import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, RefreshCw, Clock, Calendar, MapPin, BookOpen, X,
  ChevronDown, Layers, GraduationCap, Timer, AlertCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────

interface TimetableLecture {
  teacherCode: string; day: string; date: string;
  startTime: string; endTime: string;
  batches: string[]; rooms: string[];
  isMerged: boolean; isExtraLecture: boolean;
}
interface TeacherCode { code: string; count: number; }
interface TimetableViewerProps { adminHeaders: () => Record<string, string>; }

// ─── Default teacher name mapping (fallback) ────────────────────────

const DEFAULT_NAMES: Record<string, string> = {
  CRA: "Rishesh Ameriya", MBH: "Bhawesh Choudhary", PSG: "Surbhi Gupta",
  ZSV: "Shweta M. Vasoya", ZSN: "Shashank Nagar", PKK: "Krishna Kumar",
  PLS: "Love Swarnkar", CKV: "Kunal Verma", BKR: "Dr Kamlesh Ranjan",
  MIA: "Imran Ahmad", PSK: "Sachin Kumar Singh", PSB: "Surendra Bijarnia",
  CSK: "Shivani Kalra", MAP: "Ajay Patidar", BSN: "Shashank Nagar",
  EID: "Ishfaq Ahmad Dar", MKD: "Kuldeep Dewangan", CPM: "Pulkit Maheshwari",
  CGS: "Govind S. Shekhawat", PDK: "Deepak Kanskar", CPR: "Prajakt S. Rane",
  CSS: "Sunil Singh", ZSS: "Shreya", CSI: "Mohd Shazil Iqbal",
  PHP: "Himanshu Pandey", BMR: "Mukul Rohilla", SAA: "Anurag Atul",
  CAA: "Moh Arshad Ansari", PQL: "Quaneet Laraib", PMT: "Mayank Tamrakar",
  MPH: "Prashant Mishra", BAK: "Alok K. Shukla", MMK: "Mukesh Kumar",
  CTG: "Tushar Goel",
};


// ─── Helpers ────────────────────────────────────────────────────────

function parseTimeMin(t: string) {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  let h = +m[1]; const mn = +m[2]; const p = m[3].toUpperCase();
  if (p === "PM" && h !== 12) h += 12; if (p === "AM" && h === 12) h = 0;
  return h * 60 + mn;
}
function calcHrs(lecs: TimetableLecture[]) {
  let t = 0; for (const l of lecs) { const s = parseTimeMin(l.startTime), e = parseTimeMin(l.endTime); if (e > s) t += e - s; }
  return Math.round(t / 6) / 10;
}

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_SHORT: Record<string, string> = { MONDAY: "MON", TUESDAY: "TUE", WEDNESDAY: "WED", THURSDAY: "THU", FRIDAY: "FRI", SATURDAY: "SAT", SUNDAY: "SUN" };
const DAY_COLORS: Record<string, { dot: string; bg: string }> = {
  MONDAY: { dot: "bg-blue-500", bg: "border-l-blue-500" },
  TUESDAY: { dot: "bg-emerald-500", bg: "border-l-emerald-500" },
  WEDNESDAY: { dot: "bg-amber-500", bg: "border-l-amber-500" },
  THURSDAY: { dot: "bg-orange-500", bg: "border-l-orange-500" },
  FRIDAY: { dot: "bg-red-500", bg: "border-l-red-500" },
  SATURDAY: { dot: "bg-purple-500", bg: "border-l-purple-500" },
  SUNDAY: { dot: "bg-slate-400", bg: "border-l-slate-400" },
};

// ─── Component ──────────────────────────────────────────────────────

export default function TimetableViewer({ adminHeaders }: TimetableViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [allCodes, setAllCodes] = useState<TeacherCode[]>([]);
  const [lectures, setLectures] = useState<TimetableLecture[]>([]);
  const [codesExpanded, setCodesExpanded] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [mergeModal, setMergeModal] = useState<TimetableLecture | null>(null);

  const [lastLoaded, setLastLoaded] = useState<string | null>(null);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>(DEFAULT_NAMES);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Merge API names with defaults (API overrides)
  const getName = useCallback((code: string) => teacherNames[code] || DEFAULT_NAMES[code] || "", [teacherNames]);

  // ─── Fetch ────────────────────────────────────────────────────────

  const fetchCodes = useCallback(async () => {
    try {
      const r = await fetch("/api/timetable/codes", { headers: adminHeaders() });
      if (r.ok) { const d = await r.json(); setAllCodes(d.codes || []); }
    } catch {}
  }, [adminHeaders]);

  const fetchConfig = useCallback(async () => {
    try { const r = await fetch("/api/timetable/config", { headers: adminHeaders() }); if (r.ok) { const d = await r.json(); setLastLoaded(d.lastLoaded || null); setApiError(d.error || null); } } catch {}
  }, [adminHeaders]);

  const fetchTeacherNames = useCallback(async () => {
    try {
      const r = await fetch("/api/timetable/teachers", { headers: adminHeaders() });
      if (r.ok) {
        const d = await r.json();
        if (d.teachers && Object.keys(d.teachers).length > 0) {
          setTeacherNames(prev => ({ ...DEFAULT_NAMES, ...prev, ...d.teachers }));
        }
      }
    } catch {}
  }, [adminHeaders]);

  const fetchLectures = useCallback(async (code: string) => {
    try { const r = await fetch(`/api/timetable?code=${encodeURIComponent(code)}`, { headers: adminHeaders() }); if (r.ok) { const d = await r.json(); setLectures(d.lectures || []); } } catch {}
  }, [adminHeaders]);

  // Auto-detect logged-in teacher's code
  const [myCode, setMyCode] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const autoDetectDone = useRef(false);

  useEffect(() => { fetchConfig(); fetchCodes(); fetchTeacherNames(); }, [fetchConfig, fetchCodes, fetchTeacherNames]);

  // Auto-detect teacher code from email on first load
  useEffect(() => {
    if (autoDetectDone.current) return;
    autoDetectDone.current = true;
    (async () => {
      try {
        const r = await fetch("/api/timetable/my-code", { headers: adminHeaders() });
        if (r.ok) {
          const d = await r.json();
          if (d.code) {
            setMyCode(d.code);
            setMyName(d.name || null);
            setSelectedCode(d.code);
            setSearchQuery(d.code);
          }
        }
      } catch {}
    })();
  }, [adminHeaders]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try { await fetch("/api/timetable/refresh", { method: "POST", headers: adminHeaders() }); setTimeout(() => { fetchCodes(); fetchConfig(); setIsLoading(false); }, 2000); } catch { setIsLoading(false); }
  };

  useEffect(() => { if (selectedCode) fetchLectures(selectedCode); else setLectures([]); }, [selectedCode, fetchLectures]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setInputFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Logic ────────────────────────────────────────────────────────

  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    setShowSuggestions(true);
    // Auto-select exact code match
    const upper = val.toUpperCase().trim();
    const exact = allCodes.find(c => c.code === upper);
    if (exact && val.length >= 2) {
      // Don't auto-select, let them pick from dropdown
    }
  };

  const selectTeacher = (code: string) => {
    setSelectedCode(code);
    setSearchQuery("");
    setShowSuggestions(false);
    setInputFocused(false);
    setExpandedDays(new Set());
    setCodesExpanded(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setSearchQuery("");
    setSelectedCode(null);
    setLectures([]);
    setShowSuggestions(false);
    setCodesExpanded(false);
    setExpandedDays(new Set());
  };

  const groupedByDay = useMemo(() => {
    const map = new Map<string, { date: string; lectures: TimetableLecture[] }>();
    for (const l of lectures) { const k = l.day.toUpperCase(); if (!map.has(k)) map.set(k, { date: l.date, lectures: [] }); map.get(k)!.lectures.push(l); }
    const s = Array.from(map.entries()).sort((a, b) => DAY_ORDER.indexOf(a[0]) - DAY_ORDER.indexOf(b[0]));
    for (const [, v] of s) v.lectures.sort((a, b) => parseTimeMin(a.startTime) - parseTimeMin(b.startTime));
    return s;
  }, [lectures]);

  const stats = useMemo(() => ({
    lecs: lectures.length, days: groupedByDay.length,
    batches: new Set(lectures.flatMap(l => l.batches)).size, hrs: calcHrs(lectures),
  }), [lectures, groupedByDay]);

  // Search — match by CODE or NAME (even partial)
  const suggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 1) return [];
    const q = searchQuery.toLowerCase().trim();
    return allCodes.filter(c => {
      if (c.code.toLowerCase().includes(q)) return true;
      const name = getName(c.code).toLowerCase();
      if (name && name.includes(q)) return true;
      return false;
    }).slice(0, 10);
  }, [allCodes, searchQuery, getName]);

  // Show suggestions when focused with text or when typing
  const shouldShowSuggestions = showSuggestions && suggestions.length > 0 && !selectedCode;

  const MAX = 14;
  const chipList = codesExpanded ? allCodes : allCodes.slice(0, MAX);
  // Accordion: click a day → close others, toggle that one
  const toggleDay = (d: string) => setExpandedDays(prev => {
    if (prev.has(d)) { const n = new Set<string>(); return n; } // close it
    return new Set([d]); // open only this one
  });

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="pb-28">
      {/* Alerts */}

      {apiError && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <p className="text-[11px] text-red-600 dark:text-red-400 truncate">{apiError}</p>
        </div>
      )}

      {/* Auto-detected teacher welcome */}
      {myCode && myName && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
            <span className="text-xs">👋</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
            Welcome, <span className="font-bold">{myName}</span>! Your timetable (<span className="font-mono font-bold">{myCode}</span>) is loaded automatically.
          </p>
        </div>
      )}

      {/* ═══ Main Card ═══ */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-visible">
        {/* Title */}
        <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-3.5 border-b border-slate-100 dark:border-gray-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5277f7] to-[#7c3aed] flex items-center justify-center">
              <Calendar className="w-4.5 h-4.5 text-white" />
            </div>
            <h2 className="text-sm md:text-base font-bold text-slate-800 dark:text-white">Weekly Schedule</h2>
            {lastLoaded && <span className="text-[9px] text-slate-400 font-mono hidden sm:inline">· {new Date(lastLoaded).toLocaleDateString()}</span>}
          </div>
          <button onClick={handleRefresh} disabled={isLoading} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#5277f7] hover:bg-slate-100 dark:hover:bg-gray-800 transition-all cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#5277f7]" : ""}`} />
          </button>
        </div>

        {/* Search + Suggestions */}
        <div className="px-4 pt-3 pb-2 md:px-5 relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => handleSearchInput(e.target.value)}
              onFocus={() => { setInputFocused(true); if (searchQuery) setShowSuggestions(true); }}
              placeholder={selectedCode ? `${selectedCode} — ${getName(selectedCode) || "Selected"}` : "Search by name or code..."}
              className="w-full bg-slate-50 dark:bg-gray-900/40 rounded-xl border border-slate-200 dark:border-gray-800 pl-10 pr-10 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-[#5277f7] transition-colors"
            />
            {(searchQuery || selectedCode) && (
              <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1.5 -mr-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ★ Suggestions Dropdown ★ */}
          <AnimatePresence>
            {shouldShowSuggestions && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute left-4 right-4 md:left-5 md:right-5 top-full mt-1 bg-white dark:bg-[#1a2332] rounded-xl border border-slate-200 dark:border-gray-700/80 shadow-2xl z-50 overflow-hidden"
                style={{ maxHeight: "320px", overflowY: "auto" }}
              >
                {suggestions.map((c, i) => {
                  const name = getName(c.code);
                  const q = searchQuery.toLowerCase();
                  const codeMatch = c.code.toLowerCase().includes(q);
                  const nameMatch = name.toLowerCase().includes(q);
                  return (
                    <button key={c.code} onClick={() => selectTeacher(c.code)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-[#5277f7]/5 dark:hover:bg-[#5277f7]/10 active:bg-[#5277f7]/10 transition-colors ${
                        i !== suggestions.length - 1 ? "border-b border-slate-100 dark:border-gray-800/40" : ""
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#5277f7]/10 dark:bg-[#5277f7]/20 flex items-center justify-center shrink-0">
                        <span className="text-xs font-black text-[#5277f7] font-mono">{c.code}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${codeMatch ? "text-[#5277f7]" : "text-slate-700 dark:text-slate-200"}`}>{c.code}</span>
                          {name && <span className="text-xs text-slate-400">·</span>}
                          {name && <span className={`text-xs truncate ${nameMatch ? "text-[#5277f7] font-medium" : "text-slate-500 dark:text-slate-400"}`}>{name}</span>}
                        </div>
                        <p className="text-[10px] text-slate-400">{c.count} lecture{c.count !== 1 ? "s" : ""} this week</p>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-300 dark:text-gray-600 -rotate-90 shrink-0" />
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chips — hidden when a code is selected */}
        {!selectedCode && !inputFocused && (
          <div className="px-4 pb-3 md:px-5">
            <button onClick={() => setCodesExpanded(!codesExpanded)} className="flex items-center gap-1.5 mb-2 cursor-pointer">
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${codesExpanded ? "" : "-rotate-90"}`} />
              <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400 font-mono">{allCodes.length} teachers</span>
            </button>
            <div className="flex flex-wrap gap-1.5">
              {chipList.map(c => (
                <button key={c.code} onClick={() => selectTeacher(c.code)}
                  title={getName(c.code) ? `${getName(c.code)}` : c.code}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-gray-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-gray-700 active:scale-95 cursor-pointer transition-all"
                >
                  <span className="font-mono">{c.code}</span>
                  <span className="text-[9px] text-slate-400/70">{c.count}</span>
                </button>
              ))}
              {!codesExpanded && allCodes.length > MAX && (
                <button onClick={() => setCodesExpanded(true)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#5277f7]/10 text-[#5277f7] cursor-pointer hover:bg-[#5277f7]/20 transition-all">+{allCodes.length - MAX}</button>
              )}
              {codesExpanded && allCodes.length > MAX && (
                <button onClick={() => setCodesExpanded(false)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 cursor-pointer hover:text-slate-600">show less</button>
              )}
            </div>
          </div>
        )}

        {/* ═══ Selected Teacher Info Strip ═══ */}
        {selectedCode && lectures.length > 0 && (
          <div className="px-4 py-3 md:px-5 border-t border-slate-100 dark:border-gray-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5277f7] to-[#7c3aed] flex items-center justify-center shrink-0 shadow-md shadow-[#5277f7]/20">
                <span className="text-xs font-black text-white font-mono">{selectedCode}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-black text-slate-800 dark:text-white font-mono">{selectedCode}</span>
                  {getName(selectedCode) && (
                    <span className="text-sm text-slate-500 dark:text-slate-400 truncate">— {getName(selectedCode)}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-[#5277f7]" />{stats.lecs}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-emerald-500" />{stats.days}d</span>
                  <span className="flex items-center gap-1 hidden sm:flex"><Layers className="w-3.5 h-3.5 text-amber-500" />{stats.batches}</span>
                  <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5 text-purple-500" />~{stats.hrs}h</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Schedule Cards ═══ */}
      {selectedCode && lectures.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
          {groupedByDay.length > 1 && (
            <div className="flex gap-3 mb-2.5 px-0.5">
              <button onClick={() => setExpandedDays(new Set(groupedByDay.map(([d]) => d)))} className="text-xs font-bold text-[#5277f7] cursor-pointer hover:underline">Expand All</button>
              <span className="text-slate-300 dark:text-gray-700 text-xs">·</span>
              <button onClick={() => setExpandedDays(new Set())} className="text-xs font-bold text-[#5277f7] cursor-pointer hover:underline">Collapse All</button>
            </div>
          )}

          <div className="space-y-2.5">
            {groupedByDay.map(([day, { date, lectures: dl }], di) => {
              const isExpanded = expandedDays.has(day);
              const colors = DAY_COLORS[day] || { dot: "bg-slate-400", bg: "border-l-slate-400" };
              return (
                <motion.div key={day} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: di * 0.05 }}
                  className={`bg-white dark:bg-[#111827] rounded-xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-hidden border-l-[3px] ${colors.bg}`}
                >
                  <button onClick={() => toggleDay(day)}
                    className="w-full flex items-center justify-between px-4 py-3 md:px-5 md:py-3.5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-gray-800/20 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm md:text-base font-black text-slate-700 dark:text-slate-200">
                        <span className="md:hidden">{DAY_SHORT[day] || day}</span>
                        <span className="hidden md:inline">{day}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-gray-800/50 px-2 py-0.5 rounded">{date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-gray-800/50 px-2 py-0.5 rounded-md">{dl.length}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`} />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="px-4 pb-3.5 md:px-5 space-y-2.5">
                          {dl.map((l, li) => (
                            <motion.div key={li} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: li * 0.04 }}
                              className="bg-slate-50/80 dark:bg-gray-900/30 rounded-xl border border-slate-100 dark:border-gray-800/50 p-3.5 md:p-4"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  {/* Time */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="flex items-center gap-1.5 bg-[#5277f7]/10 rounded-lg px-2.5 py-1">
                                      <Clock className="w-3.5 h-3.5 text-[#5277f7]" />
                                      <span className="text-xs md:text-sm font-bold text-[#5277f7] font-mono">{l.startTime}</span>
                                    </div>
                                    <span className="text-xs text-slate-400">→</span>
                                    <div className="flex items-center gap-1.5 bg-slate-200/50 dark:bg-gray-800/50 rounded-lg px-2.5 py-1">
                                      <span className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300 font-mono">{l.endTime}</span>
                                    </div>
                                  </div>
                                  {/* Batches */}
                                  {l.batches.map((b, bi) => (
                                    <div key={bi} className="flex items-center gap-2 mb-1">
                                      <BookOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                      <span className="text-xs text-slate-600 dark:text-slate-300">{b}</span>
                                    </div>
                                  ))}
                                  {/* Room */}
                                  {l.rooms.some(r => r) && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                                      <span className="text-xs text-slate-400 font-mono">Room {l.rooms.filter(Boolean).join(", ")}</span>
                                    </div>
                                  )}
                                </div>
                                {/* Badges */}
                                <div className="flex flex-col gap-1.5 shrink-0">
                                  {l.isMerged && (
                                    <button onClick={() => setMergeModal(l)} className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 cursor-pointer hover:bg-purple-200 transition-colors">🔀 Merged</button>
                                  )}
                                  {l.isExtraLecture && (
                                    <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">⭐ Extra</span>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Empty states */}
      {selectedCode && lectures.length === 0 && (
        <div className="mt-6 text-center py-8">
          <Search className="w-8 h-8 text-slate-300 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-400">No lectures for "{selectedCode}"</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{getName(selectedCode) ? getName(selectedCode) : "Unknown teacher"}</p>
        </div>
      )}
      {!selectedCode && allCodes.length > 0 && !inputFocused && (
        <div className="mt-6 text-center py-8">
          <GraduationCap className="w-8 h-8 text-slate-300 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Search or select a teacher above</p>
        </div>
      )}

      {/* Merge Modal */}
      <AnimatePresence>
        {mergeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setMergeModal(null)}
          >
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()} className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 p-5 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">🔀 Merged Lecture</h3>
                  <p className="text-[10px] text-slate-400">{mergeModal.teacherCode} {getName(mergeModal.teacherCode) ? `— ${getName(mergeModal.teacherCode)}` : ""}</p>
                </div>
                <button onClick={() => setMergeModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-2">
                {mergeModal.batches.map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-purple-50 dark:bg-purple-950/20 rounded-xl px-3 py-2.5">
                    <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{b}</p>
                      {mergeModal.rooms[i] && <p className="text-[9px] text-slate-400 font-mono">Room {mergeModal.rooms[i]}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-3 text-center font-mono">{mergeModal.startTime} — {mergeModal.endTime} · {mergeModal.day}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
