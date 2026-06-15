import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  ExternalLink,
  Sparkles,
  Info,
  Layers,
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

interface TimetableViewerProps {
  adminHeaders: () => Record<string, string>;
}

interface TeacherCode {
  code: string;
  count: number;
}

interface TimetableStats {
  totalLectures: number;
  totalTeachers: number;
  totalBatches: number;
  lastLoaded: string | null;
  isLoading: boolean;
  error: string | null;
}

interface TimetableConfig {
  url: string;
  lastLoaded: string | null;
  isLoading: boolean;
  error: string | null;
}

// ─── Demo Data ──────────────────────────────────────────────────────

const DEMO_CODES: TeacherCode[] = [
  { code: "CSI", count: 4 },
  { code: "FMT", count: 3 },
  { code: "PBL", count: 2 },
];

const DEMO_LECTURES: Record<string, TimetableLecture[]> = {
  CSI: [
    {
      teacherCode: "CSI",
      day: "MONDAY",
      date: "16-Jun-2026",
      startTime: "8:05 AM",
      endTime: "10:15 AM",
      batches: ["27-LP103 MA 2026"],
      rooms: ["B-23"],
      isMerged: false,
      isExtraLecture: false,
    },
    {
      teacherCode: "CSI",
      day: "MONDAY",
      date: "16-Jun-2026",
      startTime: "11:30 AM",
      endTime: "1:00 PM",
      batches: ["27-LP104 MA 2026", "27-LP105 MA 2026"],
      rooms: ["A-12", "A-13"],
      isMerged: true,
      isExtraLecture: false,
    },
    {
      teacherCode: "CSI",
      day: "TUESDAY",
      date: "17-Jun-2026",
      startTime: "9:00 AM",
      endTime: "11:00 AM",
      batches: ["27-LP106 MA 2026"],
      rooms: ["C-05"],
      isMerged: false,
      isExtraLecture: false,
    },
    {
      teacherCode: "CSI",
      day: "TUESDAY",
      date: "17-Jun-2026",
      startTime: "2:00 PM",
      endTime: "3:30 PM",
      batches: ["27-LP107 MA 2026"],
      rooms: ["B-11"],
      isMerged: false,
      isExtraLecture: false,
    },
  ],
  FMT: [
    {
      teacherCode: "FMT",
      day: "MONDAY",
      date: "16-Jun-2026",
      startTime: "10:30 AM",
      endTime: "12:00 PM",
      batches: ["27-NP201 PH 2026"],
      rooms: ["D-02"],
      isMerged: false,
      isExtraLecture: false,
    },
    {
      teacherCode: "FMT",
      day: "WEDNESDAY",
      date: "18-Jun-2026",
      startTime: "8:05 AM",
      endTime: "10:15 AM",
      batches: ["27-NP202 PH 2026"],
      rooms: ["D-04"],
      isMerged: false,
      isExtraLecture: false,
    },
    {
      teacherCode: "FMT",
      day: "WEDNESDAY",
      date: "18-Jun-2026",
      startTime: "1:00 PM",
      endTime: "3:00 PM",
      batches: ["27-NP203 PH 2026"],
      rooms: ["D-06"],
      isMerged: false,
      isExtraLecture: false,
    },
  ],
  PBL: [
    {
      teacherCode: "PBL",
      day: "THURSDAY",
      date: "19-Jun-2026",
      startTime: "9:00 AM",
      endTime: "11:00 AM",
      batches: ["27-LP301 CH 2026"],
      rooms: ["E-01"],
      isMerged: false,
      isExtraLecture: true,
    },
    {
      teacherCode: "PBL",
      day: "FRIDAY",
      date: "20-Jun-2026",
      startTime: "10:00 AM",
      endTime: "12:30 PM",
      batches: ["27-LP302 CH 2026"],
      rooms: ["E-03"],
      isMerged: false,
      isExtraLecture: false,
    },
  ],
};

// ─── Utility helpers ────────────────────────────────────────────────

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return iso;
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function groupByDay(lectures: TimetableLecture[]): Record<string, TimetableLecture[]> {
  const groups: Record<string, TimetableLecture[]> = {};
  for (const lec of lectures) {
    const key = `${lec.day}|${lec.date}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(lec);
  }
  return groups;
}

function countUniqueBatches(lectures: TimetableLecture[]): number {
  const set = new Set<string>();
  for (const l of lectures) for (const b of l.batches) set.add(b);
  return set.size;
}

function estimateHours(lectures: TimetableLecture[]): number {
  let totalMinutes = 0;
  for (const l of lectures) {
    const start = parseTime(l.startTime);
    const end = parseTime(l.endTime);
    if (start !== null && end !== null) totalMinutes += end - start;
  }
  return Math.round(totalMinutes / 60);
}

function parseTime(timeStr: string): number | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function countUniqueDays(lectures: TimetableLecture[]): number {
  const set = new Set<string>();
  for (const l of lectures) set.add(l.day);
  return set.size;
}

// ─── Animated Number Counter ────────────────────────────────────────

function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    const startTime = performance.now();
    let raf: number;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        prevRef.current = to;
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{display}</span>;
}

// ─── Main Component ─────────────────────────────────────────────────

const TimetableViewer: React.FC<TimetableViewerProps> = ({ adminHeaders }) => {
  // ── State ──
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [lectures, setLectures] = useState<TimetableLecture[]>([]);
  const [teacherName, setTeacherName] = useState<string>("");
  const [codes, setCodes] = useState<TeacherCode[]>([]);
  const [config, setConfig] = useState<TimetableConfig | null>(null);
  const [stats, setStats] = useState<TimetableStats | null>(null);

  const [showConfig, setShowConfig] = useState(false);
  const [configUrl, setConfigUrl] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mergeModalLecture, setMergeModalLecture] = useState<TimetableLecture | null>(null);

  const [isDemoMode, setIsDemoMode] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch helpers ──

  const fetchJson = useCallback(
    async (url: string, opts?: RequestInit) => {
      const res = await fetch(url, {
        ...opts,
        headers: { ...adminHeaders(), ...(opts?.headers || {}) },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || `Request failed (${res.status})`);
      }
      return res.json();
    },
    [adminHeaders]
  );

  // ── Initial data load ──

  const loadInitialData = useCallback(async () => {
    try {
      const [codesData, configData, statsData] = await Promise.all([
        fetchJson("/api/timetable/codes").catch(() => null),
        fetchJson("/api/timetable/config").catch(() => null),
        fetchJson("/api/timetable/stats").catch(() => null),
      ]);

      if (configData) {
        setConfig(configData);
        setConfigUrl(configData.url || "");
      }
      if (statsData) setStats(statsData);

      if (codesData?.codes?.length > 0) {
        setCodes(codesData.codes);
        setIsDemoMode(false);
      } else {
        // No data → demo mode
        setCodes(DEMO_CODES);
        setIsDemoMode(true);
      }
    } catch {
      setCodes(DEMO_CODES);
      setIsDemoMode(true);
    }
  }, [fetchJson]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ── Search teacher ──

  const searchTeacher = useCallback(
    async (code: string) => {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) return;

      setActiveCode(trimmed);
      setError(null);

      if (isDemoMode) {
        const demoLectures = DEMO_LECTURES[trimmed];
        if (demoLectures) {
          setLectures(demoLectures);
          setTeacherName(trimmed);
        } else {
          setLectures([]);
          setTeacherName("");
        }
        return;
      }

      setIsLoading(true);
      try {
        const data = await fetchJson(`/api/timetable?code=${encodeURIComponent(trimmed)}`);
        setLectures(data.lectures || []);
        setTeacherName(data.teacher || trimmed);
      } catch (e: any) {
        setError(e.message);
        setLectures([]);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchJson, isDemoMode]
  );

  // ── Save config ──

  const saveConfig = async () => {
    setConfigSaving(true);
    setConfigMsg(null);
    try {
      const data = await fetchJson("/api/timetable/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: configUrl }),
      });
      setConfigMsg({ text: data.message || "Saved successfully", ok: true });
      // Reload data
      loadInitialData();
    } catch (e: any) {
      setConfigMsg({ text: e.message, ok: false });
    } finally {
      setConfigSaving(false);
    }
  };

  // ── Refresh data ──

  const refreshData = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const data = await fetchJson("/api/timetable/refresh", { method: "POST" });
      if (data.success) {
        await loadInitialData();
        if (activeCode) await searchTeacher(activeCode);
      } else {
        setError(data.message || "Refresh failed");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Handle search input ──

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchTeacher(searchQuery);
  };

  const handleChipClick = (code: string) => {
    setSearchQuery(code);
    searchTeacher(code);
  };

  // ── Grouped lectures ──

  const grouped = useMemo(() => groupByDay(lectures), [lectures]);
  const dayKeys = useMemo(() => Object.keys(grouped), [grouped]);

  // ── Stats for active teacher ──

  const activeStats = useMemo(() => {
    if (!activeCode || lectures.length === 0) return null;
    return {
      code: activeCode,
      lectures: lectures.length,
      days: countUniqueDays(lectures),
      batches: countUniqueBatches(lectures),
      hours: estimateHours(lectures),
    };
  }, [activeCode, lectures]);

  // ── Close modal on ESC ──

  useEffect(() => {
    if (!mergeModalLecture) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMergeModalLecture(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mergeModalLecture]);

  // ─────────────────────────────────────── RENDER ───────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-4xl mx-auto w-full space-y-4"
    >
      {/* ═══ Demo Mode Banner ═══ */}
      <AnimatePresence>
        {isDemoMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 flex items-start gap-2.5"
          >
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                📋 Demo Mode
              </span>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 leading-relaxed">
                Configure your timetable sheet URL in settings to see real data.
                Showing sample schedules below.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Main Card ═══ */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-4 md:p-6 shadow-sm">
        {/* ─── Header ─── */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-gray-800">
          <div className="w-11 h-11 rounded-2xl bg-[#5277f7]/10 text-[#5277f7] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-mono font-bold tracking-widest text-[#5277f7] uppercase block">
              Teacher Timetable
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-display leading-tight">
              📅 Weekly Schedule Viewer
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Search any teacher's weekly schedule
            </p>
          </div>

          {/* Config gear */}
          <button
            onClick={() => setShowConfig((v) => !v)}
            className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              showConfig
                ? "bg-[#5277f7] text-white shadow-md shadow-[#5277f7]/20"
                : "text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/60"
            }`}
            title="Configure"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Refresh */}
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/60 transition-all cursor-pointer disabled:opacity-40"
            title="Refresh timetable data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* ─── Config Panel (collapsible) ─── */}
        <AnimatePresence initial={false}>
          {showConfig && (
            <motion.div
              key="config-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-4 pb-3 space-y-3 border-b border-slate-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    Sheet Configuration
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={configUrl}
                    onChange={(e) => setConfigUrl(e.target.value)}
                    placeholder="Google Sheet URL (published CSV link)"
                    className="flex-1 bg-slate-50 dark:bg-gray-900/40 rounded-2xl border border-slate-200 dark:border-gray-800 px-4 py-3 text-sm text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-gray-600 outline-none focus:border-[#5277f7] focus:ring-1 focus:ring-[#5277f7]/20 transition-all font-display"
                  />
                  <button
                    onClick={saveConfig}
                    disabled={configSaving || !configUrl.trim()}
                    className="bg-[#5277f7] hover:bg-[#4062dd] text-white font-bold text-xs px-5 py-3 rounded-2xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-2 font-display"
                  >
                    {configSaving ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Save URL
                  </button>
                </div>

                {/* Config status messages */}
                <AnimatePresence>
                  {configMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                        configMsg.ok
                          ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-300"
                          : "bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-300"
                      }`}
                    >
                      {configMsg.ok ? (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      {configMsg.text}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Last loaded + error */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                  {config?.lastLoaded && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Last loaded:{" "}
                      {relTime(config.lastLoaded)}
                    </span>
                  )}
                  {config?.url && (
                    <a
                      href={config.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[#5277f7] hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Open sheet
                    </a>
                  )}
                </div>
                {config?.error && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-300 text-[11px] font-medium flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {config.error}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Search Section ─── */}
        <div className="pt-4 space-y-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 dark:text-gray-600 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              placeholder="Search teacher code (e.g., CSI)"
              className="w-full bg-slate-50 dark:bg-gray-900/40 rounded-2xl border border-slate-200 dark:border-gray-800 pl-11 pr-4 py-3.5 text-sm text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-gray-600 outline-none focus:border-[#5277f7] focus:ring-2 focus:ring-[#5277f7]/20 transition-all font-display font-semibold tracking-wide"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCode(null);
                  setLectures([]);
                  setTeacherName("");
                  setError(null);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-500 dark:text-gray-600 dark:hover:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/60 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* ─── Teacher Code Chips ─── */}
          <div className="flex flex-wrap gap-1.5">
            {codes.map((tc, i) => {
              const isActive = activeCode === tc.code;
              return (
                <motion.button
                  key={tc.code}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  onClick={() => handleChipClick(tc.code)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer font-display ${
                    isActive
                      ? "bg-[#5277f7] text-white shadow-md shadow-[#5277f7]/20"
                      : "bg-slate-50 dark:bg-gray-800/40 text-slate-500 dark:text-gray-400 border border-slate-200/60 dark:border-gray-700/50 hover:bg-slate-100 dark:hover:bg-gray-800/80 hover:border-slate-300 dark:hover:border-gray-600"
                  }`}
                >
                  {tc.code}
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md ${
                      isActive
                        ? "bg-white/20 text-white/90"
                        : "bg-slate-200/60 dark:bg-gray-700/60 text-slate-400 dark:text-gray-500"
                    }`}
                  >
                    {tc.count}
                  </span>
                </motion.button>
              );
            })}
            {codes.length === 0 && !isLoading && (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-1">
                No teacher codes available.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Error Banner ═══ */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Loading Spinner ═══ */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2.5 py-12"
          >
            <RefreshCw className="w-5 h-5 text-[#5277f7] animate-spin" />
            <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 font-display">
              Loading schedule...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Stats Bar ═══ */}
      <AnimatePresence>
        {activeStats && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-4 md:p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#5277f7]/10 text-[#5277f7] flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white font-display">
                  {activeStats.code}
                </span>
                {teacherName && teacherName !== activeStats.code && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    — {teacherName}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-bold text-slate-500 dark:text-slate-400 font-display">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#5277f7]" />
                  <AnimatedNumber value={activeStats.lectures} /> lectures
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                  <AnimatedNumber value={activeStats.days} /> days
                </span>
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-500" />
                  <AnimatedNumber value={activeStats.batches} /> batches
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-500" />
                  ~<AnimatedNumber value={activeStats.hours} /> hrs
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Schedule Cards (grouped by day) ═══ */}
      {!isLoading && activeCode && lectures.length > 0 && (
        <div className="space-y-4">
          {dayKeys.map((key, dayIdx) => {
            const [day, date] = key.split("|");
            const dayLectures = grouped[key];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: dayIdx * 0.08,
                  duration: 0.35,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {/* Day Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-1 h-8 rounded-full bg-[#5277f7]" />
                  <div>
                    <h3 className="text-xs font-bold tracking-wider uppercase text-slate-900 dark:text-white font-mono">
                      📅 {day}
                    </h3>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      {date}
                    </span>
                  </div>
                  <span className="ml-auto text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-gray-800/60 text-slate-400 dark:text-gray-500">
                    {dayLectures.length} lecture{dayLectures.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Lecture Cards */}
                <div className="space-y-2.5 pl-4 md:pl-6">
                  {dayLectures.map((lec, lecIdx) => (
                    <motion.div
                      key={`${lec.startTime}-${lecIdx}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: dayIdx * 0.08 + lecIdx * 0.05,
                        duration: 0.3,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 p-4 shadow-sm hover:shadow-md hover:border-slate-300/60 dark:hover:border-gray-700/60 transition-all group"
                    >
                      {/* Time row */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-[#5277f7]" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-mono tracking-wide">
                            {lec.startTime} — {lec.endTime}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {lec.isMerged && (
                            <button
                              onClick={() => setMergeModalLecture(lec)}
                              className="text-[9px] font-mono font-bold px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-all cursor-pointer flex items-center gap-1"
                            >
                              🔀 Merged
                            </button>
                          )}
                          {lec.isExtraLecture && (
                            <span
                              title="This is an additional/extra lecture beyond the regular schedule"
                              className="text-[9px] font-mono font-bold px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 flex items-center gap-1"
                            >
                              ⭐ Extra
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Batches */}
                      <div className="flex items-start gap-2 mb-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                        <div className="space-y-0.5">
                          {lec.batches.map((batch, bi) => (
                            <span
                              key={bi}
                              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 font-display leading-snug"
                            >
                              {batch}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Rooms */}
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium font-display">
                          Room: {lec.rooms.join(", ") || "—"}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══ Empty State ═══ */}
      <AnimatePresence>
        {!isLoading && activeCode && lectures.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-8 md:p-12 shadow-sm text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-gray-800/60 flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7 text-slate-300 dark:text-gray-600" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-300 font-display mb-1">
              No lectures found
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              No lectures found for code{" "}
              <span className="font-mono font-bold text-slate-500 dark:text-slate-400">
                '{activeCode}'
              </span>
              . Try a different teacher code.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ No Selection Prompt ═══ */}
      {!isLoading && !activeCode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-8 md:p-12 shadow-sm text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#5277f7]/10 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7 text-[#5277f7]" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-300 font-display mb-1">
            Select a teacher
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
            Type a teacher code above or click on one of the chips to view their
            weekly schedule.
          </p>
        </motion.div>
      )}

      {/* ═══ Global Stats (footer) ═══ */}
      {stats && !isDemoMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[10px] font-mono text-slate-300 dark:text-gray-600 pt-2 pb-1"
        >
          <span>{stats.totalTeachers} teachers</span>
          <span>·</span>
          <span>{stats.totalLectures} lectures</span>
          <span>·</span>
          <span>{stats.totalBatches} batches</span>
          {stats.lastLoaded && (
            <>
              <span>·</span>
              <span>Updated {relTime(stats.lastLoaded)}</span>
            </>
          )}
        </motion.div>
      )}

      {/* ═══ Merged Batch Modal ═══ */}
      <AnimatePresence>
        {mergeModalLecture && (
          <motion.div
            key="merge-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setMergeModalLecture(null)}
          >
            <motion.div
              key="merge-modal"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-5 md:p-6 shadow-xl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white font-display">
                      Merged Class
                    </h3>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      {mergeModalLecture.startTime} — {mergeModalLecture.endTime}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setMergeModalLecture(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/60 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed font-display">
                Teacher{" "}
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {mergeModalLecture.teacherCode}
                </span>{" "}
                is teaching the following batches together:
              </p>

              {/* Batch list */}
              <div className="space-y-2 mb-5">
                {mergeModalLecture.batches.map((batch, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-gray-900/40 border border-slate-100 dark:border-gray-800"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 flex items-center justify-center text-[10px] font-bold font-mono shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-display block truncate">
                        {batch}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        {mergeModalLecture.rooms[idx] || "—"}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Close button */}
              <button
                onClick={() => setMergeModalLecture(null)}
                className="w-full bg-[#5277f7] hover:bg-[#4062dd] text-white font-bold text-xs py-3 rounded-2xl transition-all cursor-pointer font-display"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TimetableViewer;
