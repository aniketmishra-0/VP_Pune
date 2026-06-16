import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as XLSX from "xlsx";
import crypto from "crypto";
import fs from "fs";
import cookieParser from "cookie-parser";
import "dotenv/config";
import * as settingsStore from "./settingsStore";
import type { Role } from "./settingsStore";
import { generateTimetable, aiResolveConflicts, setHistoricalPatterns, getPatternStats, buildPatternsFromSheetData, type GeneratorConfig, type GeneratedSlot, type BatchInfo } from "./timetableGenerator";

const app = express();
app.use(cookieParser());
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Security variables and token generation ciphers
const SHARE_SECRET = process.env.SHARE_SECRET || "pune_pcmc_academic_salt_2026_super_secret_key";

function generateShareToken(regNo: string): string {
  return crypto.createHmac("sha256", SHARE_SECRET).update(regNo).digest("hex").slice(0, 16);
}

function generateStaffToken(email: string): string {
  return crypto.createHmac("sha256", SHARE_SECRET).update(email).digest("hex");
}

const CONFIG_PATH = path.join(process.cwd(), "config.json");

interface SavedConfig {
  SPREADSHEET_URL?: string;
  SPREADSHEET_CENTERS?: Record<string, string>;
  SUBSHEET_CENTERS?: Record<string, string[]>;
  STAFF_ACCESS?: Record<string, string[]>;
}

function getAppConfig(): SavedConfig {
  let fileConfig: SavedConfig = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to parse config.json:", e);
  }
  return fileConfig;
}

function normalizeSpreadsheetUrl(url: string): string {
  let cleanUrl = url.trim();
  if (!cleanUrl) return "";
  
  // Case 1: Published pubhtml link
  if (cleanUrl.includes("docs.google.com/spreadsheets/d/e/")) {
    if (cleanUrl.endsWith("/pubhtml")) {
      return cleanUrl.replace(/\/pubhtml$/, "/pub?output=xlsx");
    }
    if (cleanUrl.includes("/pubhtml?")) {
      return cleanUrl.split("/pubhtml?")[0] + "/pub?output=xlsx";
    }
    if (cleanUrl.includes("/pub") && !cleanUrl.includes("output=xlsx")) {
      const baseUrl = cleanUrl.split("/pub")[0] + "/pub";
      return `${baseUrl}?output=xlsx`;
    }
    return cleanUrl;
  }
  
  // Case 2: Regular edit link
  const editMatch = cleanUrl.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (editMatch) {
    const spreadsheetId = editMatch[1];
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
  }
  
  return cleanUrl;
}

function getSpreadsheetUrls(): string[] {
  const config = getAppConfig();
  const envUrl = process.env.SPREADSHEET_URL || "";
  const configUrl = config.SPREADSHEET_URL || "";
  
  const combined = [
    ...envUrl.split(",").map(u => u.trim()),
    ...configUrl.split(",").map(u => u.trim())
  ].filter(Boolean);
  
  const normalized = combined.map(u => normalizeSpreadsheetUrl(u)).filter(Boolean);
  return Array.from(new Set(normalized));
}

function getSpreadsheetCenters(): Record<string, string> {
  const config = getAppConfig();
  let envCenters: Record<string, string> = {};
  if (process.env.SPREADSHEET_CENTERS) {
    try {
      envCenters = JSON.parse(process.env.SPREADSHEET_CENTERS);
    } catch (_) {}
  }
  const configCenters = config.SPREADSHEET_CENTERS || {};
  return { ...envCenters, ...configCenters };
}

function getSubsheetCenters(): Record<string, string[]> {
  const config = getAppConfig();
  let envSubsheets: Record<string, string[]> = {};
  if (process.env.SUBSHEET_CENTERS) {
    try {
      envSubsheets = JSON.parse(process.env.SUBSHEET_CENTERS);
    } catch (_) {}
  }
  const configSubsheets = config.SUBSHEET_CENTERS || {};
  return { ...envSubsheets, ...configSubsheets };
}

function getStaffAccess(): Record<string, string[]> {
  const config = getAppConfig();
  let envAccess: Record<string, string[]> = {};
  if (process.env.STAFF_ACCESS) {
    try {
      envAccess = JSON.parse(process.env.STAFF_ACCESS);
    } catch (_) {}
  }
  const configAccess = config.STAFF_ACCESS || {};
  return { ...envAccess, ...configAccess };
}

function splitCenters(raw: string): string[] {
  return String(raw || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

function isAllAccess(centers: string[]): boolean {
  return centers.some((c) => c === "*" || c.toLowerCase() === "all");
}

// Returns the list of centers a user is restricted to, or null for "no restriction"
// (i.e. full access — admins, or staff explicitly granted "*"/"all").
//
// Resolution order:
//   1. Admins (env/role) always get full access.
//   2. An explicit STAFF_ACCESS mapping in config.json (legacy / power override).
//   3. The center assigned to the user in the roster (Staff/Teacher tab of the
//      settings spreadsheet). This is what makes a staff member added via the
//      Staff tab see ONLY their assigned center.
//   4. No assigned center -> full access (nothing to scope by).
function getUserAllowedCenters(email: string | undefined): string[] | null {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();

  // 1. Admins are never restricted.
  if (getRoleForEmail(cleanEmail) === "admin") return null;

  // 2. Explicit STAFF_ACCESS override (config.json / env).
  const staffAccess = getStaffAccess();
  const matchedKey = Object.keys(staffAccess).find((key) => {
    const emails = key.split(",").map((e) => e.trim().toLowerCase());
    return emails.includes(cleanEmail);
  });
  if (matchedKey) {
    const centers = staffAccess[matchedKey];
    if (Array.isArray(centers)) {
      if (isAllAccess(centers)) return null;
      const list = centers.map((c) => c.trim()).filter(Boolean);
      if (list.length > 0) return list;
    }
  }

  // 3. Fall back to the center assigned in the roster (Staff/Teacher tab).
  const rosterCenters = splitCenters(getCenterForEmail(cleanEmail));
  if (rosterCenters.length > 0 && !isAllAccess(rosterCenters)) {
    return rosterCenters;
  }

  // 4. No scoping information available -> full access.
  return null;
}

// Case-insensitive check + filter so roster center labels (e.g. "Pimple Saudagar
// Tuition Center") line up with the centers resolved for each sheet even if the
// casing/spacing differs slightly.
function filterSheetsByCenters<T extends { center: string }>(
  sheets: T[],
  allowedCenters: string[] | null
): T[] {
  if (!allowedCenters) return sheets;
  const allowedSet = new Set(allowedCenters.map((c) => c.trim().toLowerCase()));
  return sheets.filter((s) => allowedSet.has(String(s.center || "").trim().toLowerCase()));
}

function verifyRequest(req: any, res: any, next: any) {
  const staffToken = req.headers["x-staff-token"];
  const userEmail = req.headers["x-user-email"];

  if (staffToken && userEmail) {
    const emailStr = String(userEmail).trim().toLowerCase();
    if (emailStr.endsWith("@pw.live") || emailStr.endsWith("@physicswallah.org")) {
      const expectedToken = generateStaffToken(emailStr);
      if (staffToken === expectedToken) {
        return next();
      }
    }
  }
  
  // If not staff, check if it's a student query with a valid share token
  if (req.path === "/api/student") {
    const regNo = req.query.query;
    const token = req.query.token;
    if (regNo && token) {
      const expectedToken = generateShareToken(String(regNo).trim());
      if (token === expectedToken) {
        return next();
      }
    }
  }

  return res.status(403).json({ error: "Access Denied: Invalid session or unauthorized link." });
}

interface MemorySheet {
  name: string;
  data: any[][];
  sourceUrl: string;
  center: string;
}

// Global cached variables
let memorySheets: MemorySheet[] = [];
let dropdowns: { batches: string[]; names: string[] } = { batches: [], names: [] };
let lastLoaded: string | null = null;
let isLoading = false;
let loadError: string | null = null;
let sheetUrlsMap: Record<string, string> = {};

// Normalization functions mirroring Google Apps Script
function normalizeHeader(h: any): string {
  if (h === null || h === undefined) return "";
  return h
    .toString()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isTestSheet(sheetName: string): boolean {
  const name = sheetName.trim().toLowerCase();
  // Exclude default sheet names (e.g. Sheet21, Sheet 1)
  if (/^sheet\s*\d+$/i.test(name)) {
    return false;
  }
  // Exclude metadata/admin sheets (e.g. BWS UPDATED, BWS TC)
  if (name.includes("bws") || name.startsWith("bws ")) {
    return false;
  }
  return true;
}

function resolveCenter(sheetName: string, sourceUrl: string): string {
  if (!sheetName) return "Pimpri PW Vidyapeeth";
  
  const cleanSheetName = sheetName.trim().toLowerCase();
  const cleanSourceUrl = String(sourceUrl || "").trim().toLowerCase();

  // Pre-baked GID to Sheet Name mapping for the default Pimpri spreadsheet
  const defaultGidToNameMap: Record<string, string> = {
    "1428738790": "03 may 11th jee city test tc",
    "1245937975": "10 may 11th jee milestone tc",
    "1827348726": "24 may 11th jee city test 2 ",
    "301379419": "31th may 11th jee milestone",
    "1616104245": "10 may 12th jee city test tc",
    "931820364": "17 may 12th jee milestone",
    "1336851460": "31 may 12th jee city test tc",
    "1773466001": "07th june 12th jee milestone",
    "794331982": "10 may 12th neet city test tc",
    "1901367772": "17 may 12th neet milestone",
    "1377849588": "31 may 12th neet city test 2",
    "1150357588": "07 june 12th neet phase 1 milestone"
  };

  // Helper to extract gid from any URL string
  const getGidFromUrl = (urlStr: string): string | null => {
    try {
      const match = urlStr.match(/[?&]gid=(\d+)/i);
      return match ? match[1] : null;
    } catch (_) {
      return null;
    }
  };

  // 1. Check SUBSHEET_CENTERS first (tab-level overrides)
  const subsheetMappings = getSubsheetCenters();
  if (Object.keys(subsheetMappings).length > 0) {
    try {
      for (const [centerName, patterns] of Object.entries(subsheetMappings)) {
        if (Array.isArray(patterns)) {
          for (const pat of patterns) {
            const cleanPat = String(pat).trim().toLowerCase();
            if (!cleanPat) continue;

            // Match by GID URL
            const patGid = getGidFromUrl(cleanPat);
            if (patGid && defaultGidToNameMap[patGid]) {
              if (cleanSheetName === defaultGidToNameMap[patGid]) {
                return centerName;
              }
            }

            // Match by Subsheet Name directly
            if (cleanSheetName === cleanPat || cleanSheetName.includes(cleanPat)) {
              return centerName;
            }
          }
        }
      }
    } catch (e) {
      console.error("Error matching SUBSHEET_CENTERS mappings:", e);
    }
  }

  // 2. Default fallback for the 12 default subsheets mapping to Pimple Saudagar
  // This takes priority over SPREADSHEET_CENTERS when the default workbook is used
  const isDefaultWorkbook = !cleanSourceUrl || 
                            cleanSourceUrl.includes("1ztnvtyd4wrcv9bthqi1ek-nh8tsieszw5ifvhxtajpm") || 
                            cleanSourceUrl.includes("2pacx-1vsvei4kdmjhmimnsclebffoavbwlct9sjf1kaphus7torlfuthc7m7jk3tgx6xclqltylnxxvpfxhei");
  if (isDefaultWorkbook) {
    const defaultPimpleSaudagarSheets = Object.values(defaultGidToNameMap);
    if (defaultPimpleSaudagarSheets.some(s => cleanSheetName === s || cleanSheetName.includes(s))) {
      return "Pimple Saudagar Tuition Center";
    }
  }

  // 3. Check SPREADSHEET_CENTERS (spreadsheet file-level mappings)
  const spreadsheetMappings = getSpreadsheetCenters();
  if (Object.keys(spreadsheetMappings).length > 0) {
    try {
      for (const [urlPattern, centerName] of Object.entries(spreadsheetMappings)) {
        const cleanPat = String(urlPattern).trim().toLowerCase();
        if (cleanPat && cleanSourceUrl.includes(cleanPat)) {
          return String(centerName);
        }
      }
    } catch (e) {
      console.error("Error matching SPREADSHEET_CENTERS mappings:", e);
    }
  }

  // 4. Fallback to check legacy CENTER_MAPPINGS env variable
  if (process.env.CENTER_MAPPINGS) {
    try {
      const mappings = JSON.parse(process.env.CENTER_MAPPINGS);
      for (const [centerName, patterns] of Object.entries(mappings)) {
        if (Array.isArray(patterns)) {
          for (const pat of patterns) {
            const cleanPat = String(pat).trim().toLowerCase();
            if (!cleanPat) continue;

            const patGid = getGidFromUrl(cleanPat);
            if (patGid && defaultGidToNameMap[patGid]) {
              if (cleanSheetName === defaultGidToNameMap[patGid]) {
                return centerName;
              }
            }

            if (cleanSourceUrl.includes(cleanPat)) {
              return centerName;
            }

            if (cleanSheetName === cleanPat || cleanSheetName.includes(cleanPat)) {
              return centerName;
            }
          }
        }
      }
    } catch (e) {
      console.error("Error parsing CENTER_MAPPINGS env var:", e);
    }
  }

  // 5. Check if PIMPLE_SAUDAGAR_SHEETS env variable exists
  if (process.env.PIMPLE_SAUDAGAR_SHEETS) {
    const sheets = process.env.PIMPLE_SAUDAGAR_SHEETS.split(",").map(s => s.trim().toLowerCase());
    for (const s of sheets) {
      if (!s) continue;
      const sGid = getGidFromUrl(s);
      if (sGid && defaultGidToNameMap[sGid]) {
        if (cleanSheetName === defaultGidToNameMap[sGid]) {
          return "Pimple Saudagar Tuition Center";
        }
      }
      if (cleanSheetName === s || cleanSheetName.includes(s)) {
        return "Pimple Saudagar Tuition Center";
      }
    }
  }

  // 6. Global default fallback for default subsheets (even if sourceUrl check didn't catch it)
  const defaultPimpleSaudagarSheets = Object.values(defaultGidToNameMap);
  if (defaultPimpleSaudagarSheets.some(s => cleanSheetName === s || cleanSheetName.includes(s))) {
    return "Pimple Saudagar Tuition Center";
  }

  return "Pimpri PW Vidyapeeth";
}

function expandTestName(name: string): string {
  if (!name) return "Test";
  const clean = name.trim();
  const upper = clean.toUpperCase();
  
  // Match trailing numbers like " 1", " 2", etc.
  const matchNum = clean.match(/\s+(\d+)$/);
  const suffix = matchNum ? ` ${matchNum[1]}` : "";
  
  // Strip trailing number for base matching
  const base = (matchNum ? clean.substring(0, clean.length - matchNum[0].length) : clean).trim();
  const baseUpper = base.toUpperCase();
  
  if (baseUpper === "PRACTI" || baseUpper === "PRAC" || baseUpper === "PRACTISE" || baseUpper === "PRACTICE") {
    return `Practice Test${suffix}`;
  }
  if (baseUpper === "CITY T" || baseUpper === "CITY_T" || baseUpper === "CITY" || baseUpper === "CITYTEST" || baseUpper === "CITY TEST") {
    return `City Test${suffix}`;
  }
  if (baseUpper === "MILEST" || baseUpper === "MILE" || baseUpper === "MILES" || baseUpper === "MILESTONE") {
    return `Milestone Test${suffix}`;
  }
  if (baseUpper === "GAT" || baseUpper === "GAT EXAM") {
    return `GAT Exam${suffix}`;
  }
  
  // Dynamic fallback regexes
  if (/^practi/i.test(clean)) {
    return `Practice Test${suffix}`;
  }
  if (/^city\s*t/i.test(clean) || /^city/i.test(clean)) {
    return `City Test${suffix}`;
  }
  if (/^milest/i.test(clean) || /^mile/i.test(clean)) {
    return `Milestone Test${suffix}`;
  }
  
  return clean;
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseBatchInfo(batch: string): { stream: string; class: string } | null {
  if (!batch) return null;
  const cleanBatch = batch.toUpperCase().trim();
  
  // Try to match a 2-letter alphabetic prefix that may follow a class year prefix like "27-", "21-" etc.
  const match = cleanBatch.match(/^(?:\d+[-\s]*)?([A-Z]{2})/);
  if (match) {
    const code = match[1];
    switch (code) {
      case "AJ": return { stream: "JEE", class: "11th JEE" };
      case "AN": return { stream: "NEET", class: "11th NEET" };
      case "LJ": return { stream: "JEE", class: "12th JEE" };
      case "LN": return { stream: "NEET", class: "12th NEET" };
      case "YA": return { stream: "NEET", class: "Dropper NEET" };
      case "YN": return { stream: "NEET", class: "Dropper NEET" };
      case "PJ": return { stream: "JEE", class: "Dropper JEE" };
      case "UF": return { stream: "Foundation", class: "10th" };
      case "NF": return { stream: "Foundation", class: "9th" };
      case "UP": return { stream: "Foundation", class: "8th" };
    }
  }

  // Look for the codes as substrings anywhere in the batch string (for flexibility)
  const codes = {
    "AJ": { stream: "JEE", class: "11th JEE" },
    "AN": { stream: "NEET", class: "11th NEET" },
    "LJ": { stream: "JEE", class: "12th JEE" },
    "LN": { stream: "NEET", class: "12th NEET" },
    "YA": { stream: "NEET", class: "Dropper NEET" },
    "YN": { stream: "NEET", class: "Dropper NEET" },
    "PJ": { stream: "JEE", class: "Dropper JEE" },
    "UF": { stream: "Foundation", class: "10th" },
    "NF": { stream: "Foundation", class: "9th" },
    "UP": { stream: "Foundation", class: "8th" }
  };

  for (const [code, info] of Object.entries(codes)) {
    const regex = new RegExp(`(?:^|\\d+|[^A-Z])${code}(?:\\d+|[^A-Z]|$)`, "i");
    if (regex.test(cleanBatch)) {
      return info;
    }
  }

  return null;
}

function detectStreamAndClass(batch: string, subjects: string[] = []): { stream: string; class: string } {
  // First try the strict code-based extraction
  const mapped = parseBatchInfo(batch);
  if (mapped) return mapped;

  const cleanBatch = (batch || "").toUpperCase().trim();

  // If subjects are available, let's use them as strong indicators
  const lowerSubs = subjects.map((s) => s.toLowerCase().trim());
  const hasBotanyOrZoology = lowerSubs.some(s => s.includes("botany") || s.includes("zoology"));
  const hasMaths = lowerSubs.some(s => s.includes("math") || s.includes("mathematics"));
  const hasFoundation = lowerSubs.some(s => s.includes("science") || s.includes("sst") || s.includes("social studies") || s.includes("mat") || s.includes("mental ability") || s.includes("english"));

  if (hasBotanyOrZoology) {
    let className = "NEET";
    if (cleanBatch.includes("11")) className = "11th NEET";
    else if (cleanBatch.includes("12")) className = "12th NEET";
    else if (cleanBatch.includes("DROP") || cleanBatch.includes("Y")) className = "Dropper NEET";
    return { stream: "NEET", class: className };
  }

  if (hasMaths && !hasFoundation) {
    let className = "JEE";
    if (cleanBatch.includes("11")) className = "11th JEE";
    else if (cleanBatch.includes("12")) className = "12th JEE";
    else if (cleanBatch.includes("DROP") || cleanBatch.includes("P")) className = "Dropper JEE";
    return { stream: "JEE", class: className };
  }

  if (hasFoundation) {
    let className = "Foundation";
    if (cleanBatch.includes("10") || cleanBatch.includes("UF")) className = "10th";
    else if (cleanBatch.includes("9") || cleanBatch.includes("NF")) className = "9th";
    else if (cleanBatch.includes("8") || cleanBatch.includes("UP")) className = "8th";
    return { stream: "Foundation", class: className };
  }

  // Fallback to substring detection on batch name
  if (cleanBatch.includes("NEET") || cleanBatch.includes("MED") || cleanBatch.includes("BIO")) {
    let className = "NEET";
    if (cleanBatch.includes("11")) className = "11th NEET";
    else if (cleanBatch.includes("12")) className = "12th NEET";
    else if (cleanBatch.includes("DROP")) className = "Dropper NEET";
    return { stream: "NEET", class: className };
  }

  if (cleanBatch.includes("JEE") || cleanBatch.includes("ENGG")) {
    let className = "JEE";
    if (cleanBatch.includes("11")) className = "11th JEE";
    else if (cleanBatch.includes("12")) className = "12th JEE";
    else if (cleanBatch.includes("DROP")) className = "Dropper JEE";
    return { stream: "JEE", class: className };
  }

  if (cleanBatch.includes("FND") || cleanBatch.includes("FOUNDATION") || /CLASS\s*[6789]/i.test(cleanBatch)) {
    let className = "Foundation";
    if (cleanBatch.includes("10")) className = "10th";
    else if (cleanBatch.includes("9")) className = "9th";
    else if (cleanBatch.includes("8")) className = "8th";
    return { stream: "Foundation", class: className };
  }

  // Check any default numbers for class-level matching
  if (cleanBatch.includes("UF") || /10\s*(?:TH)?/i.test(cleanBatch)) {
    return { stream: "Foundation", class: "10th" };
  }
  if (cleanBatch.includes("NF") || /9\s*(?:TH)?/i.test(cleanBatch)) {
    return { stream: "Foundation", class: "9th" };
  }
  if (cleanBatch.includes("UP") || /8\s*(?:TH)?/i.test(cleanBatch)) {
    return { stream: "Foundation", class: "8th" };
  }

  return { stream: "JEE", class: "JEE" };
}

const MONTHS_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

function parseSheetDate(sheetName: string) {
  const match = sheetName.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)/i);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2].toLowerCase();
    const month = MONTHS_MAP[monthStr] || 0;
    return { month, day };
  }
  return { month: 0, day: 0 };
}

function sortSheetNamesDescending(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const dateA = parseSheetDate(a);
    const dateB = parseSheetDate(b);
    if (dateA.month !== dateB.month) {
      return dateB.month - dateA.month;
    }
    return dateB.day - dateA.day;
  });
}

function getSheetDirectUrl(sourceUrl: string, sheetName: string, gid?: string): string {
  if (sourceUrl.includes("/d/e/2PACX-")) {
    const baseUrl = sourceUrl.split("/pub")[0];
    if (gid) {
      return `${baseUrl}/pubhtml?gid=${gid}`;
    }
    return `${baseUrl}/pubhtml`;
  }

  const match = sourceUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    const spreadsheetId = match[1];
    const editBase = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    if (gid) {
      return `${editBase}#gid=${gid}`;
    }
    // Fallback when the GID lookup failed: Google Sheets honours the
    // ?range='SheetName'!A1 parameter and switches to that tab on load.
    if (sheetName) {
      const escaped = sheetName.replace(/'/g, "''");
      return `${editBase}?range=${encodeURIComponent(`'${escaped}'!A1`)}`;
    }
    return editBase;
  }

  return sourceUrl;
}

async function fetchSheetGids(url: string): Promise<Record<string, string>> {
  const gidsMap: Record<string, string> = {};

  // Both /pubhtml (published-to-web) and /htmlview (anyone-with-link viewable)
  // pages embed the same `items.push({name: "...", pageUrl: "...", gid: "..."})`
  // JS pattern, so we can scan either with the same regex.
  const candidateUrls: string[] = [];
  if (url.includes("/d/e/2PACX-")) {
    const baseUrl = url.split("/pub")[0];
    candidateUrls.push(`${baseUrl}/pubhtml`);
  } else {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      const id = match[1];
      // Try pubhtml first (covers sheets that ARE published to web), then
      // fall back to htmlview which works for plain "Anyone with link" sheets.
      candidateUrls.push(`https://docs.google.com/spreadsheets/d/${id}/pubhtml`);
      candidateUrls.push(`https://docs.google.com/spreadsheets/d/${id}/htmlview`);
    }
  }

  const regex = /name:\s*"((?:[^"\\]|\\.)*)",\s*pageUrl:\s*"[^"]*",\s*gid:\s*"([^"]+)"/g;

  for (const candidate of candidateUrls) {
    try {
      console.log(`Fetching sheet/GID mapping from: ${candidate}`);
      const res = await fetch(candidate, { redirect: "follow" });
      if (!res.ok) {
        console.warn(`GID source ${candidate} returned HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      let m;
      while ((m = regex.exec(text)) !== null) {
        const name = m[1]
          .replace(/\\x26/g, "&")
          .replace(/\\x27/g, "'")
          .replace(/\\x22/g, '"')
          .replace(/\\x2f/g, "/")
          .replace(/\\x5c/g, "\\")
          .replace(/\\u0026/g, "&");
        gidsMap[name] = m[2];
      }
      regex.lastIndex = 0;
      if (Object.keys(gidsMap).length > 0) {
        console.log(`Parsed ${Object.keys(gidsMap).length} sheet GIDs from ${candidate}.`);
        break;
      }
    } catch (err: any) {
      console.warn(`Failed to fetch/parse GID mapping from ${candidate}:`, err.message || err);
    }
  }

  return gidsMap;
}

const nonSubjectKeywords = new Set([
  "roll no", "reg no", "student name", "name", "batch",
  "feedback", "total marks", "score", "marks", "out of", "max marks",
  "unattempted", "unattempt", "center rank", "rank", "", "rollno", "regno", "studentname", "unattempted questions"
]);

function isSubjectHeader(header: string): boolean {
  if (!header) return false;
  const norm = normalizeHeader(header);
  if (!norm) return false;
  if (nonSubjectKeywords.has(norm)) return false;
  
  // Make sure it doesn't represent other potential metadata columns
  if (
    norm.includes("email") ||
    norm.includes("phone") ||
    norm.includes("mobile") ||
    norm.includes("date") ||
    norm.includes("class") ||
    norm.includes("test")
  ) {
    return false;
  }
  return true;
}

function findHeaderRow(data: any[][]): { index: number; headers: string[] } | null {
  for (let r = 0; r < Math.min(5, data.length); r++) {
    const row = data[r];
    if (!row) continue;
    const rowStr = row.map(normalizeHeader).join(",");
    if (rowStr.includes("roll no") || rowStr.includes("reg no")) {
      return {
        index: r,
        headers: row.map(normalizeHeader),
      };
    }
  }
  return null;
}

// Background loading function
async function loadSpreadsheetData() {
  if (isLoading) return;
  isLoading = true;
  loadError = null;
  console.log("Starting spreadsheet download and load...");
  
  let urlsToLoad: string[] = getSpreadsheetUrls();
  let isUsingDefaultFallback = false;

  // If no custom URLs are provided, use the default published spreadsheet
  if (urlsToLoad.length === 0) {
    urlsToLoad = [
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVsEi4kDMjHmImNSClEBffOAvbWLCT9sjf1kapHus7torLFuthC7M7jk3Tgx6XCqLTylnXXVPFxHEI/pub?output=xlsx"
    ];
    isUsingDefaultFallback = true;
  }

  const loadedSheets: MemorySheet[] = [];
  const errorsList: string[] = [];
  let loadedCount = 0;
  const tempSheetUrlsMap: Record<string, string> = {};

  for (const url of urlsToLoad) {
    try {
      console.log(`Attempting to fetch from: ${url}`);
      const res = await fetch(url);
      if (!res.ok) {
        // Friendlier guidance for the most common Google Sheets permission failures
        if (res.status === 401 || res.status === 403) {
          throw new Error(
            `HTTP ${res.status} ${res.statusText} — the sheet is not publicly accessible. ` +
            `Open the sheet → Share → set "General access" to "Anyone with the link" (Viewer), ` +
            `or use File → Share → Publish to web and paste the /pub URL in admin settings.`
          );
        }
        if (res.status === 404) {
          throw new Error(
            `HTTP 404 Not Found — the spreadsheet ID in the URL is wrong or the sheet was deleted.`
          );
        }
        throw new Error(`HTTP Error Status: ${res.status} ${res.statusText}`);
      }
      
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("html") && !url.includes("pub?output=xlsx")) {
        throw new Error("Returned HTML/Google login redirection page instead of spreadsheet binary (Permission denied).");
      }

      const buffer = await res.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
      if (wb && wb.SheetNames && wb.SheetNames.length > 0) {
        const gidsMap = await fetchSheetGids(url);
        wb.SheetNames.forEach((sheetName) => {
          const worksheet = wb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          if (data.length >= 2) {
            loadedSheets.push({
              name: sheetName,
              data,
              sourceUrl: url,
              center: resolveCenter(sheetName, url)
            });
            const gid = gidsMap[sheetName];
            tempSheetUrlsMap[sheetName] = getSheetDirectUrl(url, sheetName, gid);
          }
        });
        loadedCount++;
        console.log(`Successfully loaded workbook from: ${url}. Added ${wb.SheetNames.length} sheets.`);
      } else {
        throw new Error("Parsed workbook is empty or has no sheets.");
      }
    } catch (err: any) {
      console.error(`Attempt failed for URL: ${url}. Error:`, err.message || err);
      errorsList.push(`${url}: ${err.message || String(err)}`);

      // If we are using the default fallback list, and the published link failed, we try the private link fallback
      if (isUsingDefaultFallback && url === urlsToLoad[0]) {
        const privateFallbackUrl = "https://docs.google.com/spreadsheets/d/1zTnVTYD4WRcV9bThQi1Ek-nh8TsIEsZW5IFvHXTajpM/export?format=xlsx";
        console.log(`Trying default private fallback URL: ${privateFallbackUrl}`);
        try {
          const fallbackRes = await fetch(privateFallbackUrl);
          if (fallbackRes.ok) {
            const fallbackBuffer = await fallbackRes.arrayBuffer();
            const fallbackWb = XLSX.read(new Uint8Array(fallbackBuffer), { type: "array" });
            const gidsMap = await fetchSheetGids(privateFallbackUrl);
            fallbackWb.SheetNames.forEach((sheetName) => {
              const worksheet = fallbackWb.Sheets[sheetName];
              const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
              if (data.length >= 2) {
                loadedSheets.push({
                  name: sheetName,
                  data,
                  sourceUrl: privateFallbackUrl,
                  center: resolveCenter(sheetName, privateFallbackUrl)
                });
                const gid = gidsMap[sheetName];
                tempSheetUrlsMap[sheetName] = getSheetDirectUrl(privateFallbackUrl, sheetName, gid);
              }
            });
            loadedCount++;
            console.log("Successfully loaded workbook from default private fallback URL.");
          } else {
            errorsList.push(`${privateFallbackUrl}: HTTP Status ${fallbackRes.status}`);
          }
        } catch (fallbackErr: any) {
          console.error(`Default private fallback failed:`, fallbackErr.message || fallbackErr);
          errorsList.push(`${privateFallbackUrl}: ${fallbackErr.message || String(fallbackErr)}`);
        }
      }
    }
  }

  if (loadedCount === 0) {
    const errorDetails = errorsList.join(" | ");
    console.error("All spreadsheet fetch attempts failed: ", errorDetails);
    loadError = "Failed to load database spreadsheet. Details: " + (errorsList[0] || "Unknown");
    isLoading = false;
    return;
  }

  try {
    memorySheets = loadedSheets;
    sheetUrlsMap = tempSheetUrlsMap;

    const validRegNos = new Set<string>();
    const batches = new Set<string>();
    const names = new Set<string>();

    memorySheets.forEach((sheetObj) => {
      const data = sheetObj.data;
      const sheetName = sheetObj.name;
      if (!isTestSheet(sheetName)) return;
      const headerInfo = findHeaderRow(data);
      if (!headerInfo) return;

      const headers = headerInfo.headers;
      const rIdx = headerInfo.index;

      const idxReg = findColumnIndex(headers, ["reg no", "roll no"]);
      const idxName = findColumnIndex(headers, ["student name", "name"]);
      const idxBatch = findColumnIndex(headers, ["batch"]);

      if (idxReg === -1) return;

      for (let i = rIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        const reg = String(row[idxReg] || "").trim();
        if (reg) {
          validRegNos.add(reg);
          if (idxName !== -1 && row[idxName] !== undefined && row[idxName] !== null) {
            const nameVal = String(row[idxName]).trim();
            if (nameVal && nameVal !== "" && nameVal.toLowerCase() !== "student name" && nameVal.toLowerCase() !== "name") {
              names.add(nameVal);
            }
          }
          if (idxBatch !== -1 && row[idxBatch] !== undefined && row[idxBatch] !== null) {
            const batchVal = String(row[idxBatch]).trim();
            if (batchVal && batchVal !== "" && batchVal.toLowerCase() !== "batch") {
              batches.add(batchVal);
            }
          }
        }
      }
    });

    dropdowns = {
      batches: Array.from(batches).filter((b) => b !== "N/A" && b !== "").sort(),
      names: Array.from(names)
        .filter((n) => n !== "")
        .sort((a, b) => {
          const aIsNA = a.includes("N/A") || a.toLowerCase() === "n/a" || a.startsWith("#");
          const bIsNA = b.includes("N/A") || b.toLowerCase() === "n/a" || b.startsWith("#");
          if (aIsNA && !bIsNA) return 1;
          if (!aIsNA && bIsNA) return -1;
          return a.localeCompare(b);
        }),
    };

    lastLoaded = fmtIST();
    console.log(`Spreadsheet successfully parsed. Sheets: ${memorySheets.length}. Batches: ${dropdowns.batches.length}. Names: ${dropdowns.names.length}.`);
  } catch (err: any) {
    console.error("Error loading spreadsheet: ", err);
    loadError = err.message || String(err);
  } finally {
    isLoading = false;
  }
}

// Initial pull on start
loadSpreadsheetData();


/* ===== ADMIN/ROLES/AUDIT SYSTEM (added) ===== */
/* ============================================================
   ROLE-BASED ACCESS, AUDIT LOG, NOTIFICATIONS & SYNC TRACKING
   ============================================================ */

interface AppUser {
  email: string;
  name?: string;
  role: Role;
  center?: string;
  addedAt: string;
  addedBy?: string;
  lastLogin?: string;
}

interface ActivityEntry {
  id: string;
  ts: string;
  email: string;
  action: string;
  detail?: string;
}

interface AppNotification {
  id: string;
  ts: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  read: boolean;
}

interface SheetSyncInfo {
  name: string;
  rows: number;
  lastSync: string;
}

interface PortalSettings {
  portalEnabled: boolean;  // Master switch for student result portal
  qrEnabled: boolean;      // Show/hide QR code on result page
  portalMessage: string;   // Custom message when portal is disabled
}

interface AppState {
  users: Record<string, AppUser>;
  activityLog: ActivityEntry[];
  notifications: AppNotification[];
  sheetSync: Record<string, SheetSyncInfo>;
  portalSettings: PortalSettings;
}

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "app-state.json");
const MAX_LOG_ENTRIES = 2000;
const MAX_NOTIFICATIONS = 500;

// Emails that are always treated as admin (comma separated env var + built-in defaults).
// Built-in defaults guarantee the owner stays admin even on ephemeral hosting
// (e.g. Cloud Run) where the persisted state file resets between deploys.
const DEFAULT_ADMIN_EMAILS = ["aniket.mishra2@pw.live"];
const ENV_ADMIN_EMAILS = Array.from(
  new Set(
    [
      ...DEFAULT_ADMIN_EMAILS,
      ...(process.env.ADMIN_EMAILS || "").split(","),
    ]
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
);

const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  portalEnabled: true,
  qrEnabled: true,
  portalMessage: "Result portal is currently disabled. Please check back later.",
};

let appState: AppState = {
  users: {},
  activityLog: [],
  notifications: [],
  sheetSync: {},
  portalSettings: { ...DEFAULT_PORTAL_SETTINGS },
};

function loadAppState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      appState = {
        users: parsed.users || {},
        activityLog: parsed.activityLog || [],
        notifications: parsed.notifications || [],
        sheetSync: parsed.sheetSync || {},
        portalSettings: { ...DEFAULT_PORTAL_SETTINGS, ...(parsed.portalSettings || {}) },
      };
      console.log(`Loaded app-state: ${Object.keys(appState.users).length} users, ${appState.activityLog.length} log entries.`);
    }
  } catch (err) {
    console.error("Failed to load app-state.json, starting fresh:", err);
  }
}

let saveTimer: NodeJS.Timeout | null = null;
function saveAppState() {
  // Debounced write to avoid hammering disk
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify(appState, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to persist app-state.json:", err);
    }
  }, 250);
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Format a Date or timestamp as readable IST: "16 Jun 2026, 03:48 PM" */
function fmtIST(d?: Date | number | string): string {
  const date = d ? new Date(d) : new Date();
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function logActivity(email: string, action: string, detail?: string) {
  const entry: ActivityEntry = {
    id: genId(),
    ts: fmtIST(),
    email: email || "unknown",
    action,
    detail,
  };
  appState.activityLog.unshift(entry);
  if (appState.activityLog.length > MAX_LOG_ENTRIES) {
    appState.activityLog = appState.activityLog.slice(0, MAX_LOG_ENTRIES);
  }
  // Queue for append-only persistence to the settings sheet (permanent footprint).
  pendingLogRows.push(entry);
  saveAppState();
  flushLogsToSheet();
}

function pushNotification(type: AppNotification["type"], title: string, message: string) {
  appState.notifications.unshift({
    id: genId(),
    ts: fmtIST(),
    type,
    title,
    message,
    read: false,
  });
  if (appState.notifications.length > MAX_NOTIFICATIONS) {
    appState.notifications = appState.notifications.slice(0, MAX_NOTIFICATIONS);
  }
  saveAppState();
  flushNotificationsToSheet();
}

function getRoleForEmail(email: string): Role {
  const e = (email || "").trim().toLowerCase();
  if (!e) return "staff";
  if (ENV_ADMIN_EMAILS.includes(e)) return "admin";
  const user = appState.users[e];
  return user ? user.role : "staff";
}

// Super-admin = built-in/env admins only (code-defined, cannot be granted or removed via the sheet/panel).
function isSuperAdmin(email: string): boolean {
  return ENV_ADMIN_EMAILS.includes((email || "").trim().toLowerCase());
}

// Express middleware: allow only super-admins (use AFTER verifyRequest, which validates the token).
function superAdminOnly(req: any, res: any, next: any) {
  const email = String(req.headers["x-user-email"] || "").trim().toLowerCase();
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: "Super-admin access required." });
  }
  next();
}

function getCenterForEmail(email: string): string {
  const e = (email || "").trim().toLowerCase();
  const user = appState.users[e];
  return user?.center || "";
}

// Ensure a user exists. The very first user to ever sign in becomes the super-admin.
function ensureUser(email: string, name?: string): AppUser {
  const e = (email || "").trim().toLowerCase();
  let user = appState.users[e];
  if (!user) {
    const isFirstEver = Object.keys(appState.users).length === 0;
    const role: Role = ENV_ADMIN_EMAILS.includes(e) || isFirstEver ? "admin" : "staff";
    user = {
      email: e,
      name: name || "",
      role,
      center: "",
      addedAt: fmtIST(),
      addedBy: isFirstEver ? "system (first login)" : "self-signup",
    };
    appState.users[e] = user;
    saveAppState();
    flushUsersToSheet();
  } else if (name && !user.name) {
    user.name = name;
    saveAppState();
    flushUsersToSheet();
  }
  // Env admins are always elevated
  if (ENV_ADMIN_EMAILS.includes(e) && user.role !== "admin") {
    user.role = "admin";
    saveAppState();
    flushUsersToSheet();
  }
  return user;
}

// Express middleware-style guard: returns the requesting admin user or null (and sends 403)
function requireAdmin(req: express.Request, res: express.Response): AppUser | null {
  const email = String(req.header("x-user-email") || "").trim().toLowerCase();
  if (!email) {
    res.status(401).json({ error: "Authentication required (missing user identity)." });
    return null;
  }
  // Verify the staff token (same HMAC scheme as verifyRequest) so x-user-email can't be spoofed
  const staffToken = String(req.header("x-staff-token") || "");
  const domainOk = email.endsWith("@pw.live") || email.endsWith("@physicswallah.org");
  if (!domainOk || !staffToken || staffToken !== generateStaffToken(email)) {
    res.status(403).json({ error: "Access denied. Invalid session token." });
    return null;
  }
  const role = getRoleForEmail(email);
  if (role !== "admin") {
    res.status(403).json({ error: "Access denied. Admin privileges required." });
    return null;
  }
  return appState.users[email] || { email, role: "admin", addedAt: fmtIST() };
}

/* ---- Google Sheets settings store integration (separate from student data) ---- */

let flushTimer: NodeJS.Timeout | null = null;

// Push the current user roster to the settings spreadsheet (debounced, best-effort).
function flushUsersToSheet() {
  if (!settingsStore.isConfigured()) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(async () => {
    try {
      const users = Object.values(appState.users).map((u) => ({
        email: u.email,
        name: u.name || "",
        center: u.center || "",
        role: u.role,
      }));
      await settingsStore.writeUsers(users);
    } catch (err) {
      console.error("Failed to flush users to settings sheet:", (err as Error).message);
      pushNotification("warning", "Settings sheet write failed", (err as Error).message);
    }
  }, 400);
}

// Mirror Staff Access Control (ACL) entries into the user roster.
// Each ACL key may hold several comma-separated emails; each becomes a "staff"
// user whose `center` reflects the allowed centers ("" = full access via "*").
// We never downgrade an existing admin/teacher — only fill in missing users
// or refresh the center on someone who is already staff.
function syncStaffAccessToRoster(staffAccess: Record<string, string[]>, addedBy: string) {
  let changed = false;

  for (const [key, centersRaw] of Object.entries(staffAccess)) {
    const centers = Array.isArray(centersRaw) ? centersRaw.map((c) => String(c).trim()).filter(Boolean) : [];
    const isFullAccess = centers.length === 0 || centers.some((c) => c === "*" || c.toLowerCase() === "all");
    const centerLabel = isFullAccess ? "" : centers.join(", ");

    const emails = key
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    for (const email of emails) {
      const existing = appState.users[email];
      if (existing) {
        // Don't touch admins/teachers; just keep staff centers in sync.
        if (existing.role === "staff" && existing.center !== centerLabel) {
          existing.center = centerLabel;
          changed = true;
        }
      } else {
        appState.users[email] = {
          email,
          role: "staff",
          center: centerLabel,
          addedAt: fmtIST(),
          addedBy,
        };
        changed = true;
      }
    }
  }

  if (changed) {
    saveAppState();
    flushUsersToSheet();
  }
}

// Debounced flush of the activity log to its own sheet tab (APPEND-ONLY).
// We append only the rows produced during this process's lifetime so the sheet
// keeps a permanent footprint and is never cleared/overwritten. On failure the
// rows are requeued for the next attempt.
let logFlushTimer: NodeJS.Timeout | null = null;
let pendingLogRows: ActivityEntry[] = [];
function flushLogsToSheet() {
  if (!settingsStore.isConfigured()) return;
  if (logFlushTimer) clearTimeout(logFlushTimer);
  logFlushTimer = setTimeout(async () => {
    if (pendingLogRows.length === 0) return;
    // pendingLogRows is in the order events occurred (oldest -> newest);
    // prependActivityLog inserts them below the header newest-first.
    const batch = pendingLogRows.slice();
    pendingLogRows = [];
    try {
      await settingsStore.prependActivityLog(
        batch.map((e) => ({ ts: e.ts, email: e.email, action: e.action, detail: e.detail }))
      );
    } catch (err) {
      // Requeue so nothing is lost; retry on the next flush.
      pendingLogRows = batch.concat(pendingLogRows);
      console.error("Failed to append activity log to sheet:", (err as Error).message);
    }
  }, 3000);
}

// Debounced flush of notifications to their own sheet tab.
let notifFlushTimer: NodeJS.Timeout | null = null;
function flushNotificationsToSheet() {
  if (!settingsStore.isConfigured()) return;
  if (notifFlushTimer) clearTimeout(notifFlushTimer);
  notifFlushTimer = setTimeout(async () => {
    try {
      await settingsStore.writeNotifications(appState.notifications.slice(0, 200));
    } catch (err) {
      console.error("Failed to flush notifications to sheet:", (err as Error).message);
    }
  }, 3000);
}

// Load the user roster FROM the settings spreadsheet (sheet is authoritative for role + center).
async function loadUsersFromSheet() {
  if (!settingsStore.isConfigured()) {
    console.log("Settings sheet not configured — using local JSON persistence for roles.");
    return;
  }
  try {
    const sheetUsers = await settingsStore.readUsers();
    sheetUsers.forEach((su) => {
      const existing = appState.users[su.email];
      appState.users[su.email] = {
        email: su.email,
        name: su.name || existing?.name || "",
        role: su.role,
        center: su.center || "",
        addedAt: existing?.addedAt || new Date().toISOString(),
        addedBy: existing?.addedBy || "settings-sheet",
        lastLogin: existing?.lastLogin,
      };
    });
    saveAppState();
    console.log(`Loaded ${sheetUsers.length} users from settings spreadsheet.`);
  } catch (err) {
    console.error("Failed to load users from settings sheet:", (err as Error).message);
    pushNotification("error", "Settings sheet read failed", (err as Error).message);
  }
}

// Load the persisted activity log FROM the settings spreadsheet so the full
// footprint survives container restarts (ephemeral hosting). The sheet is the
// source of truth here; local in-memory state is just a cache.
async function loadActivityLogFromSheet() {
  if (!settingsStore.isConfigured()) return;
  try {
    const rows = await settingsStore.readActivityLog(MAX_LOG_ENTRIES);
    if (rows.length === 0) return;
    const entries: ActivityEntry[] = rows.map((r) => ({
      id: genId(),
      ts: r.ts,
      email: r.email,
      action: r.action,
      detail: r.detail,
    }));
    // Newest first for the admin panel; tolerate sheets stored in either order.
    entries.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    appState.activityLog = entries.slice(0, MAX_LOG_ENTRIES);
    saveAppState();
    console.log(`Loaded ${entries.length} activity-log entries from settings spreadsheet.`);
  } catch (err) {
    console.error("Failed to load activity log from settings sheet:", (err as Error).message);
  }
}

loadAppState();
loadUsersFromSheet();
loadActivityLogFromSheet();

// Count valid student rows within a single in-memory sheet
function countSheetRows(sheet: MemorySheet): number {
  const data = sheet.data;
  const headerInfo = findHeaderRow(data);
  if (headerInfo) {
    const rIdx = headerInfo.index;
    const idxReg = findColumnIndex(headerInfo.headers, ["reg no", "roll no"]);
    if (idxReg !== -1) {
      return data.slice(rIdx + 1).filter((row) => {
        if (!row) return false;
        const val = String(row[idxReg] || "").trim();
        return val !== "" && val.toLowerCase() !== "reg no" && val.toLowerCase() !== "roll no" && !/^\d+th\s+june/i.test(val);
      }).length;
    }
    return Math.max(0, data.length - (rIdx + 1));
  }
  return Math.max(0, data.length - 1);
}



app.use(express.json({ limit: "10mb" }));

// Google OAuth authentication endpoints
app.get("/api/auth/google/url", (req, res) => {
  const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const base = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

  if (!isConfigured) {
    // If not configured, fall back to mock identity provider
    const mockUrl = `${base.replace(/\/$/, "")}/auth/google/mock-consent`;
    return res.json({ url: mockUrl, mode: "mock" });
  }

  const redirectUri = `${base.replace(/\/$/, "")}/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    hd: "pw.live", // Hint to prioritize pw email
    prompt: "select_account"
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url: authUrl, mode: "real" });
});

// Secure endpoint for mock token generation (only enabled when standard Google client credentials are not configured)
app.get("/api/auth/mock-token", (req, res) => {
  const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  if (isConfigured) {
    return res.status(403).json({ error: "Mock token generation is disabled when GOOGLE_CLIENT_ID is configured." });
  }
  const email = String(req.query.email || "").trim().toLowerCase();
  if (email.endsWith("@pw.live") || email.endsWith("@physicswallah.org")) {
    const token = generateStaffToken(email);
    return res.json({ staffToken: token });
  }
  return res.status(400).json({ error: "Unauthorized email domain" });
});

// Mock Google Consent Workspace Sandbox (Perfect for instant developer previews)
app.get("/auth/google/mock-consent", (req, res) => {
  const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  if (isConfigured) {
    return res.status(403).send("Mock authentication is disabled when GOOGLE_CLIENT_ID is configured.");
  }

  const tokenAniket = generateStaffToken("aniket.mishra@pw.live");
  const tokenCoordinator = generateStaffToken("academic.coordinator@physicswallah.org");

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sign in with Google - Pimpri PW Vidyapeeth Hub</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Roboto', sans-serif; }
      </style>
    </head>
    <body class="bg-slate-50 flex items-center justify-center min-h-screen p-4 text-slate-700">
      <div class="w-full max-w-md bg-white border border-slate-200 rounded-[8px] p-8 shadow-md flex flex-col items-center">
        <!-- Google Logo SVG -->
        <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-4 shrink-0" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.5 24c0-1.55-.15-3.24-.47-4.75H24v9h12.75c-.55 3-2.25 5.54-4.75 7.25l7.35 5.7C43.68 37.15 46.5 31.18 46.5 24z"/>
          <path fill="#FBBC05" d="M10.54 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.98-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.35-5.7c-2.33 1.55-5.32 2.51-8.54 2.51-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>

        <h1 class="text-xl font-medium text-[#202124] mb-1">Choose an account</h1>
        <p class="text-sm text-[#5f6368] mb-6">to continue to <span class="font-bold text-slate-800">Pimpri PW Vidyapeeth Hub</span></p>

        <!-- Developer Mode Notification -->
        <div class="w-full mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1.5 text-left">
          <p class="font-bold">💡 Google Workspace Sandbox (Demo Mode)</p>
          <p class="leading-relaxed">Mock mode is active because <code class="bg-amber-100/70 p-0.5 rounded font-mono">GOOGLE_CLIENT_ID</code> is not defined in '.env'. Feel free to click any official authorized account below to log in instantly:</p>
        </div>

        <!-- Accounts Stack -->
        <div class="w-full space-y-2.5 mb-6" id="accountsList">
          <!-- Account 1 -->
          <button onclick="selectEmail('aniket.mishra@pw.live', '${tokenAniket}')" class="w-full text-left p-3.5 hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-all flex items-center justify-between outline-none cursor-pointer">
            <div>
              <div class="font-medium text-sm text-[#3c4043]">Aniket Mishra</div>
              <div class="text-[11px] text-[#5f6368] mt-0.5">aniket.mishra@pw.live</div>
            </div>
            <span class="text-[10px] font-mono py-0.5 px-2 bg-blue-50 text-blue-600 rounded-md font-bold">Authorized</span>
          </button>

          <!-- Account 2 -->
          <button onclick="selectEmail('academic.coordinator@physicswallah.org', '${tokenCoordinator}')" class="w-full text-left p-3.5 hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-all flex items-center justify-between outline-none cursor-pointer">
            <div>
              <div class="font-medium text-sm text-[#3c4043]">Academic Coordinator</div>
              <div class="text-[11px] text-[#5f6368] mt-0.5">academic.coordinator@physicswallah.org</div>
            </div>
            <span class="text-[10px] font-mono py-0.5 px-2 bg-blue-50 text-blue-600 rounded-md font-bold">Authorized</span>
          </button>
        </div>

        <!-- Custom Account Selector Trigger -->
        <div class="w-full border-t border-slate-100 pt-4 mb-4 text-left">
          <button onclick="toggleCustomForm()" id="useAnotherBtn" class="text-xs text-[#1a73e8] hover:text-[#174ea6] font-bold inline-flex items-center gap-1.5 cursor-pointer outline-none mb-2">
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> Use another PW account
          </button>

          <div id="customForm" class="hidden space-y-3 mt-1.5">
            <label class="block text-xs font-medium text-[#202124]">Enter authorized @pw.live or @physicswallah.org email</label>
            <input type="email" id="customInput" placeholder="name@pw.live" class="w-full border border-slate-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-[#1a73e8] bg-slate-50 focus:bg-white" />
            <p id="errorMsg" class="text-[11px] text-red-600 hidden">Access Restricted: Only authorized @pw.live or @physicswallah.org emails are allowed.</p>
            <button onclick="submitCustomEmail()" class="w-full bg-[#1a73e8] hover:bg-[#174ea6] text-white font-medium py-2 rounded-lg text-sm cursor-pointer transition-colors mt-2">
              Continue
            </button>
          </div>
        </div>

        <div class="text-[10px] text-[#c0c1c2] text-center mt-3 border-t border-slate-100 pt-3 w-full">
          Production environments operate direct secure APIs.
        </div>
      </div>

      <script>
        async function selectEmail(email, staffToken) {
          if (window.opener) {
            const prefix = email.split("@")[0];
            const name = prefix.split(/[\._\-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
            const picture = "https://ui-avatars.com/api/?name=" + encodeURIComponent(name) + "&background=3b82f6&color=fff&bold=true&size=128";
            
            let finalToken = staffToken;
            if (!finalToken) {
              try {
                const res = await fetch("/api/auth/mock-token?email=" + encodeURIComponent(email));
                if (res.ok) {
                  const data = await res.json();
                  finalToken = data.staffToken;
                } else {
                  console.error("Failed to generate mock token");
                }
              } catch (e) {
                console.error(e);
              }
            }

            window.opener.postMessage({ 
              type: "GOOGLE_AUTH_SUCCESS", 
              email: email,
              name: name,
              picture: picture,
              staffToken: finalToken
            }, "*");
            window.close();
          } else {
            alert("Secure simulated login completed as: " + email);
          }
        }

        function toggleCustomForm() {
          const form = document.getElementById("customForm");
          const btn = document.getElementById("useAnotherBtn");
          if (form.classList.contains("hidden")) {
            form.classList.remove("hidden");
            btn.classList.add("hidden");
          }
        }

        function submitCustomEmail() {
          const email = document.getElementById("customInput").value.trim().toLowerCase();
          const errorMsg = document.getElementById("errorMsg");
          
          if (!email) return;
          
          if (!email.endsWith("@pw.live") && !email.endsWith("@physicswallah.org")) {
            errorMsg.classList.remove("hidden");
            return;
          }
          
          errorMsg.classList.add("hidden");
          selectEmail(email);
        }
      </script>
    </body>
    </html>
  `);
});

// Prod Google Callback Listener (exchanges standard code for token and profile data)
app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Google authorization code is missing");
  }

  try {
    const base = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${base.replace(/\/$/, "")}/auth/google/callback`;

    // Exchange verification code for credentials token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Google token exchange failed: ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Retrieve Google profile matching user session details
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userResponse.ok) {
      throw new Error("Unable to retrieve Google user profile details");
    }

    const userData = await userResponse.json();
    const email = (userData.email || "").trim().toLowerCase();

    // Enforce restricted Physics Wallah email domain constraints
    if (!email.endsWith("@pw.live") && !email.endsWith("@physicswallah.org")) {
      return res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: "GOOGLE_AUTH_FAILURE",
                  error: "Access Restricted: Account ${email} is not permitted. Only official PW staff accounts (@pw.live or @physicswallah.org) can access the portal."
                }, "*");
                window.close();
              } else {
                window.location.href = "/?error=access_denied";
              }
            </script>
            <p>Access Restricted to PW Accounts only. Closing window...</p>
          </body>
        </html>
      `);
    }

    const staffToken = generateStaffToken(email);

    // Success response posted to original application window
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: "GOOGLE_AUTH_SUCCESS",
                email: "${email}",
                name: ${JSON.stringify(userData.name || "")},
                picture: ${JSON.stringify(userData.picture || "")},
                staffToken: "${staffToken}"
              }, "*");
              window.close();
            } else {
              window.location.href = "/";
            }
          </script>
          <p>Login Successful! Synchronizing portal session...</p>
        </body>
      </html>
    `);

  } catch (err: any) {
    console.error("Google Server authorization protocol failed:", err);
    return res.status(500).send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: "GOOGLE_AUTH_FAILURE",
                error: "Google Authentication System Failure: ${err.message || 'Interpersonal handshake error.'}"
              }, "*");
              window.close();
            } else {
              window.location.href = "/?error=internal_handshake_crash";
            }
          </script>
          <p>Handshake failed. Closing window...</p>
        </body>
      </html>
    `);
  }
});

// API: Proxy Physics Wallah Logo to bypass hotlinking / referral restriction policies
app.get("/api/logo", async (req, res) => {
  try {
    const logoUrl = "https://pwhr.darwinbox.in/ms/s3proxy/getFile?fileKey=INSTANCE5_a62c4003263a06_194/logo/a141188422867e404366f582__tenant-avatar-194_15638877.png";
    const response = await fetch(logoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch logo from Darwinbox: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Set appropriate headers
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
    res.send(buffer);
  } catch (err: any) {
    console.error("Error proxying corporate logo:", err);
    // Redirect to remote as a fallback, or fail gracefully
    res.redirect("https://pwhr.darwinbox.in/ms/s3proxy/getFile?fileKey=INSTANCE5_a62c4003263a06_194/logo/a141188422867e404366f582__tenant-avatar-194_15638877.png");
  }
});

// API: Get current config mappings
app.get("/api/config", verifyRequest, superAdminOnly, (req, res) => {
  const config = getAppConfig();
  const userEmail = req.headers["x-user-email"] as string;
  const allowedCenters = getUserAllowedCenters(userEmail);
  const userSheets = filterSheetsByCenters(memorySheets, allowedCenters);

  res.json({
    env: {
      SPREADSHEET_URL: process.env.SPREADSHEET_URL || "",
      SPREADSHEET_CENTERS: process.env.SPREADSHEET_CENTERS || "",
      SUBSHEET_CENTERS: process.env.SUBSHEET_CENTERS || "",
      STAFF_ACCESS: process.env.STAFF_ACCESS || "",
    },
    local: {
      SPREADSHEET_URL: config.SPREADSHEET_URL || "",
      SPREADSHEET_CENTERS: config.SPREADSHEET_CENTERS || {},
      SUBSHEET_CENTERS: config.SUBSHEET_CENTERS || {},
      STAFF_ACCESS: config.STAFF_ACCESS || {},
    },
    combined: {
      SPREADSHEET_URL: getSpreadsheetUrls().join(", "),
      SPREADSHEET_CENTERS: getSpreadsheetCenters(),
      SUBSHEET_CENTERS: getSubsheetCenters(),
      STAFF_ACCESS: getStaffAccess(),
    },
    activeSheets: userSheets.map(s => ({
      name: s.name,
      sourceUrl: s.sourceUrl,
      center: s.center
    }))
  });
});

// API: Save custom configurations to local config file and trigger load
app.post("/api/config", verifyRequest, superAdminOnly, async (req, res) => {
  try {
    const { SPREADSHEET_URL, SPREADSHEET_CENTERS, SUBSHEET_CENTERS, STAFF_ACCESS } = req.body;
    const newConfig: SavedConfig = {};

    if (typeof SPREADSHEET_URL === "string") {
      const urls = SPREADSHEET_URL.split(",")
        .map(u => normalizeSpreadsheetUrl(u))
        .filter(Boolean);
      newConfig.SPREADSHEET_URL = urls.join(", ");
    }
    if (SPREADSHEET_CENTERS && typeof SPREADSHEET_CENTERS === "object") {
      newConfig.SPREADSHEET_CENTERS = SPREADSHEET_CENTERS;
    }
    if (SUBSHEET_CENTERS && typeof SUBSHEET_CENTERS === "object") {
      newConfig.SUBSHEET_CENTERS = SUBSHEET_CENTERS;
    }
    if (STAFF_ACCESS && typeof STAFF_ACCESS === "object") {
      newConfig.STAFF_ACCESS = STAFF_ACCESS;
    }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), "utf-8");

    // Mirror the Staff Access Controls (ACL) into the user roster so the staff
    // also show up in the settings spreadsheet (Staff tab). Without this, ACL
    // entries lived only in the local config and never reached the "excel".
    if (STAFF_ACCESS && typeof STAFF_ACCESS === "object") {
      const adminEmail = String(req.headers["x-user-email"] || "").trim().toLowerCase() || "settings-acl";
      syncStaffAccessToRoster(STAFF_ACCESS as Record<string, string[]>, adminEmail);
    }

    // Hot-reload spreadsheet data in background
    console.log("Configuration updated, reloading cache in background...");
    loadSpreadsheetData();

    res.json({ success: true, message: "Configurations successfully saved! Cache is reloading in background." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save configuration: " + err.toString() });
  }
});

// API: Health status + cache context
app.get("/api/health", verifyRequest, (req, res) => {
  res.json({
    status: "ok",
    lastLoaded,
    isLoading,
    loadError,
    sheetCount: memorySheets.length,
  });
});

// API: Get parsed dropdown listings
app.get("/api/dropdowns", verifyRequest, async (req, res) => {
  if (loadError && memorySheets.length === 0) {
    return res.status(500).json({ error: loadError });
  }
  // Try triggering download if never loaded and not loading
  if (memorySheets.length === 0 && !isLoading) {
    await loadSpreadsheetData();
  }

  const userEmail = req.headers["x-user-email"] as string;
  const allowedCenters = getUserAllowedCenters(userEmail);
  const userSheets = filterSheetsByCenters(memorySheets, allowedCenters);

  // Calculate student/row stats dynamically for each sheet
  const sheetStats: Record<string, number> = {};
  userSheets.forEach((s) => {
    const data = s.data;
    const headerInfo = findHeaderRow(data);
    if (headerInfo) {
      const rIdx = headerInfo.index;
      const idxReg = findColumnIndex(headerInfo.headers, ["reg no", "roll no"]);
      if (idxReg !== -1) {
        const validRows = data.slice(rIdx + 1).filter((row) => {
          if (!row) return false;
          const val = String(row[idxReg] || "").trim();
          return val !== "" && val.toLowerCase() !== "reg no" && val.toLowerCase() !== "roll no" && !/^\d+th\s+june/i.test(val);
        });
        sheetStats[s.name] = validRows.length;
      } else {
        sheetStats[s.name] = Math.max(0, data.length - (rIdx + 1));
      }
    } else {
      sheetStats[s.name] = Math.max(0, data.length - 1);
    }
  });

  // Compile batches and names list restricted by allowed user centers
  let userBatches = dropdowns.batches;
  let userNames = dropdowns.names;

  if (allowedCenters) {
    const batchesSet = new Set<string>();
    const namesSet = new Set<string>();

    userSheets.forEach((sheetObj) => {
      const data = sheetObj.data;
      const sheetName = sheetObj.name;
      if (!isTestSheet(sheetName)) return;
      const headerInfo = findHeaderRow(data);
      if (!headerInfo) return;

      const headers = headerInfo.headers;
      const rIdx = headerInfo.index;

      const idxReg = findColumnIndex(headers, ["reg no", "roll no"]);
      const idxName = findColumnIndex(headers, ["student name", "name"]);
      const idxBatch = findColumnIndex(headers, ["batch"]);

      if (idxReg === -1) return;

      for (let i = rIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        const reg = String(row[idxReg] || "").trim();
        if (reg) {
          if (idxName !== -1 && row[idxName] !== undefined && row[idxName] !== null) {
            const nameVal = String(row[idxName]).trim();
            if (nameVal && nameVal !== "" && nameVal.toLowerCase() !== "student name" && nameVal.toLowerCase() !== "name") {
              namesSet.add(nameVal);
            }
          }
          if (idxBatch !== -1 && row[idxBatch] !== undefined && row[idxBatch] !== null) {
            const batchVal = String(row[idxBatch]).trim();
            if (batchVal && batchVal !== "" && batchVal.toLowerCase() !== "batch") {
              batchesSet.add(batchVal);
            }
          }
        }
      }
    });

    userBatches = Array.from(batchesSet).filter((b) => b !== "N/A" && b !== "").sort();
    userNames = Array.from(namesSet)
      .filter((n) => n !== "")
      .sort((a, b) => {
        const aIsNA = a.includes("N/A") || a.toLowerCase() === "n/a" || a.startsWith("#");
        const bIsNA = b.includes("N/A") || b.toLowerCase() === "n/a" || b.startsWith("#");
        if (aIsNA && !bIsNA) return 1;
        if (!aIsNA && bIsNA) return -1;
        return a.localeCompare(b);
      });
  }

  res.json({
    batches: userBatches,
    names: userNames,
    sheets: sortSheetNamesDescending(Array.from(new Set(userSheets.map(s => s.name)))),
    sheetStats,
    sheetUrls: sheetUrlsMap,
    lastLoaded,
    isLoading,
  });
});

// API: Manual refresh endpoint
app.post("/api/refresh", verifyRequest, async (req, res) => {
  if (isLoading) {
    return res.json({ message: "Refresh already in progress...", isLoading: true });
  }
  await loadSpreadsheetData();
  if (loadError) {
    return res.status(500).json({ error: loadError });
  }
  res.json({ success: true, lastLoaded, batchesCount: dropdowns.batches.length });
});

// ============================================================
//  PUBLIC STUDENT RESULT PORTAL — Device-locked self-service
// ============================================================

const DEVICE_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours

interface DeviceBinding {
  regNo: string;
  ip: string;
  lockedAt: string;  // ISO
  expiresAt: string; // ISO
}

// In-memory cache for fast lookups — synced to Google Sheet (DeviceBindings tab)
let deviceBindings: Record<string, DeviceBinding> = {};

// Load existing bindings from Google Sheet on startup
(async function loadDeviceBindingsFromSheet() {
  if (!settingsStore.isConfigured()) return;
  try {
    const rows = await settingsStore.readDeviceBindings();
    const now = Date.now();
    for (const row of rows) {
      if (new Date(row.expiresAt).getTime() <= now) continue; // skip expired
      // Rebuild the in-memory key: for "device" type use deviceIdShort, for "ip" type use ip-based key
      const key = row.bindingType === "ip"
        ? `ip_${crypto.createHash("sha256").update(row.ip).digest("hex").slice(0, 24)}`
        : row.deviceIdShort; // deviceIdShort stores the full deviceId hash for device bindings
      deviceBindings[key] = {
        regNo: row.regNo,
        ip: row.ip,
        lockedAt: row.lockedAt,
        expiresAt: row.expiresAt,
      };
    }
    console.log(`Loaded ${Object.keys(deviceBindings).length} active device bindings from Google Sheet.`);
  } catch (err) {
    console.warn("Could not load device bindings from sheet:", (err as Error).message);
  }
})();

// Debounced flush of in-memory bindings to Google Sheet
let deviceBindingsFlushTimer: NodeJS.Timeout | null = null;
let pendingDeviceBindingRows: settingsStore.DeviceBindingRow[] = [];

function flushDeviceBindingsToSheet() {
  if (!settingsStore.isConfigured()) return;
  if (deviceBindingsFlushTimer) clearTimeout(deviceBindingsFlushTimer);
  deviceBindingsFlushTimer = setTimeout(async () => {
    if (pendingDeviceBindingRows.length === 0) return;
    const batch = pendingDeviceBindingRows.slice();
    pendingDeviceBindingRows = [];
    try {
      await settingsStore.writeDeviceBindings(batch);
    } catch (err) {
      // Requeue so nothing is lost
      pendingDeviceBindingRows = batch.concat(pendingDeviceBindingRows);
      console.error("Failed to write device bindings to sheet:", (err as Error).message);
    }
  }, 3000);
}

function saveDeviceBindings() {
  // No-op for local JSON — all persistence now goes through Google Sheet
}

// Cleanup expired entries every 30 minutes — both in-memory and Google Sheet
setInterval(async () => {
  const now = Date.now();
  let changed = false;
  for (const key of Object.keys(deviceBindings)) {
    if (new Date(deviceBindings[key].expiresAt).getTime() <= now) {
      delete deviceBindings[key];
      changed = true;
    }
  }
  // Also clean up the Google Sheet
  if (settingsStore.isConfigured()) {
    try {
      const removed = await settingsStore.removeExpiredDeviceBindings();
      if (removed > 0) {
        console.log(`[device-cleanup] Removed ${removed} expired bindings from Google Sheet.`);
      }
    } catch (err) {
      console.warn("[device-cleanup] Sheet cleanup failed:", (err as Error).message);
    }
  }
}, 30 * 60 * 1000);

function getClientIP(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress || req.ip || "unknown";
}

// Portal settings endpoints
app.get("/api/portal-settings", (req, res) => {
  const ps = appState.portalSettings || DEFAULT_PORTAL_SETTINGS;
  res.json(ps);
});

app.post("/api/portal-settings", express.json(), (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { portalEnabled, qrEnabled, portalMessage } = req.body || {};
  if (!appState.portalSettings) appState.portalSettings = { ...DEFAULT_PORTAL_SETTINGS };
  if (typeof portalEnabled === "boolean") appState.portalSettings.portalEnabled = portalEnabled;
  if (typeof qrEnabled === "boolean") appState.portalSettings.qrEnabled = qrEnabled;
  if (typeof portalMessage === "string") appState.portalSettings.portalMessage = portalMessage;
  saveAppState();
  const who = String(req.headers["x-user-email"] || "admin");
  logActivity(who, "portal-settings", `Portal: ${appState.portalSettings.portalEnabled ? "ON" : "OFF"}, QR: ${appState.portalSettings.qrEnabled ? "ON" : "OFF"}`);
  res.json({ ok: true, ...appState.portalSettings });
});

// Public result endpoint — no login required, device-locked
app.post("/api/student-public", express.json(), (req, res) => {
  // Check if portal is enabled
  const ps = appState.portalSettings || DEFAULT_PORTAL_SETTINGS;
  if (!ps.portalEnabled) {
    return res.json({ allowed: false, portalDisabled: true, message: ps.portalMessage });
  }

  const { regNo, deviceId } = req.body || {};

  if (!regNo || typeof regNo !== "string" || !regNo.trim()) {
    return res.status(400).json({ allowed: false, message: "Registration number is required." });
  }

  if (!deviceId || typeof deviceId !== "string") {
    return res.status(400).json({ allowed: false, message: "Device identification failed." });
  }

  const cleanRegNo = regNo.trim();
  const clientIP = getClientIP(req);
  const now = Date.now();

  // --- Multi-layer device check ---
  // Check by deviceId fingerprint
  const existingByDevice = deviceBindings[deviceId];
  if (existingByDevice && new Date(existingByDevice.expiresAt).getTime() > now) {
    if (existingByDevice.regNo.toLowerCase() !== cleanRegNo.toLowerCase()) {
      const remainMs = new Date(existingByDevice.expiresAt).getTime() - now;
      const remainMinutes = Math.ceil(remainMs / 60000);
      return res.json({
        allowed: false,
        remainingMinutes: remainMinutes,
        expiresAt: existingByDevice.expiresAt,
        message: `This device has already viewed a result. Please wait ${Math.floor(remainMinutes / 60)}h ${remainMinutes % 60}m before searching another registration.`
      });
    }
    // Same device + same regNo → allowed (refresh case)
  }

  // Check by IP address — prevents copy-paste-to-another-browser bypass
  const ipKey = `ip_${crypto.createHash("sha256").update(clientIP).digest("hex").slice(0, 24)}`;
  const existingByIP = deviceBindings[ipKey];
  if (existingByIP && new Date(existingByIP.expiresAt).getTime() > now) {
    if (existingByIP.regNo.toLowerCase() !== cleanRegNo.toLowerCase()) {
      const remainMs = new Date(existingByIP.expiresAt).getTime() - now;
      const remainMinutes = Math.ceil(remainMs / 60000);
      return res.json({
        allowed: false,
        remainingMinutes: remainMinutes,
        expiresAt: existingByIP.expiresAt,
        message: `Another result was recently viewed from this network. Please wait ${Math.floor(remainMinutes / 60)}h ${remainMinutes % 60}m.`
      });
    }
    // Same IP + same regNo → allowed (same student, same network)
  }

  // --- Look up the student in memory ---
  if (memorySheets.length === 0) {
    if (isLoading) {
      return res.status(503).json({ allowed: false, message: "Database is loading. Please try again in a few seconds." });
    }
    return res.status(503).json({ allowed: false, message: "Database is temporarily unavailable." });
  }

  try {
    const searchReg = cleanRegNo.toLowerCase();
    const profilesMap: Record<string, any> = {};
    const testsMap: Record<string, any[]> = {};
    let foundReg = "";

    // Sheet metadata
    const sheetMetaMap = new Map<string, { date: string; testClass: string; cleanName: string; originalSheetName: string }>();
    memorySheets.forEach((sheetObj) => {
      const sheetName = sheetObj.name;
      const dateRegex = /^(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(.*)$/i;
      const dateMatch = sheetName.match(dateRegex);
      let extractedDate = "N/A";
      let testClass = "N/A";
      let cleanTestName = sheetName;
      if (dateMatch) {
        const day = dateMatch[1];
        const month = dateMatch[2];
        const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
        extractedDate = `${day.padStart(2, "0")} ${capitalizedMonth}`;
        const remains = dateMatch[3].trim();
        const classRegex = /^(\d{1,2}(?:st|nd|rd|th)?\s+(?:JEE|NEET|COE)(?:\s+(?:Phase\s*\d+|P\s*[-_]?\s*\d+|COE))*)\s*(.*)$/i;
        const classMatch = remains.match(classRegex);
        if (classMatch) {
          testClass = classMatch[1].trim();
          cleanTestName = expandTestName(classMatch[2].trim() || "Test");
        } else {
          cleanTestName = expandTestName(remains || "Test");
        }
      }
      sheetMetaMap.set(sheetName, { date: extractedDate, testClass, cleanName: cleanTestName, originalSheetName: sheetName });
    });

    // STEP 1: Find student by reg no across ALL sheets (no center filtering for public)
    memorySheets.forEach((sheetObj) => {
      const data = sheetObj.data;
      const sheetName = sheetObj.name;
      if (!isTestSheet(sheetName)) return;
      const headerInfo = findHeaderRow(data);
      if (!headerInfo) return;
      const headers = headerInfo.headers;
      const rIdx = headerInfo.index;
      const idxReg = findColumnIndex(headers, ["reg no", "roll no"]);
      const idxName = findColumnIndex(headers, ["student name", "name"]);
      const idxBatch = findColumnIndex(headers, ["batch"]);
      if (idxReg === -1) return;

      for (let i = rIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        const reg = String(row[idxReg] || "").trim();
        if (reg.toLowerCase() === searchReg) {
          foundReg = reg;
          const name = idxName !== -1 ? String(row[idxName] || "").trim() : "";
          const batch = idxBatch !== -1 ? String(row[idxBatch] || "").trim() : "";
          if (!profilesMap[reg]) {
            profilesMap[reg] = { regNo: reg, name: name || "N/A", batch: batch || "N/A", center: sheetObj.center || "Pimpri PW Vidyapeeth" };
          } else {
            if (name && name !== "N/A" && name !== "#N/A" && (profilesMap[reg].name === "N/A" || profilesMap[reg].name === "#N/A")) profilesMap[reg].name = name;
            if (batch && batch !== "N/A" && !profilesMap[reg].batch) profilesMap[reg].batch = batch;
          }
        }
      }
    });

    if (!foundReg) {
      return res.status(404).json({ allowed: false, message: "No student found with this Registration Number." });
    }

    testsMap[foundReg] = [];

    // STEP 2: Extract test marks
    memorySheets.forEach((sheetObj) => {
      const data = sheetObj.data;
      const sheetName = sheetObj.name;
      if (!isTestSheet(sheetName)) return;
      const headerInfo = findHeaderRow(data);
      if (!headerInfo) return;
      const headers = headerInfo.headers;
      const rIdx = headerInfo.index;
      const idxReg = findColumnIndex(headers, ["reg no", "roll no"]);
      if (idxReg === -1) return;

      const originalHeaders = data[headerInfo.index] || [];
      const subjectCols: { name: string; index: number; normalized: string }[] = [];
      originalHeaders.forEach((rawHeader: any, index: number) => {
        const parsedHeader = String(rawHeader || "").trim();
        if (parsedHeader && isSubjectHeader(parsedHeader)) {
          subjectCols.push({ name: parsedHeader, index, normalized: normalizeHeader(parsedHeader) });
        }
      });

      const isNEETSheet = /neet/i.test(sheetName) || headers.includes("botany") || headers.includes("zoology");
      const isJEESheet = !isNEETSheet && (/jee/i.test(sheetName) || headers.includes("mathematics") || headers.includes("maths"));
      const isFoundationSheet = !isNEETSheet && !isJEESheet && (/foundation/i.test(sheetName) || /fnd/i.test(sheetName) || /class\s*(?:6|7|8|9|10)/i.test(sheetName) || headers.includes("science") || headers.includes("sst") || headers.includes("social studies") || headers.includes("mat") || headers.includes("mental ability") || headers.includes("english"));
      const sheetStream = isNEETSheet ? "NEET" : isFoundationSheet ? "Foundation" : "JEE";

      const idxScore = findColumnIndex(headers, ["score", "total marks", "marks"]);
      const idxOutOf = findColumnIndex(headers, ["out of", "max marks"]);
      const idxUnattempted = findColumnIndex(headers, ["unattempted", "unattempt"]);
      const idxRank = findColumnIndex(headers, ["center rank", "rank"]);
      const idxBatch = findColumnIndex(headers, ["batch"]);
      const idxPhy = findColumnIndex(headers, ["physics", "avg physics %", "physics marks"]);
      const idxChem = findColumnIndex(headers, ["chemistry", "chemisytry", "avg chemistry %", "chemistry marks"]);
      const idxMaths = findColumnIndex(headers, ["mathematics", "maths", "avg maths %"]);
      const idxBot = findColumnIndex(headers, ["botany", "botany marks"]);
      const idxZoo = findColumnIndex(headers, ["zoology", "zoology marks"]);

      for (let j = rIdx + 1; j < data.length; j++) {
        const row = data[j];
        if (!row) continue;
        const reg = String(row[idxReg] || "").trim();
        if (reg !== foundReg) continue;

        const sheetMeta = sheetMetaMap.get(sheetName) || { date: "N/A", testClass: "N/A", cleanName: sheetName, originalSheetName: sheetName };
        const studBatch = idxBatch !== -1 ? String(row[idxBatch] || "").trim() : (profilesMap[reg]?.batch || "");
        const batchInfo = parseBatchInfo(studBatch);
        const testStream = batchInfo ? batchInfo.stream : sheetStream;

        const testObj: any = {
          date: sheetMeta.date,
          testClass: sheetMeta.testClass && sheetMeta.testClass !== "N/A" && sheetMeta.testClass !== "-" ? sheetMeta.testClass : (batchInfo ? batchInfo.class : "N/A"),
          name: sheetMeta.cleanName,
          originalSheetName: sheetMeta.originalSheetName,
          type: "Test",
          outOf: idxOutOf !== -1 && row[idxOutOf] !== undefined && row[idxOutOf] !== "" ? row[idxOutOf] : testStream === "JEE" ? 300 : testStream === "NEET" ? 720 : 100,
          score: idxScore !== -1 && row[idxScore] !== undefined ? row[idxScore] : "N/A",
          avgScore: "N/A",
          sub1: idxPhy !== -1 && row[idxPhy] !== undefined ? row[idxPhy] : "-",
          sub2: idxChem !== -1 && row[idxChem] !== undefined ? row[idxChem] : "-",
          sub3: testStream === "JEE" ? (idxMaths !== -1 && row[idxMaths] !== undefined ? row[idxMaths] : "-") : (idxBot !== -1 && row[idxBot] !== undefined ? row[idxBot] : "-"),
          sub4: testStream === "NEET" && idxZoo !== -1 && row[idxZoo] !== undefined ? row[idxZoo] : "-",
          unattempted: idxUnattempted !== -1 && row[idxUnattempted] !== undefined ? row[idxUnattempted] : "-",
          centerRank: idxRank !== -1 && row[idxRank] !== undefined ? row[idxRank] : "-",
          subjectScores: subjectCols.map((col) => ({ subject: col.name, score: row[col.index] !== undefined && row[col.index] !== "" ? row[col.index] : "-" })),
          stream: testStream,
          center: sheetObj.center || "Pimpri PW Vidyapeeth",
        };

        if (testObj.score !== "N/A" && testObj.score !== "") {
          const scoreParsed = parseFloat(testObj.score);
          const outOfParsed = parseFloat(testObj.outOf);
          if (!isNaN(scoreParsed) && !isNaN(outOfParsed) && outOfParsed > 0) {
            testObj.avgScore = String((scoreParsed / outOfParsed) * 100);
          }
        }

        testsMap[foundReg].push(testObj);
      }
    });

    const sTests = testsMap[foundReg] || [];
    const updatedTests = sTests.map((t: any) => ({ ...t, type: t.name || "Test" }));

    updatedTests.sort((a, b) => {
      const dateA = parseSheetDate(a.originalSheetName || "");
      const dateB = parseSheetDate(b.originalSheetName || "");
      if (dateA.month !== dateB.month) return dateA.month - dateB.month;
      return dateA.day - dateB.day;
    });

    const profile = profilesMap[foundReg];
    const detectedInfo = detectStreamAndClass(profile.batch, updatedTests.flatMap((t: any) => (t.subjectScores || []).map((s: any) => s.subject)));
    profile.stream = detectedInfo.stream;
    profile.class = detectedInfo.class;

    let latestCenter = profile.center || "Pimpri PW Vidyapeeth";
    if (updatedTests.length > 0) {
      const latestTest = updatedTests[updatedTests.length - 1];
      if (latestTest && latestTest.center) latestCenter = latestTest.center;
    }
    profile.center = latestCenter;

    // Don't include shareToken in public response (security)
    delete profile.shareToken;

    // --- Bind device + IP ---
    const expiresAt = new Date(now + DEVICE_COOLDOWN_MS).toISOString();
    const lockedAtISO = new Date(now).toISOString();
    deviceBindings[deviceId] = { regNo: foundReg, ip: clientIP, lockedAt: lockedAtISO, expiresAt };
    deviceBindings[ipKey] = { regNo: foundReg, ip: clientIP, lockedAt: lockedAtISO, expiresAt };

    // Set HttpOnly cookie for server-side device tracking (survives JS clear)
    res.cookie("_vp_device", deviceId, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: "lax",
      maxAge: DEVICE_COOLDOWN_MS,
    });

    // Queue for Google Sheet persistence — use readable IST for sheet display
    const lockedAtReadable = fmtIST(now);
    const expiresAtReadable = fmtIST(now + DEVICE_COOLDOWN_MS);
    pendingDeviceBindingRows.push(
      { regNo: foundReg, deviceIdShort: deviceId, ip: clientIP, bindingType: "device", lockedAt: lockedAtReadable, expiresAt: expiresAtReadable, status: "active" },
      { regNo: foundReg, deviceIdShort: deviceId, ip: clientIP, bindingType: "ip", lockedAt: lockedAtReadable, expiresAt: expiresAtReadable, status: "active" }
    );
    flushDeviceBindingsToSheet();

    // Log public access
    console.log(`[public-result] RegNo=${foundReg} IP=${clientIP} DeviceID=${deviceId.slice(0, 8)}...`);

    return res.json({
      allowed: true,
      student: { profile, tests: updatedTests },
      expiresAt,
    });

  } catch (err: any) {
    console.error("[public-result] Error:", err);
    return res.status(500).json({ allowed: false, message: "Internal server error." });
  }
});

// Check device binding via cookie (for link copy-paste detection)
app.post("/api/student-public-check", express.json(), (req, res) => {
  const cookieDeviceId = req.cookies?._vp_device;
  const { deviceId, regNo } = req.body || {};
  const clientIP = getClientIP(req);
  const now = Date.now();

  // Check cookie-based device binding
  if (cookieDeviceId && deviceBindings[cookieDeviceId]) {
    const binding = deviceBindings[cookieDeviceId];
    if (new Date(binding.expiresAt).getTime() > now && binding.regNo.toLowerCase() !== (regNo || "").toLowerCase()) {
      const remainMs = new Date(binding.expiresAt).getTime() - now;
      return res.json({ bound: true, remainingMinutes: Math.ceil(remainMs / 60000), expiresAt: binding.expiresAt, boundRegNo: binding.regNo.slice(0, 3) + "***" });
    }
  }

  // Check IP-based binding
  const ipKey = `ip_${crypto.createHash("sha256").update(clientIP).digest("hex").slice(0, 24)}`;
  if (deviceBindings[ipKey]) {
    const binding = deviceBindings[ipKey];
    if (new Date(binding.expiresAt).getTime() > now) {
      const remainMs = new Date(binding.expiresAt).getTime() - now;
      return res.json({ bound: true, remainingMinutes: Math.ceil(remainMs / 60000), expiresAt: binding.expiresAt, boundRegNo: binding.regNo.slice(0, 3) + "***" });
    }
  }

  return res.json({ bound: false });
});

// Admin: View all device bindings (for debugging/management)
app.get("/api/device-bindings", verifyRequest, (req, res) => {
  const now = Date.now();
  // Group by regNo for admin view
  const grouped: Record<string, { regNo: string; ip: string; lockedAt: string; expiresAt: string; remainingMin: number; types: string[] }> = {};
  for (const [key, val] of Object.entries(deviceBindings)) {
    if (new Date(val.expiresAt).getTime() <= now) continue;
    const reg = val.regNo;
    const remainMs = new Date(val.expiresAt).getTime() - now;
    const remainMin = Math.ceil(remainMs / 60000);
    const bType = key.startsWith("ip_") ? "IP" : "Device";
    if (!grouped[reg]) {
      grouped[reg] = { regNo: reg, ip: val.ip, lockedAt: val.lockedAt, expiresAt: val.expiresAt, remainingMin: remainMin, types: [bType] };
    } else {
      if (!grouped[reg].types.includes(bType)) grouped[reg].types.push(bType);
    }
  }
  const bindings = Object.values(grouped);
  res.json({ bindings, count: bindings.length });
});

// Admin: Reset device bindings for a specific registration
app.post("/api/device-bindings/reset", verifyRequest, express.json(), async (req, res) => {
  const { regNo } = req.body || {};
  if (!regNo) return res.status(400).json({ error: "Registration number required." });

  const cleanReg = String(regNo).trim().toLowerCase();
  let removed = 0;
  for (const key of Object.keys(deviceBindings)) {
    if (deviceBindings[key].regNo.toLowerCase() === cleanReg) {
      delete deviceBindings[key];
      removed++;
    }
  }

  // Also remove from Google Sheet
  if (settingsStore.isConfigured()) {
    try {
      await settingsStore.removeDeviceBindingsByRegNo(regNo);
    } catch (err) {
      console.warn("[device-reset] Sheet cleanup failed:", (err as Error).message);
    }
  }

  const adminEmail = String(req.headers["x-user-email"] || "").trim();
  console.log(`[device-reset] Admin=${adminEmail} cleared ${removed} bindings for RegNo=${regNo}`);
  logActivity(adminEmail, "device_reset", `Cleared bindings for RegNo: ${regNo}`);

  res.json({ success: true, removed, message: `Cleared ${removed} device binding(s) for ${regNo}.` });
});

// Admin: Clear ALL device bindings
app.post("/api/device-bindings/reset-all", verifyRequest, async (req, res) => {
  const count = Object.keys(deviceBindings).length;
  deviceBindings = {};

  // Also clear from Google Sheet
  if (settingsStore.isConfigured()) {
    try {
      await settingsStore.clearAllDeviceBindings();
    } catch (err) {
      console.warn("[device-reset-all] Sheet cleanup failed:", (err as Error).message);
    }
  }

  const adminEmail = String(req.headers["x-user-email"] || "").trim();
  console.log(`[device-reset-all] Admin=${adminEmail} cleared all ${count} bindings`);
  logActivity(adminEmail, "device_reset_all", `Cleared all ${count} device bindings`);

  res.json({ success: true, removed: count, message: `All ${count} device bindings cleared.` });
});

// API: Get student records payload
app.get("/api/student", verifyRequest, (req, res) => {
  const queryParam = req.query.query;
  if (!queryParam) {
    return res.status(400).json({ error: "Missing query parameter." });
  }

  // Audit: log staff views/searches (skip anonymous share-link views without an email)
  const viewerEmail = String(req.headers["x-user-email"] || "").trim().toLowerCase();
  if (viewerEmail && String(queryParam).trim().toLowerCase() !== "all") {
    logActivity(viewerEmail, "view", `Query: "${String(queryParam).trim()}"`);
  }

  const exactSheetParam = req.query.exactSheet ? String(req.query.exactSheet) : undefined;

  const searchInput = String(queryParam).trim().toLowerCase();
  if (!searchInput) {
    return res.status(400).json({ error: "Query cannot be empty." });
  }

  if (memorySheets.length === 0) {
    if (isLoading) {
      return res.status(503).json({ error: "Database cache is currently loading. Please retry in a few seconds." });
    }
    return res.status(503).json({ error: "Database cache is empty. Error: " + (loadError || "Unknown connection error") });
  }

  try {
    const userEmail = req.headers["x-user-email"] as string;
    const allowedCenters = getUserAllowedCenters(userEmail);
    const userSheets = filterSheetsByCenters(memorySheets, allowedCenters);

    const targetRegNos = new Set<string>();
    const profilesMap: Record<string, any> = {};
    const testsMap: Record<string, any[]> = {};
    let streamType = "";

    // Parse and store detailed metadata for each sheet
    const sheetMetaMap = new Map<string, { date: string; testClass: string; cleanName: string; originalSheetName: string }>();

    userSheets.forEach((sheetObj) => {
      const sheetName = sheetObj.name;
      // Match starts with 1-2 digits, optional st/nd/rd/th suffix, spaces, then Month name
      const dateRegex = /^(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(.*)$/i;

      const dateMatch = sheetName.match(dateRegex);
      let extractedDate = "N/A";
      let testClass = "N/A";
      let cleanTestName = sheetName;

      if (dateMatch) {
        const day = dateMatch[1];
        const month = dateMatch[2];
        const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
        extractedDate = `${day.padStart(2, "0")} ${capitalizedMonth}`;
        
        const remains = dateMatch[3].trim();
        // Regex for extracting Class Batch prefix including Phase / P number or COE
        const classRegex = /^(\d{1,2}(?:st|nd|rd|th)?\s+(?:JEE|NEET|COE)(?:\s+(?:Phase\s*\d+|P\s*[-_]?\s*\d+|COE))*)\s*(.*)$/i;
        const classMatch = remains.match(classRegex);
        
        if (classMatch) {
          testClass = classMatch[1].trim();
          cleanTestName = expandTestName(classMatch[2].trim() || "Test");
        } else {
          // Fallback if no specific batch profile matches, e.g. "Draft", "Sheet21" or simple test strings
          cleanTestName = expandTestName(remains || "Test");
        }
      }

      sheetMetaMap.set(sheetName, {
        date: extractedDate,
        testClass: testClass,
        cleanName: cleanTestName,
        originalSheetName: sheetName,
      });
    });

    // STEP 1: Find Students
    userSheets.forEach((sheetObj) => {
      const data = sheetObj.data;
      const sheetName = sheetObj.name;

      if (exactSheetParam) {
        if (sheetName !== exactSheetParam) return;
      } else {
        if (!isTestSheet(sheetName)) return;
      }

      const headerInfo = findHeaderRow(data);
      if (!headerInfo) return;

      const headers = headerInfo.headers;
      const rIdx = headerInfo.index;

      const idxReg = findColumnIndex(headers, ["reg no", "roll no"]);
      const idxName = findColumnIndex(headers, ["student name", "name"]);
      const idxBatch = findColumnIndex(headers, ["batch"]);

      if (idxReg === -1) return;

      const sheetMeta = sheetMetaMap.get(sheetName);
      const cleanTestName = sheetMeta ? sheetMeta.cleanName.toLowerCase().trim() : "";
      const lowerSheetName = sheetName.toLowerCase().trim();

      for (let i = rIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        const reg = String(row[idxReg] || "").trim();
        const name = idxName !== -1 ? String(row[idxName] || "").trim() : "";
        const batch = idxBatch !== -1 ? String(row[idxBatch] || "").trim() : "";

        const isSheetMatch = (searchInput === lowerSheetName || (cleanTestName && searchInput === cleanTestName));

        if (
          reg &&
          (searchInput === "all" ||
            isSheetMatch ||
            reg.toLowerCase() === searchInput ||
            name.toLowerCase() === searchInput ||
            batch.toLowerCase() === searchInput)
        ) {
          targetRegNos.add(reg);
          if (!profilesMap[reg]) {
            profilesMap[reg] = {
              regNo: reg,
              name: name || "N/A",
              batch: batch || "N/A",
              center: sheetObj.center || "Pimpri PW Vidyapeeth",
            };
          } else {
            if (name && name !== "N/A" && name !== "#N/A" && (profilesMap[reg].name === "N/A" || profilesMap[reg].name === "#N/A")) {
              profilesMap[reg].name = name;
            }
            if (batch && batch !== "N/A" && (profilesMap[reg].batch === "N/A" || !profilesMap[reg].batch)) {
              profilesMap[reg].batch = batch;
            }
          }
        }
      }
    });

    if (targetRegNos.size === 0) {
      return res.status(404).json({ error: "No records found matching: " + searchInput });
    }

    targetRegNos.forEach((reg) => {
      testsMap[reg] = [];
    });

    // STEP 2: Extract Test Marks
    userSheets.forEach((sheetObj) => {
      const data = sheetObj.data;
      const sheetName = sheetObj.name;

      if (exactSheetParam) {
        if (sheetName !== exactSheetParam) return;
      } else {
        if (!isTestSheet(sheetName)) return;
      }

      if (req.query.singleSheet === "true") {
        const sheetMeta = sheetMetaMap.get(sheetName);
        const cleanTestName = sheetMeta ? sheetMeta.cleanName.toLowerCase().trim() : "";
        const lowerSheetName = sheetName.toLowerCase().trim();
        const isSheetMatch = (searchInput === lowerSheetName || (cleanTestName && searchInput === cleanTestName));
        if (!isSheetMatch) return;
      }

      const headerInfo = findHeaderRow(data);
      if (!headerInfo) return;
      const headers = headerInfo.headers;
      const rIdx = headerInfo.index;

      const idxReg = findColumnIndex(headers, ["reg no", "roll no"]);
      if (idxReg === -1) return;

      // Extract subject columns dynamically from original headers (preserving formatting)
      const originalHeaders = data[headerInfo.index] || [];
      const subjectCols: { name: string; index: number; normalized: string }[] = [];
      originalHeaders.forEach((rawHeader: any, index: number) => {
        const parsedHeader = String(rawHeader || "").trim();
        if (parsedHeader && isSubjectHeader(parsedHeader)) {
          subjectCols.push({
            name: parsedHeader,
            index,
            normalized: normalizeHeader(parsedHeader),
          });
        }
      });

      const isNEETSheet = /neet/i.test(sheetName) || headers.includes("botany") || headers.includes("zoology");
      const isJEESheet = !isNEETSheet && (/jee/i.test(sheetName) || headers.includes("mathematics") || headers.includes("maths"));
      const isFoundationSheet = !isNEETSheet && !isJEESheet && (/foundation/i.test(sheetName) || /fnd/i.test(sheetName) || /class\s*(?:6|7|8|9|10)/i.test(sheetName) || headers.includes("science") || headers.includes("sst") || headers.includes("social studies") || headers.includes("mat") || headers.includes("mental ability") || headers.includes("english"));

      const sheetStream = isNEETSheet ? "NEET" : isFoundationSheet ? "Foundation" : "JEE";

      const idxScore = findColumnIndex(headers, ["score", "total marks", "marks"]);
      const idxOutOf = findColumnIndex(headers, ["out of", "max marks"]);
      const idxUnattempted = findColumnIndex(headers, ["unattempted", "unattempt"]);
      const idxRank = findColumnIndex(headers, ["center rank", "rank"]);
      const idxBatch = findColumnIndex(headers, ["batch"]);

      const idxPhy = findColumnIndex(headers, ["physics", "avg physics %", "physics marks"]);
      const idxChem = findColumnIndex(headers, ["chemistry", "chemisytry", "avg chemistry %", "chemistry marks"]);
      const idxMaths = findColumnIndex(headers, ["mathematics", "maths", "avg maths %"]);
      const idxBot = findColumnIndex(headers, ["botany", "botany marks"]);
      const idxZoo = findColumnIndex(headers, ["zoology", "zoology marks"]);

      for (let j = rIdx + 1; j < data.length; j++) {
        const row = data[j];
        if (!row) continue;
        const reg = String(row[idxReg] || "").trim();

        if (targetRegNos.has(reg)) {
          const sheetMeta = sheetMetaMap.get(sheetName) || {
            date: "N/A",
            testClass: "N/A",
            cleanName: sheetName,
            originalSheetName: sheetName,
          };

          const studBatch = idxBatch !== -1 ? String(row[idxBatch] || "").trim() : (profilesMap[reg]?.batch || "");
          const batchInfo = parseBatchInfo(studBatch);
          const testStream = batchInfo ? batchInfo.stream : sheetStream;

          const testObj: any = {
            date: sheetMeta.date,
            testClass:
              sheetMeta.testClass && sheetMeta.testClass !== "N/A" && sheetMeta.testClass !== "-"
                ? sheetMeta.testClass
                : (batchInfo ? batchInfo.class : "N/A"),
            name: sheetMeta.cleanName,
            originalSheetName: sheetMeta.originalSheetName,
            type: "Test",
            outOf:
              idxOutOf !== -1 && row[idxOutOf] !== undefined && row[idxOutOf] !== ""
                ? row[idxOutOf]
                : testStream === "JEE"
                ? 300
                : testStream === "NEET"
                ? 720
                : 100,
            score: idxScore !== -1 && row[idxScore] !== undefined ? row[idxScore] : "N/A",
            avgScore: "N/A",
            sub1: idxPhy !== -1 && row[idxPhy] !== undefined ? row[idxPhy] : "-",
            sub2: idxChem !== -1 && row[idxChem] !== undefined ? row[idxChem] : "-",
            sub3:
              testStream === "JEE"
                ? idxMaths !== -1 && row[idxMaths] !== undefined
                  ? row[idxMaths]
                  : "-"
                : idxBot !== -1 && row[idxBot] !== undefined
                ? row[idxBot]
                : "-",
            sub4:
              testStream === "NEET" && idxZoo !== -1 && row[idxZoo] !== undefined
                ? row[idxZoo]
                : "-",
            unattempted:
              idxUnattempted !== -1 && row[idxUnattempted] !== undefined
                ? row[idxUnattempted]
                : "-",
            centerRank: idxRank !== -1 && row[idxRank] !== undefined ? row[idxRank] : "-",
            subjectScores: subjectCols.map((col) => ({
              subject: col.name,
              score: row[col.index] !== undefined && row[col.index] !== "" ? row[col.index] : "-",
            })),
            stream: testStream,
            center: sheetObj.center || "Pimpri PW Vidyapeeth",
          };

          if (testObj.score !== "N/A" && testObj.score !== "") {
            const scoreParsed = parseFloat(testObj.score);
            const outOfParsed = parseFloat(testObj.outOf);
            if (!isNaN(scoreParsed) && !isNaN(outOfParsed) && outOfParsed > 0) {
              testObj.avgScore = String((scoreParsed / outOfParsed) * 100);
            }
          }

          testsMap[reg].push(testObj);
        }
      }
    });

    const studentsArray: any[] = [];
    targetRegNos.forEach((reg) => {
      const sTests = testsMap[reg] || [];

      const updatedTests = sTests.map((t: any) => {
        return {
          ...t,
          type: t.name || "Test"
        };
      });

      // Sort tests chronologically (ascending order) so the latest test is at the end of the array
      updatedTests.sort((a, b) => {
        const dateA = parseSheetDate(a.originalSheetName || "");
        const dateB = parseSheetDate(b.originalSheetName || "");
        if (dateA.month !== dateB.month) {
          return dateA.month - dateB.month;
        }
        return dateA.day - dateB.day;
      });

      let latestRank = "N/A";
      let latestRankDate = "N/A";
      if (updatedTests.length > 0) {
        const validRanks = updatedTests.filter((t) => t.centerRank !== "-" && t.centerRank !== "");
        if (validRanks.length > 0) {
          latestRank = validRanks[validRanks.length - 1].centerRank;
          latestRankDate = validRanks[validRanks.length - 1].date;
        }
      }

      const profile = profilesMap[reg];
      profile.latestRank = latestRank;
      profile.latestRankDate = latestRankDate;
      
      const detectedInfo = detectStreamAndClass(profile.batch, updatedTests.flatMap((t: any) => (t.subjectScores || []).map((s: any) => s.subject)));
      profile.stream = detectedInfo.stream;
      profile.class = detectedInfo.class;
      
      // Determine the mapped center based on the student's latest test record
      let latestCenter = profile.center || "Pimpri PW Vidyapeeth";
      if (updatedTests.length > 0) {
        const latestTest = updatedTests[updatedTests.length - 1];
        if (latestTest && latestTest.center) {
          latestCenter = latestTest.center;
        }
      }
      profile.center = latestCenter;
      
      // Inject secure cryptographic shareToken
      profile.shareToken = generateShareToken(reg);

      studentsArray.push({
        profile: profile,
        tests: updatedTests,
      });
    });

    let finalStreamType = "JEE";
    if (studentsArray.length > 0) {
      const allProfileStreams = studentsArray.map((s) => s.profile.stream);
      const allTestStreams = studentsArray.flatMap((s) => (s.tests || []).map((t: any) => t.stream));
      
      if (allProfileStreams.includes("NEET") || allTestStreams.includes("NEET")) {
        finalStreamType = "NEET";
      } else if (allProfileStreams.includes("Foundation") || allTestStreams.includes("Foundation")) {
        finalStreamType = "Foundation";
      } else if (allProfileStreams.length > 0 && allProfileStreams[0]) {
        finalStreamType = allProfileStreams[0];
      } else if (allTestStreams.length > 0 && allTestStreams[0]) {
        finalStreamType = allTestStreams[0];
      } else {
        const firstBatch = String(studentsArray[0].profile.batch || "").toUpperCase();
        if (firstBatch.includes("NEET") || firstBatch.includes("MED") || firstBatch.includes("BIO") || firstBatch.includes("N")) {
          finalStreamType = "NEET";
        } else if (firstBatch.includes("FND") || firstBatch.includes("FOUNDATION") || /CLASS\s*[6789]/i.test(firstBatch)) {
          finalStreamType = "Foundation";
        }
      }
    }

    res.json({
      stream: finalStreamType,
      students: studentsArray,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Core Engine Error: " + err.toString() });
  }
});

//  SESSION + ROLE + ADMIN PANEL ENDPOINTS
// ============================================================

const VALID_ROLES: Role[] = ["admin", "teacher", "staff"];

// Register/refresh a login session. First ever user becomes super-admin.
app.post("/api/auth/session", verifyRequest, (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const name = req.body?.name ? String(req.body.name) : undefined;
  const event = req.body?.event === "resume" ? "resume" : "login";
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }
  const user = ensureUser(email, name);
  user.lastLogin = fmtIST();
  saveAppState();
  logActivity(email, event === "resume" ? "session_resume" : "login", name ? `as ${name}` : undefined);
  res.json({ email: user.email, name: user.name, role: user.role, center: user.center || "", isSuperAdmin: isSuperAdmin(user.email) });
});

// Lightweight role lookup (no logging)
app.get("/api/me", (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Email required." });
  res.json({ email, role: getRoleForEmail(email), center: getCenterForEmail(email), isSuperAdmin: isSuperAdmin(email) });
});

// --- Admin: list users ---
app.get("/api/admin/users", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const users = Object.values(appState.users).sort((a, b) => a.email.localeCompare(b.email));
  res.json({ users, sheetConfigured: settingsStore.isConfigured() });
});

// --- Admin: pull the roster fresh from the settings spreadsheet ---
app.post("/api/admin/users/reload", async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  if (!settingsStore.isConfigured()) {
    return res.status(400).json({ error: "Settings spreadsheet is not configured." });
  }
  await loadUsersFromSheet();
  logActivity(admin.email, "users_reload", "Pulled roster from settings sheet");
  res.json({ success: true, count: Object.keys(appState.users).length });
});

// --- Admin: set a single user's role (and optionally center) ---
app.post("/api/admin/users/role", (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const email = String(req.body?.email || "").trim().toLowerCase();
  const role = String(req.body?.role || "").trim().toLowerCase() as Role;
  const center = req.body?.center !== undefined ? String(req.body.center).trim() : undefined;
  if (!email || !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: "Valid email and role (admin/teacher/staff) required." });
  }
  // Only super-admins can assign the "admin" role
  const requesterEmail = String(req.headers["x-user-email"] || "").trim().toLowerCase();
  if (role === "admin" && !isSuperAdmin(requesterEmail)) {
    return res.status(403).json({ error: "Only the super-admin can assign admin privileges." });
  }
  const existing = appState.users[email];
  // Prevent demoting the last remaining admin
  if (existing && existing.role === "admin" && role !== "admin") {
    const adminCount = Object.values(appState.users).filter((u) => u.role === "admin").length;
    if (adminCount <= 1) {
      return res.status(400).json({ error: "Cannot demote the last admin. Promote someone else first." });
    }
  }
  if (existing) {
    existing.role = role;
    if (center !== undefined) existing.center = center;
  } else {
    appState.users[email] = {
      email,
      role,
      center: center || "",
      addedAt: fmtIST(),
      addedBy: admin.email,
    };
  }
  saveAppState();
  flushUsersToSheet();
  logActivity(admin.email, "role_change", `${email} → ${role}${center !== undefined ? ` @ ${center || "—"}` : ""}`);
  res.json({ success: true, user: appState.users[email] });
});

// --- Admin: bulk add emails with a role (+ optional center) ---
app.post("/api/admin/users/bulk", (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const raw = String(req.body?.emails || "");
  const role = String(req.body?.role || "staff").trim().toLowerCase() as Role;
  const center = req.body?.center !== undefined ? String(req.body.center).trim() : "";
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: "Invalid role." });
  }
  // Only super-admins can bulk-assign the "admin" role
  const bulkRequester = String(req.headers["x-user-email"] || "").trim().toLowerCase();
  if (role === "admin" && !isSuperAdmin(bulkRequester)) {
    return res.status(403).json({ error: "Only the super-admin can assign admin privileges." });
  }
  // Split on commas, semicolons, whitespace or newlines
  const candidates = raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const added: string[] = [];
  const updated: string[] = [];
  const invalid: string[] = [];

  candidates.forEach((email) => {
    if (!emailRegex.test(email)) {
      invalid.push(email);
      return;
    }
    if (appState.users[email]) {
      appState.users[email].role = role;
      if (center) appState.users[email].center = center;
      updated.push(email);
    } else {
      appState.users[email] = {
        email,
        role,
        center,
        addedAt: fmtIST(),
        addedBy: admin.email,
      };
      added.push(email);
    }
  });

  saveAppState();
  flushUsersToSheet();
  logActivity(admin.email, "bulk_import", `${added.length} added, ${updated.length} updated as ${role}${center ? ` @ ${center}` : ""}`);
  res.json({ success: true, added, updated, invalid });
});

// --- Admin: remove a user ---
app.delete("/api/admin/users", (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const email = String(req.body?.email || req.query.email || "").trim().toLowerCase();
  if (!email || !appState.users[email]) {
    return res.status(404).json({ error: "User not found." });
  }
  if (appState.users[email].role === "admin") {
    const adminCount = Object.values(appState.users).filter((u) => u.role === "admin").length;
    if (adminCount <= 1) {
      return res.status(400).json({ error: "Cannot remove the last admin." });
    }
  }
  delete appState.users[email];
  saveAppState();
  flushUsersToSheet();
  logActivity(admin.email, "user_removed", email);
  res.json({ success: true });
});

// --- Admin: activity log ---
app.get("/api/admin/activity", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const limit = Math.min(parseInt(String(req.query.limit || "300"), 10) || 300, MAX_LOG_ENTRIES);
  res.json({ activity: appState.activityLog.slice(0, limit), total: appState.activityLog.length });
});

// --- Admin: notifications ---
app.get("/api/admin/notifications", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const unread = appState.notifications.filter((n) => !n.read).length;
  res.json({ notifications: appState.notifications.slice(0, 200), unread });
});

app.post("/api/admin/notifications/read", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = req.body?.id ? String(req.body.id) : null;
  if (id) {
    const n = appState.notifications.find((x) => x.id === id);
    if (n) n.read = true;
  } else {
    appState.notifications.forEach((n) => (n.read = true));
  }
  saveAppState();
  res.json({ success: true, unread: appState.notifications.filter((n) => !n.read).length });
});

app.post("/api/admin/notifications/clear", (req, res) => {
  if (!requireAdmin(req, res)) return;
  appState.notifications = [];
  saveAppState();
  res.json({ success: true });
});

// --- Admin: last sync per sheet/center ---
app.get("/api/admin/sync-status", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const sheets = sortSheetNamesDescending(memorySheets.map((s) => s.name)).map((name) => {
    const sheet = memorySheets.find((s) => s.name === name);
    const info = appState.sheetSync[name];
    return {
      name,
      center: sheet ? (sheet as any).center || "" : "",
      rows: info ? info.rows : (sheet ? countSheetRows(sheet) : 0),
      lastSync: info ? info.lastSync : lastLoaded,
    };
  });
  res.json({
    lastLoaded,
    isLoading,
    loadError,
    sheetCount: memorySheets.length,
    sheets,
  });
});

// --- Admin: export cache data (CSV or Excel) ---
app.get("/api/admin/export-cache", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const format = String(req.query.format || "xlsx").toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);

  if (memorySheets.length === 0) {
    return res.status(503).json({ error: "Cache is empty. Sync the database first." });
  }

  if (format === "csv") {
    // Flatten every sheet's rows into one CSV with a "Sheet" column
    const lines: string[] = [];
    const esc = (v: any) => {
      const s = v === undefined || v === null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    memorySheets.forEach((sheet) => {
      sheet.data.forEach((row) => {
        if (!row) return;
        lines.push([esc(sheet.name), ...row.map(esc)].join(","));
      });
    });
    const csv = "Sheet,Data...\n" + lines.join("\n");
    const adminCsv = String(req.header("x-user-email") || "").trim().toLowerCase();
    if (adminCsv) logActivity(adminCsv, "export_cache", `format=csv, ${memorySheets.length} sheets`);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="vp-cache-${stamp}.csv"`);
    return res.send(csv);
  }

  // Default: build a multi-sheet XLSX workbook from the cache
  const wb = XLSX.utils.book_new();
  memorySheets.forEach((sheet, i) => {
    const ws = XLSX.utils.aoa_to_sheet(sheet.data);
    // Excel sheet names max 31 chars and must be unique
    let safeName = (sheet.name || `Sheet${i + 1}`).replace(/[\\/?*\[\]:]/g, " ").slice(0, 28);
    if (!safeName.trim()) safeName = `Sheet${i + 1}`;
    let finalName = safeName;
    let dup = 1;
    while (wb.SheetNames.includes(finalName)) {
      finalName = `${safeName.slice(0, 25)}_${dup++}`;
    }
    XLSX.utils.book_append_sheet(wb, ws, finalName);
  });
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const admin = String(req.header("x-user-email") || "").trim().toLowerCase();
  if (admin) logActivity(admin, "export_cache", `format=xlsx, ${memorySheets.length} sheets`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="vp-cache-${stamp}.xlsx"`);
  res.send(buffer);
});

// ═══════════════════════════════════════════════════════════════════════════
//  TIMETABLE MODULE — parse teacher-code timetable from a Google Sheet
// ═══════════════════════════════════════════════════════════════════════════

interface TimetableLecture {
  teacherCode: string;
  day: string;
  date: string;
  startTime: string;
  endTime: string;
  batches: string[];
  rooms: string[];
  isMerged: boolean;
  isExtraLecture: boolean;
}

// State variables (separate from student data)
let timetableSheetUrl: string = "";
let timetableData: TimetableLecture[] = [];
let timetableLastLoaded: string | null = null;
let timetableLoading: boolean = false;
let timetableError: string | null = null;

/** Cached timetable URL loaded from sheet (survives deploys) */
let cachedTimetableUrl: string = "";

/** Read the timetable URL — priority: cached (from sheet) > config.json > env */
function getTimetableUrl(): string {
  if (cachedTimetableUrl) return cachedTimetableUrl;
  const config = getAppConfig();
  return (config as any).TIMETABLE_URL || process.env.TIMETABLE_URL || "";
}

/** Load timetable URL from Google Sheet's TimetableConfig tab (runs on startup) */
async function loadTimetableUrlFromSheet() {
  if (!settingsStore.isConfigured()) return;
  try {
    await settingsStore.ensureTimetableConfigHeader();
    const entries = await settingsStore.readTimetableConfig();
    if (entries.length > 0 && entries[0].sheetLink) {
      cachedTimetableUrl = entries[0].sheetLink;
      console.log(`[TimetableConfig] Loaded URL from sheet: ${entries[0].sheetName || "(unnamed)"}`);
    }
  } catch (err) {
    console.error("[TimetableConfig] Failed to read from sheet:", (err as Error).message);
  }
}

/** Convert Excel time serial (0-1 fraction of day) to "H:MM AM/PM" string */
function excelTimeToString(val: any): string {
  const str = String(val ?? "").trim();
  // Already a formatted time string like "8:45 AM" → return as-is
  if (/\d+:\d+/.test(str)) return str;
  // Excel time serial: 0.364583 = 8:45 AM
  const num = parseFloat(str);
  if (!isNaN(num) && num >= 0 && num <= 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    let hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const ampm = hours >= 12 ? "PM" : "AM";
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  }
  return str;
}

/** Convert Excel date serial number to "DD-Mon-YYYY" string */
function excelDateToString(val: any): string {
  const str = String(val ?? "").trim();
  // Already a formatted date string → return as-is
  if (/[A-Za-z]/.test(str) && /\d/.test(str)) return str;
  const num = parseFloat(str);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    // Excel serial date → JS Date (Excel epoch = Jan 1, 1900, with leap year bug)
    const jsDate = new Date((num - 25569) * 86400 * 1000);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const day = jsDate.getUTCDate();
    const month = months[jsDate.getUTCMonth()];
    const year = jsDate.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }
  return str;
}

/**
 * Fully-dynamic timetable sheet parser.
 *
 * The sheet can have MULTIPLE "Start Time" / "End Time" column pairs.
 * Different batch groups may use different time columns.
 *
 * Strategy:
 *   1. Scan header rows for ALL "Start Time" / "End Time" pairs.
 *   2. Identify batch columns (anything that is not Day/Date/Time/Room metadata).
 *   3. Assign each batch column to the nearest time-pair to its LEFT.
 *   4. Parse data rows using the correct time for each batch group.
 *
 * Merged cells (DAY / DATE spanning multiple time rows) are handled by
 * carrying forward the last non-empty value.
 */
function parseTimetableSheet(sheetData: any[][]): TimetableLecture[] {
  if (!sheetData || sheetData.length < 4) return [];

  const row0 = sheetData[0] || [];
  const row1 = sheetData[1] || [];
  const row2 = sheetData[2] || [];
  const maxCols = Math.max(row0.length, row1.length, row2.length);

  // --- Helper label detectors ---
  const isStartLabel = (val: string) => {
    const v = (val || "").toLowerCase().replace(/[^a-z]/g, "");
    return v === "starttime" || v === "start";
  };
  const isEndLabel = (val: string) => {
    const v = (val || "").toLowerCase().replace(/[^a-z]/g, "");
    return v === "endtime" || v === "end";
  };
  const isDayLabel = (val: string) => /^day$/i.test((val || "").trim());
  const isDateLabel = (val: string) => /^date$/i.test((val || "").trim());
  const isRoomLabel = (val: string) => /room/i.test((val || "").trim());

  // Helper: get cell string from all 3 header rows
  const getHeaderVals = (col: number): string[] => [
    String(row0[col] ?? "").trim(),
    String(row1[col] ?? "").trim(),
    String(row2[col] ?? "").trim(),
  ];

  // --- Step 1: Find all metadata columns (Day, Date, Start Time, End Time, Room) ---
  const metadataCols = new Set<number>();
  const startCols: number[] = [];
  const endCols: number[] = [];

  for (let col = 0; col < maxCols; col++) {
    const vals = getHeaderVals(col);
    const any = vals.join(" ");

    if (vals.some(v => isDayLabel(v)))   metadataCols.add(col);
    if (vals.some(v => isDateLabel(v)))  metadataCols.add(col);
    if (vals.some(v => isRoomLabel(v)))  metadataCols.add(col);

    if (vals.some(v => isStartLabel(v)) || isStartLabel(any)) {
      startCols.push(col);
      metadataCols.add(col);
    }
    if (vals.some(v => isEndLabel(v)) || isEndLabel(any)) {
      endCols.push(col);
      metadataCols.add(col);
    }
  }

  // --- Step 2: Pair Start and End columns ---
  interface TimePair { startCol: number; endCol: number; }
  const timePairs: TimePair[] = [];

  for (const sc of startCols) {
    // Find closest End Time column to the right (within 3 columns)
    const matchEnd = endCols.find(ec => ec > sc && ec <= sc + 3);
    if (matchEnd !== undefined) {
      timePairs.push({ startCol: sc, endCol: matchEnd });
    }
  }

  // Fallback: if no pairs detected, assume cols 2-3
  if (timePairs.length === 0) {
    timePairs.push({ startCol: 2, endCol: 3 });
  }

  console.log(`Timetable parser: detected ${timePairs.length} time group(s): ${JSON.stringify(timePairs)}`);

  // --- Step 3: Find Day and Date columns ---
  let dayCol = 0;
  let dateCol = 1;
  for (let col = 0; col < Math.min(maxCols, 10); col++) {
    const vals = getHeaderVals(col);
    if (vals.some(v => isDayLabel(v)))  dayCol = col;
    if (vals.some(v => isDateLabel(v))) dateCol = col;
  }

  // --- Step 4: Discover batch columns (everything not metadata) ---
  interface BatchColumn {
    index: number;
    batchName: string;
    room: string;
    isExtra: boolean;
    timePairIndex: number;
  }

  const batchColumns: BatchColumn[] = [];

  for (let col = 0; col < maxCols; col++) {
    if (metadataCols.has(col)) continue;

    const part0 = String(row0[col] ?? "").trim();
    const part1 = String(row1[col] ?? "").trim();
    const room  = String(row2[col] ?? "").trim();

    const parts = [part0, part1].filter(Boolean);
    const batchName = parts.join(" ");
    if (!batchName) continue;

    // Skip purely numeric columns (e.g., "152", "4")
    if (/^\d+$/.test(batchName) && batchName.length <= 4) {
      metadataCols.add(col);
      continue;
    }

    // Skip room-only headers
    if (isRoomLabel(batchName)) {
      metadataCols.add(col);
      continue;
    }

    const isExtra = /\b(EXTRA|EL|SPECIAL)\b/i.test(batchName);

    // Assign to nearest time-pair to the LEFT
    let timePairIndex = 0;
    for (let tp = timePairs.length - 1; tp >= 0; tp--) {
      if (timePairs[tp].startCol < col) {
        timePairIndex = tp;
        break;
      }
    }

    batchColumns.push({ index: col, batchName, room, isExtra, timePairIndex });
  }

  if (batchColumns.length === 0) return [];

  console.log(`Timetable parser: ${batchColumns.length} batch column(s) across ${timePairs.length} time group(s)`);

  // --- Step 5: Parse data rows ---
  const lectures: TimetableLecture[] = [];
  let lastDay = "";
  let lastDate = "";

  for (let r = 3; r < sheetData.length; r++) {
    const row = sheetData[r] || [];

    // Handle merged cells for Day & Date
    const rawDay  = String(row[dayCol] ?? "").trim();
    const rawDate = excelDateToString(row[dateCol]);
    if (rawDay)  lastDay  = rawDay;
    if (rawDate) lastDate = rawDate;

    // Check if at least one time pair has valid data
    const rowHasTime = timePairs.some(tp => {
      const st = String(row[tp.startCol] ?? "").trim();
      return st.length > 0;
    });
    if (!rowHasTime) continue;

    // Group by teacherCode + time → combine batches/rooms
    const codeMap = new Map<string, {
      batches: string[];
      rooms: string[];
      isExtra: boolean;
      startTime: string;
      endTime: string;
    }>();

    for (const bc of batchColumns) {
      const cellVal = String(row[bc.index] ?? "").trim();
      if (!cellVal) continue;

      // Teacher codes are 2-5 uppercase letters (e.g., CSI, PMT, PQL, PHP)
      // Reject: numbers, day names, test descriptions, room numbers, long strings
      if (!/^[A-Z]{2,5}$/i.test(cellVal)) continue;
      const upperCode = cellVal.toUpperCase();
      // Skip day names and common non-code words that might appear in cells
      if (/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY|ROOM|DATE|TIME|DAY)$/.test(upperCode)) continue;

      const tp = timePairs[bc.timePairIndex];
      const startTime = excelTimeToString(row[tp.startCol]);
      const endTime   = excelTimeToString(row[tp.endCol]);
      if (!startTime || !endTime) continue;

      const teacherCode = upperCode;
      const mapKey = `${teacherCode}||${startTime}||${endTime}`;

      if (!codeMap.has(mapKey)) {
        codeMap.set(mapKey, { batches: [], rooms: [], isExtra: bc.isExtra, startTime, endTime });
      }
      const entry = codeMap.get(mapKey)!;
      if (!entry.batches.includes(bc.batchName)) entry.batches.push(bc.batchName);
      if (bc.room && !entry.rooms.includes(bc.room)) entry.rooms.push(bc.room);
      if (bc.isExtra) entry.isExtra = true;
    }

    for (const [mapKey, info] of Array.from(codeMap.entries())) {
      const teacherCode = mapKey.split("||")[0];
      lectures.push({
        teacherCode,
        day: lastDay,
        date: lastDate,
        startTime: info.startTime,
        endTime: info.endTime,
        batches: info.batches,
        rooms: info.rooms,
        isMerged: info.batches.length > 1,
        isExtraLecture: info.isExtra,
      });
    }
  }

  return lectures;
}

/** Download and parse the timetable spreadsheet */
async function loadTimetableData() {
  if (timetableLoading) return;
  const url = getTimetableUrl();
  if (!url) {
    timetableError = "No timetable sheet URL configured.";
    return;
  }
  timetableLoading = true;
  timetableError = null;
  try {
    const normalized = normalizeSpreadsheetUrl(url);
    const res = await fetch(normalized);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `HTTP ${res.status} Unauthorized — sheet is not publicly accessible. ` +
          `Open the sheet → Share → "Anyone with the link" → Viewer.`
        );
      }
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const buffer = await res.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });

    // Extract GID from URL if present (e.g., #gid=282013146 or ?gid=282013146)
    const gidMatch = url.match(/gid=(\d+)/);
    const targetGid = gidMatch ? gidMatch[1] : null;

    // Determine which sheet(s) to parse:
    // 1. If URL has gid → find that specific sheet
    // 2. Otherwise → parse only the FIRST sheet
    let sheetsToProcess: string[] = [];

    if (targetGid) {
      // Try to match GID to a sheet — XLSX.js stores sheet metadata
      // The GID maps to the sheet index in most cases
      // Google Sheets assigns GID per tab; the first tab is usually gid=0
      // We'll fetch the GID mapping from the HTML page
      const gidsMap = await fetchSheetGids(url);
      let foundSheet: string | null = null;

      for (const [name, gid] of Object.entries(gidsMap)) {
        if (gid === targetGid) {
          foundSheet = name;
          break;
        }
      }

      if (foundSheet && wb.SheetNames.includes(foundSheet)) {
        sheetsToProcess = [foundSheet];
        console.log(`Timetable: using specific sheet "${foundSheet}" (gid=${targetGid})`);
      } else {
        // Fallback: if GID mapping failed, use the first sheet
        sheetsToProcess = [wb.SheetNames[0]];
        console.log(`Timetable: GID ${targetGid} not found in mapping, using first sheet "${wb.SheetNames[0]}"`);
      }
    } else {
      // No GID specified → first sheet only
      sheetsToProcess = [wb.SheetNames[0]];
      console.log(`Timetable: no GID in URL, using first sheet "${wb.SheetNames[0]}"`);
    }

    // Parse selected sheet(s)
    const allLectures: TimetableLecture[] = [];
    for (const sheetName of sheetsToProcess) {
      const worksheet = wb.Sheets[sheetName];
      if (!worksheet) continue;
      const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 }) as any[][];
      if (data.length < 4) continue;

      const lectures = parseTimetableSheet(data);
      if (lectures.length > 0) {
        console.log(`  Sheet "${sheetName}": ${lectures.length} lectures parsed`);
        allLectures.push(...lectures);
      }
    }

    timetableData = allLectures;
    timetableSheetUrl = url;
    timetableLastLoaded = fmtIST();
    console.log(
      `Timetable loaded: ${timetableData.length} lectures from sheet "${sheetsToProcess.join(", ")}", ` +
      `${new Set(timetableData.map(l => l.teacherCode)).size} teachers`
    );
  } catch (err: any) {
    timetableError = err.message || String(err);
    console.error("Failed to load timetable:", timetableError);
  } finally {
    timetableLoading = false;
  }
}

// ── Timetable API endpoints ─────────────────────────────────────────────

/**
 * GET /api/timetable/my-code
 * Return the teacher code matching the logged-in user's email.
 * Uses Faculty Details sheet to find email → code mapping.
 */
app.get("/api/timetable/my-code", verifyRequest, async (req, res) => {
  try {
    const email = String(req.headers["x-user-email"] || "").trim().toLowerCase();
    if (!email) return res.json({ code: null, reason: "No email provided" });

    // Check if feature is enabled
    const config = getAppConfig() as any;
    if (config.TEACHER_AUTO_TIMETABLE === false) {
      return res.json({ code: null, reason: "Feature disabled by admin" });
    }

    const faculty = await settingsStore.readFacultyDetails();
    const match = faculty.find(f => f.email.toLowerCase() === email && f.code);

    if (match) {
      res.json({
        code: match.code,
        name: match.name,
        email: match.email,
        subject: match.subject,
        division: match.division,
      });
    } else {
      res.json({ code: null, reason: "No matching faculty found for this email" });
    }
  } catch (err: any) {
    console.error("[/api/timetable/my-code] Error:", err.message);
    res.json({ code: null, reason: "Error looking up faculty: " + err.message });
  }
});

/**
 * GET /api/timetable?code=CSI
 * Return filtered lectures for a teacher code, or all if no code given.
 */
app.get("/api/timetable", verifyRequest, (req, res) => {
  const code = String(req.query.code ?? "").trim().toUpperCase();
  const filtered = code
    ? timetableData.filter(l => l.teacherCode.toUpperCase() === code)
    : timetableData;
  res.json({
    lectures: filtered,
    total: filtered.length,
    lastLoaded: timetableLastLoaded,
  });
});

/**
 * GET /api/timetable/codes
 * Return all unique teacher codes with lecture counts.
 */
app.get("/api/timetable/codes", verifyRequest, (_req, res) => {
  const counts = new Map<string, number>();
  for (const l of timetableData) {
    counts.set(l.teacherCode, (counts.get(l.teacherCode) || 0) + 1);
  }
  const codes = Array.from(counts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => a.code.localeCompare(b.code));
  res.json({ codes, total: codes.length });
});

/**
 * GET /api/timetable/stats
 * Aggregate statistics about the loaded timetable.
 */
app.get("/api/timetable/stats", verifyRequest, superAdminOnly, (_req, res) => {
  const uniqueTeachers = new Set(timetableData.map(l => l.teacherCode));
  const uniqueBatches = new Set(timetableData.flatMap(l => l.batches));
  res.json({
    totalLectures: timetableData.length,
    totalTeachers: uniqueTeachers.size,
    totalBatches: uniqueBatches.size,
    lastLoaded: timetableLastLoaded,
    isLoading: timetableLoading,
    error: timetableError,
  });
});

/**
 * GET /api/timetable/config
 * Return the current timetable configuration & status.
 */
app.get("/api/timetable/config", verifyRequest, (_req, res) => {
  const config = getAppConfig() as any;
  res.json({
    url: getTimetableUrl(),
    lastLoaded: timetableLastLoaded,
    isLoading: timetableLoading,
    error: timetableError,
    autoTimetable: config.TEACHER_AUTO_TIMETABLE !== false, // default ON
  });
});

/**
 * POST /api/timetable/toggle-auto
 * Super admin toggle: enable/disable auto-timetable for teachers.
 * Body: { enabled: boolean }
 */
app.post("/api/timetable/toggle-auto", verifyRequest, superAdminOnly, (req, res) => {
  try {
    const { enabled } = req.body;
    const config = getAppConfig() as any;
    config.TEACHER_AUTO_TIMETABLE = !!enabled;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");

    const admin = String(req.headers["x-user-email"] || "").trim().toLowerCase();
    if (admin) logActivity(admin, "toggle_auto_timetable", `Auto-timetable ${enabled ? "enabled" : "disabled"}`);

    res.json({ success: true, enabled: !!enabled });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/timetable/config
 * Save a new timetable sheet URL and trigger an immediate load.
 */
app.post("/api/timetable/config", verifyRequest, superAdminOnly, async (req, res) => {
  try {
    const { url } = req.body;
    if (typeof url !== "string" || !url.trim()) {
      return res.status(400).json({ error: "A valid 'url' string is required." });
    }

    const trimmedUrl = url.trim();

    // Persist to config.json alongside existing keys
    const currentConfig = getAppConfig() as any;
    currentConfig.TIMETABLE_URL = trimmedUrl;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(currentConfig, null, 2), "utf-8");

    // Update cached URL
    cachedTimetableUrl = trimmedUrl;

    // Also persist to Google Sheet (survives deploys)
    if (settingsStore.isConfigured()) {
      try {
        await settingsStore.writeTimetableConfig([
          { sheetName: "Weekly Timetable", sheetLink: trimmedUrl },
        ]);
      } catch (e) {
        console.error("[TimetableConfig] Failed to write to sheet:", (e as Error).message);
      }
    }

    const admin = String(req.headers["x-user-email"] || "").trim().toLowerCase();
    if (admin) logActivity(admin, "timetable_config", `URL updated`);

    // Trigger background load
    loadTimetableData();

    res.json({ success: true, message: "Timetable URL saved. Data is reloading in background." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save timetable config: " + err.toString() });
  }
});

/**
 * POST /api/timetable/refresh
 * Re-download and parse the timetable from the configured URL.
 */
app.post("/api/timetable/refresh", verifyRequest, async (req, res) => {
  const admin = String(req.headers["x-user-email"] || "").trim().toLowerCase();
  if (admin) logActivity(admin, "timetable_refresh", "Manual refresh triggered");

  if (timetableLoading) {
    return res.json({ success: false, message: "Timetable is already loading." });
  }

  loadTimetableData();
  res.json({ success: true, message: "Timetable refresh started in background." });
});

/**
 * GET /api/timetable/teachers
 * Return teacher code → name mapping from config.
 */
app.get("/api/timetable/teachers", verifyRequest, (_req, res) => {
  const config = getAppConfig() as any;
  const names: Record<string, string> = config.TEACHER_NAMES || {};
  res.json({ teachers: names });
});

/**
 * POST /api/timetable/teachers
 * Save teacher code → name mappings to config.json.
 * Body: { teachers: { "CSI": "Mohd Shazil Iqbal", ... } }
 * OR: { add: { code: "XYZ", name: "New Teacher" } }
 * OR: { remove: "XYZ" }
 */
app.post("/api/timetable/teachers", verifyRequest, superAdminOnly, (req, res) => {
  try {
    const config = getAppConfig() as any;
    if (!config.TEACHER_NAMES) config.TEACHER_NAMES = {};

    const { teachers, add, remove } = req.body;

    if (teachers && typeof teachers === "object") {
      // Bulk set
      config.TEACHER_NAMES = teachers;
    } else if (add && add.code && add.name) {
      // Add single
      config.TEACHER_NAMES[add.code.toUpperCase().trim()] = add.name.trim();
    } else if (remove) {
      // Remove single
      delete config.TEACHER_NAMES[remove.toUpperCase().trim()];
    }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");

    const admin = String(req.headers["x-user-email"] || "").trim().toLowerCase();
    if (admin) logActivity(admin, "teacher_names_update", `Updated teacher name mappings`);

    res.json({
      success: true,
      message: "Teacher names saved.",
      count: Object.keys(config.TEACHER_NAMES).length,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save: " + err.toString() });
  }
});

// ===== Auto Timetable Generator (super-admin only) =====

/**
 * GET /api/timetable/rooms
 * Read batch → room mappings from the latest timetable sheet tab.
 * Returns rooms for ALL batches (including new ones not in historical data).
 */
app.get("/api/timetable/rooms", verifyRequest, superAdminOnly, async (_req, res) => {
  try {
    const rooms = await settingsStore.readLatestSheetRooms();
    res.json({ success: true, rooms, source: "latest_sheet_tab", count: Object.keys(rooms).length });
  } catch (err: any) {
    console.warn("[/api/timetable/rooms] Error:", err.message);
    res.json({ success: false, rooms: {}, error: err.message });
  }
});

/**
 * GET /api/timetable/faculty
 * Read Faculty Details from the timetable spreadsheet.
 * Returns the full list of active faculty with their assigned batches.
 */
app.get("/api/timetable/faculty", verifyRequest, superAdminOnly, async (_req, res) => {
  try {
    const faculty = await settingsStore.readFacultyDetails();
    res.json({
      faculty,
      total: faculty.length,
      active: faculty.filter((f) => f.status.toLowerCase() === "active").length,
    });
  } catch (err: any) {
    console.error("[/api/timetable/faculty] Error:", err.message);
    res.status(500).json({ error: "Failed to read faculty details: " + err.message });
  }
});

/**
 * POST /api/timetable/generate
 * Run the auto-generation algorithm and return a preview (does NOT write to sheet).
 * Now auto-loads LAST WEEK's timetable as historical reference.
 *
 * Body: {
 *   batches: [{ code, room, section }],
 *   config: { weekStartDate, maxConsecutive?, maxSlotsPerDay?, holidays?, testSlots? }
 * }
 */
app.post("/api/timetable/generate", verifyRequest, superAdminOnly, async (req, res) => {
  try {
    const { batches, config: rawConfig } = req.body;

    if (!batches || !Array.isArray(batches) || batches.length === 0) {
      return res.status(400).json({ error: "'batches' array is required and must not be empty." });
    }
    if (!rawConfig || !rawConfig.weekStartDate) {
      return res.status(400).json({ error: "'config.weekStartDate' is required (e.g. '2026-06-15')." });
    }

    // Read faculty from timetable sheet
    const faculty = await settingsStore.readFacultyDetails();

    // Try to load historical data from the currently loaded timetable
    let historicalData: any[] = [];
    try {
      // Use the already-loaded timetable data (TimetableLecture[])
      if (timetableData && timetableData.length > 0) {
        const dayMap: Record<string, string> = {
          'monday': 'MONDAY', 'tuesday': 'TUESDAY', 'wednesday': 'WEDNESDAY',
          'thursday': 'THURSDAY', 'friday': 'FRIDAY', 'saturday': 'SATURDAY',
        };
        const slotTimeMap: Record<string, number> = {
          '8:45 AM': 1, '10:30 AM': 2, '12:25 PM': 3, '2:15 PM': 4, '4:10 PM': 5, '5:55 PM': 6
        };

        for (const lec of timetableData) {
          const dayNorm = dayMap[lec.day?.toLowerCase()] || '';
          const slotNum = slotTimeMap[lec.startTime] || 0;
          if (dayNorm && slotNum && lec.teacherCode) {
            // Each lecture can have multiple batches
            for (const batch of (lec.batches || [])) {
              historicalData.push({
                day: dayNorm,
                slotNum,
                batchCode: batch,
                teacherCode: lec.teacherCode,
              });
            }
          }
        }
        console.log(`[generate] Loaded ${historicalData.length} historical slots from current timetable`);
      }
    } catch (histErr: any) {
      console.warn("[generate] Could not load historical data:", histErr.message);
    }

    // Build config with defaults + historical data
    const genConfig: GeneratorConfig = {
      weekStartDate: rawConfig.weekStartDate,
      maxConsecutive: rawConfig.maxConsecutive ?? 3,
      maxSlotsPerDay: rawConfig.maxSlotsPerDay ?? 4,
      holidays: rawConfig.holidays ?? [],
      testSlots: rawConfig.testSlots ?? [],
      historicalData,
    };

    const batchInfos: BatchInfo[] = batches.map((b: any) => ({
      code: String(b.code || "").trim(),
      room: String(b.room || "").trim(),
      section: b.section === "NEET" ? "NEET" : b.section === "DROPPER" ? "DROPPER" : "JEE",
    }));

    const result = generateTimetable(faculty, batchInfos, genConfig);

    const admin = String(req.headers["x-user-email"] || "").trim().toLowerCase();
    if (admin) logActivity(admin, "timetable_generate", `Generated ${result.slots.length} slots, ${result.warnings.length} warnings, ${historicalData.length} historical refs`);

    res.json({
      success: true,
      slots: result.slots,
      totalSlots: result.slots.length,
      warnings: result.warnings,
      config: genConfig,
      historicalUsed: historicalData.length,
    });
  } catch (err: any) {
    console.error("[/api/timetable/generate] Error:", err.message);
    res.status(500).json({ error: "Timetable generation failed: " + err.message });
  }
});

/**
 * POST /api/timetable/ai-resolve
 * DUAL AI: Pattern AI (local, instant) + HuggingFace AI (cloud, deep analysis)
 * Pattern AI always works. HuggingFace is bonus layer if HF_TOKEN is set.
 */
app.post("/api/timetable/ai-resolve", verifyRequest, superAdminOnly, async (req, res) => {
  try {
    const { warnings, faculty: clientFaculty, currentSlots, config } = req.body;
    
    if (!warnings || !Array.isArray(warnings) || warnings.length === 0) {
      return res.json({ success: true, patternSuggestions: [], hfSuggestions: [], message: "No conflicts to resolve" });
    }

    // Load faculty from server (more reliable than client data)
    let facultyList = clientFaculty;
    try {
      const serverFaculty = await settingsStore.readFacultyDetails();
      if (serverFaculty.length > 0) facultyList = serverFaculty;
    } catch { /* use client data */ }

    // ── LAYER 1: Pattern AI (instant, always works) ──
    const patternSuggestions = aiResolveConflicts(
      warnings,
      facultyList || [],
      currentSlots || [],
    );

    // ── LAYER 2: HuggingFace AI (cloud, deep analysis) ──
    let hfSuggestions: any[] = [];
    let hfModel = "";
    let hfError = "";

    const HF_TOKEN = process.env.HF_TOKEN || "";
    if (HF_TOKEN) {
      try {
        const activeTeachers = (facultyList || [])
          .filter((f: any) => f.status?.toLowerCase() === "active")
          .map((t: any) => `${t.code}: ${t.name} (${t.subject}, ${t.division}) → [${t.batches?.join(", ")}]`)
          .join("\n");

        const teacherLoad: Record<string, number> = {};
        for (const s of (currentSlots || [])) {
          teacherLoad[s.teacherCode] = (teacherLoad[s.teacherCode] || 0) + 1;
        }
        const loadInfo = Object.entries(teacherLoad)
          .sort((a, b) => b[1] - a[1])
          .map(([t, c]) => `${t}: ${c}`)
          .join(", ");

        // Include pattern AI suggestions as context for HuggingFace
        const patternContext = patternSuggestions
          .map(s => `Pattern AI suggests ${s.teacher || "none"} for: ${s.conflict} (${s.confidence}% confidence)`)
          .join("\n");

        const prompt = `You are an expert school timetable scheduler. Our Pattern AI has already analyzed these conflicts using 14 weeks of historical data. Review and improve the suggestions.

RULES:
- Max ${config?.maxConsecutive || 3} consecutive lectures per teacher
- Max ${config?.maxSlotsPerDay || 4} slots per teacher per day
- Batch suffix: MA=morning(slots 1-2), NA=afternoon(3-4), EA=evening(5-6)
- Teacher cannot teach 2 batches at same time

TEACHER WORKLOAD: ${loadInfo}

TEACHERS:
${activeTeachers}

PATTERN AI SUGGESTIONS:
${patternContext}

CONFLICTS:
${warnings.join("\n")}

For each conflict, confirm or improve the Pattern AI suggestion. If you agree, say "Agree with Pattern AI". If not, suggest a better teacher and explain why.

Respond ONLY in JSON: {"suggestions":[{"conflict":"...","teacher":"CODE","reason":"...","agrees_with_pattern":true/false}]}`;

        hfModel = "mistralai/Mistral-7B-Instruct-v0.3";
        const hfRes = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: { max_new_tokens: 1024, temperature: 0.3, return_full_text: false },
          }),
        });

        if (hfRes.ok) {
          const hfData = await hfRes.json();
          let aiText = "";
          if (Array.isArray(hfData) && hfData[0]?.generated_text) {
            aiText = hfData[0].generated_text;
          } else if (typeof hfData === "string") {
            aiText = hfData;
          }

          try {
            const jsonMatch = aiText.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              hfSuggestions = parsed.suggestions || [];
            }
          } catch {
            if (aiText.trim()) {
              hfSuggestions = [{ conflict: "HF Analysis", teacher: "", reason: aiText.trim() }];
            }
          }
        } else {
          hfError = `HF API ${hfRes.status}`;
        }
      } catch (e: any) {
        hfError = e.message || "HF API failed";
        console.warn("[ai-resolve] HF error:", hfError);
      }
    }

    const admin = String(req.headers["x-user-email"] || "").trim().toLowerCase();
    if (admin) logActivity(admin, "timetable_ai_resolve", `Dual AI: ${patternSuggestions.length} pattern + ${hfSuggestions.length} HF suggestions`);

    res.json({
      success: true,
      patternSuggestions,
      hfSuggestions,
      hfModel: hfModel || null,
      hfError: hfError || null,
      hfAvailable: !!HF_TOKEN,
      totalPatterns: "377 slot patterns, 35 batches, 36 teachers",
    });
  } catch (err: any) {
    console.error("[/api/timetable/ai-resolve] Error:", err.message);
    res.status(500).json({ error: "AI resolution failed: " + err.message, patternSuggestions: [], hfSuggestions: [] });
  }
});

/**
 * POST /api/timetable/write-sheet
 * Write a previously-generated timetable to the Google Sheet as a new tab
 * with full colour formatting.
 *
 * Body: {
 *   tabName: string,              // e.g. "15th-20th June 2026"
 *   grid: TimetableGridCell[][],   // 2D array of { value, color?, day? }
 *   spreadsheetId?: string         // optional override
 * }
 */
app.post("/api/timetable/write-sheet", verifyRequest, superAdminOnly, async (req, res) => {
  try {
    const { tabName, grid, spreadsheetId } = req.body;

    if (!tabName || typeof tabName !== "string") {
      return res.status(400).json({ error: "'tabName' string is required." });
    }
    if (!grid || !Array.isArray(grid) || grid.length === 0) {
      return res.status(400).json({ error: "'grid' 2D array is required." });
    }

    const result = await settingsStore.writeTimetableToSheet(
      spreadsheetId || undefined,
      tabName.trim(),
      grid,
    );

    const admin = String(req.headers["x-user-email"] || "").trim().toLowerCase();
    if (admin) logActivity(admin, "timetable_write_sheet", `Wrote tab "${tabName}"`);

    res.json({
      success: true,
      message: `Timetable written to tab "${tabName}" with formatting.`,
      sheetId: result.sheetId,
    });
  } catch (err: any) {
    console.error("[/api/timetable/write-sheet] Error:", err.message);
    res.status(500).json({ error: "Failed to write timetable to sheet: " + err.message });
  }
});


/**
 * POST /api/timetable/update-tab
 * Overwrite values in an EXISTING tab (in-place save, no new sheet created).
 *
 * Body: {
 *   tabName: string,       // existing tab name to overwrite
 *   values: string[][],    // 2D array of cell values
 * }
 */
app.post("/api/timetable/update-tab", verifyRequest, superAdminOnly, async (req, res) => {
  try {
    const { tabName, values } = req.body;

    if (!tabName || typeof tabName !== "string") {
      return res.status(400).json({ error: "'tabName' string is required." });
    }
    if (!values || !Array.isArray(values) || values.length === 0) {
      return res.status(400).json({ error: "'values' 2D array is required." });
    }

    const spreadsheetId = settingsStore.TIMETABLE_SPREADSHEET_ID;

    // Verify the tab exists
    const metaRes = await settingsStore.timetableApiFetch(spreadsheetId, "?fields=sheets.properties");
    const existingSheets: { properties: { sheetId: number; title: string } }[] = metaRes.sheets || [];
    const targetSheet = existingSheets.find((s: any) => s.properties.title === tabName.trim());

    if (!targetSheet) {
      return res.status(404).json({ error: `Tab "${tabName}" not found in spreadsheet.` });
    }

    // Directly overwrite values — formatting (colors, borders, fonts) stays UNTOUCHED
    await settingsStore.timetableApiFetch(
      spreadsheetId,
      `/values/${encodeURIComponent(tabName.trim())}!A1?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values }) },
    );

    const admin = String(req.headers["x-user-email"] || "").trim().toLowerCase();
    if (admin) logActivity(admin, "timetable_update_tab", `Updated tab "${tabName}" in-place (${values.length} rows)`);

    console.log(`[update-tab] Overwritten "${tabName}" with ${values.length} rows — formatting preserved`);

    res.json({
      success: true,
      message: `Tab "${tabName}" updated ✓ (formatting preserved)`,
    });
  } catch (err: any) {
    console.error("[/api/timetable/update-tab] Error:", err.message);
    res.status(500).json({ error: "Failed to update tab: " + err.message });
  }
});

/**
 * POST /api/timetable/write-raw
 * Write raw 2D string values to a new tab in the timetable spreadsheet
 * WITH exact colour formatting copied from the source sheet.
 *
 * Body: {
 *   tabName: string,       // e.g. "22nd-27th June 2026"
 *   values: string[][],    // 2D array of cell values
 *   formats?: any[][]      // Optional: 2D array of cell formats from source
 * }
 */
app.post("/api/timetable/write-raw", verifyRequest, superAdminOnly, async (req, res) => {
  try {
    const { tabName, values, formats, sourceTabName } = req.body;

    if (!tabName || typeof tabName !== "string") {
      return res.status(400).json({ error: "'tabName' string is required." });
    }
    if (!values || !Array.isArray(values) || values.length === 0) {
      return res.status(400).json({ error: "'values' 2D array is required." });
    }

    const spreadsheetId = settingsStore.TIMETABLE_SPREADSHEET_ID;

    // Get all existing sheets metadata
    const metaRes = await settingsStore.timetableApiFetch(spreadsheetId, "?fields=sheets.properties");
    const existingSheets: { properties: { sheetId: number; title: string } }[] = metaRes.sheets || [];

    // Find source tab to duplicate (use provided sourceTabName, or find the latest tab)
    const srcName = sourceTabName || "";
    let sourceSheet = srcName ? existingSheets.find((s: any) => s.properties.title === srcName) : null;

    // If no specific source, try to find any existing timetable tab to duplicate
    if (!sourceSheet && existingSheets.length > 0) {
      // Use the last sheet as source (most recent timetable)
      sourceSheet = existingSheets[existingSheets.length - 1];
    }

    // Delete existing tab with the same target name (if any)
    const existingTarget = existingSheets.find((s: any) => s.properties.title === tabName.trim());
    if (existingTarget) {
      await settingsStore.timetableApiFetch(spreadsheetId, ":batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          requests: [{ deleteSheet: { sheetId: existingTarget.properties.sheetId } }],
        }),
      });
    }

    let newSheetId: number;

    if (sourceSheet) {
      // ═══ DUPLICATE APPROACH — Exact copy of source sheet ═══
      console.log(`[write-raw] Duplicating source tab "${sourceSheet.properties.title}" → "${tabName.trim()}"`);

      // Step 1: Duplicate the source sheet
      const dupRes = await settingsStore.timetableApiFetch(spreadsheetId, ":batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          requests: [{
            duplicateSheet: {
              sourceSheetId: sourceSheet.properties.sheetId,
              newSheetName: tabName.trim(),
              insertSheetIndex: existingSheets.length, // Add at end
            },
          }],
        }),
      });

      newSheetId = dupRes.replies[0].duplicateSheet.properties.sheetId;

      // Step 2: Overwrite all cell values (keeps formatting intact)
      await settingsStore.timetableApiFetch(
        spreadsheetId,
        `/values/${encodeURIComponent(tabName.trim())}!A1?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ values }) },
      );

      console.log(`[write-raw] Duplicated + updated values: "${tabName.trim()}" (${values.length} rows)`);
    } else {
      // ═══ FALLBACK — Create new sheet (no source to duplicate) ═══
      console.log(`[write-raw] No source sheet found, creating new tab "${tabName.trim()}"`);

      const rowCount = Math.max(values.length, formats?.length || 0, 50);
      const colCount = Math.max(
        ...values.map((r: string[]) => r?.length || 0),
        ...(formats || []).map((r: any[]) => r?.length || 0),
        50
      );

      const createRes = await settingsStore.timetableApiFetch(spreadsheetId, ":batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: tabName.trim(),
                gridProperties: { rowCount, columnCount: colCount },
              },
            },
          }],
        }),
      });

      newSheetId = createRes.replies[0].addSheet.properties.sheetId;

      // Write values
      await settingsStore.timetableApiFetch(
        spreadsheetId,
        `/values/${encodeURIComponent(tabName.trim())}!A1?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ values }) },
      );

      // Apply formatting from formats array or auto-detect
      const formatRequests: any[] = [];

      if (formats && Array.isArray(formats) && formats.length > 0) {
        for (let r = 0; r < formats.length; r++) {
          const fmtRow = formats[r];
          if (!fmtRow || !Array.isArray(fmtRow)) continue;
          for (let c = 0; c < fmtRow.length; c++) {
            const fmt = fmtRow[c];
            if (!fmt) continue;
            const cellFormat: any = {};
            const fields: string[] = [];
            if (fmt.bg) { cellFormat.backgroundColor = fmt.bg; fields.push("userEnteredFormat.backgroundColor"); }
            if (fmt.tf) {
              cellFormat.textFormat = {};
              if (fmt.tf.bold) cellFormat.textFormat.bold = true;
              if (fmt.tf.fontSize) cellFormat.textFormat.fontSize = fmt.tf.fontSize;
              if (fmt.tf.fg) cellFormat.textFormat.foregroundColor = fmt.tf.fg;
              fields.push("userEnteredFormat.textFormat");
            }
            if (fields.length > 0) {
              formatRequests.push({
                repeatCell: {
                  range: { sheetId: newSheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: c, endColumnIndex: c + 1 },
                  cell: { userEnteredFormat: cellFormat },
                  fields: fields.join(","),
                },
              });
            }
          }
        }
      } else {
        // Auto-detect formatting
        const hex = (h: string) => {
          const x = h.replace("#", "");
          return { red: parseInt(x.substring(0, 2), 16) / 255, green: parseInt(x.substring(2, 4), 16) / 255, blue: parseInt(x.substring(4, 6), 16) / 255 };
        };
        const SC = { HEADER: hex("#FFFF00"), ROOM: hex("#FF00FF"), MON: hex("#FF8C00"), TUE: hex("#9933FF"), WED: hex("#00CC00"), THU: hex("#00BFFF"), FRI: hex("#FF3366"), SAT: hex("#CC0000"), HOLIDAY: hex("#FFFF00"), WHITE: hex("#FFFFFF") };
        const DC: Record<string, any> = { MONDAY: SC.MON, TUESDAY: SC.TUE, WEDNESDAY: SC.WED, THURSDAY: SC.THU, FRIDAY: SC.FRI, SATURDAY: SC.SAT };
        const DN = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
        let curDay = "";
        for (let r = 0; r < values.length; r++) {
          const row = values[r] || [];
          const col0 = String(row[0] || "").trim().toUpperCase();
          if (DN.includes(col0)) curDay = col0;
          for (let c = 0; c < row.length; c++) {
            const val = String(row[c] || "").trim().toUpperCase();
            let bg = SC.WHITE, bold = false;
            if (r === 0 && c >= 2) { bg = SC.HEADER; bold = true; }
            else if (r === 1 && c >= 2) { bg = SC.ROOM; bold = true; }
            else if (r >= 2) {
              if (c === 0 && DN.includes(val)) { bg = DC[val]; bold = true; }
              else if (val === "HOLIDAY") { bg = SC.HOLIDAY; bold = true; }
              else if (c >= 2 && val && curDay && DC[curDay] && val.length >= 2 && val.length <= 8) {
                const d = DC[curDay];
                bg = { red: Math.min(1, d.red * 0.3 + 0.7), green: Math.min(1, d.green * 0.3 + 0.7), blue: Math.min(1, d.blue * 0.3 + 0.7) };
              }
            }
            if (bg !== SC.WHITE || bold) {
              formatRequests.push({
                repeatCell: {
                  range: { sheetId: newSheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: c, endColumnIndex: c + 1 },
                  cell: { userEnteredFormat: { backgroundColor: bg, textFormat: { bold, fontSize: 10 } } },
                  fields: "userEnteredFormat(backgroundColor,textFormat)",
                },
              });
            }
          }
        }
      }

      if (formatRequests.length > 0) {
        for (let i = 0; i < formatRequests.length; i += 5000) {
          const chunk = formatRequests.slice(i, i + 5000);
          await settingsStore.timetableApiFetch(spreadsheetId, ":batchUpdate", {
            method: "POST",
            body: JSON.stringify({ requests: chunk }),
          });
        }
      }
    }

    const admin = String(req.headers["x-user-email"] || "").trim().toLowerCase();
    if (admin) logActivity(admin, "timetable_write_raw", `Wrote tab "${tabName}" ${sourceSheet ? `(duplicated from "${sourceSheet.properties.title}")` : "(new)"}`);

    res.json({
      success: true,
      message: `Timetable written to tab "${tabName}" ${sourceSheet ? "✓ (exact copy + updated values)" : "(new sheet)"}`,
      sheetId: newSheetId,
    });
  } catch (err: any) {
    console.error("[/api/timetable/write-raw] Error:", err.message);
    res.status(500).json({ error: "Failed to write timetable to sheet: " + err.message });
  }
});


/**
 * GET /api/timetable/tabs
 * Return all weekly timetable tab titles.
 */
app.get("/api/timetable/tabs", verifyRequest, superAdminOnly, async (req, res) => {
  try {
    const metaRes = await settingsStore.timetableApiFetch(settingsStore.TIMETABLE_SPREADSHEET_ID, "?fields=sheets.properties.title");
    const sheets = metaRes.sheets || [];
    const titles = sheets
      .map((s: any) => s.properties?.title)
      .filter((title: string) => {
        if (!title) return false;
        const lower = title.toLowerCase();
        return !["faculty details", "settings", "activity log", "timetableconfig"].includes(lower);
      });
    res.json({ success: true, tabs: titles });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch spreadsheet tabs: " + err.message });
  }
});

/**
 * GET /api/timetable/tab-values
 * Return raw 2D values AND formatting of a specific tab
 */
app.get("/api/timetable/tab-values", verifyRequest, superAdminOnly, async (req, res) => {
  try {
    const tabName = String(req.query.tabName || "").trim();
    if (!tabName) {
      return res.status(400).json({ error: "tabName parameter is required" });
    }

    // Fetch values
    const valData = await settingsStore.timetableApiFetch(
      settingsStore.TIMETABLE_SPREADSHEET_ID,
      `/values/${encodeURIComponent(tabName)}`
    );
    const values: string[][] = valData.values || [];

    // Fetch formatting (backgroundColor + textFormat per cell)
    let formats: any[][] = [];
    try {
      const fmtData = await settingsStore.timetableApiFetch(
        settingsStore.TIMETABLE_SPREADSHEET_ID,
        `?ranges=${encodeURIComponent(tabName)}&fields=sheets.data.rowData.values.userEnteredFormat`
      );
      const rowData = fmtData?.sheets?.[0]?.data?.[0]?.rowData || [];
      formats = rowData.map((row: any) => {
        return (row.values || []).map((cell: any) => {
          const fmt = cell?.userEnteredFormat;
          if (!fmt) return null;
          // Only keep bg color + text format (bold, fontSize)
          const result: any = {};
          if (fmt.backgroundColor) {
            result.bg = fmt.backgroundColor;
          }
          if (fmt.textFormat) {
            result.tf = {};
            if (fmt.textFormat.bold) result.tf.bold = true;
            if (fmt.textFormat.fontSize) result.tf.fontSize = fmt.textFormat.fontSize;
            if (fmt.textFormat.foregroundColor) result.tf.fg = fmt.textFormat.foregroundColor;
          }
          return Object.keys(result).length > 0 ? result : null;
        });
      });
    } catch (fmtErr: any) {
      console.warn("[tab-values] Could not fetch formatting:", fmtErr.message);
      // Continue without formatting — values are still useful
    }

    res.json({ success: true, values, formats });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to fetch data for tab "${req.query.tabName}": ` + err.message });
  }
});


/**
 * POST /api/timetable/rebuild-patterns
 * Rebuild historical patterns from ALL subsheets in the timetable spreadsheet.
 * This fetches every tab dynamically — no manual CSV download needed.
 */
app.post("/api/timetable/rebuild-patterns", verifyRequest, superAdminOnly, async (req, res) => {
  try {
    console.log("[rebuild-patterns] Fetching ALL timetable tabs...");
    const allTabs = await settingsStore.readAllTimetableTabs();
    
    if (allTabs.length === 0) {
      return res.status(400).json({ error: "No timetable tabs found in spreadsheet" });
    }

    const patterns = buildPatternsFromSheetData(allTabs);
    setHistoricalPatterns(patterns);

    const stats = getPatternStats();
    const admin = String(req.headers["x-user-email"] || "").trim().toLowerCase();
    if (admin) logActivity(admin, "rebuild_patterns", `Rebuilt from ${allTabs.length} tabs: ${stats.slotPatterns} slot patterns, ${stats.batches} batches, ${stats.teachers} teachers`);

    res.json({
      success: true,
      tabsProcessed: allTabs.length,
      tabNames: allTabs.map(t => t.tabName),
      ...stats,
    });
  } catch (err: any) {
    console.error("[rebuild-patterns] Error:", err.message);
    res.status(500).json({ error: "Pattern rebuild failed: " + err.message });
  }
});

/**
 * GET /api/timetable/pattern-stats
 * Get current pattern AI statistics
 */
app.get("/api/timetable/pattern-stats", verifyRequest, (req, res) => {
  const stats = getPatternStats();
  res.json({ success: true, ...stats });
});


// Auto-load timetable on startup if a URL is configured
// Load timetable URL from sheet first, THEN load data
loadTimetableUrlFromSheet().then(() => loadTimetableData()).catch(() => loadTimetableData());

// Auto-rebuild patterns from ALL subsheets on startup
setTimeout(async () => {
  try {
    console.log("[startup] Auto-rebuilding patterns from ALL subsheets...");
    const allTabs = await settingsStore.readAllTimetableTabs();
    if (allTabs.length > 0) {
      const patterns = buildPatternsFromSheetData(allTabs);
      setHistoricalPatterns(patterns);
      console.log(`[startup] Pattern AI updated from ${allTabs.length} tabs`);
    }
  } catch (err: any) {
    console.warn("[startup] Pattern auto-rebuild failed (using static 14-week data):", err.message);
  }
}, 5000); // Wait 5s after startup for auth to initialize


// Configure Vite integration or static file server
async function startViteMiddleware() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startViteMiddleware();
