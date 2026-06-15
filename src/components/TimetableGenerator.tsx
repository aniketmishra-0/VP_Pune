import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar, ChevronLeft, ChevronRight, Check, AlertCircle,
  RefreshCw, Users, Settings, Eye, FileSpreadsheet, Zap,
  AlertTriangle, CheckCircle2, Loader2, Sun, CloudOff, Hash,
  Sliders, Trash2, Plus, Download, Sparkles,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────

interface FacultyMember {
  pwId: string; name: string; email: string; code: string;
  division: string; subject: string; designation: string;
  status: string; teacherId: string; qualification: string;
  photoUrl: string; batches: string[];
}

interface GeneratedSlot {
  day: string; date: string; slotNum: number;
  startTime: string; endTime: string;
  batchCode: string; teacherCode: string;
  room: string; section: "JEE" | "NEET" | "DROPPER";
}

interface BatchInfo {
  code: string; room: string; section: "JEE" | "NEET" | "DROPPER";
}

interface TestSlotOverride {
  day: string; slot: number; batchCode: string; label: string;
}

interface TimetableGridCell {
  value: string;
  color?: "HEADER" | "ROOM" | "DAY" | "SEP" | "HOLIDAY" | "WHITE";
  day?: string;
}

interface TimetableGeneratorProps {
  adminHeaders: () => Record<string, string>;
}

// ─── Constants ──────────────────────────────────────────────────────────

const SLOTS = [
  { id: 1, start: "8:45 AM", end: "10:15 AM" },
  { id: 2, start: "10:30 AM", end: "12:00 PM" },
  { id: 3, start: "12:25 PM", end: "1:55 PM" },
  { id: 4, start: "2:15 PM", end: "3:45 PM" },
  { id: 5, start: "4:10 PM", end: "5:40 PM" },
  { id: 6, start: "5:55 PM", end: "7:20 PM" },
];

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
const DAY_SHORT: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed",
  THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat",
};
const DAY_COLORS: Record<string, string> = {
  MONDAY: "bg-orange-500", TUESDAY: "bg-purple-500",
  WEDNESDAY: "bg-green-500", THURSDAY: "bg-cyan-500",
  FRIDAY: "bg-pink-500",
};
const DAY_TEXT_COLORS: Record<string, string> = {
  MONDAY: "text-orange-400", TUESDAY: "text-purple-400",
  WEDNESDAY: "text-green-400", THURSDAY: "text-cyan-400",
  FRIDAY: "text-pink-400",
};
const DAY_BG_LIGHT: Record<string, string> = {
  MONDAY: "bg-orange-500/10", TUESDAY: "bg-purple-500/10",
  WEDNESDAY: "bg-green-500/10", THURSDAY: "bg-cyan-500/10",
  FRIDAY: "bg-pink-500/10",
};

// Default room assignments from 14-week historical data (latest week 14)
// Key: partial batch code (e.g., "LJ151MA"), Value: room number
const DEFAULT_BATCH_ROOMS: Record<string, string> = {
  // JEE Morning
  "LJE51MP":  "S-03",
  "LJ151MA":  "507",
  "LJ152MA":  "601",
  "LJ153MA":  "505",
  "LJE51MA":  "501",
  "LJE52MA":  "502",
  "AJ151MA":  "602",
  "AJ253MA":  "604",
  "AJ254MA":  "603",
  "AJ251MA":  "605",
  "AJ252MA":  "202",
  "AJ351MA":  "201",
  // JEE Afternoon
  "AJ251NA":  "603",
  "AJ351NA":  "203",
  "LJ151NA":  "503",
  "AJ451NA":  "504",
  "AJ251NP":  "S-04",
  // JEE Evening
  "AJ251EA":  "605",
  "LJ151EA":  "603",
  "LJ152EA":  "604",
  // NEET Morning
  "LNE51MP":  "S-01",
  "LN151MA":  "503",
  "LN152MA":  "506",
  "LN153MA":  "101",
  "AN151MA":  "504",
  "AN251MA":  "606",
  "AN351MA":  "203",
  // NEET Afternoon
  "AN251NA":  "604",
  "LN151NA":  "506",
  // NEET Evening
  "LN151EA":  "504",
  "AN351EA":  "602",
  // Dropper
  "YN351NA":  "101",
  "PJ451NA":  "S-02",
};

/** Extract short batch code (e.g., "LJ151MA") from full code like "27-LJ151MA 2026" */
function extractShortCode(fullCode: string): string {
  const m = fullCode.match(/\d+-([A-Z0-9]+)/i);
  return m ? m[1].toUpperCase() : fullCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Look up default room for a batch code */
function getDefaultRoom(batchCode: string): string {
  const short = extractShortCode(batchCode);
  if (DEFAULT_BATCH_ROOMS[short]) return DEFAULT_BATCH_ROOMS[short];
  // Try partial match (batch code might have different year suffix)
  for (const [key, room] of Object.entries(DEFAULT_BATCH_ROOMS)) {
    if (short.includes(key) || key.includes(short)) return room;
  }
  return "";
}

const STEPS = [
  { num: 1, label: "Week", icon: Calendar },
  { num: 2, label: "Faculty", icon: Users },
  { num: 3, label: "Constraints", icon: Settings },
  { num: 4, label: "Preview", icon: Eye },
  { num: 5, label: "Export", icon: FileSpreadsheet },
];

// ─── Helpers ────────────────────────────────────────────────────────────

function getMondayDate(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getWeekDates(mondayStr: string): { day: string; date: Date; dateStr: string }[] {
  const mon = new Date(mondayStr + "T00:00:00");
  return DAYS.map((d, i) => {
    const date = new Date(mon);
    date.setDate(mon.getDate() + i);
    return {
      day: d,
      date,
      dateStr: formatDateDisplay(date),
    };
  });
}

function formatDateDisplay(d: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function formatDateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function detectSection(batchCode: string): "JEE" | "NEET" | "DROPPER" {
  const upper = batchCode.toUpperCase();
  // Dropper codes: YA, YN = Dropper NEET; PJ = Dropper JEE
  if (/\bYA|\bYN/.test(upper.replace(/\d/g, ''))) return "DROPPER";
  if (/\bPJ/.test(upper.replace(/\d/g, ''))) return "DROPPER";
  // Check with code prefix patterns
  const codePrefix = upper.match(/\d+-([A-Z]{2})/)?.[1] || '';
  if (['YA', 'YN', 'PJ'].includes(codePrefix)) return "DROPPER";
  if (/LJ|AJ/.test(upper)) return "JEE";
  if (/LN|AN|UF|NF/.test(upper)) return "NEET";
  // Fallback heuristics
  if (/J/.test(upper.replace(/JUN|JUL|JAN/g, ""))) return "JEE";
  if (/N/.test(upper.replace(/JUN|NOV|NAN/g, ""))) return "NEET";
  return "JEE";
}

function getDefaultTabName(weekDates: { day: string; date: Date }[]): string {
  if (weekDates.length === 0) return "";
  const first = weekDates[0].date;
  const last = weekDates[weekDates.length - 1].date;
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const suffix = (n: number) => {
    if (n >= 11 && n <= 13) return "th";
    switch (n % 10) { case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th"; }
  };

  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()}${suffix(first.getDate())}-${last.getDate()}${suffix(last.getDate())} ${months[first.getMonth()]} ${first.getFullYear()}`;
  }
  return `${first.getDate()}${suffix(first.getDate())} ${months[first.getMonth()]}-${last.getDate()}${suffix(last.getDate())} ${months[last.getMonth()]} ${last.getFullYear()}`;
}

// ─── Component ──────────────────────────────────────────────────────────

export default function TimetableGenerator({ adminHeaders }: TimetableGeneratorProps) {
  const [step, setStep] = useState(1);

  // Step 1 — Week config
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const mon = getMondayDate(formatDateISO(now));
    mon.setDate(mon.getDate() + 7); // next monday
    return formatDateISO(mon);
  });
  const [holidays, setHolidays] = useState<Set<string>>(new Set());

  // Step 2 — Faculty
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [facultyLoading, setFacultyLoading] = useState(false);
  const [facultyError, setFacultyError] = useState<string | null>(null);
  const [disabledTeachers, setDisabledTeachers] = useState<Set<string>>(new Set());
  const [batchRooms, setBatchRooms] = useState<Record<string, string>>({});

  // Step 3 — Constraints
  const [maxConsecutive, setMaxConsecutive] = useState(3);
  const [maxSlotsPerDay, setMaxSlotsPerDay] = useState(4);
  const [testSlots, setTestSlots] = useState<TestSlotOverride[]>([]);

  // Step 4 — Preview
  const [generatedSlots, setGeneratedSlots] = useState<GeneratedSlot[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Step 5 — Export
  const [tabName, setTabName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string } | null>(null);

  // AI Resolve
  const [aiResolving, setAiResolving] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  // ─── Derived data ──────────────────────────────────────────────────

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const activeFaculty = useMemo(
    () => faculty.filter(f => f.status.toLowerCase() === "active" && f.code && !disabledTeachers.has(f.code)),
    [faculty, disabledTeachers],
  );

  const allBatches = useMemo(() => {
    const batchSet = new Map<string, BatchInfo>();
    for (const f of activeFaculty) {
      for (const b of f.batches) {
        const code = b.trim();
        if (!code || batchSet.has(code)) continue;
        batchSet.set(code, {
          code,
          room: batchRooms[code] || "",
          section: detectSection(code),
        });
      }
    }
    // Sort: JEE first, NEET second, DROPPER last
    const ORDER: Record<string, number> = { JEE: 0, NEET: 1, DROPPER: 2 };
    return Array.from(batchSet.values()).sort((a, b) => {
      const sa = ORDER[a.section] ?? 0, sb = ORDER[b.section] ?? 0;
      if (sa !== sb) return sa - sb;
      return a.code.localeCompare(b.code);
    });
  }, [activeFaculty, batchRooms]);

  const jeeBatches = useMemo(() => allBatches.filter(b => b.section === "JEE"), [allBatches]);
  const neetBatches = useMemo(() => allBatches.filter(b => b.section === "NEET"), [allBatches]);
  const dropperBatches = useMemo(() => allBatches.filter(b => b.section === "DROPPER"), [allBatches]);

  // ─── Fetch Faculty ────────────────────────────────────────────────

  const fetchFaculty = useCallback(async () => {
    setFacultyLoading(true);
    setFacultyError(null);
    try {
      const r = await fetch("/api/timetable/faculty", { headers: adminHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setFaculty(d.faculty || []);

      // Auto-populate room numbers from historical data
      const autoRooms: Record<string, string> = {};
      const allBatchCodes = new Set<string>();
      for (const f of (d.faculty || [])) {
        if (f.status?.toLowerCase() !== "active" || !f.code) continue;
        for (const b of (f.batches || [])) {
          const code = b.trim();
          if (code && !allBatchCodes.has(code)) {
            allBatchCodes.add(code);
            const room = getDefaultRoom(code);
            if (room) autoRooms[code] = room;
          }
        }
      }
      // Only set rooms that aren't already manually set
      setBatchRooms(prev => {
        const merged = { ...autoRooms };
        // Keep any manual overrides
        for (const [k, v] of Object.entries(prev)) {
          if (v) merged[k] = v as string;
        }
        return merged;
      });
    } catch (e: any) {
      setFacultyError(e.message || "Failed to fetch faculty");
    } finally {
      setFacultyLoading(false);
    }
  }, [adminHeaders]);

  useEffect(() => {
    if (step === 2 && faculty.length === 0) fetchFaculty();
  }, [step, faculty.length, fetchFaculty]);

  // ─── Generate ─────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const batches = allBatches.map(b => ({
        code: b.code,
        room: batchRooms[b.code] || b.room || "",
        section: b.section,
      }));

      const config = {
        weekStartDate: weekStart,
        maxConsecutive,
        maxSlotsPerDay,
        holidays: Array.from(holidays),
        testSlots,
      };

      const r = await fetch("/api/timetable/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ batches, config }),
      });

      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${r.status}`);
      }

      const d = await r.json();
      setGeneratedSlots(d.slots || []);
      setWarnings(d.warnings || []);
    } catch (e: any) {
      setGenError(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [allBatches, batchRooms, weekStart, maxConsecutive, maxSlotsPerDay, holidays, testSlots, adminHeaders]);

  // Auto-generate on entering step 4
  useEffect(() => {
    if (step === 4 && generatedSlots.length === 0 && !generating) {
      handleGenerate();
    }
  }, [step]); // intentionally only on step change

  // Auto-set tab name
  useEffect(() => {
    if (step === 5 && !tabName) {
      setTabName(getDefaultTabName(weekDates));
    }
  }, [step, weekDates, tabName]);

  // ─── Build Preview Grid ──────────────────────────────────────────

  const previewGrid = useMemo(() => {
    if (generatedSlots.length === 0) return null;

    // Build slot lookup: "DAY-SLOT-BATCH" → teacherCode
    const lookup = new Map<string, string>();
    for (const s of generatedSlots) {
      lookup.set(`${s.day}-${s.slotNum}-${s.batchCode}`, s.teacherCode);
    }

    const workDays = DAYS.filter(d => !holidays.has(d));

    // Grid rows: each day has 6 slot rows
    const rows: { day: string; date: string; slot: typeof SLOTS[0]; isHoliday: boolean }[] = [];
    for (const d of DAYS) {
      const dateInfo = weekDates.find(w => w.day === d);
      for (const slot of SLOTS) {
        rows.push({
          day: d,
          date: dateInfo?.dateStr || "",
          slot,
          isHoliday: holidays.has(d),
        });
      }
    }

    return { rows, lookup, workDays };
  }, [generatedSlots, holidays, weekDates]);

  // ─── Build Export Grid ────────────────────────────────────────────

  const buildExportGrid = useCallback((): TimetableGridCell[][] => {
    if (!previewGrid) return [];

    const grid: TimetableGridCell[][] = [];
    const jb = jeeBatches;
    const nb = neetBatches;
    const db = dropperBatches;

    // Row 0: Header — empty | empty | JEE section header | ... | separator | NEET section header | ...
    const headerRow: TimetableGridCell[] = [
      { value: "Day", color: "HEADER" },
      { value: "Date", color: "HEADER" },
      { value: "Start", color: "HEADER" },
      { value: "End", color: "HEADER" },
    ];
    for (const b of jb) headerRow.push({ value: b.code, color: "HEADER" });
    headerRow.push({ value: "", color: "SEP" }); // separator
    headerRow.push({ value: "Start", color: "HEADER" });
    headerRow.push({ value: "End", color: "HEADER" });
    for (const b of nb) headerRow.push({ value: b.code, color: "HEADER" });
    // DROPPER separator + headers
    headerRow.push({ value: "", color: "SEP" });
    headerRow.push({ value: "Start", color: "HEADER" });
    headerRow.push({ value: "End", color: "HEADER" });
    for (const b of db) headerRow.push({ value: b.code, color: "HEADER" });
    grid.push(headerRow);

    // Row 1: Room numbers
    const roomRow: TimetableGridCell[] = [
      { value: "", color: "ROOM" },
      { value: "", color: "ROOM" },
      { value: "", color: "ROOM" },
      { value: "", color: "ROOM" },
    ];
    for (const b of jb) roomRow.push({ value: batchRooms[b.code] || b.room || "", color: "ROOM" });
    roomRow.push({ value: "", color: "SEP" });
    roomRow.push({ value: "", color: "ROOM" });
    roomRow.push({ value: "", color: "ROOM" });
    for (const b of nb) roomRow.push({ value: batchRooms[b.code] || b.room || "", color: "ROOM" });
    // DROPPER separator + rooms
    roomRow.push({ value: "", color: "SEP" });
    roomRow.push({ value: "", color: "ROOM" });
    roomRow.push({ value: "", color: "ROOM" });
    for (const b of db) roomRow.push({ value: batchRooms[b.code] || b.room || "", color: "ROOM" });
    grid.push(roomRow);

    // Data rows
    for (const row of previewGrid.rows) {
      const isFirstSlot = row.slot.id === 1;
      const gridRow: TimetableGridCell[] = [];

      // Day column (only show on first slot of that day)
      gridRow.push({
        value: isFirstSlot ? row.day : "",
        color: row.isHoliday ? "HOLIDAY" : "DAY",
        day: row.day,
      });
      // Date column
      gridRow.push({
        value: isFirstSlot ? row.date : "",
        color: row.isHoliday ? "HOLIDAY" : "WHITE",
      });

      if (row.isHoliday) {
        // Fill all cells with HOLIDAY
        gridRow.push({ value: "", color: "HOLIDAY" });
        gridRow.push({ value: "", color: "HOLIDAY" });
        for (const b of jb) gridRow.push({ value: isFirstSlot ? "HOLIDAY" : "", color: "HOLIDAY" });
        gridRow.push({ value: "", color: "SEP" });
        gridRow.push({ value: "", color: "HOLIDAY" });
        gridRow.push({ value: "", color: "HOLIDAY" });
        for (const b of nb) gridRow.push({ value: isFirstSlot ? "HOLIDAY" : "", color: "HOLIDAY" });
        // DROPPER holiday
        gridRow.push({ value: "", color: "SEP" });
        gridRow.push({ value: "", color: "HOLIDAY" });
        gridRow.push({ value: "", color: "HOLIDAY" });
        for (const b of db) gridRow.push({ value: isFirstSlot ? "HOLIDAY" : "", color: "HOLIDAY" });
      } else {
        // JEE Start/End
        gridRow.push({ value: row.slot.start, color: "WHITE" });
        gridRow.push({ value: row.slot.end, color: "WHITE" });
        // JEE batches
        for (const b of jb) {
          const teacher = previewGrid.lookup.get(`${row.day}-${row.slot.id}-${b.code}`) || "";
          gridRow.push({ value: teacher, color: "WHITE" });
        }
        // Separator
        gridRow.push({ value: "", color: "SEP" });
        // NEET Start/End
        gridRow.push({ value: row.slot.start, color: "WHITE" });
        gridRow.push({ value: row.slot.end, color: "WHITE" });
        // NEET batches
        for (const b of nb) {
          const teacher = previewGrid.lookup.get(`${row.day}-${row.slot.id}-${b.code}`) || "";
          gridRow.push({ value: teacher, color: "WHITE" });
        }
        // DROPPER Separator + Start/End + batches
        gridRow.push({ value: "", color: "SEP" });
        gridRow.push({ value: row.slot.start, color: "WHITE" });
        gridRow.push({ value: row.slot.end, color: "WHITE" });
        for (const b of db) {
          const teacher = previewGrid.lookup.get(`${row.day}-${row.slot.id}-${b.code}`) || "";
          gridRow.push({ value: teacher, color: "WHITE" });
        }
      }

      grid.push(gridRow);
    }

    return grid;
  }, [previewGrid, jeeBatches, neetBatches, dropperBatches, batchRooms]);

  // ─── Export to Sheet ──────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const grid = buildExportGrid();
      if (grid.length === 0) throw new Error("No grid data to export");

      const r = await fetch("/api/timetable/write-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ tabName, grid }),
      });

      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setExportResult({ success: true, message: d.message || "Timetable written successfully!" });
    } catch (e: any) {
      setExportResult({ success: false, message: e.message || "Export failed" });
    } finally {
      setExporting(false);
    }
  }, [tabName, buildExportGrid, adminHeaders]);

  // ─── Step Navigation ──────────────────────────────────────────────

  const canGoNext = (): boolean => {
    switch (step) {
      case 1: return !!weekStart;
      case 2: return activeFaculty.length > 0 && allBatches.length > 0;
      case 3: return true;
      case 4: return generatedSlots.length > 0;
      default: return false;
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="pb-28">
      {/* ═══ Step Indicator ═══ */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-hidden mb-4">
        {/* Title */}
        <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-3.5 border-b border-slate-100 dark:border-gray-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5277f7] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#5277f7]/20">
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-slate-800 dark:text-white">Auto Timetable Generator</h2>
              <p className="text-[10px] text-slate-400 font-mono">Step {step} of 5</p>
            </div>
          </div>
        </div>

        {/* Steps bar */}
        <div className="px-3 py-3 md:px-5 flex items-center gap-1 overflow-x-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <React.Fragment key={s.num}>
                {i > 0 && (
                  <div className={`flex-1 h-[2px] min-w-4 rounded-full transition-colors duration-300 ${isDone ? "bg-[#5277f7]" : "bg-slate-200 dark:bg-gray-800"}`} />
                )}
                <button
                  onClick={() => { if (isDone || isActive) setStep(s.num); }}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? "bg-[#5277f7]/10 text-[#5277f7] ring-1 ring-[#5277f7]/30"
                      : isDone
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "text-slate-400 dark:text-gray-600"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.num}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ═══ Step Content ═══ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* ─── Step 1: Configure Week ─── */}
          {step === 1 && (
            <div className="space-y-4">
              <GlassCard title="Select Week" icon={<Calendar className="w-3.5 h-3.5 text-[#5277f7]" />}>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-400 font-mono block mb-2">Week Start (Monday)</label>
                    <input
                      type="date"
                      value={weekStart}
                      onChange={e => {
                        const d = getMondayDate(e.target.value);
                        setWeekStart(formatDateISO(d));
                        setHolidays(new Set());
                      }}
                      className="w-full max-w-xs bg-slate-50 dark:bg-gray-900/40 rounded-xl border border-slate-200 dark:border-gray-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-[#5277f7] transition-colors font-mono"
                    />
                  </div>

                  {/* Week days list */}
                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-400 font-mono block mb-2">Working Days</label>
                    <div className="space-y-2">
                      {weekDates.map(({ day, dateStr }) => {
                        const isHoliday = holidays.has(day);
                        return (
                          <motion.div
                            key={day}
                            layout
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                              isHoliday
                                ? "bg-amber-500/5 border-amber-500/20"
                                : "bg-slate-50/80 dark:bg-gray-900/30 border-slate-100 dark:border-gray-800/50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${DAY_COLORS[day] || "bg-slate-400"}`} />
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{DAY_SHORT[day]}</span>
                              <span className="text-xs text-slate-400 font-mono">{dateStr}</span>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              {isHoliday && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-500 uppercase tracking-wider">Holiday</span>
                              )}
                              <div
                                onClick={() => {
                                  setHolidays(prev => {
                                    const next = new Set(prev);
                                    if (next.has(day)) next.delete(day); else next.add(day);
                                    return next;
                                  });
                                }}
                                className={`w-10 h-6 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${
                                  isHoliday ? "bg-amber-500" : "bg-slate-200 dark:bg-gray-700"
                                }`}
                              >
                                <motion.div
                                  layout
                                  className="w-5 h-5 rounded-full bg-white shadow-sm"
                                  animate={{ x: isHoliday ? 16 : 0 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                              </div>
                            </label>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {holidays.size > 0 && (
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                      <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        {holidays.size} holiday{holidays.size > 1 ? "s" : ""} marked — {Array.from(holidays).map((h: string) => DAY_SHORT[h]).join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>
          )}

          {/* ─── Step 2: Faculty & Batches ─── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Faculty Table */}
              <GlassCard
                title="Active Faculty"
                icon={<Users className="w-3.5 h-3.5 text-[#5277f7]" />}
                action={
                  <button onClick={fetchFaculty} disabled={facultyLoading} className="flex items-center gap-1 text-[10px] font-bold text-[#5277f7] hover:text-[#4062dd] cursor-pointer transition-colors">
                    <RefreshCw className={`w-3 h-3 ${facultyLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                }
              >
                {facultyLoading && (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <Loader2 className="w-5 h-5 text-[#5277f7] animate-spin" />
                    <span className="text-xs text-slate-400">Loading faculty...</span>
                  </div>
                )}

                {facultyError && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <p className="text-[11px] text-red-600 dark:text-red-400">{facultyError}</p>
                  </div>
                )}

                {!facultyLoading && faculty.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono text-slate-400">
                        {activeFaculty.length} active / {faculty.filter(f => f.status.toLowerCase() === "active").length} total active
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDisabledTeachers(new Set())}
                          className="text-[10px] font-bold text-emerald-500 cursor-pointer hover:underline"
                        >Enable All</button>
                        <span className="text-slate-300 dark:text-gray-700 text-[10px]">·</span>
                        <button
                          onClick={() => setDisabledTeachers(new Set(faculty.filter(f => f.status.toLowerCase() === "active").map(f => f.code)))}
                          className="text-[10px] font-bold text-red-400 cursor-pointer hover:underline"
                        >Disable All</button>
                      </div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto overflow-x-auto -mx-1 px-1">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-gray-800/40">
                            <th className="text-left py-2 px-2 text-[9px] font-bold tracking-widest uppercase text-slate-400 font-mono">On</th>
                            <th className="text-left py-2 px-2 text-[9px] font-bold tracking-widest uppercase text-slate-400 font-mono">Code</th>
                            <th className="text-left py-2 px-2 text-[9px] font-bold tracking-widest uppercase text-slate-400 font-mono hidden sm:table-cell">Name</th>
                            <th className="text-left py-2 px-2 text-[9px] font-bold tracking-widest uppercase text-slate-400 font-mono hidden md:table-cell">Division</th>
                            <th className="text-left py-2 px-2 text-[9px] font-bold tracking-widest uppercase text-slate-400 font-mono">Subject</th>
                            <th className="text-left py-2 px-2 text-[9px] font-bold tracking-widest uppercase text-slate-400 font-mono">Batches</th>
                          </tr>
                        </thead>
                        <tbody>
                          {faculty
                            .filter(f => f.status.toLowerCase() === "active" && f.code)
                            .sort((a, b) => a.code.localeCompare(b.code))
                            .map(f => {
                              const isOff = disabledTeachers.has(f.code);
                              return (
                                <tr
                                  key={f.code}
                                  className={`border-b border-slate-50 dark:border-gray-900/30 transition-opacity ${isOff ? "opacity-40" : ""}`}
                                >
                                  <td className="py-2 px-2">
                                    <div
                                      onClick={() => {
                                        setDisabledTeachers(prev => {
                                          const next = new Set(prev);
                                          if (next.has(f.code)) next.delete(f.code); else next.add(f.code);
                                          return next;
                                        });
                                      }}
                                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
                                        !isOff
                                          ? "bg-[#5277f7] border-[#5277f7]"
                                          : "border-slate-300 dark:border-gray-600"
                                      }`}
                                    >
                                      {!isOff && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                  </td>
                                  <td className="py-2 px-2 font-black font-mono text-[#5277f7]">{f.code}</td>
                                  <td className="py-2 px-2 text-slate-600 dark:text-slate-300 hidden sm:table-cell truncate max-w-[120px]">{f.name}</td>
                                  <td className="py-2 px-2 text-slate-400 hidden md:table-cell">{f.division}</td>
                                  <td className="py-2 px-2 text-slate-500 dark:text-slate-400">{f.subject}</td>
                                  <td className="py-2 px-2">
                                    <div className="flex flex-wrap gap-1">
                                      {f.batches.filter(Boolean).slice(0, 3).map((b, i) => (
                                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-gray-800/50 text-slate-500 dark:text-slate-400 font-mono truncate max-w-[70px]">
                                          {b.length > 10 ? b.slice(0, 10) + "…" : b}
                                        </span>
                                      ))}
                                      {f.batches.filter(Boolean).length > 3 && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#5277f7]/10 text-[#5277f7] font-bold">
                                          +{f.batches.filter(Boolean).length - 3}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </GlassCard>

              {/* Batch List with Rooms */}
              <GlassCard title={`Batches (${allBatches.length})`} icon={<Hash className="w-3.5 h-3.5 text-purple-500" />}>
                {allBatches.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 italic">
                    Enable at least one teacher above to see batches
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* JEE section */}
                    {jeeBatches.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] font-black tracking-widest uppercase text-blue-500 font-mono bg-blue-500/10 px-2 py-0.5 rounded">JEE — {jeeBatches.length}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {jeeBatches.map(b => (
                            <BatchRoomRow
                              batch={b}
                              room={batchRooms[b.code] || ""}
                              onRoomChange={room => setBatchRooms(prev => ({ ...prev, [b.code]: room }))}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {/* NEET section */}
                    {neetBatches.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] font-black tracking-widest uppercase text-emerald-500 font-mono bg-emerald-500/10 px-2 py-0.5 rounded">NEET — {neetBatches.length}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {neetBatches.map(b => (
                            <BatchRoomRow
                              batch={b}
                              room={batchRooms[b.code] || ""}
                              onRoomChange={room => setBatchRooms(prev => ({ ...prev, [b.code]: room }))}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {/* DROPPER section */}
                    {dropperBatches.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] font-black tracking-widest uppercase text-orange-500 font-mono bg-orange-500/10 px-2 py-0.5 rounded">DROPPER — {dropperBatches.length}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {dropperBatches.map(b => (
                            <BatchRoomRow
                              batch={b}
                              room={batchRooms[b.code] || ""}
                              onRoomChange={room => setBatchRooms(prev => ({ ...prev, [b.code]: room }))}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            </div>
          )}

          {/* ─── Step 3: Constraints ─── */}
          {step === 3 && (
            <div className="space-y-4">
              <GlassCard title="Scheduling Constraints" icon={<Sliders className="w-3.5 h-3.5 text-[#5277f7]" />}>
                <div className="space-y-6">
                  {/* Max consecutive */}
                  <SliderInput
                    label="Max Consecutive Lectures"
                    value={maxConsecutive}
                    min={1} max={6}
                    onChange={setMaxConsecutive}
                    description="Maximum back-to-back slots for any teacher in a day"
                  />

                  {/* Max per day */}
                  <SliderInput
                    label="Max Slots Per Day"
                    value={maxSlotsPerDay}
                    min={1} max={6}
                    onChange={setMaxSlotsPerDay}
                    description="Maximum total slots per teacher in one day"
                  />
                </div>
              </GlassCard>

              {/* Test Slot Overrides */}
              <GlassCard title="Test Slot Overrides (Optional)" icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}>
                <p className="text-[10px] text-slate-400 mb-3">Mark specific slots as tests — these won't be filled by the auto-generator.</p>
                {testSlots.map((ts, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 mb-2 bg-slate-50/80 dark:bg-gray-900/30 rounded-xl p-3 border border-slate-100 dark:border-gray-800/50">
                    <select
                      value={ts.day}
                      onChange={e => {
                        const updated = [...testSlots];
                        updated[i] = { ...ts, day: e.target.value };
                        setTestSlots(updated);
                      }}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 outline-none"
                    >
                      {DAYS.map(d => <option key={d} value={d}>{DAY_SHORT[d]}</option>)}
                    </select>
                    <select
                      value={ts.slot}
                      onChange={e => {
                        const updated = [...testSlots];
                        updated[i] = { ...ts, slot: Number(e.target.value) };
                        setTestSlots(updated);
                      }}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 outline-none"
                    >
                      {SLOTS.map(s => <option key={s.id} value={s.id}>Slot {s.id}</option>)}
                    </select>
                    <select
                      value={ts.batchCode}
                      onChange={e => {
                        const updated = [...testSlots];
                        updated[i] = { ...ts, batchCode: e.target.value };
                        setTestSlots(updated);
                      }}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 outline-none flex-1 min-w-0 max-w-[160px]"
                    >
                      <option value="">Select Batch</option>
                      {allBatches.map(b => <option key={b.code} value={b.code}>{b.code}</option>)}
                    </select>
                    <input
                      type="text"
                      value={ts.label}
                      onChange={e => {
                        const updated = [...testSlots];
                        updated[i] = { ...ts, label: e.target.value };
                        setTestSlots(updated);
                      }}
                      placeholder="Label (e.g. VP AIR TEST)"
                      className="bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 outline-none flex-1 min-w-[120px]"
                    />
                    <button
                      onClick={() => setTestSlots(prev => prev.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-500 cursor-pointer p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setTestSlots(prev => [...prev, { day: "TUESDAY", slot: 1, batchCode: allBatches[0]?.code || "", label: "" }])}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-[#5277f7] hover:text-[#4062dd] cursor-pointer transition-colors mt-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Test Slot
                </button>
              </GlassCard>

              {/* Summary */}
              <GlassCard title="Summary" icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <SummaryPill label="Teachers" value={activeFaculty.length.toString()} color="blue" />
                  <SummaryPill label="Batches" value={allBatches.length.toString()} color="purple" />
                  <SummaryPill label="Work Days" value={(5 - holidays.size).toString()} color="green" />
                  <SummaryPill label="Test Slots" value={testSlots.length.toString()} color="amber" />
                </div>
              </GlassCard>
            </div>
          )}

          {/* ─── Step 4: Preview ─── */}
          {step === 4 && (
            <div className="space-y-4">
              {generating && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5277f7] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#5277f7]/30 animate-pulse">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-bold text-slate-700 dark:text-white">Generating Timetable...</p>
                  <p className="text-[10px] text-slate-400">Running constraint satisfaction algorithm</p>
                </div>
              )}

              {genError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-red-500">Generation Failed</p>
                    <p className="text-[11px] text-red-400">{genError}</p>
                  </div>
                </div>
              )}

              {!generating && generatedSlots.length > 0 && previewGrid && (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <SummaryPill label="Total Slots" value={generatedSlots.length.toString()} color="blue" />
                    <SummaryPill label="Days" value={previewGrid.workDays.length.toString()} color="green" />
                    <SummaryPill label="JEE Batches" value={jeeBatches.length.toString()} color="purple" />
                    <SummaryPill label="NEET Batches" value={neetBatches.length.toString()} color="cyan" />
                    <SummaryPill label="Dropper" value={dropperBatches.length.toString()} color="amber" />
                  </div>

                  {/* Warnings */}
                  {warnings.length > 0 && (
                    <GlassCard title={`Warnings (${warnings.length})`} icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}>
                      <div className="max-h-[200px] overflow-y-auto space-y-1">
                        {warnings.map((w, i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px] text-amber-600 dark:text-amber-400">
                            <CloudOff className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  )}

                  {/* AI Resolve Button */}
                  {warnings.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={async () => {
                          setAiResolving(true);
                          setAiError(null);
                          setAiSuggestions([]);
                          try {
                            const r = await fetch("/api/timetable/ai-resolve", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", ...adminHeaders() },
                              body: JSON.stringify({
                                warnings,
                                faculty: activeFaculty,
                                currentSlots: generatedSlots,
                                config: { maxConsecutive, maxSlotsPerDay },
                              }),
                            });
                            const d = await r.json();
                            if (d.suggestions) setAiSuggestions(d.suggestions);
                            if (d.error) setAiError(d.error);
                          } catch (err: any) {
                            setAiError(err.message);
                          } finally {
                            setAiResolving(false);
                          }
                        }}
                        disabled={aiResolving}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
                      >
                        {aiResolving ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI Resolving...</>
                        ) : (
                          <><Sparkles className="w-3.5 h-3.5" /> 🤖 Ask AI to Resolve Conflicts</>
                        )}
                      </button>

                      {aiError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-[11px] text-red-400">
                          {aiError}
                        </div>
                      )}

                      {aiSuggestions.length > 0 && (
                        <GlassCard title={`🧠 Pattern AI Suggestions (14-Week Data)`} icon={<Sparkles className="w-3.5 h-3.5 text-purple-500" />}>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {aiSuggestions.map((s: any, i: number) => (
                              <div key={i} className="bg-purple-500/5 border border-purple-500/10 rounded-xl px-3 py-2.5">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[11px] font-bold text-purple-400">
                                    {s.teacher ? `→ Assign ${s.teacher}` : "⚠ No suggestion"}
                                  </p>
                                  {s.confidence > 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${
                                            s.confidence >= 80 ? "bg-green-500" : s.confidence >= 50 ? "bg-yellow-500" : "bg-red-500"
                                          }`}
                                          style={{ width: `${s.confidence}%` }}
                                        />
                                      </div>
                                      <span className="text-[9px] text-slate-500">{s.confidence}%</span>
                                    </div>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">{s.reason}</p>
                              </div>
                            ))}
                          </div>
                        </GlassCard>
                      )}
                    </div>
                  )}

                  {/* Preview Grid */}
                  <GlassCard title="Timetable Preview" icon={<Eye className="w-3.5 h-3.5 text-[#5277f7]" />}>
                    <div className="overflow-x-auto -mx-4 px-4 md:-mx-5 md:px-5 pb-2">
                      <table className="w-max min-w-full border-collapse text-[10px]">
                        <thead>
                          {/* Section Headers */}
                          <tr>
                            <th colSpan={2} className="bg-slate-100 dark:bg-gray-900/40 px-2 py-1.5 border border-slate-200 dark:border-gray-800" />
                            <th colSpan={2 + jeeBatches.length} className="bg-blue-500/10 text-blue-500 font-black tracking-widest uppercase px-2 py-1.5 border border-slate-200 dark:border-gray-800 text-center">
                              JEE ({jeeBatches.length})
                            </th>
                            <th className="bg-emerald-500/20 w-1 border border-slate-200 dark:border-gray-800" />
                            <th colSpan={2 + neetBatches.length} className="bg-emerald-500/10 text-emerald-500 font-black tracking-widest uppercase px-2 py-1.5 border border-slate-200 dark:border-gray-800 text-center">
                              NEET ({neetBatches.length})
                            </th>
                            <th className="bg-orange-500/20 w-1 border border-slate-200 dark:border-gray-800" />
                            <th colSpan={2 + dropperBatches.length} className="bg-orange-500/10 text-orange-500 font-black tracking-widest uppercase px-2 py-1.5 border border-slate-200 dark:border-gray-800 text-center">
                              DROPPER ({dropperBatches.length})
                            </th>
                          </tr>
                          {/* Column Headers */}
                          <tr>
                            <th className="sticky left-0 z-10 bg-slate-50 dark:bg-[#111827] px-2 py-2 border border-slate-200 dark:border-gray-800 font-bold text-slate-500">Day</th>
                            <th className="bg-slate-50 dark:bg-[#111827] px-2 py-2 border border-slate-200 dark:border-gray-800 font-bold text-slate-500">Date</th>
                            <th className="bg-slate-50 dark:bg-[#111827] px-1.5 py-2 border border-slate-200 dark:border-gray-800 font-bold text-slate-500">Start</th>
                            <th className="bg-slate-50 dark:bg-[#111827] px-1.5 py-2 border border-slate-200 dark:border-gray-800 font-bold text-slate-500">End</th>
                            {jeeBatches.map(b => (
                              <th key={b.code} className="bg-slate-50 dark:bg-[#111827] px-1 py-2 border border-slate-200 dark:border-gray-800 font-bold text-slate-500 whitespace-nowrap max-w-[60px] truncate" title={b.code}>
                                {b.code.length > 12 ? b.code.slice(0, 12) + "…" : b.code}
                              </th>
                            ))}
                            <th className="bg-emerald-500/20 w-1 border border-slate-200 dark:border-gray-800" />
                            <th className="bg-slate-50 dark:bg-[#111827] px-1.5 py-2 border border-slate-200 dark:border-gray-800 font-bold text-slate-500">Start</th>
                            <th className="bg-slate-50 dark:bg-[#111827] px-1.5 py-2 border border-slate-200 dark:border-gray-800 font-bold text-slate-500">End</th>
                            {neetBatches.map(b => (
                              <th key={b.code} className="bg-slate-50 dark:bg-[#111827] px-1 py-2 border border-slate-200 dark:border-gray-800 font-bold text-slate-500 whitespace-nowrap max-w-[60px] truncate" title={b.code}>
                                {b.code.length > 12 ? b.code.slice(0, 12) + "…" : b.code}
                              </th>
                            ))}
                            <th className="bg-orange-500/20 w-1 border border-slate-200 dark:border-gray-800" />
                            <th className="bg-slate-50 dark:bg-[#111827] px-1.5 py-2 border border-slate-200 dark:border-gray-800 font-bold text-slate-500">Start</th>
                            <th className="bg-slate-50 dark:bg-[#111827] px-1.5 py-2 border border-slate-200 dark:border-gray-800 font-bold text-slate-500">End</th>
                            {dropperBatches.map(b => (
                              <th key={b.code} className="bg-slate-50 dark:bg-[#111827] px-1 py-2 border border-slate-200 dark:border-gray-800 font-bold text-slate-500 whitespace-nowrap max-w-[60px] truncate" title={b.code}>
                                {b.code.length > 12 ? b.code.slice(0, 12) + "…" : b.code}
                              </th>
                            ))}
                          </tr>
                          {/* Room Numbers Row */}
                          <tr>
                            <th className="sticky left-0 z-10 bg-fuchsia-500/20 px-2 py-1.5 border border-slate-200 dark:border-gray-800 font-bold text-fuchsia-600 dark:text-fuchsia-400 text-[9px]">Room</th>
                            <th className="bg-fuchsia-500/20 px-2 py-1.5 border border-slate-200 dark:border-gray-800 text-fuchsia-600 dark:text-fuchsia-400 text-[9px]"></th>
                            <th className="bg-fuchsia-500/20 px-1.5 py-1.5 border border-slate-200 dark:border-gray-800 text-fuchsia-600 dark:text-fuchsia-400 text-[9px] font-bold">Room No</th>
                            <th className="bg-fuchsia-500/20 px-1.5 py-1.5 border border-slate-200 dark:border-gray-800 text-fuchsia-600 dark:text-fuchsia-400 text-[9px]"></th>
                            {jeeBatches.map(b => (
                              <th key={`room-jee-${b.code}`} className="bg-fuchsia-500/20 px-1 py-1.5 border border-slate-200 dark:border-gray-800 font-bold text-fuchsia-600 dark:text-fuchsia-300 text-[9px] whitespace-nowrap">
                                {batchRooms[b.code] || b.room || "—"}
                              </th>
                            ))}
                            <th className="bg-emerald-500/20 w-1 border border-slate-200 dark:border-gray-800" />
                            <th className="bg-fuchsia-500/20 px-1.5 py-1.5 border border-slate-200 dark:border-gray-800 text-fuchsia-600 dark:text-fuchsia-400 text-[9px] font-bold">Room No</th>
                            <th className="bg-fuchsia-500/20 px-1.5 py-1.5 border border-slate-200 dark:border-gray-800 text-fuchsia-600 dark:text-fuchsia-400 text-[9px]"></th>
                            {neetBatches.map(b => (
                              <th key={`room-neet-${b.code}`} className="bg-fuchsia-500/20 px-1 py-1.5 border border-slate-200 dark:border-gray-800 font-bold text-fuchsia-600 dark:text-fuchsia-300 text-[9px] whitespace-nowrap">
                                {batchRooms[b.code] || b.room || "—"}
                              </th>
                            ))}
                            <th className="bg-orange-500/20 w-1 border border-slate-200 dark:border-gray-800" />
                            <th className="bg-fuchsia-500/20 px-1.5 py-1.5 border border-slate-200 dark:border-gray-800 text-fuchsia-600 dark:text-fuchsia-400 text-[9px] font-bold">Room No</th>
                            <th className="bg-fuchsia-500/20 px-1.5 py-1.5 border border-slate-200 dark:border-gray-800 text-fuchsia-600 dark:text-fuchsia-400 text-[9px]"></th>
                            {dropperBatches.map(b => (
                              <th key={`room-dropper-${b.code}`} className="bg-fuchsia-500/20 px-1 py-1.5 border border-slate-200 dark:border-gray-800 font-bold text-fuchsia-600 dark:text-fuchsia-300 text-[9px] whitespace-nowrap">
                                {batchRooms[b.code] || b.room || "—"}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewGrid.rows.map((row, ri) => {
                            const isFirstSlot = row.slot.id === 1;
                            const dayColor = DAY_COLORS[row.day] || "bg-slate-400";
                            const dayBgLight = DAY_BG_LIGHT[row.day] || "";
                            const dayTextColor = DAY_TEXT_COLORS[row.day] || "text-slate-400";

                            return (
                              <tr key={ri} className={row.isHoliday ? "opacity-40" : ""}>
                                {/* Day cell */}
                                {isFirstSlot ? (
                                  <td
                                    rowSpan={6}
                                    className={`sticky left-0 z-10 px-2 py-1.5 border border-slate-200 dark:border-gray-800 font-black text-center align-middle ${dayColor} text-white`}
                                  >
                                    <div className="flex flex-col items-center">
                                      <span className="text-[11px]">{DAY_SHORT[row.day]}</span>
                                      {row.isHoliday && <span className="text-[8px] mt-0.5 opacity-80">HOLIDAY</span>}
                                    </div>
                                  </td>
                                ) : null}
                                {/* Date cell */}
                                <td className={`px-1.5 py-1 border border-slate-200 dark:border-gray-800 font-mono text-slate-500 dark:text-slate-400 ${isFirstSlot ? dayBgLight : ""}`}>
                                  {isFirstSlot ? row.date : ""}
                                </td>
                                {/* JEE Start/End */}
                                <td className="px-1 py-1 border border-slate-200 dark:border-gray-800 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {row.isHoliday ? "" : row.slot.start}
                                </td>
                                <td className="px-1 py-1 border border-slate-200 dark:border-gray-800 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {row.isHoliday ? "" : row.slot.end}
                                </td>
                                {/* JEE batch cells */}
                                {jeeBatches.map(b => {
                                  const teacher = row.isHoliday ? "" : (previewGrid.lookup.get(`${row.day}-${row.slot.id}-${b.code}`) || "");
                                  return (
                                    <td
                                      key={b.code}
                                      className={`px-1 py-1 border border-slate-200 dark:border-gray-800 text-center font-bold font-mono ${
                                        teacher ? `${dayTextColor}` : "text-slate-300 dark:text-gray-700"
                                      }`}
                                    >
                                      {teacher || "—"}
                                    </td>
                                  );
                                })}
                                {/* Separator */}
                                <td className="bg-emerald-500/10 w-1 border border-slate-200 dark:border-gray-800" />
                                {/* NEET Start/End */}
                                <td className="px-1 py-1 border border-slate-200 dark:border-gray-800 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {row.isHoliday ? "" : row.slot.start}
                                </td>
                                <td className="px-1 py-1 border border-slate-200 dark:border-gray-800 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {row.isHoliday ? "" : row.slot.end}
                                </td>
                                {/* NEET batch cells */}
                                {neetBatches.map(b => {
                                  const teacher = row.isHoliday ? "" : (previewGrid.lookup.get(`${row.day}-${row.slot.id}-${b.code}`) || "");
                                  return (
                                    <td
                                      key={b.code}
                                      className={`px-1 py-1 border border-slate-200 dark:border-gray-800 text-center font-bold font-mono ${
                                        teacher ? `${dayTextColor}` : "text-slate-300 dark:text-gray-700"
                                      }`}
                                    >
                                      {teacher || "—"}
                                    </td>
                                  );
                                })}
                                {/* DROPPER Separator */}
                                <td className="bg-orange-500/10 w-1 border border-slate-200 dark:border-gray-800" />
                                {/* DROPPER Start/End */}
                                <td className="px-1 py-1 border border-slate-200 dark:border-gray-800 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {row.isHoliday ? "" : row.slot.start}
                                </td>
                                <td className="px-1 py-1 border border-slate-200 dark:border-gray-800 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {row.isHoliday ? "" : row.slot.end}
                                </td>
                                {/* DROPPER batch cells */}
                                {dropperBatches.map(b => {
                                  const teacher = row.isHoliday ? "" : (previewGrid.lookup.get(`${row.day}-${row.slot.id}-${b.code}`) || "");
                                  return (
                                    <td
                                      key={b.code}
                                      className={`px-1 py-1 border border-slate-200 dark:border-gray-800 text-center font-bold font-mono ${
                                        teacher ? `${dayTextColor}` : "text-slate-300 dark:text-gray-700"
                                      }`}
                                    >
                                      {teacher || "—"}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </GlassCard>

                  {/* Re-generate button */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        setGeneratedSlots([]);
                        setWarnings([]);
                        handleGenerate();
                      }}
                      disabled={generating}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-gray-800/60 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
                      Re-generate (Different Random)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── Step 5: Export ─── */}
          {step === 5 && (
            <div className="space-y-4">
              <GlassCard title="Export to Google Sheet" icon={<FileSpreadsheet className="w-3.5 h-3.5 text-[#5277f7]" />}>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-400 font-mono block mb-2">Tab Name</label>
                    <input
                      type="text"
                      value={tabName}
                      onChange={e => setTabName(e.target.value)}
                      placeholder="e.g. 15th-20th June 2026"
                      className="w-full max-w-md bg-slate-50 dark:bg-gray-900/40 rounded-xl border border-slate-200 dark:border-gray-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-[#5277f7] transition-colors font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5">This will be the name of the new tab in the Google Sheet</p>
                  </div>

                  {/* Preview Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <SummaryPill label="Slots Generated" value={generatedSlots.length.toString()} color="blue" />
                    <SummaryPill label="Grid Rows" value={buildExportGrid().length.toString()} color="purple" />
                    <SummaryPill label="Tab Name" value={tabName || "—"} color="green" />
                  </div>

                  {/* Export Button */}
                  <button
                    onClick={handleExport}
                    disabled={exporting || !tabName.trim() || generatedSlots.length === 0}
                    className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                      exporting
                        ? "bg-slate-300 dark:bg-gray-700 text-slate-500"
                        : "bg-gradient-to-r from-[#5277f7] to-[#7c3aed] text-white shadow-lg shadow-[#5277f7]/25 hover:shadow-xl hover:shadow-[#5277f7]/30 active:scale-[0.98]"
                    }`}
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Writing to Sheet...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Write to Google Sheet
                      </>
                    )}
                  </button>

                  {/* Result */}
                  {exportResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center gap-2 rounded-xl px-4 py-3 ${
                        exportResult.success
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : "bg-red-500/10 border border-red-500/20"
                      }`}
                    >
                      {exportResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                      <p className={`text-xs font-bold ${
                        exportResult.success ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      }`}>
                        {exportResult.message}
                      </p>
                    </motion.div>
                  )}
                </div>
              </GlassCard>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ═══ Navigation Buttons ═══ */}
      <div className="flex items-center justify-between mt-6 gap-3">
        <button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            step === 1
              ? "opacity-30 cursor-not-allowed text-slate-400"
              : "bg-slate-100 dark:bg-gray-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700"
          }`}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </button>

        {step < 5 && (
          <button
            onClick={() => setStep(s => Math.min(5, s + 1))}
            disabled={!canGoNext()}
            className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              !canGoNext()
                ? "opacity-30 cursor-not-allowed bg-slate-200 dark:bg-gray-700 text-slate-400"
                : "bg-gradient-to-r from-[#5277f7] to-[#7c3aed] text-white shadow-lg shadow-[#5277f7]/25 hover:shadow-xl hover:shadow-[#5277f7]/30 active:scale-[0.98]"
            }`}
          >
            {step === 3 ? "Generate" : "Next"}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function GlassCard({
  title, icon, children, action,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-3.5 border-b border-slate-100 dark:border-gray-800/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#5277f7]/10 flex items-center justify-center">
            {icon}
          </div>
          <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-4 py-3.5 md:px-5">
        {children}
      </div>
    </div>
  );
}

function BatchRoomRow({
  batch, room, onRoomChange,
}: {
  batch: BatchInfo;
  room: string;
  onRoomChange: (room: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-slate-50/80 dark:bg-gray-900/30 rounded-xl border border-slate-100 dark:border-gray-800/50 px-3 py-2.5">
      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
        batch.section === "JEE" ? "bg-blue-500/10 text-blue-500" : batch.section === "NEET" ? "bg-emerald-500/10 text-emerald-500" : "bg-orange-500/10 text-orange-500"
      }`}>
        {batch.section}
      </span>
      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 font-mono flex-1 min-w-0 truncate" title={batch.code}>
        {batch.code}
      </span>
      <input
        type="text"
        value={room}
        onChange={e => onRoomChange(e.target.value)}
        placeholder="Room"
        className="w-16 bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 px-2 py-1 text-[10px] text-slate-700 dark:text-slate-200 outline-none focus:border-[#5277f7] transition-colors text-center font-mono"
      />
    </div>
  );
}

function SliderInput({
  label, value, min, max, onChange, description,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">{label}</label>
        <span className="text-sm font-black text-[#5277f7] font-mono bg-[#5277f7]/10 px-2.5 py-0.5 rounded-lg">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#5277f7] cursor-pointer"
      />
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-slate-400">{min}</span>
        <span className="text-[9px] text-slate-400">{description}</span>
        <span className="text-[9px] font-mono text-slate-400">{max}</span>
      </div>
    </div>
  );
}

function SummaryPill({
  label, value, color,
}: {
  label: string;
  value: string;
  color: "blue" | "purple" | "green" | "amber" | "cyan";
}) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-500",
    purple: "bg-purple-500/10 text-purple-500",
    green: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
    cyan: "bg-cyan-500/10 text-cyan-500",
  };
  return (
    <div className="bg-slate-50/80 dark:bg-gray-900/30 rounded-xl border border-slate-100 dark:border-gray-800/50 p-3 text-center">
      <p className={`text-lg font-black font-mono ${colors[color]?.split(" ")[1] || "text-[#5277f7]"}`}>{value}</p>
      <p className="text-[9px] font-bold tracking-widest uppercase text-slate-400 font-mono mt-0.5">{label}</p>
    </div>
  );
}
