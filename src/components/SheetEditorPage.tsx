import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileSpreadsheet, Download, Save, Loader2, AlertCircle,
  CheckCircle2, AlertTriangle, X, Search, Replace, Undo2,
  ArrowLeftRight, CalendarDays, Eraser, Umbrella, CopyPlus,
  Users, RefreshCw, Zap, ChevronDown, Eye, EyeOff,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────

interface FacultyMember {
  pwId: string; name: string; email: string; code: string;
  division: string; subject: string; designation: string;
  status: string; teacherId: string; qualification: string;
  photoUrl: string; batches: string[];
}

interface SheetEditorPageProps {
  adminHeaders: () => Record<string, string>;
}

// ─── Constants ──────────────────────────────────────────────────────────

const DAY_NAMES = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

// ─── Helpers ────────────────────────────────────────────────────────────

/** Extract short batch code like "LJ151MA" from "27-LJ151MA 2026" */
function extractShortCode(fullCode: string): string {
  const m = fullCode.match(/\d+-([A-Z0-9]+)/i);
  return m ? m[1].toUpperCase() : fullCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ─── Component ──────────────────────────────────────────────────────────

export default function SheetEditorPage({ adminHeaders }: SheetEditorPageProps) {
  // ── Tab list ──
  const [existingTabs, setExistingTabs] = useState<string[]>([]);
  const [selectedLoadTab, setSelectedLoadTab] = useState("");
  const [loadingTab, setLoadingTab] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Sheet data ──
  const [sheetData, setSheetData] = useState<string[][] | null>(null);
  const [sheetFormats, setSheetFormats] = useState<any[][] | null>(null);
  const [sheetSourceTab, setSheetSourceTab] = useState("");
  const [sheetEditingCell, setSheetEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [sheetCopyName, setSheetCopyName] = useState("");
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetSaveResult, setSheetSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  // ── Faculty data (auto-loaded) ──
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [facultyLoading, setFacultyLoading] = useState(false);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});

  // ── Undo stack ──
  const [undoStack, setUndoStack] = useState<string[][][]>([]);

  // ── Find & Replace ──
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  // ── Swap mode ──
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirst, setSwapFirst] = useState<{ r: number; c: number } | null>(null);

  // ── NEW: Teacher highlight ──
  const [highlightedTeacher, setHighlightedTeacher] = useState<string | null>(null);

  // ── NEW: Autocomplete ──
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<{ code: string; name: string }[]>([]);
  const [autocompletePos, setAutocompletePos] = useState<{ r: number; c: number } | null>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // ── NEW: Eligible teacher dropdown ──
  const [eligibleDropdown, setEligibleDropdown] = useState<{ r: number; c: number; batchCode: string } | null>(null);

  // ── Quick generate state ──
  const [quickGenerating, setQuickGenerating] = useState(false);

  // ── Show/hide toolbar sections ──
  const [showToolbar, setShowToolbar] = useState(true);

  // ════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ════════════════════════════════════════════════════════════════════════

  // Auto-fetch tabs on mount
  useEffect(() => {
    const fetchTabs = async () => {
      try {
        const r = await fetch("/api/timetable/tabs", { headers: adminHeaders() });
        if (r.ok) {
          const d = await r.json();
          if (d.success) setExistingTabs(d.tabs || []);
        }
      } catch (err) {
        console.warn("Failed to fetch sheet tabs:", err);
      }
    };
    fetchTabs();
  }, [adminHeaders]);

  // Auto-fetch faculty on mount (background)
  useEffect(() => {
    const fetchFaculty = async () => {
      setFacultyLoading(true);
      try {
        const r = await fetch("/api/timetable/faculty", { headers: adminHeaders() });
        if (r.ok) {
          const d = await r.json();
          setFaculty(d.faculty || []);
        }
      } catch { /* silent */ }

      // Also fetch teacher name mappings
      try {
        const r = await fetch("/api/timetable/teachers", { headers: adminHeaders() });
        if (r.ok) {
          const d = await r.json();
          setTeacherNames(d.teachers || {});
        }
      } catch { /* silent */ }

      setFacultyLoading(false);
    };
    fetchFaculty();
  }, [adminHeaders]);

  // ════════════════════════════════════════════════════════════════════════
  // DERIVED DATA
  // ════════════════════════════════════════════════════════════════════════

  // All active teacher codes + names
  const allTeachers = useMemo(() => {
    const map = new Map<string, string>();
    // From faculty
    for (const f of faculty) {
      if (f.status?.toLowerCase() === "active" && f.code) {
        map.set(f.code, f.name || teacherNames[f.code] || "");
      }
    }
    // From teacher names config (may have codes not in faculty)
    for (const [code, name] of Object.entries(teacherNames)) {
      if (!map.has(code)) map.set(code, name as string);
    }
    return Array.from(map.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code));
  }, [faculty, teacherNames]);

  // Column → batch code mapping (from header row)
  const colBatchMap = useMemo(() => {
    if (!sheetData || sheetData.length < 1) return new Map<number, string>();
    const map = new Map<number, string>();
    const headerRow = sheetData[0];
    for (let c = 0; c < headerRow.length; c++) {
      const val = (headerRow[c] || "").trim();
      if (!val || val === "Day" || val === "Date" || /^Start/i.test(val) || /^End/i.test(val)) continue;
      if (/^(JEE|NEET|DROPPER)\s*\(/i.test(val)) continue;
      if (/room/i.test(val)) continue;
      // Looks like a batch code
      if (/[A-Z]/i.test(val) && /\d/.test(val) && val.length >= 4) {
        map.set(c, val);
      }
    }
    return map;
  }, [sheetData]);

  // Batch → eligible teachers (from faculty data)
  const batchEligibleTeachers = useMemo(() => {
    const map = new Map<string, { code: string; name: string }[]>();
    for (const f of faculty) {
      if (f.status?.toLowerCase() !== "active" || !f.code) continue;
      for (const b of (f.batches || [])) {
        const bTrim = b.trim();
        if (!bTrim) continue;
        if (!map.has(bTrim)) map.set(bTrim, []);
        const list = map.get(bTrim)!;
        if (!list.some(t => t.code === f.code)) {
          list.push({ code: f.code, name: f.name || teacherNames[f.code] || "" });
        }
        // Also check short code match
        const short = extractShortCode(bTrim);
        if (short !== bTrim) {
          if (!map.has(short)) map.set(short, []);
          const shortList = map.get(short)!;
          if (!shortList.some(t => t.code === f.code)) {
            shortList.push({ code: f.code, name: f.name || teacherNames[f.code] || "" });
          }
        }
      }
    }
    return map;
  }, [faculty, teacherNames]);

  // Teacher stats
  const teacherStats = useMemo(() => {
    if (!sheetData) return [];
    const counts: Record<string, number> = {};
    for (let r = 2; r < sheetData.length; r++) {
      for (let c = 2; c < sheetData[r].length; c++) {
        const val = (sheetData[r][c] || "").trim().toUpperCase();
        if (val && val !== "HOLIDAY" && val !== "—" && val !== "-" && val.length >= 2 && val.length <= 6) {
          counts[val] = (counts[val] || 0) + 1;
        }
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [sheetData]);

  // Conflict detection
  const conflicts = useMemo(() => {
    if (!sheetData) return new Set<string>();
    const conflictSet = new Set<string>();
    for (let r = 2; r < sheetData.length; r++) {
      const teacherCols: Record<string, number[]> = {};
      for (let c = 2; c < sheetData[r].length; c++) {
        const val = (sheetData[r][c] || "").trim().toUpperCase();
        if (val && val !== "HOLIDAY" && val !== "—" && val !== "-" && val.length >= 2 && val.length <= 6) {
          if (!teacherCols[val]) teacherCols[val] = [];
          teacherCols[val].push(c);
        }
      }
      for (const [, cols] of Object.entries(teacherCols)) {
        if (cols.length > 1) {
          for (const c of cols) conflictSet.add(`${r}-${c}`);
        }
      }
    }
    return conflictSet;
  }, [sheetData]);

  // Find count
  const findCount = useMemo(() => {
    if (!sheetData || !findText) return 0;
    const search = findText.toUpperCase();
    let count = 0;
    for (const row of sheetData) {
      for (const cell of row) {
        if (cell.toUpperCase() === search) count++;
      }
    }
    return count;
  }, [sheetData, findText]);

  // Highlighted teacher day breakdown
  const highlightBreakdown = useMemo(() => {
    if (!sheetData || !highlightedTeacher) return null;
    const dayCounts: Record<string, number> = {};
    let total = 0;
    let currentDay = "";
    for (let r = 2; r < sheetData.length; r++) {
      const cellDay = (sheetData[r][0] || "").trim().toUpperCase();
      if (DAY_NAMES.includes(cellDay)) currentDay = cellDay;
      for (let c = 2; c < sheetData[r].length; c++) {
        if ((sheetData[r][c] || "").trim().toUpperCase() === highlightedTeacher) {
          dayCounts[currentDay] = (dayCounts[currentDay] || 0) + 1;
          total++;
        }
      }
    }
    return { total, days: dayCounts };
  }, [sheetData, highlightedTeacher]);

  // ════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ════════════════════════════════════════════════════════════════════════

  const pushUndo = useCallback(() => {
    if (!sheetData) return;
    setUndoStack(prev => [...prev.slice(-19), sheetData.map(r => [...r])]);
  }, [sheetData]);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setSheetData(last);
      return prev.slice(0, -1);
    });
  }, []);

  const handleCellChange = useCallback((r: number, c: number, value: string) => {
    setSheetData(prev => {
      if (!prev) return prev;
      const copy = prev.map(row => [...row]);
      copy[r][c] = value;
      return copy;
    });
  }, []);

  const handleReplace = useCallback(() => {
    if (!sheetData || !findText) return;
    pushUndo();
    const search = findText.toUpperCase();
    setSheetData(prev => {
      if (!prev) return prev;
      return prev.map(row =>
        row.map(cell => cell.toUpperCase() === search ? replaceText : cell)
      );
    });
  }, [sheetData, findText, replaceText, pushUndo]);

  const handleAutoDate = useCallback((newWeekStart: string) => {
    if (!sheetData || !newWeekStart) return;
    pushUndo();
    const start = new Date(newWeekStart);
    if (isNaN(start.getTime())) return;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    setSheetData(prev => {
      if (!prev) return prev;
      const copy = prev.map(r => [...r]);
      let dayOffset = 0;
      for (let r = 2; r < copy.length; r++) {
        const cellDay = (copy[r][0] || "").trim().toUpperCase();
        if (DAY_NAMES.includes(cellDay)) {
          const dateObj = new Date(start);
          dateObj.setDate(dateObj.getDate() + dayOffset);
          const dayNum = dateObj.getDate();
          const suffix = dayNum === 1 || dayNum === 21 || dayNum === 31 ? "st" :
                         dayNum === 2 || dayNum === 22 ? "nd" :
                         dayNum === 3 || dayNum === 23 ? "rd" : "th";
          copy[r][1] = `${dayNum}${suffix}-${months[dateObj.getMonth()]}-${dateObj.getFullYear()}`;
          dayOffset++;
        }
      }
      return copy;
    });
  }, [sheetData, pushUndo]);

  const handleClearDay = useCallback((dayName: string) => {
    if (!sheetData) return;
    pushUndo();
    const target = dayName.toUpperCase();
    setSheetData(prev => {
      if (!prev) return prev;
      const copy = prev.map(r => [...r]);
      let inDay = false;
      for (let r = 2; r < copy.length; r++) {
        const cellDay = (copy[r][0] || "").trim().toUpperCase();
        if (DAY_NAMES.includes(cellDay)) inDay = cellDay === target;
        if (inDay) {
          for (let c = 2; c < copy[r].length; c++) copy[r][c] = "";
        }
      }
      return copy;
    });
  }, [sheetData, pushUndo]);

  const handleMarkHoliday = useCallback((dayName: string) => {
    if (!sheetData) return;
    pushUndo();
    const target = dayName.toUpperCase();
    setSheetData(prev => {
      if (!prev) return prev;
      const copy = prev.map(r => [...r]);
      let inDay = false;
      let isFirstRow = true;
      for (let r = 2; r < copy.length; r++) {
        const cellDay = (copy[r][0] || "").trim().toUpperCase();
        if (DAY_NAMES.includes(cellDay)) { inDay = cellDay === target; isFirstRow = true; }
        if (inDay) {
          for (let c = 2; c < copy[r].length; c++) {
            copy[r][c] = isFirstRow && c === 2 ? "HOLIDAY" : "";
          }
          isFirstRow = false;
        }
      }
      return copy;
    });
  }, [sheetData, pushUndo]);

  const handleSwapClick = useCallback((r: number, c: number) => {
    if (!sheetData || r < 2 || c < 2) return;
    if (!swapFirst) {
      setSwapFirst({ r, c });
    } else {
      pushUndo();
      setSheetData(prev => {
        if (!prev) return prev;
        const copy = prev.map(row => [...row]);
        const temp = copy[swapFirst.r][swapFirst.c];
        copy[swapFirst.r][swapFirst.c] = copy[r][c];
        copy[r][c] = temp;
        return copy;
      });
      setSwapFirst(null);
    }
  }, [sheetData, swapFirst, pushUndo]);

  // ── Load sheet tab ──
  const handleLoadTab = useCallback(async (tabNameOverride?: string) => {
    const tab = tabNameOverride || selectedLoadTab;
    if (!tab) return;
    setLoadingTab(true);
    setLoadError(null);
    setSheetSaveResult(null);
    try {
      const r = await fetch(`/api/timetable/tab-values?tabName=${encodeURIComponent(tab)}`, {
        headers: adminHeaders()
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Failed to load tab values");

      const values: string[][] = d.values || [];
      if (values.length < 2) throw new Error("Sheet has too few rows");

      const maxCols = Math.max(...values.map((row: string[]) => row.length));
      const normalized = values.map((row: string[]) => {
        const padded = [...row];
        while (padded.length < maxCols) padded.push("");
        return padded;
      });

      setSheetData(normalized);
      setSheetFormats(d.formats || null);
      setSheetSourceTab(tab);
      setSheetCopyName(`${tab} (Copy)`);
      setSheetEditingCell(null);
      setUndoStack([]);
      setHighlightedTeacher(null);
    } catch (err: any) {
      setLoadError(err.message || "Failed to load sheet");
    } finally {
      setLoadingTab(false);
    }
  }, [selectedLoadTab, adminHeaders]);

  // ── Copy to Next Week ──
  const handleCopyToNextWeek = useCallback(() => {
    if (!sheetData) return;
    pushUndo();

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthsFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    let mondayDate: Date | null = null;
    for (let r = 2; r < sheetData.length; r++) {
      const col0 = (sheetData[r][0] || "").trim().toUpperCase();
      if (col0 === "MONDAY" && sheetData[r][1]) {
        const dateStr = sheetData[r][1].replace(/(\d+)(st|nd|rd|th)/i, "$1");
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) mondayDate = parsed;
        break;
      }
    }

    const nextMonday = mondayDate ? new Date(mondayDate.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date();
    if (!mondayDate) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
      nextMonday.setTime(today.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
    }

    setSheetData(prev => {
      if (!prev) return prev;
      const copy = prev.map(r => [...r]);
      let dayOffset = 0;
      for (let r = 2; r < copy.length; r++) {
        const cellDay = (copy[r][0] || "").trim().toUpperCase();
        if (DAY_NAMES.includes(cellDay)) {
          const dateObj = new Date(nextMonday);
          dateObj.setDate(dateObj.getDate() + dayOffset);
          const dayNum = dateObj.getDate();
          const suffix = dayNum === 1 || dayNum === 21 || dayNum === 31 ? "st" :
                         dayNum === 2 || dayNum === 22 ? "nd" :
                         dayNum === 3 || dayNum === 23 ? "rd" : "th";
          copy[r][1] = `${dayNum}${suffix}-${months[dateObj.getMonth()]}-${dateObj.getFullYear()}`;
          dayOffset++;
        }
      }
      return copy;
    });

    const endDate = new Date(nextMonday);
    endDate.setDate(endDate.getDate() + 5);
    const startDay = nextMonday.getDate();
    const endDay = endDate.getDate();
    const sfx = (d: number) => d === 1 || d === 21 || d === 31 ? "st" : d === 2 || d === 22 ? "nd" : d === 3 || d === 23 ? "rd" : "th";
    const tabName = nextMonday.getMonth() === endDate.getMonth()
      ? `${startDay}${sfx(startDay)} -${endDay}${sfx(endDay)} ${monthsFull[nextMonday.getMonth()]} ${nextMonday.getFullYear()}`
      : `${startDay}${sfx(startDay)} ${monthsFull[nextMonday.getMonth()]} -${endDay}${sfx(endDay)} ${monthsFull[endDate.getMonth()]} ${nextMonday.getFullYear()}`;

    setSheetCopyName(tabName);
  }, [sheetData, pushUndo]);

  // ── Save as copy ──
  const handleSaveAsCopy = useCallback(async () => {
    if (!sheetData || !sheetCopyName.trim()) return;
    setSheetSaving(true);
    setSheetSaveResult(null);
    try {
      const r = await fetch("/api/timetable/write-raw", {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          tabName: sheetCopyName.trim(),
          values: sheetData,
          sourceTabName: sheetSourceTab || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Failed to save");
      setSheetSaveResult({ success: true, message: `Saved as "${sheetCopyName.trim()}" ✓ (new tab created)` });
      setSheetSourceTab(sheetCopyName.trim());
      // Refresh tabs list
      try {
        const tr = await fetch("/api/timetable/tabs", { headers: adminHeaders() });
        if (tr.ok) {
          const td = await tr.json();
          if (td.success) setExistingTabs(td.tabs || []);
        }
      } catch {}
    } catch (err: any) {
      setSheetSaveResult({ success: false, message: err.message || "Save failed" });
    } finally {
      setSheetSaving(false);
    }
  }, [sheetData, sheetCopyName, sheetSourceTab, adminHeaders]);

  // ── Save in-place (overwrite same tab) ──
  const [savingInPlace, setSavingInPlace] = useState(false);
  const handleSaveInPlace = useCallback(async () => {
    if (!sheetData || !sheetSourceTab) return;
    setSavingInPlace(true);
    setSheetSaveResult(null);
    try {
      const r = await fetch("/api/timetable/update-tab", {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          tabName: sheetSourceTab,
          values: sheetData,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Failed to save");
      setSheetSaveResult({ success: true, message: `"${sheetSourceTab}" updated ✓` });
    } catch (err: any) {
      setSheetSaveResult({ success: false, message: err.message || "Save failed" });
    } finally {
      setSavingInPlace(false);
    }
  }, [sheetData, sheetSourceTab, adminHeaders]);

  // ── Quick Generate (uses selected sheet or latest, dates from today) ──
  const handleQuickGenerate = useCallback(async () => {
    setQuickGenerating(true);
    setLoadError(null);
    setSheetSaveResult(null);
    try {
      // 1. Get tabs list
      const tabsRes = await fetch("/api/timetable/tabs", { headers: adminHeaders() });
      if (!tabsRes.ok) throw new Error("Failed to fetch tabs");
      const tabsData = await tabsRes.json();
      const tabs = tabsData.tabs || [];
      if (tabs.length === 0) throw new Error("No existing tabs found in sheet");
      setExistingTabs(tabs);

      // Use selected tab if user chose one, otherwise use latest
      const tabToLoad = selectedLoadTab || tabs[tabs.length - 1];
      setSelectedLoadTab(tabToLoad);

      // 2. Load the selected tab
      const r = await fetch(`/api/timetable/tab-values?tabName=${encodeURIComponent(tabToLoad)}`, {
        headers: adminHeaders()
      });
      if (!r.ok) throw new Error(`Failed to load tab: HTTP ${r.status}`);
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Failed to load tab");

      const values: string[][] = d.values || [];
      if (values.length < 2) throw new Error("Sheet has too few rows");

      const maxCols = Math.max(...values.map((row: string[]) => row.length));
      const normalized = values.map((row: string[]) => {
        const padded = [...row];
        while (padded.length < maxCols) padded.push("");
        return padded;
      });

      // 3. Set data
      setSheetFormats(d.formats || null);
      setSheetSourceTab(tabToLoad);
      setUndoStack([]);
      setHighlightedTeacher(null);

      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthsFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

      // ═══ SMART DATE LOGIC ═══
      // Always calculate next Monday from TODAY
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...

      let nextMonday: Date;
      if (dayOfWeek === 1) {
        // Today is Monday — use NEXT Monday (today + 7)
        nextMonday = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (dayOfWeek === 0) {
        // Sunday — tomorrow is Monday
        nextMonday = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
      } else {
        // Tue-Sat — find next Monday
        const daysUntilMonday = 8 - dayOfWeek;
        nextMonday = new Date(today.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
      }

      // Always update dates to next Monday
      const copy = normalized.map((r: string[]) => [...r]);
      let dayOffset = 0;
      for (let rx = 2; rx < copy.length; rx++) {
        const cellDay = (copy[rx][0] || "").trim().toUpperCase();
        if (DAY_NAMES.includes(cellDay)) {
          const dateObj = new Date(nextMonday);
          dateObj.setDate(dateObj.getDate() + dayOffset);
          const dayNum = dateObj.getDate();
          const suffix = dayNum === 1 || dayNum === 21 || dayNum === 31 ? "st" :
                         dayNum === 2 || dayNum === 22 ? "nd" :
                         dayNum === 3 || dayNum === 23 ? "rd" : "th";
          copy[rx][1] = `${dayNum}${suffix}-${months[dateObj.getMonth()]}-${dateObj.getFullYear()}`;
          dayOffset++;
        }
      }

      setSheetData(copy);

      // Generate tab name from next Monday
      const endDate = new Date(nextMonday);
      endDate.setDate(endDate.getDate() + 5);
      const startDay = nextMonday.getDate();
      const endDay = endDate.getDate();
      const sfx = (dn: number) => dn === 1 || dn === 21 || dn === 31 ? "st" : dn === 2 || dn === 22 ? "nd" : dn === 3 || dn === 23 ? "rd" : "th";
      const tabName = nextMonday.getMonth() === endDate.getMonth()
        ? `${startDay}${sfx(startDay)} -${endDay}${sfx(endDay)} ${monthsFull[nextMonday.getMonth()]} ${nextMonday.getFullYear()}`
        : `${startDay}${sfx(startDay)} ${monthsFull[nextMonday.getMonth()]} -${endDay}${sfx(endDay)} ${monthsFull[endDate.getMonth()]} ${nextMonday.getFullYear()}`;

      setSheetCopyName(tabName);
    } catch (err: any) {
      setLoadError(err.message || "Quick generate failed");
    } finally {
      setQuickGenerating(false);
    }
  }, [adminHeaders, selectedLoadTab]);

  // ── NEW: Autocomplete logic ──
  const getAutocompleteSuggestions = useCallback((input: string, batchCode?: string) => {
    if (!input || input.length < 1) return [];
    const upper = input.toUpperCase();

    // Priority 1: eligible teachers for this batch
    let eligible: { code: string; name: string }[] = [];
    if (batchCode) {
      eligible = batchEligibleTeachers.get(batchCode) || [];
      // Also try short code
      const short = extractShortCode(batchCode);
      const shortEligible = batchEligibleTeachers.get(short) || [];
      const combined = [...eligible];
      for (const t of shortEligible) {
        if (!combined.some(c => c.code === t.code)) combined.push(t);
      }
      eligible = combined;
    }

    // Filter by input
    const filtered = allTeachers.filter(t => t.code.startsWith(upper));

    // Sort: eligible first, then others
    const eligibleCodes = new Set(eligible.map(e => e.code));
    filtered.sort((a, b) => {
      const aEligible = eligibleCodes.has(a.code) ? 0 : 1;
      const bEligible = eligibleCodes.has(b.code) ? 0 : 1;
      if (aEligible !== bEligible) return aEligible - bEligible;
      return a.code.localeCompare(b.code);
    });

    return filtered.slice(0, 10);
  }, [allTeachers, batchEligibleTeachers]);

  // Get eligible teachers for a column
  const getEligibleForCol = useCallback((colIdx: number): { code: string; name: string; count: number }[] => {
    const batchCode = colBatchMap.get(colIdx);
    if (!batchCode) return [];

    let eligible = batchEligibleTeachers.get(batchCode) || [];
    const short = extractShortCode(batchCode);
    const shortEligible = batchEligibleTeachers.get(short) || [];
    const combined = [...eligible];
    for (const t of shortEligible) {
      if (!combined.some(c => c.code === t.code)) combined.push(t);
    }

    // Add count (from current sheet stats)
    const statsMap = new Map(teacherStats);
    return combined.map(t => ({
      ...t,
      count: statsMap.get(t.code) || 0,
    })).sort((a, b) => a.code.localeCompare(b.code));
  }, [colBatchMap, batchEligibleTeachers, teacherStats]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setAutocompleteSuggestions([]);
        setAutocompletePos(null);
      }
      // Don't close eligible dropdown here — it closes on selection or blur
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className="pb-28 space-y-4">
      {/* ═══ Header ═══ */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 md:px-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <FileSpreadsheet className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-slate-800 dark:text-white">Sheet Editor</h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {sheetData ? `Editing: ${sheetSourceTab}` : "Load a week to start editing"}
              </p>
            </div>
          </div>

          {/* Quick Generate Button */}
          <button
            onClick={handleQuickGenerate}
            disabled={quickGenerating}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 hover:shadow-xl active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {quickGenerating ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</>
            ) : (
              <><Zap className="w-3.5 h-3.5" /> Quick Generate Next Week</>
            )}
          </button>
        </div>
      </div>

      {/* ═══ Load Tab Selector (shown when no sheet loaded) ═══ */}
      {!sheetData && (
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm p-4 md:p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Download className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">Load Existing Week</h3>
          </div>

          <p className="text-[11px] text-slate-400">
            Sheet load karein → edit karein → "💾 Save" se same tab mein save karein. <span className="text-amber-500 font-medium">⚠️ "Copy of" tabs mein galat colors hain — original tab select karein!</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedLoadTab}
              onChange={(e) => { setSelectedLoadTab(e.target.value); setLoadError(null); }}
              className="flex-1 bg-slate-50 dark:bg-gray-900/40 rounded-xl border border-slate-200 dark:border-gray-800 px-4 py-3 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="">-- Choose Week / Subsheet --</option>
              {existingTabs.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              onClick={() => handleLoadTab()}
              disabled={!selectedLoadTab || loadingTab}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/15"
            >
              {loadingTab ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> Load Sheet</>
              )}
            </button>
          </div>

          {loadError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <p className="text-[11px] text-red-400">{loadError}</p>
            </div>
          )}

          {/* Quick tip */}
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-3">
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
              💡 <strong>Tip:</strong> "⚡ Quick Generate Next Week" button use karo — latest week auto-load hoga, dates +7 ho jayengi, tab name ready hoga. Sirf edit karke save karo!
            </p>
          </div>
        </div>
      )}

      {/* ═══ Sheet Editor (when data loaded) ═══ */}
      {sheetData && (
        <div className="space-y-3">
          {/* ═══ Toolbar ═══ */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 md:px-5 border-b border-slate-100 dark:border-gray-800/40">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">
                  {sheetSourceTab}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowToolbar(p => !p)}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                >
                  {showToolbar ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showToolbar ? "Hide Tools" : "Show Tools"}
                </button>
                <button
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-[#5277f7] cursor-pointer transition-colors disabled:opacity-30"
                  title="Undo"
                >
                  <Undo2 className="w-3 h-3" /> Undo
                </button>
                <button
                  onClick={() => { setSheetData(null); setSheetFormats(null); setSheetSourceTab(""); setSheetSaveResult(null); setUndoStack([]); setHighlightedTeacher(null); setEligibleDropdown(null); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-red-500 cursor-pointer transition-colors"
                >
                  <X className="w-3 h-3" /> Close
                </button>
              </div>
            </div>

            {showToolbar && (
              <div className="px-4 py-3 md:px-5 space-y-3">
                {/* Find & Replace */}
                <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                  <div className="flex items-center gap-2 flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={findText}
                      onChange={(e) => setFindText(e.target.value)}
                      placeholder="Find teacher (e.g. PKK)"
                      className="flex-1 bg-slate-50 dark:bg-gray-900/40 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                    {findText && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${findCount > 0 ? "bg-amber-500/20 text-amber-500" : "bg-slate-200 dark:bg-gray-800 text-slate-400"}`}>
                        {findCount} found
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <Replace className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      placeholder="Replace with (e.g. AKM)"
                      className="flex-1 bg-slate-50 dark:bg-gray-900/40 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                    <button
                      onClick={handleReplace}
                      disabled={!findText || findCount === 0}
                      className="bg-amber-500 hover:bg-amber-400 text-white font-bold text-[10px] px-3 py-2 rounded-lg transition-all disabled:opacity-30 cursor-pointer shrink-0"
                    >
                      Replace All
                    </button>
                  </div>
                </div>

                {/* Quick Actions Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-bold tracking-widest uppercase text-slate-400 font-mono">Quick:</span>

                  {/* Copy to Next Week */}
                  <button
                    onClick={handleCopyToNextWeek}
                    className="flex items-center gap-1 text-[9px] font-bold px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white cursor-pointer shadow-md shadow-emerald-500/20 hover:shadow-lg active:scale-95 transition-all"
                    title="1-click: update dates to next week + set tab name"
                  >
                    <CopyPlus className="w-3 h-3" /> Next Week
                  </button>

                  {/* Swap Mode */}
                  <button
                    onClick={() => { setSwapMode(prev => !prev); setSwapFirst(null); }}
                    className={`flex items-center gap-1 text-[9px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-all ${
                      swapMode
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                        : "bg-slate-100 dark:bg-gray-800/50 text-slate-500 hover:bg-amber-500/10 hover:text-amber-500 border border-slate-200/50 dark:border-gray-800/40"
                    }`}
                    title="Click two cells to swap"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    {swapMode ? (swapFirst ? "Click 2nd..." : "Click 1st...") : "Swap"}
                  </button>

                  {/* Auto-date */}
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-gray-900/30 rounded-lg px-2 py-1.5 border border-slate-200/50 dark:border-gray-800/40">
                    <CalendarDays className="w-3 h-3 text-emerald-500" />
                    <input
                      type="date"
                      onChange={(e) => handleAutoDate(e.target.value)}
                      className="bg-transparent text-[10px] text-slate-600 dark:text-slate-300 outline-none font-mono cursor-pointer w-24"
                      title="Set new week start → auto-update all dates"
                    />
                    <span className="text-[9px] text-slate-400">Dates</span>
                  </div>

                  {/* Day actions */}
                  {["MON", "TUE", "WED", "THU", "FRI"].map(d => {
                    const full = d === "MON" ? "MONDAY" : d === "TUE" ? "TUESDAY" : d === "WED" ? "WEDNESDAY" : d === "THU" ? "THURSDAY" : "FRIDAY";
                    return (
                      <div key={d} className="flex items-center gap-0.5">
                        <button
                          onClick={() => handleClearDay(full)}
                          className="text-[9px] font-bold px-1.5 py-1 rounded-l-md bg-slate-100 dark:bg-gray-800/50 text-slate-500 hover:bg-red-500/10 hover:text-red-500 cursor-pointer transition-colors border border-slate-200/50 dark:border-gray-800/40 border-r-0"
                          title={`Clear ${d}`}
                        >
                          <Eraser className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-[9px] font-bold px-1 py-1 bg-slate-100 dark:bg-gray-800/50 text-slate-500 border-y border-slate-200/50 dark:border-gray-800/40">{d}</span>
                        <button
                          onClick={() => handleMarkHoliday(full)}
                          className="text-[9px] font-bold px-1.5 py-1 rounded-r-md bg-slate-100 dark:bg-gray-800/50 text-slate-500 hover:bg-amber-500/10 hover:text-amber-500 cursor-pointer transition-colors border border-slate-200/50 dark:border-gray-800/40 border-l-0"
                          title={`Mark ${d} Holiday`}
                        >
                          <Umbrella className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Status indicators */}
                {swapMode && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                      SWAP MODE: {swapFirst ? `Selected "${sheetData?.[swapFirst.r]?.[swapFirst.c]}" — click cell to swap with` : "Click first cell"}
                    </p>
                    <button onClick={() => { setSwapMode(false); setSwapFirst(null); }} className="text-[9px] text-amber-500 underline cursor-pointer ml-auto">Cancel</button>
                  </div>
                )}

                {conflicts.size > 0 && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <p className="text-[10px] text-red-400 font-bold">{conflicts.size} double-booking conflict{conflicts.size > 1 ? "s" : ""} — same teacher in same time slot!</p>
                  </div>
                )}

                {/* Teacher highlight info */}
                {highlightedTeacher && highlightBreakdown && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                    <Eye className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      {highlightedTeacher}: {highlightBreakdown.total} slots — {Object.entries(highlightBreakdown.days).map(([day, count]) =>
                        `${day.slice(0, 3)}(${count})`
                      ).join(", ")}
                    </p>
                    <button onClick={() => setHighlightedTeacher(null)} className="text-[9px] text-emerald-500 underline cursor-pointer ml-auto">Clear</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══ Spreadsheet Grid ═══ */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[65vh]">
              <table className="w-full border-collapse text-[10px] font-mono">
                <tbody>
                  {sheetData.map((row, rIdx) => {
                    const isHeaderRow = rIdx === 0;
                    const isRoomRow = rIdx === 1;
                    const cellDayVal = rIdx >= 2 ? (row[0] || "").trim().toUpperCase() : "";
                    const dayColors: Record<string, string> = {
                      MONDAY: "border-l-4 border-l-orange-400",
                      TUESDAY: "border-l-4 border-l-fuchsia-400",
                      WEDNESDAY: "border-l-4 border-l-emerald-400",
                      THURSDAY: "border-l-4 border-l-cyan-400",
                      FRIDAY: "border-l-4 border-l-pink-400",
                      SATURDAY: "border-l-4 border-l-violet-400",
                    };
                    const rowDayColor = dayColors[cellDayVal] || "";

                    return (
                      <tr
                        key={rIdx}
                        className={
                          isHeaderRow ? "bg-emerald-500/10 dark:bg-emerald-500/5 sticky top-0 z-10" :
                          isRoomRow ? "bg-slate-100/60 dark:bg-gray-800/30 sticky top-[26px] z-[9]" :
                          row.some(c => c.toUpperCase() === "HOLIDAY") ? "bg-amber-500/5" :
                          ""
                        }
                      >
                        {row.map((cell, cIdx) => {
                          const isEditing = sheetEditingCell?.r === rIdx && sheetEditingCell?.c === cIdx;
                          const isConflict = conflicts.has(`${rIdx}-${cIdx}`);
                          const isFindHighlighted = findText && cell.toUpperCase() === findText.toUpperCase();
                          const isTeacherHighlighted = highlightedTeacher && cell.trim().toUpperCase() === highlightedTeacher && rIdx >= 2 && cIdx >= 2;
                          const isDay = cIdx === 0 && rIdx >= 2 && cell.trim().length > 0;
                          const isDataCell = rIdx >= 2 && cIdx >= 2;
                          const showEligible = eligibleDropdown?.r === rIdx && eligibleDropdown?.c === cIdx;

                          // Source formatting
                          const cellFmt = sheetFormats?.[rIdx]?.[cIdx];
                          const inlineStyle: React.CSSProperties = {};
                          if (cellFmt?.bg && !isConflict && !isFindHighlighted && !isTeacherHighlighted) {
                            const bg = cellFmt.bg;
                            inlineStyle.backgroundColor = `rgba(${Math.round((bg.red || 0) * 255)}, ${Math.round((bg.green || 0) * 255)}, ${Math.round((bg.blue || 0) * 255)}, 0.45)`;
                          }
                          if (cellFmt?.tf?.bold) inlineStyle.fontWeight = "bold";
                          if (cellFmt?.tf?.fg) {
                            const fg = cellFmt.tf.fg;
                            inlineStyle.color = `rgb(${Math.round((fg.red || 0) * 255)}, ${Math.round((fg.green || 0) * 255)}, ${Math.round((fg.blue || 0) * 255)})`;
                          }

                          return (
                            <td
                              key={cIdx}
                              style={inlineStyle}
                              className={`border border-slate-200/30 dark:border-gray-800/30 px-1.5 py-[3px] min-w-[42px] max-w-[90px] transition-all relative ${
                                isHeaderRow && !cellFmt ? "font-bold text-emerald-600 dark:text-emerald-400 text-center text-[9px] py-1.5" :
                                isRoomRow && !cellFmt ? "font-bold text-[9px] text-slate-400 text-center" :
                                isDay && !cellFmt ? `font-bold text-slate-700 dark:text-slate-200 bg-slate-50/30 dark:bg-gray-900/20 ${rowDayColor}` :
                                !cellFmt ? "text-slate-700 dark:text-slate-200" : ""
                              } ${isConflict ? "!bg-red-500/15 !text-red-600 dark:!text-red-400 ring-1 ring-red-500/30 ring-inset" : ""}
                              ${isFindHighlighted ? "!bg-amber-400/20 !text-amber-700 dark:!text-amber-300 ring-1 ring-amber-400/40 ring-inset" : ""}
                              ${isTeacherHighlighted ? "!bg-emerald-400/25 !text-emerald-700 dark:!text-emerald-300 ring-2 ring-emerald-500/50 ring-inset" : ""}
                              ${swapFirst?.r === rIdx && swapFirst?.c === cIdx ? "ring-2 ring-amber-500 ring-inset !bg-amber-500/20" : ""}
                              ${!isEditing && !isHeaderRow ? "cursor-pointer hover:bg-emerald-500/5" : ""}`}
                              onClick={() => {
                                if (swapMode) {
                                  handleSwapClick(rIdx, cIdx);
                                } else if (isDataCell && !isEditing) {
                                  // Show eligible dropdown on click
                                  const batchCode = colBatchMap.get(cIdx);
                                  if (batchCode) {
                                    setEligibleDropdown({ r: rIdx, c: cIdx, batchCode });
                                  }
                                  pushUndo();
                                  setSheetEditingCell({ r: rIdx, c: cIdx });
                                } else if (!isEditing) {
                                  pushUndo();
                                  setSheetEditingCell({ r: rIdx, c: cIdx });
                                }
                              }}
                            >
                              {isEditing ? (
                                <div className="relative" ref={autocompleteRef}>
                                  <input
                                    type="text"
                                    defaultValue={cell}
                                    autoFocus
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const batchCode = colBatchMap.get(cIdx) || "";
                                      const suggestions = getAutocompleteSuggestions(val, batchCode);
                                      setAutocompleteSuggestions(suggestions);
                                      setAutocompletePos(suggestions.length > 0 ? { r: rIdx, c: cIdx } : null);
                                    }}
                                    onBlur={(e) => {
                                      // Delay to allow autocomplete click
                                      setTimeout(() => {
                                        handleCellChange(rIdx, cIdx, e.target.value);
                                        setSheetEditingCell(null);
                                        setAutocompleteSuggestions([]);
                                        setAutocompletePos(null);
                                        setEligibleDropdown(null);
                                      }, 150);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        handleCellChange(rIdx, cIdx, (e.target as HTMLInputElement).value);
                                        setSheetEditingCell(rIdx + 1 < sheetData.length ? { r: rIdx + 1, c: cIdx } : null);
                                        setAutocompleteSuggestions([]);
                                        setAutocompletePos(null);
                                        setEligibleDropdown(null);
                                      } else if (e.key === "Tab") {
                                        e.preventDefault();
                                        handleCellChange(rIdx, cIdx, (e.target as HTMLInputElement).value);
                                        if (e.shiftKey) {
                                          if (cIdx > 0) setSheetEditingCell({ r: rIdx, c: cIdx - 1 });
                                          else if (rIdx > 0) setSheetEditingCell({ r: rIdx - 1, c: row.length - 1 });
                                        } else {
                                          if (cIdx + 1 < row.length) setSheetEditingCell({ r: rIdx, c: cIdx + 1 });
                                          else if (rIdx + 1 < sheetData.length) setSheetEditingCell({ r: rIdx + 1, c: 0 });
                                        }
                                        setAutocompleteSuggestions([]);
                                        setAutocompletePos(null);
                                        setEligibleDropdown(null);
                                      } else if (e.key === "Escape") {
                                        setSheetEditingCell(null);
                                        setAutocompleteSuggestions([]);
                                        setAutocompletePos(null);
                                        setEligibleDropdown(null);
                                      } else if (e.key === "ArrowUp" && rIdx > 0) {
                                        e.preventDefault();
                                        handleCellChange(rIdx, cIdx, (e.target as HTMLInputElement).value);
                                        setSheetEditingCell({ r: rIdx - 1, c: cIdx });
                                      } else if (e.key === "ArrowDown" && rIdx + 1 < sheetData.length) {
                                        e.preventDefault();
                                        handleCellChange(rIdx, cIdx, (e.target as HTMLInputElement).value);
                                        setSheetEditingCell({ r: rIdx + 1, c: cIdx });
                                      }
                                    }}
                                    className="w-full bg-white dark:bg-gray-900 border border-emerald-500 rounded px-1 py-0.5 text-[10px] outline-none text-slate-800 dark:text-white"
                                  />

                                  {/* Autocomplete dropdown */}
                                  {autocompletePos?.r === rIdx && autocompletePos?.c === cIdx && autocompleteSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 z-50 mt-0.5 bg-white dark:bg-gray-900 border border-emerald-500/30 rounded-lg shadow-xl shadow-black/10 min-w-[160px] max-h-[200px] overflow-y-auto">
                                      {autocompleteSuggestions.map((s) => {
                                        const isEligible = (() => {
                                          const batchCode = colBatchMap.get(cIdx) || "";
                                          if (!batchCode) return false;
                                          const eligible = batchEligibleTeachers.get(batchCode) || batchEligibleTeachers.get(extractShortCode(batchCode)) || [];
                                          return eligible.some(e => e.code === s.code);
                                        })();
                                        return (
                                          <button
                                            key={s.code}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              handleCellChange(rIdx, cIdx, s.code);
                                              setSheetEditingCell(null);
                                              setAutocompleteSuggestions([]);
                                              setAutocompletePos(null);
                                              setEligibleDropdown(null);
                                            }}
                                            className={`w-full text-left px-2.5 py-1.5 text-[10px] hover:bg-emerald-500/10 transition-colors flex items-center gap-2 ${
                                              isEligible ? "font-bold" : "opacity-60"
                                            }`}
                                          >
                                            <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono w-8">{s.code}</span>
                                            <span className="text-slate-500 dark:text-slate-400 truncate text-[9px]">{s.name}</span>
                                            {isEligible && <span className="text-[8px] bg-emerald-500/20 text-emerald-600 px-1 rounded ml-auto shrink-0">✓ eligible</span>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="block whitespace-nowrap" title={cell}>{cell || "\u00A0"}</span>
                              )}

                              {/* Eligible teachers dropdown (on click, non-editing) */}
                              {showEligible && !isEditing && (
                                <div className="absolute top-full left-0 z-50 mt-0.5 bg-white dark:bg-gray-900 border border-emerald-500/30 rounded-lg shadow-xl shadow-black/10 min-w-[180px] max-h-[220px] overflow-y-auto">
                                  <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-gray-800/40">
                                    <p className="text-[8px] font-bold tracking-widest uppercase text-slate-400">Eligible for {extractShortCode(eligibleDropdown.batchCode)}</p>
                                  </div>
                                  {(() => {
                                    const eligible = getEligibleForCol(cIdx);
                                    if (eligible.length === 0) return (
                                      <p className="px-2.5 py-2 text-[9px] text-slate-400 italic">No faculty data</p>
                                    );
                                    return eligible.map(t => (
                                      <button
                                        key={t.code}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          pushUndo();
                                          handleCellChange(rIdx, cIdx, t.code);
                                          setEligibleDropdown(null);
                                        }}
                                        className="w-full text-left px-2.5 py-1.5 text-[10px] hover:bg-emerald-500/10 transition-colors flex items-center gap-2"
                                      >
                                        <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono w-8">{t.code}</span>
                                        <span className="text-slate-500 dark:text-slate-400 truncate text-[9px] flex-1">{t.name}</span>
                                        <span className="text-[8px] text-slate-400 font-mono shrink-0">{t.count} slots</span>
                                      </button>
                                    ));
                                  })()}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ Bottom: Teacher Stats + Save ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Teacher Stats with highlight */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 md:px-5 border-b border-slate-100 dark:border-gray-800/40">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">Teacher Load</h3>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">{teacherStats.length} teachers</span>
              </div>
              <div className="px-4 py-3 md:px-5">
                <p className="text-[9px] text-slate-400 mb-2">Click a teacher to highlight all their slots in the grid</p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {teacherStats.map(([teacher, count]) => (
                    <button
                      key={teacher}
                      onClick={() => {
                        setHighlightedTeacher(prev => prev === teacher ? null : teacher);
                        setFindText("");
                      }}
                      className={`text-[9px] font-bold font-mono px-2 py-1 rounded-md cursor-pointer transition-all ${
                        highlightedTeacher === teacher
                          ? "bg-emerald-500 text-white shadow-md ring-2 ring-emerald-400/50"
                          : findText.toUpperCase() === teacher
                          ? "bg-[#5277f7] text-white shadow-md"
                          : "bg-slate-100 dark:bg-gray-800/50 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/10"
                      }`}
                    >
                      {teacher} <span className="opacity-60">({count})</span>
                    </button>
                  ))}
                  {teacherStats.length === 0 && (
                    <p className="text-[10px] text-slate-400 italic">No teachers found</p>
                  )}
                </div>
              </div>
            </div>

            {/* Save Options */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 md:px-5 border-b border-slate-100 dark:border-gray-800/40">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Save className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">Save</h3>
              </div>
              <div className="px-4 py-3 md:px-5 space-y-3">
                {/* Primary: Save in-place */}
                <button
                  onClick={handleSaveInPlace}
                  disabled={savingInPlace || !sheetSourceTab}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 hover:shadow-xl active:scale-[0.98]"
                >
                  {savingInPlace ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="w-3.5 h-3.5" /> 💾 Save — Overwrite "{sheetSourceTab}"</>
                  )}
                </button>
                <p className="text-[9px] text-slate-400 text-center">Changes directly update the current tab in Google Sheets</p>

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-gray-800/40" />
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-gray-800/40" />
                </div>

                {/* Secondary: Save as new tab */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sheetCopyName}
                    onChange={(e) => setSheetCopyName(e.target.value)}
                    placeholder="New tab name (e.g. 22nd-27th June 2026)"
                    className="flex-1 bg-slate-50 dark:bg-gray-900/40 rounded-xl border border-slate-200 dark:border-gray-800 px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-emerald-500 transition-colors font-mono"
                  />
                  <button
                    onClick={handleSaveAsCopy}
                    disabled={sheetSaving || !sheetCopyName.trim()}
                    className="bg-slate-100 dark:bg-gray-800/50 text-slate-600 dark:text-slate-300 font-bold text-[10px] px-4 py-2.5 rounded-xl transition-all disabled:opacity-30 flex items-center gap-1.5 cursor-pointer hover:bg-emerald-500/10 hover:text-emerald-600 border border-slate-200/50 dark:border-gray-800/40 shrink-0"
                  >
                    {sheetSaving ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> ...</>
                    ) : (
                      <><CopyPlus className="w-3 h-3" /> Save as New Tab</>
                    )}
                  </button>
                </div>

                {/* Result */}
                {sheetSaveResult && (
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                    sheetSaveResult.success ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"
                  }`}>
                    {sheetSaveResult.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    <p className={`text-[11px] ${sheetSaveResult.success ? "text-emerald-400" : "text-red-400"}`}>{sheetSaveResult.message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Faculty loading indicator */}
          {facultyLoading && (
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Loading faculty data for autocomplete...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
