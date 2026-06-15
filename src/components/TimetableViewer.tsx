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
  User,
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
interface TeacherCode { code: string; count: number; }
interface TimetableViewerProps { adminHeaders: () => Record<string, string>; }

// ─── Teacher Name Mapping ───────────────────────────────────────────

const TEACHER_NAMES: Record<string, string> = {
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

const getName = (code: string) => TEACHER_NAMES[code] || "";

// ─── Demo ───────────────────────────────────────────────────────────

const DEMO_LECTURES: TimetableLecture[] = [
  { teacherCode: "CSI", day: "MONDAY", date: "16-Jun-2026", startTime: "8:45 AM", endTime: "10:15 AM", batches: ["27-LJ151MA 2026"], rooms: ["507"], isMerged: false, isExtraLecture: false },
  { teacherCode: "CSI", day: "MONDAY", date: "16-Jun-2026", startTime: "10:30 AM", endTime: "12:00 PM", batches: ["27-LJ152MA 2026"], rooms: ["601"], isMerged: false, isExtraLecture: false },
  { teacherCode: "CSI", day: "TUESDAY", date: "17-Jun-2026", startTime: "8:45 AM", endTime: "10:15 AM", batches: ["27-LJ151MA 2026"], rooms: ["507"], isMerged: false, isExtraLecture: false },
  { teacherCode: "PMT", day: "MONDAY", date: "16-Jun-2026", startTime: "8:45 AM", endTime: "10:15 AM", batches: ["27-LJ151MA 2026"], rooms: ["507"], isMerged: false, isExtraLecture: false },
  { teacherCode: "PQL", day: "MONDAY", date: "16-Jun-2026", startTime: "8:45 AM", endTime: "10:15 AM", batches: ["27-LJ153MA 2026"], rooms: ["505"], isMerged: false, isExtraLecture: false },
];
const DEMO_CODES: TeacherCode[] = [{ code: "CSI", count: 3 }, { code: "PMT", count: 1 }, { code: "PQL", count: 1 }];

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
const DAY_DOT: Record<string, string> = {
  MONDAY: "bg-blue-500", TUESDAY: "bg-emerald-500", WEDNESDAY: "bg-amber-500",
  THURSDAY: "bg-orange-500", FRIDAY: "bg-red-500", SATURDAY: "bg-purple-500", SUNDAY: "bg-slate-400",
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
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [mergeModal, setMergeModal] = useState<TimetableLecture | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);

  // ─── Fetch ────────────────────────────────────────────────────────

  const fetchCodes = useCallback(async () => {
    try {
      const r = await fetch("/api/timetable/codes", { headers: adminHeaders() });
      if (r.ok) { const d = await r.json(); if (d.codes?.length) { setAllCodes(d.codes); setIsDemo(false); } else { setAllCodes(DEMO_CODES); setIsDemo(true); } }
    } catch { setAllCodes(DEMO_CODES); setIsDemo(true); }
  }, [adminHeaders]);

  const fetchConfig = useCallback(async () => {
    try { const r = await fetch("/api/timetable/config", { headers: adminHeaders() }); if (r.ok) { const d = await r.json(); setLastLoaded(d.lastLoaded || null); setApiError(d.error || null); } } catch {}
  }, [adminHeaders]);

  const fetchLectures = useCallback(async (code: string) => {
    if (isDemo) { setLectures(DEMO_LECTURES.filter(l => l.teacherCode === code)); return; }
    try { const r = await fetch(`/api/timetable?code=${encodeURIComponent(code)}`, { headers: adminHeaders() }); if (r.ok) { const d = await r.json(); setLectures(d.lectures || []); } } catch {}
  }, [adminHeaders, isDemo]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try { await fetch("/api/timetable/refresh", { method: "POST", headers: adminHeaders() }); setTimeout(() => { fetchCodes(); fetchConfig(); setIsLoading(false); }, 2000); } catch { setIsLoading(false); }
  };

  useEffect(() => { fetchConfig(); fetchCodes(); }, [fetchConfig, fetchCodes]);
  useEffect(() => { if (selectedCode) fetchLectures(selectedCode); else setLectures([]); }, [selectedCode, fetchLectures]);

  // ─── Logic ────────────────────────────────────────────────────────

  const handleSearch = (val: string) => {
    const u = val.toUpperCase().replace(/[^A-Z]/g, "");
    setSearchQuery(u);
    // Also search by name
    const byCode = allCodes.find(c => c.code === u);
    if (byCode) { setSelectedCode(u); setCodesExpanded(false); }
  };
  const handleChip = (code: string) => {
    setSelectedCode(code); setSearchQuery(code); setCollapsedDays(new Set()); setCodesExpanded(false);
  };
  const handleClear = () => {
    setSearchQuery(""); setSelectedCode(null); setCodesExpanded(false);
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

  // Filter codes by search (match code or name)
  const filtered = useMemo(() => {
    if (!searchQuery) return allCodes;
    const q = searchQuery.toLowerCase();
    return allCodes.filter(c => c.code.includes(searchQuery) || getName(c.code).toLowerCase().includes(q));
  }, [allCodes, searchQuery]);

  const MAX = 14;
  const visible = codesExpanded ? filtered : filtered.slice(0, MAX);
  const toggleDay = (d: string) => setCollapsedDays(p => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n; });

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="pb-28">
      {/* Alerts */}
      {isDemo && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <p className="text-[11px] text-amber-600 dark:text-amber-400"><b>Demo</b> — Settings → Time Table to configure</p>
        </div>
      )}
      {apiError && !isDemo && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <p className="text-[11px] text-red-600 dark:text-red-400 truncate">{apiError}</p>
        </div>
      )}

      {/* ═══ Unified Card ═══ */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-2 md:px-4 md:py-2.5 border-b border-slate-100 dark:border-gray-800/40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5277f7] to-[#7c3aed] flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-xs md:text-sm font-bold text-slate-800 dark:text-white">Weekly Schedule</h2>
            {lastLoaded && <span className="text-[8px] text-slate-400 font-mono hidden sm:inline">· {new Date(lastLoaded).toLocaleDateString()}</span>}
          </div>
          <button onClick={handleRefresh} disabled={isLoading} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#5277f7] hover:bg-slate-100 dark:hover:bg-gray-800 transition-all cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#5277f7]" : ""}`} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-2 pb-1.5 md:px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)}
              placeholder="Search by code or name..."
              className="w-full bg-slate-50 dark:bg-gray-900/40 rounded-lg border border-slate-200 dark:border-gray-800 pl-8 pr-8 py-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-[#5277f7] transition-colors"
            />
            {searchQuery && (
              <button onClick={handleClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Chips — HIDDEN when a code is selected */}
        {!selectedCode && (
          <div className="px-3 pb-2.5 md:px-4">
            <button onClick={() => setCodesExpanded(!codesExpanded)} className="flex items-center gap-1 mb-1.5 cursor-pointer group">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${codesExpanded ? "" : "-rotate-90"}`} />
              <span className="text-[9px] font-bold tracking-widest uppercase text-slate-400 font-mono">{allCodes.length} teachers</span>
            </button>
            <div className="flex flex-wrap gap-1">
              {visible.map(c => {
                const name = getName(c.code);
                return (
                  <button key={c.code} onClick={() => handleChip(c.code)}
                    title={name ? `${c.code} — ${name}` : c.code}
                    className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-gray-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-gray-700 active:scale-95 cursor-pointer transition-all"
                  >
                    <span className="font-mono">{c.code}</span>
                    <span className="text-[8px] text-slate-400/70">{c.count}</span>
                  </button>
                );
              })}
              {!codesExpanded && filtered.length > MAX && (
                <button onClick={() => setCodesExpanded(true)} className="px-2 py-1 rounded-md text-[10px] font-bold bg-[#5277f7]/10 text-[#5277f7] cursor-pointer hover:bg-[#5277f7]/20 transition-all">+{filtered.length - MAX}</button>
              )}
              {codesExpanded && filtered.length > MAX && (
                <button onClick={() => setCodesExpanded(false)} className="px-2 py-1 rounded-md text-[10px] font-bold text-slate-400 cursor-pointer hover:text-slate-600">less</button>
              )}
            </div>
          </div>
        )}

        {/* Selected Teacher Strip */}
        {selectedCode && lectures.length > 0 && (
          <div className="border-t border-slate-100 dark:border-gray-800/40 px-3 py-2 md:px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-md bg-[#5277f7] flex items-center justify-center shrink-0">
                  <GraduationCap className="w-3 h-3 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-slate-800 dark:text-white font-mono">{selectedCode}</span>
                    {getName(selectedCode) && (
                      <span className="text-[10px] text-slate-400 truncate hidden sm:inline">· {getName(selectedCode)}</span>
                    )}
                  </div>
                  {getName(selectedCode) && (
                    <p className="text-[9px] text-slate-400 truncate sm:hidden">{getName(selectedCode)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-[10px] text-slate-400 shrink-0">
                <span className="flex items-center gap-0.5"><BookOpen className="w-3 h-3 text-[#5277f7]" />{stats.lecs}</span>
                <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3 text-emerald-500" />{stats.days}d</span>
                <span className="flex items-center gap-0.5 hidden sm:flex"><Layers className="w-3 h-3 text-amber-500" />{stats.batches}</span>
                <span className="flex items-center gap-0.5"><Timer className="w-3 h-3 text-purple-500" />~{stats.hrs}h</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Day Cards ═══ */}
      {selectedCode && lectures.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2">
          {groupedByDay.length > 1 && (
            <div className="flex gap-2 mb-1.5 px-0.5">
              <button onClick={() => setCollapsedDays(new Set())} className="text-[10px] font-bold text-[#5277f7] cursor-pointer hover:underline">Expand All</button>
              <span className="text-slate-300 dark:text-gray-700 text-[10px]">·</span>
              <button onClick={() => setCollapsedDays(new Set(groupedByDay.map(([d]) => d)))} className="text-[10px] font-bold text-[#5277f7] cursor-pointer hover:underline">Collapse All</button>
            </div>
          )}

          <div className="space-y-1.5">
            {groupedByDay.map(([day, { date, lectures: dl }], di) => {
              const col = collapsedDays.has(day);
              return (
                <motion.div key={day} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: di * 0.04 }}
                  className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm overflow-hidden"
                >
                  <button onClick={() => toggleDay(day)}
                    className="w-full flex items-center justify-between px-3 py-2 md:px-4 md:py-2.5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-gray-800/20 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-5 rounded-full ${DAY_DOT[day] || "bg-slate-400"}`} />
                      <span className="text-[11px] md:text-xs font-black text-slate-700 dark:text-slate-200">
                        <span className="md:hidden">{DAY_SHORT[day] || day}</span>
                        <span className="hidden md:inline">{day}</span>
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">{date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-slate-400">{dl.length}</span>
                      <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${col ? "-rotate-90" : ""}`} />
                    </div>
                  </button>

                  <AnimatePresence>
                    {!col && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                        <div className="px-3 pb-2.5 md:px-4 md:pb-3 space-y-1.5">
                          {dl.map((l, li) => (
                            <motion.div key={li} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: li * 0.02 }}
                              className="bg-slate-50/80 dark:bg-gray-900/30 rounded-lg border border-slate-100 dark:border-gray-800/50 px-3 py-2 md:px-3.5 md:py-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Clock className="w-3 h-3 text-[#5277f7] shrink-0" />
                                    <span className="text-[11px] md:text-xs font-bold text-slate-700 dark:text-slate-200 font-mono">{l.startTime} — {l.endTime}</span>
                                  </div>
                                  {l.batches.map((b, bi) => (
                                    <div key={bi} className="flex items-center gap-1.5 ml-[18px]">
                                      <BookOpen className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      <span className="text-[10px] md:text-[11px] text-slate-500 dark:text-slate-400 truncate">{b}</span>
                                    </div>
                                  ))}
                                  {l.rooms.some(r => r) && (
                                    <div className="flex items-center gap-1.5 ml-[18px] mt-0.5">
                                      <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      <span className="text-[9px] text-slate-400 font-mono">{l.rooms.filter(Boolean).join(", ")}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-1 shrink-0 pt-0.5">
                                  {l.isMerged && (
                                    <button onClick={() => setMergeModal(l)} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 cursor-pointer hover:bg-purple-200 transition-colors">🔀</button>
                                  )}
                                  {l.isExtraLecture && (
                                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">⭐</span>
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
      {selectedCode && lectures.length === 0 && !isDemo && (
        <div className="mt-4 text-center py-6">
          <Search className="w-7 h-7 text-slate-300 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-400">No lectures for "{selectedCode}"</p>
        </div>
      )}
      {!selectedCode && !isDemo && allCodes.length > 0 && (
        <div className="mt-4 text-center py-6">
          <GraduationCap className="w-7 h-7 text-slate-300 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Select a teacher code above</p>
        </div>
      )}

      {/* Merge Modal */}
      <AnimatePresence>
        {mergeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setMergeModal(null)}
          >
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()} className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 p-4 max-w-xs w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-white">🔀 Merged — {mergeModal.teacherCode}</h3>
                  {getName(mergeModal.teacherCode) && <p className="text-[9px] text-slate-400">{getName(mergeModal.teacherCode)}</p>}
                </div>
                <button onClick={() => setMergeModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="space-y-1.5">
                {mergeModal.batches.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/20 rounded-lg px-2.5 py-2">
                    <span className="w-4 h-4 rounded-full bg-purple-500 text-white text-[8px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">{b}</p>
                      {mergeModal.rooms[i] && <p className="text-[8px] text-slate-400 font-mono">Room {mergeModal.rooms[i]}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-slate-400 mt-2 text-center font-mono">{mergeModal.startTime} — {mergeModal.endTime} · {mergeModal.day}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
