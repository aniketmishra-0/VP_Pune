import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as XLSX from "xlsx";

const app = express();
const PORT = 3000;

interface MemorySheet {
  name: string;
  data: any[][];
}

// Global cached variables
let memorySheets: MemorySheet[] = [];
let dropdowns: { batches: string[]; names: string[] } = { batches: [], names: [] };
let lastLoaded: string | null = null;
let isLoading = false;
let loadError: string | null = null;

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
  const hasFoundation = lowerSubs.some(s => s.includes("science") || s.includes("sst") || s.includes("mat") || s.includes("english") || s.includes("hindi"));

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
  
  const urlsToTry = [
    process.env.SPREADSHEET_URL,
    "https://docs.google.com/spreadsheets/d/1TCHsheXDqTyox79_0f5wRWAc5imtQtU-PVBJPzKeW_k/export?format=xlsx",
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVsEi4kDMjHmImNSClEBffOAvbWLCT9sjf1kapHus7torLFuthC7M7jk3Tgx6XCqLTylnXXVPFxHEI/pub?output=xlsx",
    "https://docs.google.com/spreadsheets/d/1zTnVTYD4WRcV9bThQi1Ek-nh8TsIEsZW5IFvHXTajpM/export?format=xlsx"
  ].filter(Boolean) as string[];

  let workbook: XLSX.WorkBook | null = null;
  let successfulUrl = "";
  let errorsList: string[] = [];

  for (const url of urlsToTry) {
    try {
      console.log(`Attempting to fetch from: ${url}`);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP Error Status: ${res.status} ${res.statusText}`);
      }
      
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("html") && !url.includes("pub?output=xlsx")) {
        throw new Error("Returned HTML/Google login redirection page instead of spreadsheet binary (Permission denied).");
      }

      const buffer = await res.arrayBuffer();
      // Try to read and parse the XLSX file
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
      if (wb && wb.SheetNames && wb.SheetNames.length > 0) {
        workbook = wb;
        successfulUrl = url;
        break; // Parse succeeded! Exit loop.
      } else {
        throw new Error("Parsed workbook is empty or has no sheets.");
      }
    } catch (err: any) {
      console.error(`Attempt failed for URL: ${url}. Error:`, err.message || err);
      errorsList.push(`${url}: ${err.message || String(err)}`);
    }
  }

  if (!workbook) {
    const errorDetails = errorsList.join(" | ");
    console.error("All spreadsheet fetch attempts failed: ", errorDetails);
    loadError = "Failed to load database spreadsheet. Details: " + errorsList[0];
    isLoading = false;
    return;
  }

  try {
    const loadedSheets: MemorySheet[] = [];
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook!.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
      if (data.length >= 2) {
        loadedSheets.push({ name: sheetName, data });
      }
    });

    memorySheets = loadedSheets;

    const validRegNos = new Set<string>();
    const batches = new Set<string>();
    const names = new Set<string>();

    memorySheets.forEach((sheetObj) => {
      const data = sheetObj.data;
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

    lastLoaded = new Date().toISOString();
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

app.use(express.json());

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

// Mock Google Consent Workspace Sandbox (Perfect for instant developer previews)
app.get("/auth/google/mock-consent", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sign in with Google - Vidyapeeth Pune Hub</title>
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
        <p class="text-sm text-[#5f6368] mb-6">to continue to <span class="font-bold text-slate-800">Vidyapeeth Pune Hub</span></p>

        <!-- Developer Mode Notification -->
        <div class="w-full mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1.5 text-left">
          <p class="font-bold">💡 Google Workspace Sandbox (Demo Mode)</p>
          <p class="leading-relaxed">Mock mode is active because <code class="bg-amber-100/70 p-0.5 rounded font-mono">GOOGLE_CLIENT_ID</code> is not defined in '.env'. Feel free to click any official authorized account below to log in instantly:</p>
        </div>

        <!-- Accounts Stack -->
        <div class="w-full space-y-2.5 mb-6" id="accountsList">
          <!-- Account 1 -->
          <button onclick="selectEmail('aniket.mishra@pw.live')" class="w-full text-left p-3.5 hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-all flex items-center justify-between outline-none cursor-pointer">
            <div>
              <div class="font-medium text-sm text-[#3c4043]">Aniket Mishra</div>
              <div class="text-[11px] text-[#5f6368] mt-0.5">aniket.mishra@pw.live</div>
            </div>
            <span class="text-[10px] font-mono py-0.5 px-2 bg-blue-50 text-blue-600 rounded-md font-bold">Authorized</span>
          </button>

          <!-- Account 2 -->
          <button onclick="selectEmail('academic.coordinator@physicswallah.org')" class="w-full text-left p-3.5 hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-all flex items-center justify-between outline-none cursor-pointer">
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
        function selectEmail(email) {
          if (window.opener) {
            const prefix = email.split("@")[0];
            const name = prefix.split(/[\._\-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
            const picture = "https://ui-avatars.com/api/?name=" + encodeURIComponent(name) + "&background=3b82f6&color=fff&bold=true&size=128";
            window.opener.postMessage({ 
              type: "GOOGLE_AUTH_SUCCESS", 
              email: email,
              name: name,
              picture: picture
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
                  error: "Access Restricted: Account " + ${JSON.stringify(email)} + " is not permitted. Only official PW staff accounts (@pw.live or @physicswallah.org) can access the portal."
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

    // Success response posted to original application window
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: "GOOGLE_AUTH_SUCCESS",
                email: ${JSON.stringify(email)},
                name: ${JSON.stringify(userData.name || "")},
                picture: ${JSON.stringify(userData.picture || "")}
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
                error: "Google Authentication System Failure: " + ${JSON.stringify(err.message || 'Interpersonal handshake error.')}
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

// API: Health status + cache context
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    lastLoaded,
    isLoading,
    loadError,
    sheetCount: memorySheets.length,
  });
});

// API: Get parsed dropdown listings
app.get("/api/dropdowns", async (req, res) => {
  if (loadError && memorySheets.length === 0) {
    return res.status(500).json({ error: loadError });
  }
  // Try triggering download if never loaded and not loading
  if (memorySheets.length === 0 && !isLoading) {
    await loadSpreadsheetData();
  }

  // Calculate student/row stats dynamically for each sheet
  const sheetStats: Record<string, number> = {};
  memorySheets.forEach((s) => {
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

  res.json({
    batches: dropdowns.batches,
    names: dropdowns.names,
    sheets: sortSheetNamesDescending(Array.from(new Set(memorySheets.map(s => s.name)))),
    sheetStats,
    lastLoaded,
    isLoading,
  });
});

// API: Manual refresh endpoint
app.post("/api/refresh", async (req, res) => {
  if (isLoading) {
    return res.json({ message: "Refresh already in progress...", isLoading: true });
  }
  await loadSpreadsheetData();
  if (loadError) {
    return res.status(500).json({ error: loadError });
  }
  res.json({ success: true, lastLoaded, batchesCount: dropdowns.batches.length });
});

// API: Get student records payload
app.get("/api/student", (req, res) => {
  const queryParam = req.query.query;
  if (!queryParam) {
    return res.status(400).json({ error: "Missing query parameter." });
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
    const targetRegNos = new Set<string>();
    const profilesMap: Record<string, any> = {};
    const testsMap: Record<string, any[]> = {};
    let streamType = "";

    // Parse and store detailed metadata for each sheet
    const sheetMetaMap = new Map<string, { date: string; testClass: string; cleanName: string; originalSheetName: string }>();

    memorySheets.forEach((sheetObj) => {
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
    memorySheets.forEach((sheetObj) => {
      const data = sheetObj.data;
      const sheetName = sheetObj.name;

      if (exactSheetParam && sheetName !== exactSheetParam) {
        return;
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
              center: "Vidyapeeth Pune",
            };
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
    memorySheets.forEach((sheetObj) => {
      const data = sheetObj.data;
      const sheetName = sheetObj.name;

      if (exactSheetParam && sheetName !== exactSheetParam) {
        return;
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
      const isFoundationSheet = !isNEETSheet && !isJEESheet && (/foundation/i.test(sheetName) || /fnd/i.test(sheetName) || /class\s*(?:6|7|8|9|10)/i.test(sheetName) || headers.includes("science") || headers.includes("sst") || headers.includes("mat") || headers.includes("english") || headers.includes("hindi"));

      const sheetStream = isNEETSheet ? "NEET" : isFoundationSheet ? "Foundation" : "JEE";

      const idxScore = findColumnIndex(headers, ["score", "total marks", "marks"]);
      const idxOutOf = findColumnIndex(headers, ["out of", "max marks"]);
      const idxUnattempted = findColumnIndex(headers, ["unattempted", "unattempt"]);
      const idxRank = findColumnIndex(headers, ["center rank", "rank"]);
      const idxBatch = findColumnIndex(headers, ["batch"]);

      const idxPhy = findColumnIndex(headers, ["physics", "avg physics %", "physics marks"]);
      const idxChem = findColumnIndex(headers, ["chemistry", "avg chemistry %", "chemistry marks"]);
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
