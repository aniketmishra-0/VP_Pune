import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  RefreshCw,
  Clock,
  Calendar,
  MapPin,
  BookOpen,
  X,
  ChevronDown,
  Sparkles,
  Layers,
  GraduationCap,
  Timer,
  AlertCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────

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

interface TeacherCode {
  code: string;
  count: number;
}

interface TimetableViewerProps {
  adminHeaders: () => Record<string, string>;
}

// ─── Demo Data ──────────────────────────────────────────────────────

const DEMO_LECTURES: TimetableLecture[] = [
  { teacherCode: "CSI", day: "MONDAY", date: "16-Jun-2026", startTime: "8:45 AM", endTime: "10:15 AM", batches: ["27-LJ151MA 2026"], rooms: ["507"], isMerged: false, isExtraLecture: false },
  { teacherCode: "CSI", day: "MONDAY", date: "16-Jun-2026", startTime: "10:30 AM", endTime: "12:00 PM", batches: ["27-LJ152MA 2026"], rooms: ["601"], isMerged: false, isExtraLecture: false },
  { teacherCode: "CSI", day: "MONDAY", date: "16-Jun-2026", startTime: "4:10 PM", endTime: "5:40 PM", batches: ["27-LJ151EA", "27-LJ152EA"], rooms: ["201", "605"], isMerged: true, isExtraLecture: false },
  { teacherCode: "CSI", day: "TUESDAY", date: "17-Jun-2026", startTime: "8:45 AM", endTime: "10:15 AM", batches: ["27-LJ151MA 2026"], rooms: ["507"], isMerged: false, isExtraLecture: false },
  { teacherCode: "PMT", day: "MONDAY", date: "16-Jun-2026", startTime: "8:45 AM", endTime: "10:15 AM", batches: ["27-LJ151MA 2026"], rooms: ["507"], isMerged: false, isExtraLecture: false },
  { teacherCode: "PQL", day: "MONDAY", date: "16-Jun-2026", startTime: "8:45 AM", endTime: "10:15 AM", batches: ["27-LJ153MA 2026"], rooms: ["505"], isMerged: false, isExtraLecture: false },
];

const DEMO_CODES: TeacherCode[] = [
  { code: "CSI", count: 4 }, { code: "PMT", count: 1 }, { code: "PQL", count: 1 },
];

// ─── Helpers ────────────────────────────────────────────────────────

function parseTimeToMinutes(time: string): number {
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function calcHours(lectures: TimetableLecture[]): number {
  let total = 0;
  for (const l of lectures) {
    const start = parseTimeToMinutes(l.startTime);
    const end = parseTimeToMinutes(l.endTime);
    if (end > start) total += (end - start);
  }
  return Math.round(total / 60 * 10) / 10;
}

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_SHORT: Record<string, string> = {
  MONDAY: "MON", TUESDAY: "TUE", WEDNESDAY: "WED", THURSDAY: "THU", FRIDAY: "FRI", SATURDAY: "SAT", SUNDAY: "SUN",
};
const DAY_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  MONDAY:    { bg: "bg-blue-50 dark:bg-blue-950/20",   text: "text-blue-700 dark:text-blue-300",   border: "border-blue-200 dark:border-blue-900/40",   dot: "bg-blue-500" },
  TUESDAY:   { bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-900/40", dot: "bg-emerald-500" },
  WEDNESDAY: { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-900/40", dot: "bg-amber-500" },
  THURSDAY:  { bg: "bg-orange-50 dark:bg-orange-950/20", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-900/40", dot: "bg-orange-500" },
  FRIDAY:    { bg: "bg-red-50 dark:bg-red-950/20",     text: "text-red-700 dark:text-red-300",     border: "border-red-200 dark:border-red-900/40",     dot: "bg-red-500" },
  SATURDAY:  { bg: "bg-purple-50 dark:bg-purple-950/20", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-900/40", dot: "bg-purple-500" },
  SUNDAY:    { bg: "bg-slate-50 dark:bg-slate-950/20", text: "text-slate-600 dark:text-slate-400", border: "border-slate-200 dark:border-slate-800/40", dot: "bg-slate-400" },
};

const DEFAULT_DAY_COLORS = { bg: "bg-slate-50 dark:bg-slate-950/20", text: "text-slate-600 dark:text-slate-400", border: "border-slate-200 dark:border-slate-800/40", dot: "bg-slate-400" };

// ─── Component ──────────────────────────────────────────────────────

export default function TimetableViewer({ adminHeaders }: TimetableViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [allCodes, setAllCodes] = useState<TeacherCode[]>([]);
  const [lectures, setLectures] = useState<TimetableLecture[]>([]);
  const [codesExpanded, setCodesExpanded] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [mergeModal, setMergeModal] = useState<TimetableLecture | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);

  // ─── Data Fetching ────────────────────────────────────────────────

  const fetchCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/timetable/codes", { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.codes && data.codes.length > 0) {
          setAllCodes(data.codes);
          setIsDemo(false);
        } else {
          setAllCodes(DEMO_CODES);
          setIsDemo(true);
        }
      }
    } catch {
      setAllCodes(DEMO_CODES);
      setIsDemo(true);
    }
  }, [adminHeaders]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/timetable/config", { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLastLoaded(data.lastLoaded || null);
        setApiError(data.error || null);
      }
    } catch { /* ignore */ }
  }, [adminHeaders]);

  const fetchLectures = useCallback(async (code: string) => {
    if (isDemo) {
      setLectures(DEMO_LECTURES.filter(l => l.teacherCode === code));
      return;
    }
    try {
      const res = await fetch(`/api/timetable?code=${encodeURIComponent(code)}`, { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLectures(data.lectures || []);
      }
    } catch { /* ignore */ }
  }, [adminHeaders, isDemo]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/timetable/refresh", { method: "POST", headers: adminHeaders() });
      setTimeout(() => { fetchCodes(); fetchConfig(); setIsLoading(false); }, 2000);
    } catch { setIsLoading(false); }
  };

  useEffect(() => { fetchConfig(); fetchCodes(); }, [fetchConfig, fetchCodes]);

  useEffect(() => {
    if (selectedCode) fetchLectures(selectedCode);
    else setLectures([]);
  }, [selectedCode, fetchLectures]);

  // ─── Search + Selection ───────────────────────────────────────────

  const handleSearch = (val: string) => {
    const upper = val.toUpperCase().replace(/[^A-Z]/g, "");
    setSearchQuery(upper);
    const match = allCodes.find(c => c.code === upper);
    if (match) setSelectedCode(upper);
  };

  const handleChipClick = (code: string) => {
    setSelectedCode(code);
    setSearchQuery(code);
    setCollapsedDays(new Set());
  };

  // ─── Grouped Data ─────────────────────────────────────────────────

  const groupedByDay = useMemo(() => {
    const map = new Map<string, { date: string; lectures: TimetableLecture[] }>();
    for (const l of lectures) {
      const key = l.day.toUpperCase();
      if (!map.has(key)) map.set(key, { date: l.date, lectures: [] });
      map.get(key)!.lectures.push(l);
    }
    const sorted = Array.from(map.entries()).sort(
      (a, b) => DAY_ORDER.indexOf(a[0]) - DAY_ORDER.indexOf(b[0])
    );
    for (const [, v] of sorted) {
      v.lectures.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
    }
    return sorted;
  }, [lectures]);

  const stats = useMemo(() => ({
    totalLectures: lectures.length,
    totalDays: groupedByDay.length,
    totalBatches: new Set(lectures.flatMap(l => l.batches)).size,
    totalHours: calcHours(lectures),
  }), [lectures, groupedByDay]);

  const filteredCodes = useMemo(() => {
    if (!searchQuery) return allCodes;
    return allCodes.filter(c => c.code.includes(searchQuery));
  }, [allCodes, searchQuery]);

  const MAX_VISIBLE = 12;
  const visibleCodes = codesExpanded ? filteredCodes : filteredCodes.slice(0, MAX_VISIBLE);

  const toggleDay = (day: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const expandAll = () => setCollapsedDays(new Set());
  const collapseAll = () => setCollapsedDays(new Set(groupedByDay.map(([d]) => d)));

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="pb-32">
      {/* Demo Banner */}
      {isDemo && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-4 py-3 mb-4"
        >
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <span className="font-bold">Demo Mode</span> — Go to Settings → Time Table tab to configure your sheet URL.
          </p>
        </motion.div>
      )}

      {/* Error Banner */}
      {apiError && !isDemo && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-2xl px-4 py-3 mb-4"
        >
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-300">{apiError}</p>
        </motion.div>
      )}

      {/* ═══ Header + Search ═══ */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-hidden mb-4">
        {/* Header */}
        <div className="p-4 md:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-gradient-to-br from-[#5277f7] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#5277f7]/20">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-black text-slate-800 dark:text-white">Weekly Schedule</h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {lastLoaded ? `Updated ${new Date(lastLoaded).toLocaleDateString()}` : "Teacher Timetable"}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#5277f7] hover:bg-slate-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#5277f7]" : ""}`} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 md:px-5 pb-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search teacher code..."
              className="w-full bg-slate-50 dark:bg-gray-900/40 rounded-xl border border-slate-200 dark:border-gray-800 pl-10 pr-10 py-2.5 md:py-3 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-[#5277f7] focus:ring-2 focus:ring-[#5277f7]/10 transition-all font-mono tracking-wide"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSelectedCode(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Teacher Chips (collapsible) */}
        <div className="px-4 md:px-5 pb-4">
          <button
            onClick={() => setCodesExpanded(!codesExpanded)}
            className="flex items-center gap-1.5 mb-2 cursor-pointer group"
          >
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${codesExpanded ? "" : "-rotate-90"}`} />
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400 font-mono group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
              Teachers · {allCodes.length}
            </span>
          </button>

          <div className="flex flex-wrap gap-1.5">
            {visibleCodes.map(c => (
              <button
                key={c.code}
                onClick={() => handleChipClick(c.code)}
                className={`inline-flex items-center gap-1 px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg text-[11px] md:text-xs font-bold transition-all cursor-pointer ${
                  selectedCode === c.code
                    ? "bg-[#5277f7] text-white shadow-md shadow-[#5277f7]/20 scale-105"
                    : "bg-slate-100 dark:bg-gray-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700 active:scale-95"
                }`}
              >
                <span className="font-mono">{c.code}</span>
                <span className={`text-[9px] ${selectedCode === c.code ? "text-white/60" : "text-slate-400"}`}>{c.count}</span>
              </button>
            ))}
            {!codesExpanded && filteredCodes.length > MAX_VISIBLE && (
              <button
                onClick={() => setCodesExpanded(true)}
                className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#5277f7]/10 text-[#5277f7] hover:bg-[#5277f7]/20 cursor-pointer transition-all"
              >
                +{filteredCodes.length - MAX_VISIBLE} more
              </button>
            )}
            {codesExpanded && filteredCodes.length > MAX_VISIBLE && (
              <button
                onClick={() => setCodesExpanded(false)}
                className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer transition-all"
              >
                Show less
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Selected Teacher Section ═══ */}
      {selectedCode && lectures.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

          {/* Stats Bar */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm p-4 md:p-5 mb-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5277f7] to-[#7c3aed] flex items-center justify-center shadow-md shadow-[#5277f7]/20">
                  <GraduationCap className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-black text-slate-800 dark:text-white font-mono tracking-wider">{selectedCode}</span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-2 sm:flex sm:gap-4 sm:ml-auto">
                <div className="flex flex-col items-center sm:flex-row sm:gap-1.5 text-center sm:text-left">
                  <BookOpen className="w-3.5 h-3.5 text-[#5277f7] mx-auto sm:mx-0" />
                  <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">{stats.totalLectures}<span className="hidden sm:inline"> lectures</span></span>
                </div>
                <div className="flex flex-col items-center sm:flex-row sm:gap-1.5 text-center sm:text-left">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500 mx-auto sm:mx-0" />
                  <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">{stats.totalDays}<span className="hidden sm:inline"> days</span></span>
                </div>
                <div className="flex flex-col items-center sm:flex-row sm:gap-1.5 text-center sm:text-left">
                  <Layers className="w-3.5 h-3.5 text-amber-500 mx-auto sm:mx-0" />
                  <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">{stats.totalBatches}<span className="hidden sm:inline"> batches</span></span>
                </div>
                <div className="flex flex-col items-center sm:flex-row sm:gap-1.5 text-center sm:text-left">
                  <Timer className="w-3.5 h-3.5 text-purple-500 mx-auto sm:mx-0" />
                  <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">~{stats.totalHours}<span className="hidden sm:inline"> hrs</span></span>
                </div>
              </div>
            </div>

            {/* Expand/Collapse */}
            {groupedByDay.length > 1 && (
              <div className="flex gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-gray-800/60">
                <button onClick={expandAll} className="text-[10px] font-bold text-[#5277f7] hover:underline cursor-pointer">Expand All</button>
                <span className="text-slate-200 dark:text-gray-700">·</span>
                <button onClick={collapseAll} className="text-[10px] font-bold text-[#5277f7] hover:underline cursor-pointer">Collapse All</button>
              </div>
            )}
          </div>

          {/* ═══ Day Cards ═══ */}
          <div className="space-y-2.5">
            {groupedByDay.map(([day, { date, lectures: dayLectures }], dayIdx) => {
              const isCollapsed = collapsedDays.has(day);
              const colors = DAY_COLORS[day] || DEFAULT_DAY_COLORS;

              return (
                <motion.div
                  key={day}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: dayIdx * 0.05 }}
                  className="bg-white dark:bg-[#111827] rounded-2xl md:rounded-3xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-hidden"
                >
                  {/* Day Header */}
                  <button
                    onClick={() => toggleDay(day)}
                    className="w-full flex items-center justify-between px-3.5 py-3 md:px-5 md:py-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-gray-800/20 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 md:gap-3">
                      <div className={`w-2 h-7 md:h-8 rounded-full ${colors.dot}`} />
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs md:text-sm font-black tracking-wide text-slate-800 dark:text-white">
                            <span className="sm:hidden">{DAY_SHORT[day] || day}</span>
                            <span className="hidden sm:inline">{day}</span>
                          </h3>
                          <span className={`text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-md ${colors.bg} ${colors.text}`}>
                            {dayLectures.length} lec
                          </span>
                        </div>
                        <p className="text-[10px] md:text-[11px] text-slate-400 font-mono">{date}</p>
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform group-hover:text-slate-600 ${isCollapsed ? "-rotate-90" : ""}`} />
                  </button>

                  {/* Lectures */}
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3.5 md:px-5 pb-3.5 md:pb-4 space-y-2">
                          {dayLectures.map((lecture, lIdx) => (
                            <motion.div
                              key={lIdx}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: lIdx * 0.03 }}
                              className={`rounded-xl md:rounded-2xl border p-3 md:p-4 transition-colors ${colors.bg} ${colors.border} hover:shadow-sm`}
                            >
                              {/* Time Row */}
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-[#5277f7]" />
                                  <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">
                                    {lecture.startTime} — {lecture.endTime}
                                  </span>
                                </div>
                                {/* Badges */}
                                <div className="flex gap-1.5">
                                  {lecture.isMerged && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setMergeModal(lecture); }}
                                      className="text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 cursor-pointer hover:bg-purple-200 transition-colors"
                                    >🔀 Merged</button>
                                  )}
                                  {lecture.isExtraLecture && (
                                    <span className="text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">⭐ Extra</span>
                                  )}
                                </div>
                              </div>

                              {/* Batch + Room */}
                              <div className="ml-5 space-y-0.5">
                                {lecture.batches.map((batch, bIdx) => (
                                  <div key={bIdx} className="flex items-center gap-1.5">
                                    <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="text-[11px] md:text-xs text-slate-600 dark:text-slate-300 font-medium truncate">{batch}</span>
                                  </div>
                                ))}
                                {lecture.rooms.length > 0 && lecture.rooms.some(r => r) && (
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="text-[10px] md:text-[11px] text-slate-400 font-mono">Room {lecture.rooms.filter(Boolean).join(", ")}</span>
                                  </div>
                                )}
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

      {/* Empty State */}
      {selectedCode && lectures.length === 0 && !isDemo && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-10 shadow-sm text-center"
        >
          <Search className="w-10 h-10 text-slate-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No lectures found for "{selectedCode}"</p>
          <p className="text-xs text-slate-400 mt-1">Try a different teacher code</p>
        </motion.div>
      )}

      {/* No Selection Prompt */}
      {!selectedCode && !isDemo && allCodes.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-8 md:p-10 shadow-sm text-center"
        >
          <GraduationCap className="w-10 h-10 text-slate-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Select a teacher code</p>
          <p className="text-xs text-slate-400 mt-1">Click on any code above or search by name</p>
        </motion.div>
      )}

      {/* ═══ Merge Modal ═══ */}
      <AnimatePresence>
        {mergeModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setMergeModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-5 md:p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                  🔀 Merged Class
                  <span className="text-[10px] font-bold text-[#5277f7] bg-[#5277f7]/10 px-2 py-0.5 rounded-md">{mergeModal.teacherCode}</span>
                </h3>
                <button onClick={() => setMergeModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-gray-800 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">These batches are combined in a single lecture:</p>
              <div className="space-y-2">
                {mergeModal.batches.map((batch, i) => (
                  <div key={i} className="flex items-center gap-3 bg-purple-50 dark:bg-purple-950/20 rounded-xl px-3 py-2.5 border border-purple-100 dark:border-purple-900/30">
                    <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{batch}</p>
                      {mergeModal.rooms[i] && <p className="text-[10px] text-slate-400 font-mono">Room {mergeModal.rooms[i]}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-3 text-center font-mono">
                {mergeModal.startTime} — {mergeModal.endTime} · {mergeModal.day} · {mergeModal.date}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
