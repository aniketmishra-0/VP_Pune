import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Settings,
  RefreshCw,
  Clock,
  Calendar,
  MapPin,
  BookOpen,
  Users,
  AlertCircle,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Layers,
  GraduationCap,
  Timer,
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
  { teacherCode: "CSI", day: "MONDAY", date: "16-Jun-2026", startTime: "4:10 PM", endTime: "5:40 PM", batches: ["27-LJ151EA 2026", "27-LJ152EA 2026"], rooms: ["201", "605-"], isMerged: true, isExtraLecture: false },
  { teacherCode: "CSI", day: "TUESDAY", date: "17-Jun-2026", startTime: "8:45 AM", endTime: "10:15 AM", batches: ["27-LJ151MA 2026"], rooms: ["507"], isMerged: false, isExtraLecture: false },
  { teacherCode: "PMT", day: "MONDAY", date: "16-Jun-2026", startTime: "8:45 AM", endTime: "10:15 AM", batches: ["27-LJ151MA 2026"], rooms: ["507"], isMerged: false, isExtraLecture: false },
  { teacherCode: "PMT", day: "MONDAY", date: "16-Jun-2026", startTime: "2:15 PM", endTime: "3:45 PM", batches: ["27-AJ251NA 2026"], rooms: ["503-"], isMerged: false, isExtraLecture: false },
  { teacherCode: "PQL", day: "MONDAY", date: "16-Jun-2026", startTime: "8:45 AM", endTime: "10:15 AM", batches: ["27-LJ153MA 2026"], rooms: ["505"], isMerged: false, isExtraLecture: false },
  { teacherCode: "PQL", day: "WEDNESDAY", date: "18-Jun-2026", startTime: "12:25 PM", endTime: "1:55 PM", batches: ["MHT-CET"], rooms: ["504--"], isMerged: false, isExtraLecture: true },
];

const DEMO_CODES: TeacherCode[] = [
  { code: "CSI", count: 4 }, { code: "PMT", count: 2 }, { code: "PQL", count: 2 },
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
const DAY_EMOJI: Record<string, string> = {
  MONDAY: "🟦", TUESDAY: "🟩", WEDNESDAY: "🟨", THURSDAY: "🟧", FRIDAY: "🟥", SATURDAY: "🟪", SUNDAY: "⬜",
};
const DAY_COLORS: Record<string, string> = {
  MONDAY: "#5277f7", TUESDAY: "#10b981", WEDNESDAY: "#f59e0b", THURSDAY: "#f97316", FRIDAY: "#ef4444", SATURDAY: "#8b5cf6", SUNDAY: "#6b7280",
};

// ─── Component ──────────────────────────────────────────────────────

export default function TimetableViewer({ adminHeaders }: TimetableViewerProps) {
  // State
  const [configOpen, setConfigOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);
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

  // ─── Data Fetching ────────────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/timetable/config", { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSheetUrl(data.url || "");
        setLastLoaded(data.lastLoaded || null);
        setApiError(data.error || null);
      }
    } catch { /* ignore */ }
  }, [adminHeaders]);

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

  const handleSaveUrl = async () => {
    setSaveMsg(null);
    try {
      const res = await fetch("/api/timetable/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ url: sheetUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMsg({ type: "ok", text: data.message || "Saved!" });
        setTimeout(() => { fetchCodes(); fetchConfig(); }, 2000);
      } else {
        setSaveMsg({ type: "err", text: data.error || "Failed to save" });
      }
    } catch (e: any) {
      setSaveMsg({ type: "err", text: e.message });
    }
  };

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

  // ─── Search Logic ─────────────────────────────────────────────────

  const handleSearch = (val: string) => {
    const upper = val.toUpperCase().replace(/[^A-Z]/g, "");
    setSearchQuery(upper);
    const match = allCodes.find(c => c.code === upper);
    if (match) setSelectedCode(upper);
  };

  const handleChipClick = (code: string) => {
    setSelectedCode(code);
    setSearchQuery(code);
    setCollapsedDays(new Set()); // expand all days on new selection
  };

  // ─── Grouped Data ─────────────────────────────────────────────────

  const groupedByDay = useMemo(() => {
    const map = new Map<string, { date: string; lectures: TimetableLecture[] }>();
    for (const l of lectures) {
      const key = l.day.toUpperCase();
      if (!map.has(key)) map.set(key, { date: l.date, lectures: [] });
      map.get(key)!.lectures.push(l);
    }
    // Sort by day order
    const sorted = Array.from(map.entries()).sort(
      (a, b) => DAY_ORDER.indexOf(a[0]) - DAY_ORDER.indexOf(b[0])
    );
    // Sort lectures within each day by time
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

  const visibleCodes = codesExpanded ? filteredCodes : filteredCodes.slice(0, 15);

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
    <div className="space-y-4 pb-32">
      {/* Demo Banner */}
      {isDemo && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-4 py-3"
        >
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <span className="font-bold">Demo Mode</span> — Configure your timetable sheet URL in settings to see real data.
          </p>
        </motion.div>
      )}

      {/* Header Card */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-4 md:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5277f7]/10 dark:bg-[#5277f7]/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#5277f7]" />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 font-mono">Teacher Timetable</p>
              <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-white font-display">Weekly Schedule Viewer</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfigOpen(!configOpen)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                configOpen ? "bg-[#5277f7] text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800"
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#5277f7] hover:bg-slate-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#5277f7]" : ""}`} />
            </button>
          </div>
        </div>

        {/* Config Panel (collapsible) */}
        <AnimatePresence>
          {configOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-slate-100 dark:border-gray-800/60 pt-4 mt-2 space-y-3">
                <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 font-mono">Sheet Configuration</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sheetUrl}
                    onChange={e => setSheetUrl(e.target.value)}
                    placeholder="Paste Google Sheet URL with ?gid=... for specific tab"
                    className="flex-1 bg-slate-50 dark:bg-gray-900/40 rounded-xl border border-slate-200 dark:border-gray-800 px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-[#5277f7] transition-colors"
                  />
                  <button
                    onClick={handleSaveUrl}
                    className="bg-[#5277f7] hover:bg-[#4062dd] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" /> Save
                  </button>
                </div>
                {saveMsg && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                    saveMsg.type === "ok" ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                  }`}>
                    {saveMsg.type === "ok" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {saveMsg.text}
                  </div>
                )}
                {apiError && (
                  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {apiError}
                  </div>
                )}
                {lastLoaded && (
                  <p className="text-[10px] text-slate-400">Last loaded: {new Date(lastLoaded).toLocaleString()}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search + Codes Card */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-4 md:p-6 shadow-sm space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search teacher code (e.g., CSI)"
            className="w-full bg-slate-50 dark:bg-gray-900/40 rounded-xl border border-slate-200 dark:border-gray-800 pl-10 pr-10 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-[#5277f7] transition-colors font-mono tracking-wide"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setSelectedCode(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Teacher Code Chips (collapsible) */}
        <div>
          <button
            onClick={() => setCodesExpanded(!codesExpanded)}
            className="flex items-center gap-2 mb-2.5 cursor-pointer group"
          >
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${codesExpanded ? "" : "-rotate-90"}`} />
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400 font-mono group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
              Teachers ({allCodes.length})
            </span>
          </button>

          <AnimatePresence>
            {(codesExpanded || filteredCodes.length <= 15) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-1.5">
                  {visibleCodes.map(c => (
                    <button
                      key={c.code}
                      onClick={() => handleChipClick(c.code)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedCode === c.code
                          ? "bg-[#5277f7] text-white shadow-md shadow-[#5277f7]/20"
                          : "bg-slate-100 dark:bg-gray-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700"
                      }`}
                    >
                      <span className="font-mono">{c.code}</span>
                      <span className={`text-[10px] ${selectedCode === c.code ? "text-white/70" : "text-slate-400"}`}>{c.count}</span>
                    </button>
                  ))}
                  {!codesExpanded && filteredCodes.length > 15 && (
                    <button
                      onClick={() => setCodesExpanded(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-gray-800/60 text-[#5277f7] hover:bg-slate-200 dark:hover:bg-gray-700 cursor-pointer transition-all"
                    >
                      +{filteredCodes.length - 15} more
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Selected Teacher Stats */}
      {selectedCode && lectures.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-4 md:p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#5277f7] flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-black text-slate-800 dark:text-white font-mono">{selectedCode}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-[#5277f7]" />{stats.totalLectures} lectures</span>
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-emerald-500" />{stats.totalDays} days</span>
              <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-amber-500" />{stats.totalBatches} batches</span>
              <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5 text-purple-500" />~{stats.totalHours} hrs</span>
            </div>
          </div>

          {/* Expand/Collapse All */}
          {groupedByDay.length > 1 && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-gray-800/60">
              <button onClick={expandAll} className="text-[10px] font-bold text-[#5277f7] hover:underline cursor-pointer">Expand All</button>
              <span className="text-slate-300 dark:text-gray-700">|</span>
              <button onClick={collapseAll} className="text-[10px] font-bold text-[#5277f7] hover:underline cursor-pointer">Collapse All</button>
            </div>
          )}
        </motion.div>
      )}

      {/* Day-wise Lecture Cards (collapsible) */}
      <AnimatePresence mode="wait">
        {selectedCode && lectures.length > 0 && (
          <motion.div
            key={selectedCode}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {groupedByDay.map(([day, { date, lectures: dayLectures }], dayIdx) => {
              const isCollapsed = collapsedDays.has(day);
              const color = DAY_COLORS[day] || "#5277f7";

              return (
                <motion.div
                  key={day}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: dayIdx * 0.06 }}
                  className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-hidden"
                >
                  {/* Day Header (clickable to collapse) */}
                  <button
                    onClick={() => toggleDay(day)}
                    className="w-full flex items-center justify-between p-4 md:px-6 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-gray-800/20 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-8 rounded-full" style={{ backgroundColor: color }} />
                      <div className="text-left">
                        <h3 className="text-sm font-black tracking-wide text-slate-800 dark:text-white">
                          {DAY_EMOJI[day] || "📅"} {day}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-mono">{date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                        {dayLectures.length} {dayLectures.length === 1 ? "lecture" : "lectures"}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                      />
                    </div>
                  </button>

                  {/* Lectures (collapsible) */}
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 md:px-6 pb-4 space-y-2.5">
                          {dayLectures.map((lecture, lIdx) => (
                            <motion.div
                              key={lIdx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: lIdx * 0.04 }}
                              className="bg-slate-50/80 dark:bg-gray-900/30 rounded-2xl border border-slate-100 dark:border-gray-800/50 p-3.5 md:p-4 hover:border-slate-200 dark:hover:border-gray-700 transition-colors"
                            >
                              {/* Time */}
                              <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-3.5 h-3.5 text-[#5277f7]" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">
                                  {lecture.startTime} — {lecture.endTime}
                                </span>
                              </div>

                              {/* Batches */}
                              <div className="space-y-1 ml-5.5">
                                {lecture.batches.map((batch, bIdx) => (
                                  <div key={bIdx} className="flex items-center gap-2">
                                    <BookOpen className="w-3 h-3 text-slate-400" />
                                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{batch}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Rooms */}
                              {lecture.rooms.length > 0 && lecture.rooms.some(r => r) && (
                                <div className="flex items-center gap-2 mt-1.5 ml-5.5">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  <span className="text-[11px] text-slate-400">Room: {lecture.rooms.join(", ")}</span>
                                </div>
                              )}

                              {/* Badges */}
                              <div className="flex items-center gap-2 mt-2 ml-5.5">
                                {lecture.isMerged && (
                                  <button
                                    onClick={() => setMergeModal(lecture)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 text-[10px] font-bold cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-900/40 transition-colors"
                                  >
                                    🔀 Merged
                                  </button>
                                )}
                                {lecture.isExtraLecture && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold" title="Extra / additional lecture">
                                    ⭐ Extra
                                  </span>
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
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Merge Modal */}
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
              className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-white">🔀 Merged Class</h3>
                <button onClick={() => setMergeModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                <span className="font-bold text-[#5277f7]">{mergeModal.teacherCode}</span> is teaching these batches together:
              </p>
              <div className="space-y-2">
                {mergeModal.batches.map((batch, i) => (
                  <div key={i} className="flex items-center gap-3 bg-purple-50 dark:bg-purple-950/20 rounded-xl px-3 py-2.5">
                    <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{batch}</p>
                      {mergeModal.rooms[i] && <p className="text-[10px] text-slate-400">Room: {mergeModal.rooms[i]}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-3 text-center">
                {mergeModal.startTime} — {mergeModal.endTime} • {mergeModal.day}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
