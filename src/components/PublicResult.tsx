import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Loader2,
  ShieldAlert,
  AlertCircle,
  Trophy,
  Hash,
  TrendingUp,
  GraduationCap,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  BookOpen,
  MapPin,
  Layers,
  CalendarDays,
  Award,
  BarChart3,
  Star,
  CheckCircle2,
  QrCode,
  Download,
  Printer,
  PartyPopper,
  ArrowLeft,
} from "lucide-react";
import QRCode from "qrcode";
import { getDeviceFingerprint } from "../utils/deviceFingerprint";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Profile {
  regNo: string;
  name: string;
  batch: string;
  center: string;
  stream?: string;
  class?: string;
}

interface SubjectScore {
  subject: string;
  score: number | string;
}

interface TestRecord {
  date: string;
  testClass?: string;
  name: string;
  type: string;
  outOf: number | string;
  score: number | string;
  avgScore?: string | number;
  unattempted?: number | string;
  centerRank?: number | string;
  subjectScores?: SubjectScore[];
  stream?: string;
}

interface Student {
  profile: Profile;
  tests: TestRecord[];
}

type PageState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "blocked"; remainingMinutes: number }
  | { kind: "error"; message: string }
  | { kind: "result"; student: Student };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function scoreColor(score: number, outOf: number): string {
  if (outOf <= 0) return "text-slate-300";
  const pct = (score / outOf) * 100;
  if (pct >= 70) return "text-emerald-400";
  if (pct >= 40) return "text-amber-400";
  return "text-rose-400";
}

function parseSafe(v: string | number | undefined): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function formatCountdown(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h, m, s };
}

/* ------------------------------------------------------------------ */
/*  Countdown Timer Hook                                               */
/* ------------------------------------------------------------------ */

function useCountdown(initialMinutes: number) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil(initialMinutes * 60)));

  useEffect(() => {
    setRemaining(Math.max(0, Math.ceil(initialMinutes * 60)));
  }, [initialMinutes]);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining > 0]);

  return formatCountdown(remaining);
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PulsingOrb({ className }: { className?: string }) {
  return (
    <div
      className={`absolute rounded-full blur-3xl opacity-20 animate-pulse-glow pointer-events-none ${className ?? ""}`}
    />
  );
}

function GlassCard({
  children,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/20 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-white/10 text-slate-200 border border-white/5 ${className}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <GlassCard className="p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {label}
          </span>
        </div>
        <p className="text-2xl font-extrabold text-white font-display">{value}</p>
      </GlassCard>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

/* PW Logo — loads real logo from API with fallback */
function PWLogoPublic() {
  const [hasError, setHasError] = React.useState(false);
  return (
    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white shadow-lg shadow-[#5277f7]/30 border border-white/20 flex items-center justify-center shrink-0">
      {!hasError ? (
        <img
          src="/api/logo"
          alt="PW Logo"
          className="w-full h-full object-contain p-1"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#5277f7] to-[#3a56c5] text-white flex items-center justify-center font-bold tracking-tight select-none">
          <span className="text-xl font-black tracking-tighter" style={{ fontFamily: "Space Grotesk, sans-serif" }}>PW</span>
        </div>
      )}
    </div>
  );
}

export default function PublicResult() {
  const [regNo, setRegNo] = useState("");
  const [state, setState] = useState<PageState>({ kind: "idle" });
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  /* Focus input on mount */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* Generate QR code for this page URL */
  useEffect(() => {
    const pageUrl = `${window.location.origin}/result`;
    QRCode.toDataURL(pageUrl, {
      width: 512,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, []);

  /* Search handler */
  const handleSearch = useCallback(async () => {
    const trimmed = regNo.trim();
    if (!trimmed) return;

    setState({ kind: "loading" });

    try {
      const deviceId = await getDeviceFingerprint();

      const res = await fetch("/api/student-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regNo: trimmed, deviceId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState({ kind: "error", message: data.message || "Something went wrong." });
        return;
      }

      if (data.allowed === false) {
        setState({ kind: "blocked", remainingMinutes: data.remainingMinutes ?? 180 });
        return;
      }

      if (data.student) {
        setState({ kind: "result", student: data.student as Student });
        // Show success toast popup
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 4000);
      } else {
        setState({ kind: "error", message: "No results found for this registration number." });
      }
    } catch {
      setState({ kind: "error", message: "Network error. Please check your connection and try again." });
    }
  }, [regNo]);

  const toggleRow = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  /* Compute summary stats */
  const stats =
    state.kind === "result"
      ? (() => {
          const tests = state.student.tests;
          const total = tests.length;
          const validScores = tests
            .map((t) => {
              const s = parseSafe(t.score);
              const o = parseSafe(t.outOf);
              return o > 0 ? (s / o) * 100 : null;
            })
            .filter((x): x is number => x !== null);
          const avg = validScores.length > 0
            ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
            : "–";
          const ranks = tests
            .map((t) => parseSafe(t.centerRank))
            .filter((r) => r > 0);
          const bestRank = ranks.length > 0 ? Math.min(...ranks) : "–";
          return { total, avg, bestRank };
        })()
      : null;

  return (
    <div className="dark min-h-[100dvh] bg-gradient-to-br from-slate-950 via-indigo-950/80 to-slate-900 relative overflow-x-hidden font-sans">
      {/* Ambient orbs */}
      <PulsingOrb className="w-96 h-96 bg-indigo-600 -top-40 -left-40" />
      <PulsingOrb className="w-80 h-80 bg-[#5277f7] top-1/3 -right-32" />
      <PulsingOrb className="w-64 h-64 bg-violet-700 bottom-20 left-1/4" />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-100 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-[100dvh]">
        {/* Header */}
        <header className="pt-8 pb-4 px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-3"
          >
            {/* Real PW Logo */}
            <PWLogoPublic />
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-white font-display tracking-tight">
                Student Result Portal
              </h1>
              <p className="text-[11px] text-slate-400 mt-1 font-medium tracking-wide">
                PW Vidyapeeth Pune &middot; Academic Results
              </p>
            </div>
          </motion.div>
        </header>

        {/* Main */}
        <main className="flex-1 flex flex-col items-center px-4 pb-8">
          <AnimatePresence mode="wait">
          {/* Search Card — only visible when NOT showing result */}
          {state.kind !== "result" && (
            <motion.div
              key="search-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-lg mt-4"
            >
              <GlassCard className="p-6 md:p-8">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-[#5277f7]/15 flex items-center justify-center">
                    <Search className="w-4.5 h-4.5 text-[#5277f7]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Search Result</h2>
                    <p className="text-[10px] text-slate-500">
                      Enter your registration number to view results
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={regNo}
                      onChange={(e) => setRegNo(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Enter Your Registration Number"
                      className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#5277f7]/50 focus:border-[#5277f7]/50 transition-all"
                      disabled={state.kind === "loading"}
                    />
                    {regNo && (
                      <button
                        onClick={() => setRegNo("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleSearch}
                    disabled={state.kind === "loading" || !regNo.trim()}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#5277f7] to-indigo-500 hover:from-[#4062dd] hover:to-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#5277f7]/20 active:scale-[0.98]"
                  >
                    {state.kind === "loading" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        View Result
                      </>
                    )}
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Back to Search button — only when result is shown */}
          {state.kind === "result" && (
            <motion.div
              key="back-button"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-lg mt-4"
            >
              <button
                onClick={() => { setState({ kind: "idle" }); setRegNo(""); }}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-bold cursor-pointer group mb-2"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Back to Search
              </button>
            </motion.div>
          )}
          </AnimatePresence>

          {/* Results Area */}
          <AnimatePresence mode="wait">
            {/* Blocked State */}
            {state.kind === "blocked" && (
              <div key="blocked">
                <BlockedCard remainingMinutes={state.remainingMinutes} />
              </div>
            )}

            {/* Error State */}
            {state.kind === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-lg mt-6"
              >
                <GlassCard className="p-6 border-rose-500/20">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-rose-400">Result Not Found</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {state.message}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )}

            {/* Result State */}
            {state.kind === "result" && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-4xl mt-6 space-y-5"
              >
                {/* Profile Card */}
                <GlassCard className="p-5 md:p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5277f7] to-indigo-500 flex items-center justify-center shrink-0 shadow-lg shadow-[#5277f7]/25">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg md:text-xl font-extrabold text-white font-display truncate">
                        {state.student.profile.name}
                      </h2>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Reg. No: {state.student.profile.regNo}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge>
                          <BookOpen className="w-3 h-3" />
                          {state.student.profile.batch}
                        </Badge>
                        <Badge>
                          <MapPin className="w-3 h-3" />
                          {state.student.profile.center}
                        </Badge>
                        {state.student.profile.stream && (
                          <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/20">
                            <Layers className="w-3 h-3" />
                            {state.student.profile.stream}
                          </Badge>
                        )}
                        {state.student.profile.class && (
                          <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/20">
                            <GraduationCap className="w-3 h-3" />
                            Class {state.student.profile.class}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Stats Row */}
                {stats && (
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard
                      icon={BarChart3}
                      label="Exams"
                      value={stats.total}
                      accent="bg-[#5277f7]/15 text-[#5277f7]"
                    />
                    <StatCard
                      icon={Trophy}
                      label="Best Rank"
                      value={stats.bestRank}
                      accent="bg-amber-500/15 text-amber-400"
                    />
                    <StatCard
                      icon={TrendingUp}
                      label="Avg %"
                      value={stats.avg === "–" ? "–" : `${stats.avg}%`}
                      accent="bg-emerald-500/15 text-emerald-400"
                    />
                  </div>
                )}

                {/* Tests Table */}
                <GlassCard className="overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#5277f7]/15 flex items-center justify-center">
                      <Award className="w-4 h-4 text-[#5277f7]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Academic Assessment</h3>
                      <p className="text-[10px] text-slate-500">
                        Complete examination history
                      </p>
                    </div>
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-10">
                            #
                          </th>
                          <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[80px]">
                            Date
                          </th>
                          <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[200px]">
                            Test Name
                          </th>
                          <th className="text-center py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Max
                          </th>
                          <th className="text-center py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Score
                          </th>
                          <th className="text-center py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[140px]">
                            Subjects
                          </th>
                          <th className="text-center py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Rank
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.student.tests.map((test, idx) => {
                          const s = parseSafe(test.score);
                          const o = parseSafe(test.outOf);
                          return (
                            <tr
                              key={idx}
                              className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors"
                            >
                              <td className="py-3 px-4 text-slate-500 font-mono text-[10px]">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                                {test.date || "–"}
                              </td>
                              <td className="py-3 px-4">
                                <p className="text-white font-semibold text-[11px] leading-snug">
                                  {test.name}
                                </p>
                                {test.testClass && (
                                  <p className="text-[9px] text-slate-500 mt-0.5">
                                    {test.testClass}
                                  </p>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center text-slate-300 font-mono">
                                {o || "–"}
                              </td>
                              <td className={`py-3 px-4 text-center font-bold font-mono ${scoreColor(s, o)}`}>
                                {s || "–"}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {test.subjectScores && test.subjectScores.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {test.subjectScores.map((sub, si) => (
                                      <span
                                        key={si}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-slate-300"
                                      >
                                        <span className="text-slate-500">{sub.subject}:</span>
                                        <span className="font-bold font-mono">{sub.score}</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-600">–</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {parseSafe(test.centerRank) > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold text-[10px] font-mono">
                                    <Star className="w-2.5 h-2.5" />
                                    {test.centerRank}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">–</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-white/[0.04]">
                    {state.student.tests.map((test, idx) => {
                      const s = parseSafe(test.score);
                      const o = parseSafe(test.outOf);
                      const isExpanded = expandedRows.has(idx);
                      const hasSubjects = test.subjectScores && test.subjectScores.length > 0;

                      return (
                        <div
                          key={idx}
                          className="px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
                        >
                          <div
                            className="flex items-start justify-between gap-3 cursor-pointer"
                            onClick={() => (hasSubjects ? toggleRow(idx) : undefined)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] font-mono text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">
                                  #{idx + 1}
                                </span>
                                {test.date && (
                                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                    <CalendarDays className="w-2.5 h-2.5" />
                                    {test.date}
                                  </span>
                                )}
                              </div>
                              <p className="text-[12px] text-white font-semibold leading-snug">
                                {test.name}
                              </p>
                              {test.testClass && (
                                <p className="text-[9px] text-slate-500 mt-0.5">
                                  {test.testClass}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`text-sm font-extrabold font-mono ${scoreColor(s, o)}`}>
                                {s || "–"}
                                <span className="text-[10px] text-slate-500 font-normal">
                                  /{o || "–"}
                                </span>
                              </span>
                              {parseSafe(test.centerRank) > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-400 font-mono">
                                  <Star className="w-2.5 h-2.5" />
                                  Rank {test.centerRank}
                                </span>
                              )}
                              {hasSubjects && (
                                isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                )
                              )}
                            </div>
                          </div>

                          {/* Expanded subjects */}
                          <AnimatePresence>
                            {isExpanded && hasSubjects && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-white/5">
                                  {test.subjectScores!.map((sub, si) => (
                                    <span
                                      key={si}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 text-[10px] text-slate-300 border border-white/5"
                                    >
                                      <span className="text-slate-500">{sub.subject}</span>
                                      <span className="font-bold font-mono">{sub.score}</span>
                                    </span>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>

                  {state.student.tests.length === 0 && (
                    <div className="py-12 text-center">
                      <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No examination records found.</p>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* QR Code Section — for staff to print/share */}
        {state.kind === "idle" && qrDataUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="w-full max-w-lg mt-6 px-4 mx-auto"
          >
            <GlassCard className="p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#5277f7]/15 flex items-center justify-center">
                  <QrCode className="w-4 h-4 text-[#5277f7]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Share with Students</h3>
                  <p className="text-[10px] text-slate-500">Print this QR or share the link for student access</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* QR Image */}
                <div className="bg-white rounded-2xl p-3 shadow-lg shadow-black/20 shrink-0">
                  <img src={qrDataUrl} alt="Result Page QR" className="w-36 h-36 sm:w-40 sm:h-40" />
                </div>

                <div className="flex flex-col gap-3 flex-1 w-full">
                  {/* URL display */}
                  <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Page Link</p>
                    <p className="text-xs text-[#5277f7] font-mono break-all select-all">
                      {window.location.origin}/result
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/result`);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[11px] font-bold text-slate-300 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Copy Link
                    </button>
                    <button
                      onClick={() => {
                        const printWin = window.open('', '_blank');
                        if (printWin) {
                          printWin.document.write(`
                            <!DOCTYPE html>
                            <html>
                            <head><title>PW Vidyapeeth - Result QR</title>
                            <style>
                              body { font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fff; color: #0f172a; }
                              .card { border: 3px solid #0f172a; border-radius: 24px; padding: 40px; text-align: center; max-width: 400px; }
                              .logo { font-size: 32px; font-weight: 900; color: #5277f7; margin-bottom: 8px; letter-spacing: -1px; }
                              .subtitle { font-size: 14px; color: #64748b; margin-bottom: 24px; }
                              .qr { width: 280px; height: 280px; margin: 0 auto 20px; }
                              .url { font-family: monospace; font-size: 13px; color: #5277f7; background: #f1f5f9; padding: 10px 16px; border-radius: 12px; word-break: break-all; }
                              .instructions { margin-top: 20px; font-size: 13px; color: #475569; line-height: 1.6; }
                              .step { display: flex; align-items: flex-start; gap: 8px; text-align: left; margin-top: 8px; }
                              .step-num { background: #5277f7; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
                              @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                            </style></head>
                            <body>
                              <div class="card">
                                <div class="logo">PW Vidyapeeth Pune</div>
                                <div class="subtitle">Student Result Portal</div>
                                <img src="${qrDataUrl}" class="qr" alt="QR Code" />
                                <div class="url">${window.location.origin}/result</div>
                                <div class="instructions">
                                  <strong>How to check your result:</strong>
                                  <div class="step"><span class="step-num">1</span><span>Scan QR code or open the link above</span></div>
                                  <div class="step"><span class="step-num">2</span><span>Enter your Registration Number</span></div>
                                  <div class="step"><span class="step-num">3</span><span>View your exam results instantly</span></div>
                                </div>
                              </div>
                            </body></html>
                          `);
                          printWin.document.close();
                          setTimeout(() => printWin.print(), 500);
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#5277f7]/20 hover:bg-[#5277f7]/30 border border-[#5277f7]/30 rounded-xl text-[11px] font-bold text-[#5277f7] transition-all cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print QR
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Footer */}
        <footer className="py-5 text-center">
          <p className="text-[10px] text-slate-600 font-medium tracking-wide">
            Powered by <span className="text-slate-400">PW Vidyapeeth Pune</span>
          </p>
        </footer>
      </div>

      {/* Success Toast Popup */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 bg-emerald-600/95 backdrop-blur-xl text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-emerald-900/40 border border-emerald-400/20">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Result Found!</p>
                <p className="text-[10px] opacity-80 font-medium">Scroll down to view your complete exam report</p>
              </div>
              <PartyPopper className="w-5 h-5 opacity-60 shrink-0" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Blocked Card (extracted for countdown hook)                        */
/* ------------------------------------------------------------------ */

function BlockedCard({ remainingMinutes }: { remainingMinutes: number }) {
  const { h, m, s } = useCountdown(remainingMinutes);

  return (
    <motion.div
      key="blocked"
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-lg mt-6"
    >
      <GlassCard className="p-6 border-amber-500/20">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-400">Device Restricted</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              You have already viewed a result on this device. Please wait for the cooldown
              period to expire before searching again.
            </p>
          </div>
        </div>

        {/* Countdown */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Time Remaining
            </span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <CountdownUnit value={h} label="Hours" />
            <span className="text-xl font-bold text-slate-600 -mt-4">:</span>
            <CountdownUnit value={m} label="Min" />
            <span className="text-xl font-bold text-slate-600 -mt-4">:</span>
            <CountdownUnit value={s} label="Sec" />
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-14 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
        <span className="text-2xl font-extrabold text-white font-mono tabular-nums">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-1.5">
        {label}
      </span>
    </div>
  );
}
