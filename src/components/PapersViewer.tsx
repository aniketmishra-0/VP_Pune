import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  RefreshCw,
  FileText,
  ExternalLink,
  ChevronDown,
  Calendar,
  Layers,
  GraduationCap,
  Download,
  AlertCircle,
  X,
  Copy,
  Check,
  Folder,
  FolderOpen,
} from "lucide-react";

interface PaperLink {
  name: string;
  url: string;
}

interface PaperRow {
  date: string;
  class: string;
  phase: string;
  stream: string;
  testName: string;
  questionPapers: PaperLink[];
  answerKeys: PaperLink[];
}

interface PaperTab {
  name: string;
  rows: PaperRow[];
}

interface PapersViewerProps {
  adminHeaders: () => Record<string, string>;
}

const normalizeClass = (rawClass: string): string => {
  const text = (rawClass || "").trim().toLowerCase();
  if (!text) return "";
  
  // Droppers / Repeaters
  if (text.includes("dropper") || text.includes("prayas") || text.includes("yakeen") || text.includes("repeater")) {
    return "Dropper";
  }
  
  // 12th Class
  if (text.includes("12") || text.includes("lakshya") || text.includes("second year")) {
    return "12th";
  }
  
  // 11th Class
  if (text.includes("11") || text.includes("arjuna") || text.includes("first year")) {
    return "11th";
  }
  
  // 10th Class
  if (text.includes("10") || text.includes("pegasus")) {
    return "10th";
  }
  
  // 9th Class
  if (text.includes("9")) {
    return "9th";
  }
  
  // 8th Class
  if (text.includes("8")) {
    return "8th";
  }

  // Fallback: title-case the string nicely
  return rawClass.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

const normalizeStream = (rawStream: string, rawClass: string = ""): string => {
  const s = (rawStream || "").toLowerCase();
  const c = (rawClass || "").toLowerCase();
  
  if (s.includes("jee") || s.includes("iit") || c.includes("jee") || c.includes("prayas") || c.includes("arjuna j") || c.includes("lakshya j")) {
    return "JEE";
  }
  if (s.includes("neet") || s.includes("yakeen") || c.includes("neet") || c.includes("yakeen") || c.includes("arjuna n") || c.includes("lakshya n")) {
    return "NEET";
  }
  
  const trimmed = rawStream.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

export default function PapersViewer({ adminHeaders }: PapersViewerProps) {
  const [papersData, setPapersData] = useState<PaperTab[]>([]);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [availableSheets, setAvailableSheets] = useState<Array<{ name: string; url: string }>>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("");
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedStream, setSelectedStream] = useState<string>("all");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");

  // Preview and copy states
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string; type: "QP" | "AK" } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeDropdown, setActiveDropdown] = useState<{ idx: number; type: "QP" | "AK" } | null>(null);

  // Handle back gesture to close modal
  useEffect(() => {
    if (!previewDoc) return;

    // Push dummy history state to intercept back button
    window.history.pushState({ modal: "previewDoc" }, "");

    const handlePopState = () => {
      setPreviewDoc(null);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (window.history.state?.modal === "previewDoc") {
        window.history.back();
      }
    };
  }, [previewDoc]);

  // Fetch Papers
  const getEmbedUrl = useCallback((url: string): string => {
    if (!url) return "";
    
    // Google Drive file
    const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/i);
    if (driveFileMatch) {
      return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
    }
    
    // Google Drive open?id=
    const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9-_]+)/i);
    if (driveOpenMatch) {
      return `https://drive.google.com/file/d/${driveOpenMatch[1]}/preview`;
    }
    
    // Google Docs
    const docsMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/i);
    if (docsMatch) {
      return `https://docs.google.com/document/d/${docsMatch[1]}/preview`;
    }

    // Google Sheets
    const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
    if (sheetsMatch) {
      return `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/preview`;
    }

    return url;
  }, []);

  const isFolderUrl = useCallback((url: string): boolean => {
    if (!url) return false;
    return url.includes("drive.google.com") && url.includes("/folders/");
  }, []);

  const handleCopyLink = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const fetchPapers = useCallback(async (isRefresh = false, targetSheet = selectedSheetName) => {
    if (isRefresh) {
      setIsSyncing(true);
      setSyncNotice(null);
    } else {
      setIsLoading(true);
    }
    setApiError(null);

    try {
      const url = isRefresh 
        ? "/api/papers/refresh" 
        : `/api/papers?sheet=${encodeURIComponent(targetSheet)}`;
      const method = isRefresh ? "POST" : "GET";
      const body = isRefresh ? JSON.stringify({ sheet: targetSheet }) : undefined;
      const headers: Record<string, string> = {
        ...adminHeaders(),
      };
      if (isRefresh) {
        headers["Content-Type"] = "application/json";
      }

      const res = await fetch(url, {
        method,
        headers,
        body,
      });

      if (!res.ok) {
        let errMsg = `Server returned status ${res.status}`;
        try {
          const data = await res.json();
          if (data && data.error) errMsg = data.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (isRefresh) {
        setSyncNotice(`Refreshed sheet successfully!`);
        setTimeout(() => setSyncNotice(null), 4000);
        // Refresh again to pull fresh data
        await fetchPapers(false, targetSheet);
      } else {
        setPapersData(data.papers || []);
        setLastLoaded(data.lastLoaded || null);
        setApiError(data.error || null);
        setAvailableSheets(data.sheets || []);
        setSelectedSheetName(data.currentSheet || "");
        setServiceAccountEmail(data.serviceAccountEmail || null);
      }
    } catch (err: any) {
      console.error("[PapersViewer] Error fetching:", err);
      setApiError(err.message || "Failed to load papers.");
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [adminHeaders, selectedSheetName]);

  useEffect(() => {
    fetchPapers(false, "");
  }, []);

  // Flattened papers list
  const allPapers = useMemo(() => {
    const list: Array<PaperRow & { tabName: string }> = [];
    papersData.forEach((tab) => {
      tab.rows.forEach((row) => {
        list.push({ ...row, tabName: tab.name });
      });
    });
    return list;
  }, [papersData]);

  // Extract unique metadata for filter options
  const filterOptions = useMemo(() => {
    const tabs = new Set<string>();
    const classes = new Set<string>();
    const streams = new Set<string>();
    const phases = new Set<string>();

    allPapers.forEach((p) => {
      if (p.tabName) tabs.add(p.tabName);
      if (p.class) {
        const normCls = normalizeClass(p.class);
        if (normCls) classes.add(normCls);
      }
      if (p.stream) {
        const normSt = normalizeStream(p.stream, p.class);
        if (normSt) streams.add(normSt);
      }
      if (p.phase) phases.add(p.phase);
    });

    const classOrder = ["8th", "9th", "10th", "11th", "12th", "Dropper"];
    const sortedClasses = Array.from(classes).sort((a, b) => {
      const idxA = classOrder.indexOf(a);
      const idxB = classOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const streamOrder = ["JEE", "NEET"];
    const sortedStreams = Array.from(streams).sort((a, b) => {
      const idxA = streamOrder.indexOf(a);
      const idxB = streamOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return {
      tabs: Array.from(tabs).sort(),
      classes: sortedClasses,
      streams: sortedStreams,
      phases: Array.from(phases).sort(),
    };
  }, [allPapers]);

  // Filtered papers list
  const filteredPapers = useMemo(() => {
    return allPapers.filter((paper) => {
      const matchesSearch =
        !searchQuery ||
        paper.testName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        paper.class.toLowerCase().includes(searchQuery.toLowerCase()) ||
        paper.stream.toLowerCase().includes(searchQuery.toLowerCase()) ||
        paper.date.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTab = selectedTab === "all" || paper.tabName === selectedTab;
      const matchesClass = selectedClass === "all" || normalizeClass(paper.class) === selectedClass;
      const matchesStream = selectedStream === "all" || normalizeStream(paper.stream, paper.class) === selectedStream;
      const matchesPhase = selectedPhase === "all" || paper.phase === selectedPhase;

      return matchesSearch && matchesTab && matchesClass && matchesStream && matchesPhase;
    });
  }, [allPapers, searchQuery, selectedTab, selectedClass, selectedStream, selectedPhase]);

  // Badge styles mapping
  const getStreamBadgeStyle = (stream: string, cls: string = "") => {
    const norm = normalizeStream(stream, cls);
    if (norm === "JEE") {
      return "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30";
    }
    if (norm === "NEET") {
      return "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-100 dark:border-rose-900/30";
    }
    return "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300 border border-slate-200/40 dark:border-slate-800/30";
  };

  const getClassBadgeStyle = (cls: string) => {
    const norm = normalizeClass(cls);
    if (norm === "12th") {
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30";
    }
    if (norm === "11th") {
      return "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30";
    }
    if (norm === "Dropper") {
      return "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-100 dark:border-amber-900/30";
    }
    return "bg-slate-50 text-slate-600 dark:bg-gray-800 dark:text-gray-300";
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#111827] p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#5277f7] dark:text-blue-400" />
            Test Papers & Answer Keys
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">
            View, search, and download question papers and answer keys parsed from the Google Sheet.
          </p>
        </div>
      </div>

      {/* Sync Notification Banner */}
      <AnimatePresence>
        {syncNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-300 rounded-xl text-xs font-medium"
          >
            {syncNotice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Alert */}
      {apiError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider">Sync Error</h4>
            <p className="text-xs leading-relaxed">{apiError}</p>
            <p className="text-[10px] opacity-80 mt-1 leading-relaxed">
              Please check if the sheet is shared as <strong>"Anyone with the link can view"</strong> (Viewer) or shared with your Google service account email: <strong className="select-all underline bg-rose-100/40 dark:bg-rose-950/40 px-1 py-0.5 rounded">{serviceAccountEmail || "loading..."}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search papers by test name, class, stream, or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-950 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5277f7] placeholder-slate-400 transition-all font-medium"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {/* Year of Paper Filter */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Year of Paper</label>
            <div className="relative">
              <select
                value={selectedSheetName}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSheetName(val);
                  fetchPapers(false, val);
                }}
                className="w-full p-2.5 pr-8 text-xs rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-950 text-slate-800 dark:text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#5277f7] font-medium"
              >
                {availableSheets.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-3.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Category/Tab Filter */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Category Tab</label>
            <div className="relative">
              <select
                value={selectedTab}
                onChange={(e) => setSelectedTab(e.target.value)}
                className="w-full p-2.5 pr-8 text-xs rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-950 text-slate-800 dark:text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#5277f7] font-medium"
              >
                <option value="all">All Categories</option>
                {filterOptions.tabs.map((tab) => (
                  <option key={tab} value={tab}>
                    {tab}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-3.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Class Filter */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Class</label>
            <div className="relative">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full p-2.5 pr-8 text-xs rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-950 text-slate-800 dark:text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#5277f7] font-medium"
              >
                <option value="all">All Classes</option>
                {filterOptions.classes.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-3.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Stream Filter */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Stream</label>
            <div className="relative">
              <select
                value={selectedStream}
                onChange={(e) => setSelectedStream(e.target.value)}
                className="w-full p-2.5 pr-8 text-xs rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-950 text-slate-800 dark:text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#5277f7] font-medium"
              >
                <option value="all">All Streams</option>
                {filterOptions.streams.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-3.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Phase Filter */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Phase</label>
            <div className="relative">
              <select
                value={selectedPhase}
                onChange={(e) => setSelectedPhase(e.target.value)}
                className="w-full p-2.5 pr-8 text-xs rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-950 text-slate-800 dark:text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#5277f7] font-medium"
              >
                <option value="all">All Phases</option>
                {filterOptions.phases.map((ph) => (
                  <option key={ph} value={ph}>
                    Phase {ph}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-3.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="w-8 h-8 text-[#5277f7] animate-spin" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading papers index...</p>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-3xl p-12 text-center shadow-sm">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">No Papers Found</h3>
          <p className="text-xs text-slate-400 dark:text-gray-500 max-w-md mx-auto">
            We couldn't find any test papers matching your query or filter criteria. Try adjusting your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Count Header */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-gray-500 font-semibold px-1">
            <span>SHOWING {filteredPapers.length} OF {allPapers.length} PAPERS</span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-gray-800/30 border-b border-slate-100 dark:border-gray-800/50 text-[10px] tracking-wider uppercase font-bold text-slate-400">
                    <th className="p-4 pl-6">Date</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Test Name</th>
                    <th className="p-4">Target Class</th>
                    <th className="p-4 text-center">QP Link</th>
                    <th className="p-4 text-center">AK Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800/50">
                  {filteredPapers.map((paper, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/40 dark:hover:bg-gray-800/10 transition-colors"
                    >
                      {/* Date */}
                      <td className="p-4 pl-6 font-medium text-slate-500 dark:text-gray-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {paper.date}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-4">
                        <span className="font-semibold text-slate-700 dark:text-slate-350">
                          {paper.tabName}
                        </span>
                      </td>

                      {/* Test Name */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <span className="font-bold text-slate-800 dark:text-white">
                            {paper.testName}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {paper.stream && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getStreamBadgeStyle(paper.stream, paper.class)}`}>
                                {paper.stream}
                              </span>
                            )}
                            {paper.phase && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-350 border border-slate-200/20">
                                Phase {paper.phase}
                              </span>
                            )}
                            {selectedSheetName && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-100/20 uppercase">
                                {selectedSheetName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Target Class */}
                      <td className="p-4">
                        {paper.class ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getClassBadgeStyle(paper.class)}`}>
                            {paper.class}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Question Paper Action */}
                      <td className="p-4 text-center relative">
                        {paper.questionPapers && paper.questionPapers.length > 0 ? (
                          paper.questionPapers.length === 1 ? (
                            <button
                              onClick={() => setPreviewDoc({ title: `${paper.testName} - Question Paper`, url: paper.questionPapers[0].url, type: "QP" })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-[#5277f7] text-blue-600 hover:text-white dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white rounded-lg font-bold transition-all cursor-pointer shadow-sm border border-blue-100/20"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Open
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          ) : (
                            <div className="inline-block relative">
                              <button
                                onClick={() => setActiveDropdown(activeDropdown?.idx === idx && activeDropdown?.type === "QP" ? null : { idx, type: "QP" })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-[#5277f7] text-blue-600 hover:text-white dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white rounded-lg font-bold transition-all cursor-pointer shadow-sm border border-blue-100/20"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Open ({paper.questionPapers.length})
                                <ChevronDown className="w-3 h-3 opacity-60" />
                              </button>
                              
                              {activeDropdown?.idx === idx && activeDropdown?.type === "QP" && (
                                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#1f2937] rounded-xl shadow-xl border border-slate-200/50 dark:border-gray-700 z-50 py-1 overflow-hidden">
                                  {paper.questionPapers.map((link, lIdx) => (
                                    <button
                                      key={lIdx}
                                      onClick={() => {
                                        setPreviewDoc({ title: `${paper.testName} - ${link.name || `QP ${lIdx + 1}`}`, url: link.url, type: "QP" });
                                        setActiveDropdown(null);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-700 dark:text-slate-200 font-semibold transition-colors flex items-center gap-1.5"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                      <span className="truncate">{link.name || `QP ${lIdx + 1}`}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-350 font-bold bg-slate-50 dark:bg-gray-800/10 px-2 py-1 rounded border border-slate-100 dark:border-gray-800/20 select-none">
                            Unavailable
                          </span>
                        )}
                      </td>

                      {/* Answer Key Action */}
                      <td className="p-4 text-center relative">
                        {paper.answerKeys && paper.answerKeys.length > 0 ? (
                          paper.answerKeys.length === 1 ? (
                            <button
                              onClick={() => setPreviewDoc({ title: `${paper.testName} - Answer Key`, url: paper.answerKeys[0].url, type: "AK" })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white rounded-lg font-bold transition-all cursor-pointer shadow-sm border border-emerald-100/20"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Open
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          ) : (
                            <div className="inline-block relative">
                              <button
                                onClick={() => setActiveDropdown(activeDropdown?.idx === idx && activeDropdown?.type === "AK" ? null : { idx, type: "AK" })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white rounded-lg font-bold transition-all cursor-pointer shadow-sm border border-emerald-100/20"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Open ({paper.answerKeys.length})
                                <ChevronDown className="w-3 h-3 opacity-60" />
                              </button>
                              
                              {activeDropdown?.idx === idx && activeDropdown?.type === "AK" && (
                                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#1f2937] rounded-xl shadow-xl border border-slate-200/50 dark:border-gray-700 z-50 py-1 overflow-hidden">
                                  {paper.answerKeys.map((link, lIdx) => (
                                    <button
                                      key={lIdx}
                                      onClick={() => {
                                        setPreviewDoc({ title: `${paper.testName} - ${link.name || `AK ${lIdx + 1}`}`, url: link.url, type: "AK" });
                                        setActiveDropdown(null);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-700 dark:text-slate-200 font-semibold transition-colors flex items-center gap-1.5"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                      <span className="truncate">{link.name || `AK ${lIdx + 1}`}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-350 font-bold bg-slate-50 dark:bg-gray-800/10 px-2 py-1 rounded border border-slate-100 dark:border-gray-800/20 select-none">
                            Unavailable
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card Layout View */}
          <div className="md:hidden space-y-3">
            {filteredPapers.map((paper, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                      {paper.tabName}
                    </span>
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                      {paper.testName}
                    </h3>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {paper.class && (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getClassBadgeStyle(paper.class)}`}>
                        {paper.class}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-450 dark:text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {paper.date}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {paper.stream && (
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${getStreamBadgeStyle(paper.stream, paper.class)}`}>
                      {paper.stream}
                    </span>
                  )}
                  {paper.phase && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-350 border border-slate-200/20">
                      Phase {paper.phase}
                    </span>
                  )}
                  {selectedSheetName && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-100/20 uppercase">
                      {selectedSheetName}
                    </span>
                  )}
                </div>

                <hr className="border-slate-100 dark:border-gray-800/30" />

                <div className="grid grid-cols-2 gap-3 pt-0.5 items-start">
                  {/* QP links container */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Question Papers</span>
                    {paper.questionPapers && paper.questionPapers.length > 0 ? (
                      paper.questionPapers.map((link, lIdx) => (
                        <button
                          key={lIdx}
                          onClick={() => setPreviewDoc({ title: `${paper.testName} - ${link.name || `QP ${lIdx + 1}`}`, url: link.url, type: "QP" })}
                          className="flex items-center justify-center gap-1 py-2 px-2 bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-300 rounded-xl font-bold text-[10px] border border-blue-100/10 cursor-pointer transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{link.name || `QP ${lIdx + 1}`}</span>
                        </button>
                      ))
                    ) : (
                      <div className="flex items-center justify-center py-2 bg-slate-50 dark:bg-gray-800/10 text-slate-350 dark:text-slate-600 rounded-xl font-bold text-[10px] border border-slate-100 dark:border-gray-800/20 select-none">
                        Unavailable
                      </div>
                    )}
                  </div>

                  {/* AK links container */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Answer Keys</span>
                    {paper.answerKeys && paper.answerKeys.length > 0 ? (
                      paper.answerKeys.map((link, lIdx) => (
                        <button
                          key={lIdx}
                          onClick={() => setPreviewDoc({ title: `${paper.testName} - ${link.name || `AK ${lIdx + 1}`}`, url: link.url, type: "AK" })}
                          className="flex items-center justify-center gap-1 py-2 px-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-300 rounded-xl font-bold text-[10px] border border-emerald-100/10 cursor-pointer transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{link.name || `AK ${lIdx + 1}`}</span>
                        </button>
                      ))
                    ) : (
                      <div className="flex items-center justify-center py-2 bg-slate-50 dark:bg-gray-800/10 text-slate-350 dark:text-slate-600 rounded-xl font-bold text-[10px] border border-slate-100 dark:border-gray-800/20 select-none">
                        Unavailable
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF Inline Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm no-print"
          >
            {/* Backdrop click to close */}
            <div
              className="absolute inset-0 cursor-default"
              onClick={() => setPreviewDoc(null)}
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`relative w-full bg-white dark:bg-[#111827] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/50 dark:border-gray-800/40 z-10 transition-all duration-300 ${
                isFolderUrl(previewDoc.url)
                  ? "max-w-md h-auto mx-4 my-auto md:mx-auto"
                  : "max-w-md h-auto mx-4 my-auto md:max-w-6xl md:h-[85vh] md:mx-auto"
              }`}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-gray-800/50 bg-slate-50/50 dark:bg-gray-900/20">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className={`w-5 h-5 shrink-0 ${previewDoc.type === "QP" ? "text-blue-500" : "text-emerald-500"}`} />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                      {previewDoc.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-gray-500 font-medium truncate select-all mt-0.5">
                      Source Link: {previewDoc.url}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden md:flex items-center gap-2">
                    {!isFolderUrl(previewDoc.url) && (
                      <>
                        <button
                          onClick={() => handleCopyLink(previewDoc.url)}
                          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                          title="Copy direct Google Drive URL"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-500" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy Link
                            </>
                          )}
                        </button>

                        <a
                          href={previewDoc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-[#5277f7] hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                          title="Open full document in a new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open Tab
                        </a>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
                    title="Close preview"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body (IFrame Preview or Folder View) */}
              <div className={`flex-1 bg-slate-50 dark:bg-gray-950 p-4 relative ${
                isFolderUrl(previewDoc.url)
                  ? "flex items-center justify-center min-h-[300px]"
                  : "flex md:block items-center justify-center min-h-[300px] md:min-h-0"
              }`}>
                {isFolderUrl(previewDoc.url) ? (
                  <div className="w-full flex flex-col items-center text-center p-4">
                    <div className="relative mb-5">
                      {/* Decorative glowing background */}
                      <div className="absolute inset-0 bg-[#5277f7]/10 dark:bg-blue-500/10 rounded-full blur-2xl w-20 h-20 -translate-x-2 -translate-y-2" />
                      
                      <div className="relative w-16 h-16 bg-blue-50 dark:bg-blue-950/40 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-900/30">
                        <FolderOpen className="w-8 h-8 text-[#5277f7] dark:text-blue-400" />
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2">
                      Google Drive Folder
                    </h3>
                    
                    <p className="text-xs text-slate-500 dark:text-gray-400 max-w-sm mb-6 leading-relaxed">
                      This link contains a folder with multiple papers or files. Due to security restrictions, folders cannot be previewed directly inside the application.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
                      <a
                        href={previewDoc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-[#5277f7] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open Folder
                      </a>
                      
                      <button
                        onClick={() => handleCopyLink(previewDoc.url)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-white hover:bg-slate-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-250 rounded-xl text-xs font-bold border border-slate-200/50 dark:border-gray-700 transition-all cursor-pointer active:scale-95"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy Link
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Desktop View: IFrame */}
                    <div className="hidden md:block w-full h-full">
                      <iframe
                        src={getEmbedUrl(previewDoc.url)}
                        className="w-full h-full border-0 rounded-2xl bg-white dark:bg-[#111827] shadow-inner"
                        allow="autoplay"
                        title="PDF Preview"
                      />
                    </div>

                    {/* Mobile View: File Preview Card */}
                    <div className="block md:hidden w-full flex flex-col items-center text-center p-4">
                      <div className="relative mb-5">
                        {/* Decorative glowing background */}
                        <div className="absolute inset-0 bg-[#5277f7]/10 dark:bg-blue-500/10 rounded-full blur-2xl w-20 h-20 -translate-x-2 -translate-y-2" />
                        
                        <div className="relative w-16 h-16 bg-blue-50 dark:bg-blue-950/40 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-900/30">
                          <FileText className={`w-8 h-8 ${previewDoc.type === "QP" ? "text-blue-500" : "text-emerald-500"}`} />
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2">
                        PDF Document Preview
                      </h3>
                      
                      <p className="text-xs text-slate-500 dark:text-gray-400 max-w-sm mb-6 leading-relaxed">
                        This document is ready to view. On mobile devices, opening the file in a new tab provides the best reading experience.
                      </p>

                      <div className="flex flex-col gap-3 w-full justify-center">
                        <a
                          href={previewDoc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-[#5277f7] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open Document
                        </a>
                        
                        <button
                          onClick={() => handleCopyLink(previewDoc.url)}
                          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-250 rounded-xl text-xs font-bold border border-slate-200/50 dark:border-gray-700 transition-all cursor-pointer active:scale-95"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-500" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy Link
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
