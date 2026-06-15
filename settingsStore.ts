import crypto from "crypto";

/**
 * Settings store backed by a Google Spreadsheet.
 *
 * The "settings" spreadsheet is SEPARATE from the student-data spreadsheet.
 * It holds access control in three tabs: `Admin`, `Teacher`, `Staff`.
 * Each tab has the header row:  Email | Name | Center
 *
 * Writing to a Google Sheet requires a Google Cloud **service account**:
 *   1. Create a service account + JSON key in Google Cloud Console.
 *   2. Enable the "Google Sheets API" for that project.
 *   3. Share the settings spreadsheet with the service account email (Editor).
 *   4. Provide credentials via env:
 *        SETTINGS_SPREADSHEET_ID   (defaults to the id below)
 *        GOOGLE_SERVICE_ACCOUNT_KEY = the full JSON key (stringified), OR
 *        GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *
 * If credentials are absent the app falls back to local JSON persistence and
 * all functions here become no-ops (isConfigured() returns false).
 */

export type Role = "admin" | "teacher" | "staff";
export const ROLE_TABS: Record<Role, string> = {
  admin: "Admin",
  teacher: "Teacher",
  staff: "Staff",
};

export interface SheetUser {
  email: string;
  name: string;
  center: string;
  role: Role;
}

const DEFAULT_SPREADSHEET_ID = "1zuNphm7hQd7_8WJXXSOA-J3PgEk-mN-elqLyAOPnA94";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function getCredentials(): { email: string; privateKey: string } | null {
  // Option 1: full JSON key
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed.client_email && parsed.private_key) {
        return { email: parsed.client_email, privateKey: parsed.private_key };
      }
    } catch (err) {
      console.error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON:", (err as Error).message);
    }
  }
  // Option 2: separate email + key (private key may have escaped newlines)
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (email && key) {
    return { email, privateKey: key.replace(/\\n/g, "\n") };
  }
  return null;
}

export function getSpreadsheetId(): string {
  return process.env.SETTINGS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
}

export function isConfigured(): boolean {
  return getCredentials() !== null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  const creds = getCredentials();
  if (!creds) throw new Error("Service account credentials are not configured.");

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) {
    return cachedToken.token;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: creds.email,
    scope: SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64url(signer.sign(creds.privateKey));
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return data.access_token;
}

async function apiFetch(pathAndQuery: string, init?: RequestInit): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${SHEETS_API}/${getSpreadsheetId()}${pathAndQuery}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

// Make sure the three role tabs exist; create any that are missing.
async function ensureTabs(): Promise<void> {
  const meta = await apiFetch("");
  const existing = new Set<string>((meta.sheets || []).map((s: any) => s.properties.title));
  const toCreate = Object.values(ROLE_TABS).filter((t) => !existing.has(t));
  if (toCreate.length === 0) return;
  await apiFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })),
    }),
  });
}

function normEmail(e: any): string {
  return String(e || "").trim().toLowerCase();
}

// Read every user across all three role tabs.
export async function readUsers(): Promise<SheetUser[]> {
  await ensureTabs();
  const users: SheetUser[] = [];
  for (const role of Object.keys(ROLE_TABS) as Role[]) {
    const tab = ROLE_TABS[role];
    let data: any;
    try {
      data = await apiFetch(`/values/${encodeURIComponent(tab)}!A1:C5000`);
    } catch (err) {
      console.error(`Failed to read tab ${tab}:`, (err as Error).message);
      continue;
    }
    const rows: any[][] = data.values || [];
    // Detect header row (skip it if first cell looks like "email")
    let start = 0;
    if (rows.length > 0 && /email/i.test(String(rows[0][0] || ""))) start = 1;
    for (let i = start; i < rows.length; i++) {
      const row = rows[i] || [];
      const email = normEmail(row[0]);
      if (!email) continue;
      users.push({
        email,
        name: String(row[1] || "").trim(),
        center: String(row[2] || "").trim(),
        role,
      });
    }
  }
  return users;
}

// Overwrite all three tabs with the supplied users (whole-tab rewrite = simple + reliable).
export async function writeUsers(users: SheetUser[]): Promise<void> {
  await ensureTabs();
  const grouped: Record<Role, SheetUser[]> = { admin: [], teacher: [], staff: [] };
  users.forEach((u) => {
    const role = (grouped[u.role] ? u.role : "staff") as Role;
    grouped[role].push(u);
  });

  for (const role of Object.keys(ROLE_TABS) as Role[]) {
    const tab = ROLE_TABS[role];
    const list = grouped[role];
    const values = [["Email", "Name", "Center"], ...list.map((u) => [u.email, u.name || "", u.center || ""])];

    // Clear the tab first so removed rows disappear, then write fresh values.
    await apiFetch(`/values/${encodeURIComponent(tab)}!A1:C5000:clear`, { method: "POST" });
    await apiFetch(
      `/values/${encodeURIComponent(tab)}!A1?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values }) }
    );
  }
}

/* ===== Activity Log & Notifications persistence (separate tabs) ===== */

export const LOG_TAB = "ActivityLog";
export const NOTIF_TAB = "Notifications";

// Create a tab if it doesn't already exist.
async function ensureTab(title: string): Promise<void> {
  const meta = await apiFetch("");
  const existing = new Set<string>((meta.sheets || []).map((s: any) => s.properties.title));
  if (existing.has(title)) return;
  await apiFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
}

// Whole-tab rewrite helper (clear + write).
async function rewriteTab(title: string, values: any[][], lastCol: string): Promise<void> {
  await ensureTab(title);
  await apiFetch(`/values/${encodeURIComponent(title)}!A1:${lastCol}50000:clear`, { method: "POST" });
  await apiFetch(
    `/values/${encodeURIComponent(title)}!A1?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values }) }
  );
}

export async function writeActivityLog(
  entries: { ts: string; email: string; action: string; detail?: string }[]
): Promise<void> {
  const values = [
    ["Time", "Email", "Action", "Detail"],
    ...entries.map((e) => [e.ts, e.email, e.action, e.detail || ""]),
  ];
  await rewriteTab(LOG_TAB, values, "D");
}

// Make sure the ActivityLog tab has its header row, without clobbering any
// existing data rows. Only writes the header when the sheet is empty.
async function ensureLogHeader(): Promise<void> {
  let data: any;
  try {
    data = await apiFetch(`/values/${encodeURIComponent(LOG_TAB)}!A1:D1`);
  } catch {
    data = {};
  }
  const rows: any[][] = data.values || [];
  const hasContent = rows.length > 0 && String(rows[0][0] || "").trim() !== "";
  if (!hasContent) {
    await apiFetch(`/values/${encodeURIComponent(LOG_TAB)}!A1?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [["Time", "Email", "Action", "Detail"]] }),
    });
  }
}

// Look up the numeric sheetId (gid) for a tab title — needed for row-insert ops.
async function getSheetId(title: string): Promise<number | null> {
  const meta = await apiFetch("");
  const sheet = (meta.sheets || []).find((s: any) => s.properties.title === title);
  return sheet ? sheet.properties.sheetId : null;
}

// Prepend new rows directly below the header so the NEWEST entry is always on
// top and older ones shift down. The tab is never cleared, so the full footprint
// survives ephemeral container restarts (e.g. on Hugging Face Spaces).
export async function prependActivityLog(
  entries: { ts: string; email: string; action: string; detail?: string }[]
): Promise<void> {
  if (entries.length === 0) return;
  await ensureTab(LOG_TAB);
  await ensureLogHeader();

  // Within this batch, write newest first (caller passes oldest -> newest).
  const ordered = [...entries].reverse();
  const values = ordered.map((e) => [e.ts, e.email, e.action, e.detail || ""]);

  const sheetId = await getSheetId(LOG_TAB);
  if (sheetId == null) {
    // Fallback: append to the bottom if we can't resolve the sheetId.
    await apiFetch(
      `/values/${encodeURIComponent(LOG_TAB)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values }) }
    );
    return;
  }

  // Insert N blank rows right after the header row (0-based index 1), shifting
  // existing data down, then fill the new rows.
  await apiFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 1 + values.length },
            inheritFromBefore: false,
          },
        },
      ],
    }),
  });

  await apiFetch(`/values/${encodeURIComponent(LOG_TAB)}!A2?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });
}

// Read the persisted activity log back from the sheet (used on startup so the
// admin panel shows full history even after the in-memory state was reset).
export async function readActivityLog(
  limit = 5000
): Promise<{ ts: string; email: string; action: string; detail?: string }[]> {
  await ensureTab(LOG_TAB);
  let data: any;
  try {
    data = await apiFetch(`/values/${encodeURIComponent(LOG_TAB)}!A1:D50000`);
  } catch {
    return [];
  }
  const rows: any[][] = data.values || [];
  let start = 0;
  if (rows.length > 0 && /time/i.test(String(rows[0][0] || ""))) start = 1;
  const out: { ts: string; email: string; action: string; detail?: string }[] = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i] || [];
    const ts = String(r[0] || "").trim();
    const email = String(r[1] || "").trim();
    if (!ts && !email) continue;
    out.push({ ts, email, action: String(r[2] || "").trim(), detail: String(r[3] || "").trim() });
  }
  // Keep the most recent `limit` entries (rows may be chronological or not).
  return out.slice(-limit);
}

export async function writeNotifications(
  notifs: { ts: string; type: string; title: string; message: string; read: boolean }[]
): Promise<void> {
  const values = [
    ["Time", "Type", "Title", "Message", "Read"],
    ...notifs.map((n) => [n.ts, n.type, n.title, n.message, n.read ? "yes" : "no"]),
  ];
  await rewriteTab(NOTIF_TAB, values, "E");
}

/* ===== TimetableConfig persistence (Google Sheet tab) ===== */

export const TIMETABLE_CONFIG_TAB = "TimetableConfig";

export interface TimetableConfigEntry {
  sheetName: string;
  sheetLink: string;
}

/**
 * Read all timetable config entries from the TimetableConfig tab.
 * Columns: A = Sheet Name, B = Sheet Link
 * Returns rows sorted in order.
 */
export async function readTimetableConfig(): Promise<TimetableConfigEntry[]> {
  await ensureTab(TIMETABLE_CONFIG_TAB);
  let data: any;
  try {
    data = await apiFetch(`/values/${encodeURIComponent(TIMETABLE_CONFIG_TAB)}!A1:B100`);
  } catch {
    return [];
  }
  const rows: any[][] = data.values || [];
  let start = 0;
  // Skip header row
  if (rows.length > 0 && /name|sheet/i.test(String(rows[0][0] || ""))) start = 1;
  const entries: TimetableConfigEntry[] = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i] || [];
    const sheetName = String(r[0] || "").trim();
    const sheetLink = String(r[1] || "").trim();
    if (!sheetName && !sheetLink) continue;
    entries.push({ sheetName, sheetLink });
  }
  return entries;
}

/**
 * Write/update timetable config entries.
 * Fully rewrites the tab.
 */
export async function writeTimetableConfig(entries: TimetableConfigEntry[]): Promise<void> {
  const values = [
    ["Sheet Name", "Sheet Link"],
    ...entries.map((e) => [e.sheetName, e.sheetLink]),
  ];
  await rewriteTab(TIMETABLE_CONFIG_TAB, values, "B");
}

/**
 * Ensure TimetableConfig tab has header, without overwriting data.
 */
export async function ensureTimetableConfigHeader(): Promise<void> {
  await ensureTab(TIMETABLE_CONFIG_TAB);
  let data: any;
  try {
    data = await apiFetch(`/values/${encodeURIComponent(TIMETABLE_CONFIG_TAB)}!A1:B1`);
  } catch {
    data = {};
  }
  const rows: any[][] = data.values || [];
  const hasContent = rows.length > 0 && String(rows[0][0] || "").trim() !== "";
  if (!hasContent) {
    await apiFetch(
      `/values/${encodeURIComponent(TIMETABLE_CONFIG_TAB)}!A1?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: [["Sheet Name", "Sheet Link"]] }) }
    );
  }
}

/* ===== Timetable Spreadsheet helpers (separate sheet) ===== */

/**
 * The timetable data lives in a DIFFERENT spreadsheet than the settings one.
 * This spreadsheet ID is the one containing Faculty Details, weekly grids, etc.
 */
const TIMETABLE_SPREADSHEET_ID = "1EChiZIoa53KhaZSELkBrIpuTgyBqJf1PVl28y2BcS7g";

/**
 * Like apiFetch, but targets an arbitrary spreadsheet by ID rather than
 * the default settings spreadsheet.
 */
async function timetableApiFetch(
  spreadsheetId: string,
  pathAndQuery: string,
  init?: RequestInit,
): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}${pathAndQuery}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── Faculty Details ─────────────────────────────────────────────────────

export interface FacultyMember {
  pwId: string;
  name: string;
  email: string;
  code: string;         // e.g., CRA, MBH
  division: string;     // JEE, NEET, Foundation
  subject: string;      // Physics, Chemistry, etc.
  designation: string;
  status: string;       // Active / Inactive
  teacherId: string;
  qualification: string;
  photoUrl: string;
  batches: string[];    // Up to 6 assigned batches
}

/**
 * Read the "Faculty Details" tab (GID 891757177) from the timetable spreadsheet.
 *
 * CSV columns (A-Q):
 *   PWID, Faculty Name, Official Email, Faculty Code, Division, Subject,
 *   Designation, Status, Teacher_ID, Highest Qualification, Photo URL,
 *   Batch 1, Batch 2, Batch 3, Batch 4, Batch 5, Batch 6
 */
export async function readFacultyDetails(
  spreadsheetId: string = TIMETABLE_SPREADSHEET_ID,
): Promise<FacultyMember[]> {
  const tab = "Faculty Details";
  let data: any;
  try {
    data = await timetableApiFetch(
      spreadsheetId,
      `/values/${encodeURIComponent(tab)}!A1:Q500`,
    );
  } catch (err) {
    console.error(`[readFacultyDetails] Failed to read tab "${tab}":`, (err as Error).message);
    throw err;
  }

  const rows: any[][] = data.values || [];
  // Skip header row if present
  let start = 0;
  if (rows.length > 0 && /pw\s*id|faculty/i.test(String(rows[0][0] || ""))) start = 1;

  const members: FacultyMember[] = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i] || [];
    const pwId = String(r[0] || "").trim();
    const name = String(r[1] || "").trim();
    if (!pwId && !name) continue; // skip empty rows

    // Collect up to 6 batches (columns L through Q, indices 11-16)
    const batches: string[] = [];
    for (let b = 11; b <= 16; b++) {
      const val = String(r[b] || "").trim();
      if (val) batches.push(val);
    }

    members.push({
      pwId,
      name,
      email: String(r[2] || "").trim(),
      code: String(r[3] || "").trim(),
      division: String(r[4] || "").trim(),
      subject: String(r[5] || "").trim(),
      designation: String(r[6] || "").trim(),
      status: String(r[7] || "").trim(),
      teacherId: String(r[8] || "").trim(),
      qualification: String(r[9] || "").trim(),
      photoUrl: String(r[10] || "").trim(),
      batches,
    });
  }

  return members;
}

// ── Write timetable to sheet ────────────────────────────────────────────

// ── Room Number Lookup from Latest Sheet ─────────────────────────────────

/**
 * Read batch → room mappings from the latest (most recent) timetable tab.
 * Reads rows 1-2: header row has batch codes, row 2 has "Room No" and room values.
 * Returns: Record<batchCode, roomNumber>
 */
export async function readLatestSheetRooms(
  spreadsheetId: string = TIMETABLE_SPREADSHEET_ID,
): Promise<Record<string, string>> {
  // 1. Get all sheet names to find the latest tab
  const metaRes = await timetableApiFetch(spreadsheetId, "?fields=sheets.properties.title");
  const sheets: { properties: { title: string } }[] = metaRes.sheets || [];
  
  // Filter out system tabs (Faculty Details, Settings, etc.)
  const timetableTabs = sheets
    .map(s => s.properties.title)
    .filter(t => !["Faculty Details", "Settings", "Activity Log", "Notifications", "Timetable Config"].includes(t));
  
  if (timetableTabs.length === 0) return {};
  
  // Pick the LAST tab (most recent timetable)
  const latestTab = timetableTabs[timetableTabs.length - 1];
  
  // 2. Read first 2 rows (header + rooms)
  const dataRes = await timetableApiFetch(
    spreadsheetId,
    `/values/${encodeURIComponent(latestTab)}!A1:BZ3?majorDimension=ROWS`,
  );
  const rows: string[][] = dataRes.values || [];
  if (rows.length < 2) return {};

  // Find header row (the one with batch codes starting with "27-")
  let headerRow: string[] = [];
  let roomRow: string[] = [];
  
  for (let i = 0; i < Math.min(rows.length, 3); i++) {
    if (rows[i].some(c => (c || "").trim().startsWith("27-"))) {
      headerRow = rows[i];
      // Room row is the next one
      if (i + 1 < rows.length) roomRow = rows[i + 1];
      break;
    }
  }
  
  if (headerRow.length === 0) return {};

  // 3. Build batch → room map
  const rooms: Record<string, string> = {};
  for (let c = 0; c < headerRow.length; c++) {
    const batch = (headerRow[c] || "").trim();
    if (!batch.startsWith("27-")) continue;
    
    const room = (roomRow[c] || "").trim();
    if (!room || room.toLowerCase() === "room no" || room.toLowerCase() === "room no.") continue;
    
    rooms[batch] = room;
  }
  
  return rooms;
}

/**
 * Colour constants for timetable formatting (RGB 0-1 scale for Sheets API).
 */
function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const h = hex.replace("#", "");
  return {
    red: parseInt(h.substring(0, 2), 16) / 255,
    green: parseInt(h.substring(2, 4), 16) / 255,
    blue: parseInt(h.substring(4, 6), 16) / 255,
  };
}

const COLORS = {
  HEADER:  hexToRgb("#FFFF00"),  // Yellow — batch name row
  ROOM:    hexToRgb("#FF00FF"),  // Magenta — room row
  MON:     hexToRgb("#FF8C00"),  // Orange
  TUE:     hexToRgb("#9933FF"),  // Purple
  WED:     hexToRgb("#00CC00"),  // Green
  THU:     hexToRgb("#00BFFF"),  // Cyan
  FRI:     hexToRgb("#FF3366"),  // Pink
  SAT:     hexToRgb("#CC0000"),  // Red
  SEP:     hexToRgb("#00FF00"),  // Green — JEE/NEET separator
  HOLIDAY: hexToRgb("#FFFF00"),  // Yellow
  WHITE:   hexToRgb("#FFFFFF"),  // Normal cells
} as const;

const DAY_COLORS: Record<string, typeof COLORS.MON> = {
  MONDAY:    COLORS.MON,
  TUESDAY:   COLORS.TUE,
  WEDNESDAY: COLORS.WED,
  THURSDAY:  COLORS.THU,
  FRIDAY:    COLORS.FRI,
  SATURDAY:  COLORS.SAT,
};

/**
 * Grid cell for writing to the sheet.
 */
export interface TimetableGridCell {
  value: string;
  color?: "HEADER" | "ROOM" | "DAY" | "SEP" | "HOLIDAY" | "WHITE";
  day?: string; // used to look up the actual day colour when color === "DAY"
}

/**
 * Write a generated timetable to the timetable spreadsheet as a new tab
 * with full colour formatting.
 *
 * @param spreadsheetId  The timetable spreadsheet ID
 * @param tabName        The new tab name, e.g. "15th-20th June 2026"
 * @param grid           2D array of grid cells (rows × columns)
 */
export async function writeTimetableToSheet(
  spreadsheetId: string = TIMETABLE_SPREADSHEET_ID,
  tabName: string,
  grid: TimetableGridCell[][],
): Promise<{ sheetId: number }> {
  // 1. Create the new tab
  const createRes = await timetableApiFetch(spreadsheetId, ":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: tabName,
              gridProperties: {
                rowCount: Math.max(grid.length, 1),
                columnCount: Math.max(grid[0]?.length || 1, 1),
              },
            },
          },
        },
      ],
    }),
  });

  const newSheetId: number = createRes.replies[0].addSheet.properties.sheetId;

  // 2. Write cell values
  const values = grid.map((row) => row.map((cell) => cell.value));
  await timetableApiFetch(
    spreadsheetId,
    `/values/${encodeURIComponent(tabName)}!A1?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values }) },
  );

  // 3. Build formatting requests (one repeatCell per cell that needs colour)
  const formatRequests: any[] = [];

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      let bgColor = COLORS.WHITE;

      if (cell.color === "HEADER")       bgColor = COLORS.HEADER;
      else if (cell.color === "ROOM")    bgColor = COLORS.ROOM;
      else if (cell.color === "SEP")     bgColor = COLORS.SEP;
      else if (cell.color === "HOLIDAY") bgColor = COLORS.HOLIDAY;
      else if (cell.color === "DAY" && cell.day) {
        bgColor = DAY_COLORS[cell.day] || COLORS.WHITE;
      }

      // Only emit a request if the colour isn't plain white (optimisation)
      if (bgColor !== COLORS.WHITE) {
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId: newSheetId,
              startRowIndex: r,
              endRowIndex: r + 1,
              startColumnIndex: c,
              endColumnIndex: c + 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: bgColor,
              },
            },
            fields: "userEnteredFormat.backgroundColor",
          },
        });
      }
    }
  }

  // Send formatting in a single batchUpdate (Sheets API allows up to 100k requests)
  if (formatRequests.length > 0) {
    // Batch in chunks of 5000 to stay well within limits
    for (let i = 0; i < formatRequests.length; i += 5000) {
      const chunk = formatRequests.slice(i, i + 5000);
      await timetableApiFetch(spreadsheetId, ":batchUpdate", {
        method: "POST",
        body: JSON.stringify({ requests: chunk }),
      });
    }
  }

  return { sheetId: newSheetId };
}

