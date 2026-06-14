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

// Append-only write: adds new rows after the last filled row and NEVER clears
// the tab. This makes the activity log a permanent footprint that survives
// ephemeral container restarts (e.g. on Hugging Face Spaces).
export async function appendActivityLog(
  entries: { ts: string; email: string; action: string; detail?: string }[]
): Promise<void> {
  if (entries.length === 0) return;
  await ensureTab(LOG_TAB);
  await ensureLogHeader();
  const values = entries.map((e) => [e.ts, e.email, e.action, e.detail || ""]);
  await apiFetch(
    `/values/${encodeURIComponent(LOG_TAB)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values }) }
  );
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
