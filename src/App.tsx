import React, { useState, useEffect, useRef } from "react";
// @ts-ignore
import html2pdf from "html2pdf.js";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  BookOpen,
  User,
  Hash,
  ArrowLeft,
  Printer,
  Download,
  Sun,
  Moon,
  RefreshCw,
  Compass,
  AlertCircle,
  Clock,
  Sparkles,
  Award,
  ChevronRight,
  LayoutGrid,
  Check,
  Play,
  Lock,
  Phone,
  HelpCircle,
  GraduationCap,
  Calendar,
  Grid,
  MapPin,
  Mail,
  Settings,
  Share2,
  X,
  FileSpreadsheet,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  Shield,
} from "lucide-react";
import { Student, Dropdowns, TestRecord, Profile } from "./types";
import AdminSettings, { Role, SessionUser } from "./components/AdminSettings";
import StudentQR from "./components/StudentQR";
import FloatingEducationBg from "./components/FloatingEducationBg";
import InstallPrompt from "./components/InstallPrompt";
import TimetableViewer from "./components/TimetableViewer";

function PWLogo({ size = "h-10 w-10", textSize = "text-sm", className = "" }: { size?: string, textSize?: string, className?: string }) {
  const [hasError, setHasError] = React.useState(false);
  const logoUrl = "/api/logo";

  return (
    <div className={`overflow-hidden rounded-xl bg-white border border-slate-200/50 dark:border-gray-800 shadow-md shrink-0 flex items-center justify-center ${size} ${className}`}>
      {!hasError ? (
        <img
          src={logoUrl}
          alt="Physics Wallah Logo"
          className="w-full h-full object-contain p-1"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#5277f7] to-[#3a56c5] text-white flex items-center justify-center font-bold tracking-tight select-none" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
          <span className={`${textSize} font-black tracking-tighter`}>PW</span>
        </div>
      )}
    </div>
  );
}

function OwlLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-blue-500/10 rounded-xl p-2 shrink-0 ${className}`}>
      <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" className="fill-[#5277f7]/10 stroke-[#5277f7]/20" strokeWidth="2" />
        {/* Glasses frame */}
        <rect x="22" y="38" width="56" height="24" rx="12" className="stroke-[#5277f7]" strokeWidth="8" fill="none" />
        {/* Eyeglass bridges */}
        <path d="M42 50H58" className="stroke-[#5277f7]" strokeWidth="8" strokeLinecap="round" />
        {/* Pupils */}
        <circle cx="36" cy="50" r="5" className="fill-[#5277f7]" />
        {/* Right Pupil */}
        <circle cx="64" cy="50" r="5" className="fill-[#5277f7]" />
        {/* Owl feather accents */}
        <path d="M28 24C33 27 40 27 43 24" className="stroke-[#5277f7]" strokeWidth="4" strokeLinecap="round" />
        <path d="M72 24C67 27 60 27 57 24" className="stroke-[#5277f7]" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

const STUDENT_AVATAR_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
    <rect width="100" height="100" rx="30" fill="#f1f5f9"/>
    <circle cx="50" cy="38" r="17" fill="#475569"/>
    <path d="M20 80c0-14 13-24 30-24s30 10 30 24" fill="#475569"/>
  </svg>
`)}`;

function getStudentAvatar(name: string, index: number) {
  // Returns a beautifully clean default silhouette avatar representing the classic student/user outline as requested by the user.
  // Dark slate-gray avatar silhouette over a soft slate-100 background.
  return STUDENT_AVATAR_SVG;
}

function getClassmatesAvatars(name: string, index: number) {
  const photos = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=120",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120",
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=120",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=120"
  ];
  const hash = Math.abs(name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + index);
  return [
    photos[hash % photos.length],
    photos[(hash + 1) % photos.length],
    photos[(hash + 2) % photos.length]
  ];
}

function getTimetableDays(student: Student) {
  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  if (student.tests && student.tests.length > 0) {
    return student.tests.slice(0, 5).map((test, index) => {
      const d = new Date(test.date);
      if (isNaN(d.getTime())) {
        return {
          dayNum: index + 20,
          month: "April",
          dayName: days[index % days.length],
          testName: test.name,
          dateStr: test.date
        };
      }
      return {
        dayNum: d.getDate(),
        month: d.toLocaleString("en-US", { month: "short" }),
        dayName: d.toLocaleString("en-US", { weekday: "long" }).toUpperCase(),
        testName: test.name,
        dateStr: test.date
      };
    });
  }
  return [
    { dayNum: 20, month: "Apr", dayName: "MONDAY", testName: "Topic Test 1", dateStr: "" },
    { dayNum: 21, month: "Apr", dayName: "TUESDAY", testName: "Topic Test 2", dateStr: "" },
    { dayNum: 22, month: "Apr", dayName: "WEDNESDAY", testName: "Topic Test 3", dateStr: "" },
    { dayNum: 23, month: "Apr", dayName: "THURSDAY", testName: "Topic Test 4", dateStr: "" },
    { dayNum: 24, month: "Apr", dayName: "FRIDAY", testName: "Topic Test 5", dateStr: "" }
  ];
}

function getSuggestedSyllabus(stream: string) {
  if (stream === "NEET") {
    return [
      { name: "Plant Anatomy & Physiology", duration: "2 hours", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-thin border-rose-500/20", iconColor: "text-rose-500", rawColor: "rose" },
      { name: "Mechanics & Thermal Physics", duration: "2 hours", color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-thin border-teal-500/20", iconColor: "text-teal-500", rawColor: "teal" },
      { name: "Organic Biomolecules", duration: "1 hour", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-thin border-amber-500/20", iconColor: "text-amber-500", rawColor: "amber" }
    ];
  }
  return [
    { name: "Integral Calculus & Areas", duration: "2 hours", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-thin border-rose-500/20", iconColor: "text-rose-500", rawColor: "rose" },
    { name: "Electrostatics & Capacitance", duration: "2 hours", color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-thin border-teal-500/20", iconColor: "text-teal-500", rawColor: "teal" },
    { name: "Chemical Kinetics Revision", duration: "1 hour", color: "bg-[#fef3c7] text-[#92400e] dark:bg-[#78350f]/20 dark:text-[#fde047] border border-thin border-[#f59e0b]/25", iconColor: "text-[#d97706]", rawColor: "amber" }
  ];
}

function formatFullTestName(name: string): string {
  if (!name) return "Test";
  const clean = name.trim();
  const upper = clean.toUpperCase();

  // Match trailing space and a number
  const matchNum = clean.match(/\s+(\d+)$/);
  const suffix = matchNum ? ` ${matchNum[1]}` : "";
  const base = (matchNum ? clean.substring(0, clean.length - matchNum[0].length) : clean).trim().toUpperCase();

  if (base === "PRACTI" || base === "PRAC" || base === "PRACTISE" || base === "PRACTICE") {
    return `Practice Test${suffix}`;
  }
  if (base === "CITY T" || base === "CITY_T" || base === "CITY" || base === "CITYTEST" || base === "CITY TEST") {
    return `City Test${suffix}`;
  }
  if (base === "MILEST" || base === "MILE" || base === "MILES" || base === "MILESTONE") {
    return `Milestone Test${suffix}`;
  }
  if (base === "GAT" || base === "GAT EXAM") {
    return `GAT Exam${suffix}`;
  }

  // Fallbacks
  if (clean.toLowerCase().startsWith("practi") || clean.toLowerCase().startsWith("prac")) {
    return `Practice Test${suffix}`;
  }
  if (clean.toLowerCase().startsWith("city")) {
    return `City Test${suffix}`;
  }
  if (clean.toLowerCase().startsWith("milest") || clean.toLowerCase().startsWith("mile")) {
    return `Milestone Test${suffix}`;
  }

  return clean;
}

export default function App() {
  const getFullNameFromEmail = (email: string) => {
    if (!email) return "Physics Wallah Staff";
    const prefix = email.split("@")[0];
    return prefix
      .split(/[\._\-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getUserInitials = (email: string) => {
    const name = getFullNameFromEmail(email);
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") || "light"
  );
  const [activeView, setActiveView] = useState<"home" | "input" | "batchList" | "dashboard" | "sheetsList" | "admin" | "timetable">("home");
  const [searchType, setSearchType] = useState<"batch" | "name" | "reg" | null>(null);
  const [sheetFilterQuery, setSheetFilterQuery] = useState<string>("");
  
  // Check if we are viewing a shared report directly via URL without logging in
  const publicInfo = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const regParam = params.get("reg");
    const tokenParam = params.get("token");
    if (regParam) {
      return { reg: regParam, token: tokenParam };
    }
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && (parts[0] === "student" || parts[0] === "share")) {
      return { reg: parts[1], token: parts[2] || null };
    }
    return null;
  }, []);

  // Real PW ID Login system
  const [loggedInUser, setLoggedInUser] = useState<{ email: string; name?: string; picture?: string } | null>(() => {
    const saved = localStorage.getItem("pwUserEmail");
    const savedName = localStorage.getItem("pwUserName");
    const savedPicture = localStorage.getItem("pwUserPicture");
    return saved ? { email: saved, name: savedName || undefined, picture: savedPicture || undefined } : null;
  });
  const isPublicReport = !loggedInUser && !!publicInfo;
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // ---- Admin roles / settings panel (Google Sheet-backed) ----
  const [userRole, setUserRole] = useState<Role>(() => (localStorage.getItem("pwUserRole") as Role) || "staff");
  const [userCenter, setUserCenter] = useState<string>(() => localStorage.getItem("pwUserCenter") || "");
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(() => localStorage.getItem("pwIsSuperAdmin") === "1");
  const [notifUnread, setNotifUnread] = useState<number>(0);
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);
  const isAdmin = userRole === "admin";

  const adminHeaders = (): Record<string, string> => {
    const h: Record<string, string> = {};
    const email = localStorage.getItem("pwUserEmail");
    const token = localStorage.getItem("pwStaffToken");
    if (email) h["x-user-email"] = email;
    if (token) h["x-staff-token"] = token;
    return h;
  };

  const refreshUnread = async () => {
    try {
      const res = await fetch("/api/admin/notifications", { headers: adminHeaders() });
      if (res.ok) {
        const d = await res.json();
        setNotifUnread(d.unread || 0);
      }
    } catch (_) {}
  };

  // Register/resume session: records audit + returns the user's role + center
  const establishSession = async (email: string, name: string | undefined, event: "login" | "resume") => {
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ email, name, event }),
      });
      if (res.ok) {
        const data = await res.json();
        const role: Role = data.role || "staff";
        setUserRole(role);
        localStorage.setItem("pwUserRole", role);
        setUserCenter(data.center || "");
        localStorage.setItem("pwUserCenter", data.center || "");
        setIsSuperAdmin(!!data.isSuperAdmin);
        localStorage.setItem("pwIsSuperAdmin", data.isSuperAdmin ? "1" : "0");
        if (role === "admin") refreshUnread();
        return role;
      }
    } catch (e) {
      console.error("Session establish failed:", e);
    }
    return "staff" as Role;
  };

  // Resume session on mount when already logged in
  useEffect(() => {
    const email = localStorage.getItem("pwUserEmail");
    const name = localStorage.getItem("pwUserName") || undefined;
    if (email && localStorage.getItem("pwStaffToken")) {
      establishSession(email, name, "resume");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Input fields
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [nameQuery, setNameQuery] = useState<string>("");
  const [regInput, setRegInput] = useState<string>("");
  const [batchSearchQuery, setBatchSearchQuery] = useState<string>("");
  const [batchPageSize, setBatchPageSize] = useState<number>(50);

  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // Payload states
  const [dropdowns, setDropdowns] = useState<Dropdowns>({ batches: [], names: [], isLoading: true });
  const [studentsPayload, setStudentsPayload] = useState<{ stream: string; students: Student[] } | null>(null);
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number>(0);

  // Sharing states
  const [copiedShare, setCopiedShare] = useState<boolean>(false);
  const [copiedReg, setCopiedReg] = useState<string | null>(null);

  // Status indicators
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<{ lastLoaded?: string | null; sheetCount?: number }>({});

  // Configuration Settings states (Visual Interface)
  const [spreadsheetUrls, setSpreadsheetUrls] = useState<string[]>([]);
  const [spreadsheetCenters, setSpreadsheetCenters] = useState<Array<{ pattern: string; center: string }>>([]);
  const [subsheetCenters, setSubsheetCenters] = useState<Array<{ center: string; patterns: string[] }>>([]);
  const [staffAccess, setStaffAccess] = useState<Array<{ email: string; centers: string[] }>>([]);
  const [activeSheets, setActiveSheets] = useState<Array<{ name: string; sourceUrl: string; center: string }>>([]);
  const [adminTab, setAdminTab] = useState<"config" | "debugger" | "guide">("config");
  const [newUrlInput, setNewUrlInput] = useState<string>("");
  const [debuggerFilter, setDebuggerFilter] = useState<string>("");
  const [openCenter, setOpenCenter] = useState<string | null>(null);
  const [typedEmails, setTypedEmails] = useState<Record<number, string>>({});
  
  // Custom Batch Dropdown states
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState<boolean>(false);
  const [classSelectSearchQuery, setClassSelectSearchQuery] = useState<string>("");
  const batchDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(e.target as Node)) {
        setIsBatchDropdownOpen(false);
      }
    };
    if (isBatchDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isBatchDropdownOpen]);
  
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [configSaveMessage, setConfigSaveMessage] = useState<string | null>(null);
  const [configSaveError, setConfigSaveError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      const res = await securedFetch("/api/config");
      if (!res.ok) throw new Error(`HTTP Error status ${res.status}`);
      const data = await res.json();
      
      // Parse Spreadsheet URLs
      const urls = (data.local?.SPREADSHEET_URL || "")
        .split(",")
        .map((u: string) => u.trim())
        .filter(Boolean);
      setSpreadsheetUrls(urls);

      // Parse Spreadsheet centers (File mappings)
      const sCenters = data.local?.SPREADSHEET_CENTERS || {};
      const sCentersList = Object.entries(sCenters).map(([pattern, center]) => ({
        pattern,
        center: String(center)
      }));
      setSpreadsheetCenters(sCentersList);

      // Parse Subsheet centers (Tab mappings)
      const subCenters = data.local?.SUBSHEET_CENTERS || {};
      const subCentersList = Object.entries(subCenters).map(([center, patterns]) => ({
        center,
        patterns: Array.isArray(patterns) ? patterns.map(String) : []
      }));
      setSubsheetCenters(subCentersList);

      // Parse Staff Access (ACL)
      const accessObj = data.local?.STAFF_ACCESS || {};
      const accessList = Object.entries(accessObj).map(([email, centers]) => ({
        email,
        centers: Array.isArray(centers) ? centers.map(String) : []
      }));
      setStaffAccess(accessList);

      // Set Active Sheets
      setActiveSheets(data.activeSheets || []);
    } catch (err: any) {
      setConfigSaveError("Failed to fetch system configurations: " + err.message);
    }
  };

  // Fetch configurations when activeView is changed to 'admin'
  useEffect(() => {
    if (activeView === "admin") {
      setConfigSaveMessage(null);
      setConfigSaveError(null);
      fetchConfig();
    }
  }, [activeView]);

  const [exportMode, setExportMode] = useState<boolean>(false);
  const exportAreaRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLDivElement>(null);

  // Scroll main canvas back to top on view changes to prevent scroll residue bugs
  useEffect(() => {
    if (mainCanvasRef.current) {
      mainCanvasRef.current.scrollTop = 0;
    }
  }, [activeView, searchType, studentsPayload, selectedStudentIndex]);

  // New interactive dashboard active states
  const [filterTestDate, setFilterTestDate] = useState<string | null>(null);
  const [highlightedTestName, setHighlightedTestName] = useState<string | null>(null);
  const [showingSyncModal, setShowingSyncModal] = useState<boolean>(false);

  // Robust clipboard copy utility supporting legacy mobile webviews
  const safeCopyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn("navigator.clipboard failed, trying fallback", err);
      }
    }
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error("Fallback copy failed", err);
      return false;
    }
  };

  // Optimized single-pass student filtration logic for large roster directories
  const filteredStudents = React.useMemo(() => {
    if (!studentsPayload || !studentsPayload.students) return [];
    const query = batchSearchQuery.toLowerCase().trim();
    if (!query) {
      return studentsPayload.students.map((student, originalIdx) => ({ student, originalIdx }));
    }
    const queryTokens = query.split(/\s+/).filter(Boolean);
    if (queryTokens.length === 0) {
      return studentsPayload.students.map((student, originalIdx) => ({ student, originalIdx }));
    }
    const results: { student: Student; originalIdx: number }[] = [];
    const len = studentsPayload.students.length;
    for (let i = 0; i < len; i++) {
      const student = studentsPayload.students[i];
      const name = (student.profile.name || "").toLowerCase();
      const regNo = (student.profile.regNo || "").toLowerCase();
      const batch = (student.profile.batch || "").toLowerCase();
      
      const nameWords = name.split(/[\s\-_,.]+/).filter(Boolean);
      const batchWords = batch.split(/[\s\-_,.]+/).filter(Boolean);
      
      const matchesAllTokens = queryTokens.every(token => {
        const nameWordMatches = nameWords.some(word => word.startsWith(token));
        const batchWordMatches = batchWords.some(word => word.startsWith(token));
        const fullNamePrefix = name.startsWith(token);
        const fullBatchPrefix = batch.startsWith(token);
        const regMatches = regNo.includes(token);
        return nameWordMatches || batchWordMatches || fullNamePrefix || fullBatchPrefix || regMatches;
      });

      if (matchesAllTokens) {
        results.push({ student, originalIdx: i });
      }
    }
    return results;
  }, [studentsPayload, batchSearchQuery]);

  // Memoized worksheet filtration logic
  const filteredSheets = React.useMemo(() => {
    if (!dropdowns.sheets) return [];
    const queryLower = (sheetFilterQuery || "").toLowerCase().trim();
    if (!queryLower) return dropdowns.sheets;
    return dropdowns.sheets.filter((sheet) =>
      sheet.toLowerCase().includes(queryLower)
    );
  }, [dropdowns.sheets, sheetFilterQuery]);

  // Sync theme changes with document body
  useEffect(() => {
    const root = window.document.documentElement;
    const themeMeta = document.getElementById("theme-meta");
    if (theme === "dark") {
      root.classList.add("dark");
      if (themeMeta) themeMeta.setAttribute("content", "#0c0e17");
    } else {
      root.classList.remove("dark");
      if (themeMeta) themeMeta.setAttribute("content", "#4e74e6");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Listen to beforeprint and afterprint to toggle exportMode for native browser prints (Ctrl+P)
  useEffect(() => {
    const handleBeforePrint = () => {
      setExportMode(true);
    };
    const handleAfterPrint = () => {
      setExportMode(false);
    };
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  // Ref to prevent pushing state when popped (back/forward)
  const isPopStateRef = useRef(false);
  // Ref to keep track of last pushed state as a serialized string
  const lastPushedStateRef = useRef<string>("");

  // Setup PopState listener for back/forward navigation
  useEffect(() => {
    if (isPublicReport) return;
    const handlePopState = (event: PopStateEvent) => {
      // If we go back to the very beginning (no state), default to home
      if (!event.state) {
        isPopStateRef.current = true;
        setActiveView("home");
        setSearchType(null);
        setStudentsPayload(null);
        setSelectedStudentIndex(0);
        
        const initialState = {
          activeView: "home",
          searchType: null,
          selectedBatch: "",
          regInput: "",
          nameQuery: "",
          studentsPayload: null,
          selectedStudentIndex: 0
        };
        lastPushedStateRef.current = JSON.stringify(initialState);
        
        setTimeout(() => {
          isPopStateRef.current = false;
        }, 80);
        return;
      }

      isPopStateRef.current = true;
      const state = event.state;

      // Restore all navigation state
      if (state.activeView !== undefined) setActiveView(state.activeView);
      if (state.searchType !== undefined) setSearchType(state.searchType);
      if (state.selectedBatch !== undefined) setSelectedBatch(state.selectedBatch);
      if (state.regInput !== undefined) setRegInput(state.regInput);
      if (state.nameQuery !== undefined) setNameQuery(state.nameQuery);
      if (state.studentsPayload !== undefined) setStudentsPayload(state.studentsPayload);
      if (state.selectedStudentIndex !== undefined) setSelectedStudentIndex(state.selectedStudentIndex);

      // Serialize and update our last pushed state tracking ref
      lastPushedStateRef.current = JSON.stringify(state);

      // Allow some time for state updates to apply before allowing pushes
      setTimeout(() => {
        isPopStateRef.current = false;
      }, 80);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Synchronize state changes to browser history
  useEffect(() => {
    if (isPublicReport) return;
    // If we're currently executing a popstate restore, do not push
    if (isPopStateRef.current) return;

    const currentState = {
      activeView,
      searchType,
      selectedBatch,
      regInput,
      nameQuery,
      studentsPayload,
      selectedStudentIndex
    };

    const currentStateStr = JSON.stringify(currentState);

    // If the state is identical to what we last pushed, do nothing
    if (currentStateStr === lastPushedStateRef.current) return;

    // Check if this is the first state initialization
    if (!lastPushedStateRef.current) {
      window.history.replaceState(currentState, "", window.location.pathname + window.location.search);
      lastPushedStateRef.current = currentStateStr;
      return;
    }

    const lastState = JSON.parse(lastPushedStateRef.current);

    const viewChanged = lastState.activeView !== activeView;
    const searchTypeChanged = activeView === "input" && lastState.searchType !== searchType;
    const studentIndexChanged = activeView === "dashboard" && lastState.selectedStudentIndex !== selectedStudentIndex;
    
    const lastPayloadId = lastState.studentsPayload?.students?.[0]?.profile?.regNo || null;
    const currentPayloadId = studentsPayload?.students?.[0]?.profile?.regNo || null;
    const payloadChanged = lastPayloadId !== currentPayloadId || lastState.studentsPayload?.students?.length !== studentsPayload?.students?.length;

    let shouldPush = false;
    let shouldReplace = false;

    if (viewChanged || searchTypeChanged || studentIndexChanged || payloadChanged) {
      shouldPush = true;
    } else {
      shouldReplace = true;
    }

    if (shouldPush || shouldReplace) {
      let url = window.location.pathname;
      const params = new URLSearchParams();
      
      if (activeView === "dashboard" && studentsPayload?.students?.[selectedStudentIndex]) {
        const student = studentsPayload.students[selectedStudentIndex];
        if (student.profile.regNo) {
          params.set("reg", student.profile.regNo);
          // Preserve share token for public/shared links
          if (student.profile.shareToken) {
            params.set("token", student.profile.shareToken);
          }
        }
      } else if (activeView === "batchList" && selectedBatch) {
        params.set("batch", selectedBatch);
      } else if (activeView === "input" && searchType) {
        params.set("type", searchType);
      }

      const paramStr = params.toString();
      if (paramStr) {
        url += "?" + paramStr;
      }

      try {
        if (shouldPush) {
          window.history.pushState(currentState, "", url);
        } else if (shouldReplace) {
          window.history.replaceState(currentState, "", url);
        }
      } catch (e) {
        // Fallback for environment/sandbox limitations or serialize errors
        console.warn("History pushState failed, trying without heavy payload:", e);
        const leanState = { ...currentState, studentsPayload: null };
        try {
          if (shouldPush) {
            window.history.pushState(leanState, "", url);
          } else {
            window.history.replaceState(leanState, "", url);
          }
        } catch (err) {
          console.error("Critical history api fail:", err);
        }
      }
      
      lastPushedStateRef.current = currentStateStr;
    }
  }, [activeView, searchType, selectedBatch, studentsPayload, selectedStudentIndex, regInput, nameQuery]);

  // Utility wrapper for secured backend API fetches
  const securedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    const email = localStorage.getItem("pwUserEmail");
    const staffToken = localStorage.getItem("pwStaffToken");
    
    if (email) {
      headers.set("X-User-Email", email);
    }
    if (staffToken) {
      headers.set("X-Staff-Token", staffToken);
    }

    let finalInput = input;
    // Inject share token if it's a student query by a public user
    const isPublic = !email && !!publicInfo;
    if (isPublic && typeof input === "string" && input.includes("/api/student")) {
      const token = new URLSearchParams(window.location.search).get("token") || (publicInfo ? publicInfo.token : null);
      if (token) {
        const separator = input.includes("?") ? "&" : "?";
        finalInput = `${input}${separator}token=${encodeURIComponent(token)}`;
      }
    }

    return fetch(finalInput, { ...init, headers });
  };

  // Fetch initial dropdown metadata from Express server backend
  const fetchDropdowns = async () => {
    try {
      setDropdowns((prev) => ({ ...prev, isLoading: true }));
      const response = await securedFetch("/api/dropdowns");
      if (!response.ok) {
        throw new Error(`Failed to initialize dropdown parameters. Code: ${response.status}`);
      }
      const data = await response.json();
      setDropdowns({
        batches: data.batches || [],
        names: data.names || [],
        sheets: data.sheets || [],
        sheetStats: data.sheetStats || {},
        sheetUrls: data.sheetUrls || {},
        isLoading: false,
        lastLoaded: data.lastLoaded,
      });

      // Also get general database health summary
      const healthRes = await securedFetch("/api/health");
      if (healthRes.ok) {
        const health = await healthRes.json();
        setDbStatus({
          lastLoaded: health.lastLoaded,
          sheetCount: health.sheetCount,
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Could not connect to PW Vidyapeeth database server. Please refresh page.");
      setDropdowns((prev) => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    if (loggedInUser) {
      fetchDropdowns();
    }
  }, [loggedInUser]);

  useEffect(() => {
    // Support sharing deep-linking via query parameters on mount
    const params = new URLSearchParams(window.location.search);
    const regParam = params.get("reg") || (publicInfo ? publicInfo.reg : null);
    const nameParam = params.get("name");
    const batchParam = params.get("batch");

    const loadSharedStudent = async (queryVal: string, type: "reg" | "name" | "batch") => {
      setErrorMessage(null);
      setIsSearching(true);
      try {
        const encodeQuery = encodeURIComponent(queryVal.trim());
        const res = await securedFetch(`/api/student?query=${encodeQuery}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "No students found matching your criteria.");
        }

        const data = await res.json();
        setStudentsPayload(data);
        setSelectedStudentIndex(0);
        
        if (type === "batch" && data.students && data.students.length > 1) {
          setActiveView("batchList");
        } else {
          setActiveView("dashboard");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to load shared report.");
      } finally {
        setIsSearching(false);
      }
    };

    if (regParam) {
      setSearchType("reg");
      setRegInput(regParam);
      loadSharedStudent(regParam, "reg");
    } else if (nameParam) {
      setSearchType("name");
      setNameQuery(nameParam);
      loadSharedStudent(nameParam, "name");
    } else if (batchParam) {
      setSearchType("batch");
      setSelectedBatch(batchParam);
      loadSharedStudent(batchParam, "batch");
    }
  }, []);

  const handleGoogleLogin = async () => {
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const response = await securedFetch("/api/auth/google/url");
      if (!response.ok) {
        throw new Error("Unable to fetch secure login address. Ensure server is online.");
      }
      const { url } = await response.json();

      const width = 500;
      const height = 620;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const authWindow = window.open(
        url,
        "google_oauth_popup",
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
      );

      if (!authWindow) {
        setLoginError("Popup Blocked: Google Sign-In requires popups. Please enable popups for this portal.");
        setIsLoggingIn(false);
      }
    } catch (err: any) {
      setLoginError(err.message || "Failed to initiate secure Google Sign-In.");
      setIsLoggingIn(false);
    }
  };

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      const isAllowedOrigin = origin.endsWith(".run.app") || origin.endsWith(".hf.space") || origin.includes("localhost") || origin.includes("127.0.0.1");
      if (!isAllowedOrigin) return;

      if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
        const email = event.data.email;
        const name = event.data.name || "";
        const picture = event.data.picture || "";
        const staffToken = event.data.staffToken || "";
        localStorage.setItem("pwUserEmail", email);
        localStorage.setItem("pwStaffToken", staffToken);
        if (name) {
          localStorage.setItem("pwUserName", name);
        } else {
          localStorage.removeItem("pwUserName");
        }
        if (picture) {
          localStorage.setItem("pwUserPicture", picture);
        } else {
          localStorage.removeItem("pwUserPicture");
        }
        setLoggedInUser({ email, name, picture });
        setActiveView("home");
        setIsLoggingIn(false);
        setLoginError(null);
        // Register session → records audit + resolves role/center from settings sheet
        establishSession(email, name || undefined, "login");
      } else if (event.data?.type === "GOOGLE_AUTH_FAILURE") {
        setLoginError(event.data.error || "Google authentication rejected.");
        setIsLoggingIn(false);
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem("pwUserEmail");
      localStorage.removeItem("pwUserName");
      localStorage.removeItem("pwUserPicture");
      localStorage.removeItem("pwStaffToken");
      localStorage.removeItem("pwUserRole");
      localStorage.removeItem("pwUserCenter");
      localStorage.removeItem("pwIsSuperAdmin");
    } catch (_) {}
    // Force a clean reload to the root so all state, caches and effects reset.
    window.location.href = window.location.origin + "/";
  };

  // Handle Autocomplete filtering for Student Names
  useEffect(() => {
    const query = nameQuery.toLowerCase().trim();
    if (!query) {
      setNameSuggestions([]);
      return;
    }
    const filtered = dropdowns.names
      .filter((n) => n.toLowerCase().includes(query))
      .sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();

        // 1. Push N/A or hashtag placeholders to the very bottom
        const aIsNA = a.includes("N/A") || aLower === "n/a" || a.startsWith("#");
        const bIsNA = b.includes("N/A") || bLower === "n/a" || b.startsWith("#");
        if (aIsNA && !bIsNA) return 1;
        if (!aIsNA && bIsNA) return -1;

        // 2. Exact match gets ultimate priority
        if (aLower === query && bLower !== query) return -1;
        if (bLower === query && aLower !== query) return 1;

        // 3. Name starts with the query word gets high priority
        const aStarts = aLower.startsWith(query);
        const bStarts = bLower.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // 4. Any inside word starts with the query (e.g., "Aaditya Yadav" matched with "ya")
        const aWords = aLower.split(/\s+/);
        const bWords = bLower.split(/\s+/);
        const aWordStarts = aWords.some(w => w.startsWith(query));
        const bWordStarts = bWords.some(w => w.startsWith(query));
        if (aWordStarts && !bWordStarts) return -1;
        if (!aWordStarts && bWordStarts) return 1;

        // 5. Fallback: alphabetical sorting
        return a.localeCompare(b);
      })
      .slice(0, 10);
    setNameSuggestions(filtered);
  }, [nameQuery, dropdowns.names]);

  // Submit configuration updates to Express server
  const handleSaveConfig = async (
    e?: React.FormEvent,
    overrides?: {
      urls?: string[];
      sCenters?: Array<{ pattern: string; center: string }>;
      subCenters?: Array<{ center: string; patterns: string[] }>;
      access?: Array<{ email: string; centers: string[] }>;
    }
  ) => {
    if (e) e.preventDefault();
    setIsSavingConfig(true);
    setConfigSaveMessage(null);
    setConfigSaveError(null);

    try {
      const activeUrls = overrides?.urls || spreadsheetUrls;
      const activeSCenters = overrides?.sCenters || spreadsheetCenters;
      const activeSubCenters = overrides?.subCenters || subsheetCenters;
      const activeAccess = overrides?.access || staffAccess;

      // 1. Build Spreadsheet URLs string
      const urlStr = activeUrls.map(u => u.trim()).filter(Boolean).join(", ");

      // 2. Build Spreadsheet Centers object
      const sCentersObj: Record<string, string> = {};
      activeSCenters.forEach(item => {
        const pat = item.pattern.trim();
        const ctr = item.center.trim();
        if (pat && ctr) {
          sCentersObj[pat] = ctr;
        }
      });

      // 3. Build Subsheet Centers object
      const subCentersObj: Record<string, string[]> = {};
      activeSubCenters.forEach(item => {
        const ctr = item.center.trim();
        const pats = item.patterns.map(p => p.trim()).filter(Boolean);
        if (ctr && pats.length > 0) {
          subCentersObj[ctr] = pats;
        }
      });

      // 4. Build Staff Access (ACL) object
      const staffAccessObj: Record<string, string[]> = {};
      activeAccess.forEach(item => {
        const email = item.email.trim();
        const ctrs = item.centers.map(c => c.trim()).filter(Boolean);
        if (email && ctrs.length > 0) {
          staffAccessObj[email] = ctrs;
        }
      });

      // 5. Make POST request
      const response = await securedFetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          SPREADSHEET_URL: urlStr,
          SPREADSHEET_CENTERS: sCentersObj,
          SUBSHEET_CENTERS: subCentersObj,
          STAFF_ACCESS: staffAccessObj,
        }),
      });

      if (!response.ok) {
        let errMsg = "Failed to save configuration settings.";
        try {
          const errData = await response.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const resData = await response.json();
      setConfigSaveMessage(resData.message || "Configurations successfully updated and database cache reloaded!");
      
      // Reload configurations and cache stats
      await fetchConfig();
      // Fetch dropdowns to sync student rosters
      await fetchDropdowns();
    } catch (err: any) {
      setConfigSaveError(err.message || String(err));
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Force Database Synchronization with Google Sheets again via Express backend
  const handleDatabaseSync = async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const response = await securedFetch("/api/refresh", { method: "POST" });
      if (!response.ok) {
        let errMsg = "Sync failed. Check network link.";
        try {
          const errData = await response.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      const resData = await response.json();
      
      // Pull fresh data
      await fetchDropdowns();
      setIsRefreshing(false);
    } catch (err: any) {
      setErrorMessage(err.message || "Manual database synchronization failed.");
      setIsRefreshing(false);
    }
  };

  // Auto-refresh student data every 5 minutes silently while a staff/admin is logged in.
  // No spinner, no error popup — just keeps the cache warm so new students/exams appear automatically.
  useEffect(() => {
    if (!loggedInUser) return;
    const id = setInterval(async () => {
      try {
        await securedFetch("/api/refresh", { method: "POST" });
        await fetchDropdowns();
      } catch (_) {}
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInUser]);

  // Perform search query
  const handlePerformSearch = async (overrideQuery?: string) => {
    setErrorMessage(null);
    setSelectedSheetName(null);
    let finalQuery = "";

    if (overrideQuery) {
      finalQuery = overrideQuery;
    } else {
      if (searchType === "batch") finalQuery = selectedBatch;
      if (searchType === "name") finalQuery = nameQuery;
      if (searchType === "reg") finalQuery = regInput;
    }

    if (!finalQuery.trim()) {
      setErrorMessage("Please input a valid search parameters.");
      return;
    }

    setIsSearching(true);
    setShowSuggestions(false);

    try {
      const encodeQuery = encodeURIComponent(finalQuery.trim());
      const res = await securedFetch(`/api/student?query=${encodeQuery}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "No students found matching your criteria.");
      }

      const data = await res.json();
      setStudentsPayload(data);
      setSelectedStudentIndex(0);

      if (searchType === "batch" && data.students && data.students.length > 1) {
        setActiveView("batchList");
        setBatchPageSize(50);
      } else {
        setActiveView("dashboard");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Request timed out or database could not process search query.");
    } finally {
      setIsSearching(false);
    }
  };

  const [selectedSheetName, setSelectedSheetName] = useState<string | null>(null);

  const handleLoadSheetStudents = async (sheetName: string) => {
    setErrorMessage(null);
    setIsSearching(true);
    setSelectedSheetName(sheetName);
    try {
      const res = await securedFetch(`/api/student?query=${encodeURIComponent(sheetName)}&singleSheet=true&exactSheet=${encodeURIComponent(sheetName)}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `No student records mapped in sheet "${sheetName}".`);
      }

      const data = await res.json();
      setStudentsPayload(data);
      setSelectedStudentIndex(0);
      setSearchType("batch");
      setBatchSearchQuery("");
      setActiveView("batchList");
      setBatchPageSize(50);
    } catch (err: any) {
      setErrorMessage(err.message || `Failed to load students for sheet "${sheetName}".`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadAllStudents = async () => {
    setErrorMessage(null);
    setIsSearching(true);
    setSelectedSheetName(null);
    try {
      const res = await securedFetch(`/api/student?query=all`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "No students found in the database.");
      }

      const data = await res.json();
      setStudentsPayload(data);
      setSelectedStudentIndex(0);
      setSearchType("batch");
      setActiveView("batchList");
      setBatchPageSize(50);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load all student records.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestClick = (name: string) => {
    setNameQuery(name);
    setShowSuggestions(false);
    handlePerformSearch(name);
  };

  const selectStudentFromBatch = (index: number) => {
    setSelectedStudentIndex(index);
    setActiveView("dashboard");
  };

  // Modern print styling and trigger
  const triggerPrint = () => {
    setExportMode(true);
    setTimeout(() => {
      window.print();
      setExportMode(false);
    }, 150);
  };

  // Download high-resolution landscape A4 PDF report with dark mode auto-stripping
  const downloadReportPdf = () => {
    if (!exportAreaRef.current) return;
    setExportMode(true);
    
    // Select the target student profile details
    const activeStudent = studentsPayload?.students[selectedStudentIndex];
    const safeName = (activeStudent?.profile.name || "Student").replace(/[^a-zA-Z0-9]/g, "_");
    const regNo = activeStudent?.profile.regNo || "Report";

    // Temporarily remove dark-mode classes so it renders beautifully as a standard high-contrast light theme PDF
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
    }

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${safeName}_${regNo}_Report.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 1120 },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] }
    } as any;

    // Wait slightly for DOM adjustment (CSS repaint)
    setTimeout(() => {
      try {
        html2pdf().set(opt).from(exportAreaRef.current).save().then(() => {
          setExportMode(false);
          // Restore dark mode state
          if (isDark) {
            document.documentElement.classList.add("dark");
          }
        }).catch((err: any) => {
          console.error("PDF generation failed:", err);
          setExportMode(false);
          if (isDark) {
            document.documentElement.classList.add("dark");
          }
        });
      } catch (err: any) {
        console.error("PDF generation exception:", err);
        alert("PDF printing engine encountered an issue. Please try native Browser Print (Print Icon) instead!");
        setExportMode(false);
        if (isDark) {
          document.documentElement.classList.add("dark");
        }
      }
    }, 500);
  };

  // Modern sharing handler (Web Share API on mobile, slick clipboard popup on desktop)
  const handleShareReport = async () => {
    const activeStudent = studentsPayload?.students[selectedStudentIndex];
    if (!activeStudent) return;

    const shareUrl = `${window.location.origin}/student/${encodeURIComponent(activeStudent.profile.regNo || "")}/${encodeURIComponent(activeStudent.profile.shareToken || "")}`;
    const shareTitle = `PW Vidyapeeth Academic Report Card - ${activeStudent.profile.name}`;
    const shareText = `Check out the academic performance card for ${activeStudent.profile.name} at PW Vidyapeeth.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
      } catch (err) {
        console.log("Web Share cancelled or failed, checking copy variant:", err);
        copyLinkToClipboard(shareUrl);
      }
    } else {
      copyLinkToClipboard(shareUrl);
    }
  };

  const copyLinkToClipboard = (url: string) => {
    safeCopyToClipboard(url).then((success) => {
      if (success) {
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2000);
      }
    });
  };

  // Date formatter helper
  const formatDateString = (val: string) => {
    if (!val || val === "N/A") return "N/A";
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      const match = val.match(/^(\d{1,2})\s+([a-zA-Z]+)/);
      if (match) {
        const day = match[1];
        const month = match[2].slice(0, 3);
        const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
        return `${day.padStart(2, "0")} ${formattedMonth}`;
      }
      return val;
    }
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  // Badge styler for different test categories
  const getTypeBadgeStyles = (type: string) => {
    const normType = type.toLowerCase();
    if (normType.includes("city")) {
      return "bg-blue-50/85 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/45";
    }
    if (normType.includes("milestone") || normType.includes("milesto")) {
      return "bg-purple-50/85 text-purple-700 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/45";
    }
    if (normType.includes("practice")) {
      return "bg-emerald-50/85 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/45";
    }
    if (normType.includes("gat")) {
      return "bg-amber-50/85 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/45";
    }
    return "bg-slate-50/85 text-slate-600 border-slate-200/60 dark:bg-gray-800/60 dark:text-gray-300 dark:border-gray-700/65";
  };

  // Score value sanitization
  const formatRawScoreValue = (val: any) => {
    if (val === "N/A" || val === undefined || val === "" || val === "-") return val;
    const num = parseFloat(val);
    return isNaN(num) ? val : Math.round(num);
  };

  // Active student object
  const activeStudent: Student | undefined = studentsPayload?.students[selectedStudentIndex];

  // Dynamically compute subjects present in active student's test records
  const dynamicSubjects = React.useMemo(() => {
    if (!activeStudent || !activeStudent.tests) return [];
    const setOfSubs = new Set<string>();
    activeStudent.tests.forEach((test) => {
      if (test.subjectScores && Array.isArray(test.subjectScores)) {
        test.subjectScores.forEach((s) => {
          if (s.subject) setOfSubs.add(s.subject);
        });
      }
    });
    const uniqueList = Array.from(setOfSubs);

    // Custom ordering preferred priority list for neat layout:
    const preferredSubjectOrder = [
      "physics", "phys", "phys.", "chemistry", "chem", "chem.",
      "mathematics", "maths", "math", "botany", "bot.", "zoology", "zoo.",
      "science", "mat", "mental ability", "sst", "social studies", "english"
    ];

    const getSubjectPriority = (sub: string) => {
      const norm = sub.toLowerCase().trim().replace(/\./g, "");
      const idx = preferredSubjectOrder.indexOf(norm);
      return idx !== -1 ? idx : 999;
    };

    return uniqueList.sort((a, b) => {
      const pA = getSubjectPriority(a);
      const pB = getSubjectPriority(b);
      if (pA !== pB) return pA - pB;
      return a.localeCompare(b);
    });
  }, [activeStudent]);

  const finalSubjects = React.useMemo(() => {
    if (dynamicSubjects.length > 0) return dynamicSubjects;
    const activeStream = activeStudent?.profile?.stream || studentsPayload?.stream || "JEE";
    if (activeStream === "NEET") {
      return ["Physics", "Chemistry", "Botany", "Zoology"];
    } else if (activeStream === "Foundation") {
      return ["Science", "Mathematics", "English", "MAT", "SST"];
    } else {
      return ["Physics", "Chemistry", "Mathematics"];
    }
  }, [dynamicSubjects, activeStudent?.profile?.stream, studentsPayload?.stream]);

  if (isPublicReport) {
    if (errorMessage) {
      return (
        <div className={`min-h-screen font-sans flex flex-col justify-center items-center bg-slate-50 dark:bg-[#0c0e17] p-4 text-slate-800 dark:text-slate-100 ${theme === "dark" ? "dark" : ""}`}>
          <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-[32px] p-6 shadow-xl border border-slate-200/50 dark:border-gray-800 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto text-xl font-bold">!</div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Failed to Load Report</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400">{errorMessage}</p>
            <button 
              onClick={() => { window.location.href = window.location.origin + window.location.pathname; }}
              className="px-6 py-2.5 rounded-xl bg-[#5277f7] hover:bg-[#4062dd] text-white font-bold text-xs uppercase tracking-wider cursor-pointer border-0"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
    }

    // Show loading spinner if search is in progress OR data hasn't loaded yet
    if (isSearching || !studentsPayload) {
      return (
        <div className={`min-h-screen font-sans flex flex-col justify-center items-center bg-slate-50 dark:bg-[#0c0e17] p-4 text-slate-800 dark:text-slate-100 ${theme === "dark" ? "dark" : ""}`}>
          <div className="text-center space-y-4 max-w-xs">
            <div className="w-12 h-12 border-4 border-[#5277f7] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium font-sans animate-pulse">Loading shared report card...</p>
            <button
              onClick={() => window.location.reload()}
              className="text-[11px] text-[#5277f7] font-bold underline cursor-pointer"
            >
              Stuck? Tap to retry
            </button>
          </div>
        </div>
      );
    }
    // Public payload loaded but no student matched — show explicit error instead of falling through silently
    if (!studentsPayload.students || studentsPayload.students.length === 0) {
      return (
        <div className={`min-h-screen font-sans flex flex-col justify-center items-center bg-slate-50 dark:bg-[#0c0e17] p-4 text-slate-800 dark:text-slate-100 ${theme === "dark" ? "dark" : ""}`}>
          <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-[32px] p-6 shadow-xl border border-slate-200/50 dark:border-gray-800 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto text-xl font-bold">!</div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Report not found</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400">This report link is invalid or the student record isn't available yet. Ask staff for a fresh QR.</p>
          </div>
        </div>
      );
    }
  }

  if (!loggedInUser && !isPublicReport) {
    return (
      <div className={`min-h-screen font-sans flex flex-col justify-center items-center py-10 transition-all bg-[#4e74e6] dark:bg-[#0c0e17] p-4 text-slate-800 dark:text-slate-100 relative overflow-hidden ${theme === "dark" ? "dark" : ""}`}>
        <FloatingEducationBg />
        <InstallPrompt />
        <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-[32px] shadow-2xl border border-slate-200/50 dark:border-gray-800 p-6 sm:p-8 flex flex-col items-center relative overflow-hidden z-10">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#5277f7]/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#3d62dd]/15 rounded-full blur-3xl pointer-events-none"></div>

          {/* Theme Switcher */}
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800/60 transition-colors cursor-pointer"
            title="Toggle Mode"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          {/* PW Logo Identity */}
          <div className="mb-6 flex flex-col items-center text-center">
            <PWLogo size="w-16 h-16" className="mb-3" />
            <span className="text-[10px] text-[#5277f7] uppercase tracking-[0.25em] font-mono font-black">
              Pimpri PW Vidyapeeth
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-display mt-1 animate-pulse">
              Academic Assessment Hub
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs font-medium">
              Staff and Faculty Verification Portal
            </p>
          </div>

          <div className="w-full space-y-4">
            {/* Google Login Call-to-Action */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-gray-700/80 text-slate-700 dark:text-slate-200 font-extrabold py-3.5 px-4 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-[#1e293b]/80 transition-all text-xs uppercase tracking-wider font-display shrink-0 cursor-pointer outline-none active:scale-[0.98]"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <title>Google Secure Logo</title>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.66-.53-1.18-1.21-1.35-1.79z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              {isLoggingIn ? "Authorizing via Google..." : "Login with Google"}
            </button>

            {loginError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/35 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-start gap-2 text-left animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/20 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Only official <span className="font-bold text-[#5277f7] dark:text-blue-400">@pw.live</span> or <span className="font-bold text-[#5277f7] dark:text-blue-400">@physicswallah.org</span> Google accounts are permitted access.
              </span>
            </div>
          </div>

          {/* Secure Workspace Indicator */}
          <div className="mt-6 pt-4 border-t border-slate-105 dark:border-gray-800/40 w-full text-center">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
              Secure Access Session: <span className="font-bold uppercase text-emerald-500">VP-ONLINE-ACTIVE</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-screen font-sans flex flex-col transition-all text-slate-800 dark:text-slate-100 ${
      exportMode 
        ? "export-mode bg-white p-0 text-black min-h-screen h-auto overflow-visible" 
        : "h-[100dvh] overflow-hidden md:justify-center md:items-center bg-[#4e74e6] dark:bg-[#0c0e17] p-0 sm:p-4 md:p-6"
    } ${theme === "dark" && !exportMode ? "dark" : ""}`}>
      
      {/* INITIAL BLUR SPINNER IF SYSTEM DROP DOWNS PRE-LOAD */}
      {dropdowns.isLoading && activeView === "home" && (
        <div id="initialSplash" className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white dark:bg-[#0b0f19]">
          <div className="animate-spin h-10 w-10 border-2 border-slate-250 dark:border-gray-800 border-t-blue-600 dark:border-t-blue-500 rounded-full mb-6"></div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display uppercase tracking-widest">
            Pimpri PW Vidyapeeth
          </h1>
          <p className="text-xs text-slate-400 mt-1 dark:text-slate-500 font-mono">Caching administrative indices...</p>
        </div>
      )}

      {/* FLOATING ACTION OVERLAY IF DB IS PROCESSING CLIENT LOAD */}
      {isSearching && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1e293b]/70 backdrop-blur-md">
          <div className="animate-spin h-12 w-12 border-4 border-slate-200/20 border-t-[#5277f7] rounded-full mb-4"></div>
          <div className="text-white font-extrabold text-xs tracking-widest uppercase font-display">
            Siphoning metrics cache...
          </div>
        </div>
      )}

      {/* ANIMATED FLOATING BACKGROUND — Education/Science themed icons */}
      {!exportMode && <FloatingEducationBg />}

      {/* MAIN HARDWARE DECK CASING */}
      <div className={`w-full max-w-[1400px] bg-[#f0f4fa] dark:bg-[#090d16] flex flex-col md:flex-row relative transition-all border-white/15 z-10 ${
        exportMode 
          ? "border-0 shadow-none rounded-none bg-white min-h-screen w-full text-black h-auto overflow-visible" 
          : "h-full md:h-[88vh] rounded-none md:rounded-[40px] shadow-none md:shadow-2xl overflow-hidden border-0 md:border"
      }`}>
        
        {/* MOBILE SPECIAL TOP NAV BAR */}
        {!exportMode && (
          <header className="md:hidden flex bg-white dark:bg-[#111827] h-14 w-full border-b border-slate-200/50 dark:border-gray-800/40 shrink-0 items-center justify-between px-4 relative z-30 shadow-sm no-print">
            {/* Top PW Logo Identity */}
            <div className="flex items-center gap-2">
              <PWLogo size="w-8 h-8" textSize="text-[10px] animate-pulse" />
              <div className="flex flex-col select-none leading-none">
                <span className="font-display font-black text-xs text-[#5277f7] dark:text-blue-400">PW PUNE</span>
                <span className="text-[8px] font-mono tracking-widest text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">Academic</span>
              </div>
            </div>

            {/* Top Right Buttons (Sync, Theme, Profile) */}
            <div className="flex items-center gap-2">
              {loggedInUser && (
                <button
                  onClick={handleDatabaseSync}
                  disabled={isRefreshing}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#5277f7] hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-all cursor-pointer relative"
                  title="Synchronize Google Sheets"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#5277f7]" : ""}`} />
                </button>
              )}

              <button
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-all cursor-pointer"
                title="Toggle Mode"
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
              </button>

              {loggedInUser && (
                <div className="relative">
                  <button
                    onClick={() => setShowProfileModal(!showProfileModal)}
                    className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200/50 dark:border-gray-850 hover:border-[#5277f7] transition-all cursor-pointer bg-slate-50 dark:bg-gray-800/60 flex items-center justify-center shrink-0 focus:outline-none"
                  >
                    <img
                      src={loggedInUser.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(getFullNameFromEmail(loggedInUser.email))}&background=1d4ed8&color=fff&bold=true&size=128`}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getFullNameFromEmail(loggedInUser.email))}&background=1d4ed8&color=fff&bold=true&size=128`;
                      }}
                    />
                  </button>

                  <AnimatePresence>
                    {showProfileModal && (
                      <>
                        {/* Click Outside Overlay Backdrop */}
                        <motion.div
                          key="profile-backdrop-mobile"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-40 cursor-default bg-transparent"
                          onClick={() => setShowProfileModal(false)}
                        />

                      {/* Float profile card details popover */}
                      {loggedInUser && (
                        <motion.div
                          key="profile-popover-mobile"
                          initial={{ opacity: 0, scale: 0.92, y: 12 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92, y: 12 }}
                          transition={{ type: "spring", damping: 25, stiffness: 350 }}
                          className="absolute right-0 top-11 z-50 w-72 bg-white dark:bg-[#111827] rounded-[24px] p-5 border border-slate-200 dark:border-gray-800 shadow-2xl text-left"
                        >
                          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-gray-800">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#5277f7] text-white flex items-center justify-center font-extrabold text-sm tracking-tight font-display">
                              <img
                                src={loggedInUser.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(getFullNameFromEmail(loggedInUser.email))}&background=1d4ed8&color=fff&bold=true&size=128`}
                                alt="Profile"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getFullNameFromEmail(loggedInUser.email))}&background=1d4ed8&color=fff&bold=true&size=128`;
                                }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                                {getFullNameFromEmail(loggedInUser.email)}
                              </h4>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                                {loggedInUser.email}
                              </p>
                            </div>
                          </div>
                          <div className="py-3.5 space-y-2">
                            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              <span>Center:</span>
                              <span className="font-bold text-slate-700 dark:text-gray-300">Pimpri PW Vidyapeeth</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              <span>Access Category:</span>
                              <span className="font-bold text-slate-700 dark:text-gray-300">Staff & Faculty Only</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              <span>Indexing Status:</span>
                              <span className="font-bold text-emerald-500 flex items-center gap-1">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> ONLINE
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={handleLogout}
                            className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/25 dark:hover:bg-rose-950/50 dark:text-rose-400 font-extrabold py-2.5 rounded-xl transition-all text-[11px] uppercase tracking-wider font-display flex items-center justify-center gap-1.5 cursor-pointer border-0"
                          >
                            Logout Session
                          </button>
                        </motion.div>
                      )}
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </header>
      )}

        {/* RESPONSIVE LEFT SIDEBAR BAR (DESKTOP ONLY) */}
        {!exportMode && loggedInUser && (
          <aside className="hidden md:flex bg-white dark:bg-[#111827] md:flex-col justify-between items-center md:py-8 md:w-24 border-r border-slate-200/50 dark:border-gray-800/40 shrink-0 relative z-30 no-print">
            {/* Top PW Logo Identity */}
            <div className="flex md:flex-col items-center gap-2">
              <PWLogo size="w-11 h-11" textSize="text-base animate-pulse" />
            </div>

            {/* Middle Nav Circle Stack */}
            <nav className="flex md:flex-col justify-center items-center gap-2 md:my-8">
              {/* Home Tab */}
              <button
                onClick={() => { setActiveView("home"); setErrorMessage(null); }}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  activeView === "home"
                    ? "bg-[#5277f7] text-white shadow-lg shadow-[#5277f7]/20"
                    : "text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/60"
                }`}
                title="Home Dashboard"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>

              {/* Search Trigger Tab */}
              <button
                onClick={() => { setSearchType("reg"); setActiveView("input"); setErrorMessage(null); }}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  activeView === "input"
                    ? "bg-[#5277f7] text-white shadow-lg shadow-[#5277f7]/20"
                    : "text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/60"
                }`}
                title="Student Database Query"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Student Classrooms list Tab */}
              <button
                onClick={handleLoadAllStudents}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  activeView === "batchList"
                    ? "bg-[#5277f7] text-white shadow-lg shadow-[#5277f7]/20"
                    : "text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/60"
                }`}
                title="Current Batch Directory"
              >
                <GraduationCap className="w-5 h-5" />
              </button>

              {/* Assessment Sub-Sheets Directory Tab */}
              <button
                onClick={() => { setActiveView("sheetsList"); setErrorMessage(null); }}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  activeView === "sheetsList"
                    ? "bg-[#5277f7] text-white shadow-lg shadow-[#5277f7]/20"
                    : "text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/60"
                }`}
                title="Assessment Sheet Directory"
              >
                <BookOpen className="w-5 h-5" />
              </button>

              {/* Database Synchronize Button */}
              <button
                onClick={handleDatabaseSync}
                disabled={isRefreshing}
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-400 hover:text-[#5277f7] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-gray-800/60 transition-all cursor-pointer"
                title="Synchronize Google Sheets"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin text-[#5277f7]" : ""}`} />
              </button>

              {/* Configuration Settings Tab — super-admin only */}
              {isSuperAdmin && (
              <button
                onClick={() => { setActiveView("admin"); setErrorMessage(null); }}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  activeView === "admin"
                    ? "bg-[#5277f7] text-white shadow-lg shadow-[#5277f7]/20"
                    : "text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/60"
                }`}
                title="System Configuration & Guide"
              >
                <Settings className="w-5 h-5" />
              </button>
              )}

              {/* Workspace Color Preferences */}
              <button
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-gray-800/60 transition-all cursor-pointer"
                title="Toggle Mode"
              >
                {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
              </button>
            </nav>

            {/* Bottom Active Staff Profile Popover Toggle */}
            <div className="flex flex-col items-center gap-2 relative">
              <button
                onClick={() => setShowProfileModal(!showProfileModal)}
                className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-slate-200/30 dark:border-gray-800 hover:border-[#5277f7] transition-all cursor-pointer bg-slate-50 dark:bg-gray-800/60 flex items-center justify-center font-black text-xs shrink-0 outline-none text-slate-800 dark:text-white uppercase tracking-wider"
                title={`${loggedInUser ? getFullNameFromEmail(loggedInUser.email) : 'View session details'}`}
              >
                {loggedInUser ? (
                  <img
                    src={loggedInUser.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(getFullNameFromEmail(loggedInUser.email))}&background=1d4ed8&color=fff&bold=true&size=128`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getFullNameFromEmail(loggedInUser.email))}&background=1d4ed8&color=fff&bold=true&size=128`;
                    }}
                  />
                ) : (
                  "PW"
                )}
              </button>

              <AnimatePresence>
                {showProfileModal && (
                  <>
                    {/* Click Outside Overlay Backdrop */}
                    <motion.div
                      key="profile-backdrop"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40 cursor-default bg-transparent"
                      onClick={() => setShowProfileModal(false)}
                    />

                    {/* Float profile card details popover */}
                    {loggedInUser && (
                      <motion.div
                        key="profile-popover"
                        initial={{ opacity: 0, scale: 0.92, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 12 }}
                        transition={{ type: "spring", damping: 25, stiffness: 350 }}
                        className="absolute bottom-0 left-24 z-50 w-72 bg-white dark:bg-[#111827] rounded-[24px] p-5 border border-slate-200 dark:border-gray-800 shadow-2xl text-left"
                      >
                        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-gray-800">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#5277f7] text-white flex items-center justify-center font-extrabold text-sm tracking-tight font-display">
                            <img
                              src={loggedInUser.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(getFullNameFromEmail(loggedInUser.email))}&background=1d4ed8&color=fff&bold=true&size=128`}
                              alt="Profile"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getFullNameFromEmail(loggedInUser.email))}&background=1d4ed8&color=fff&bold=true&size=128`;
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                              {getFullNameFromEmail(loggedInUser.email)}
                            </h4>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                              {loggedInUser.email}
                            </p>
                          </div>
                        </div>
                        <div className="py-3.5 space-y-2">
                          <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                            <span>Center:</span>
                            <span className="font-bold text-slate-700 dark:text-gray-300">Pimpri PW Vidyapeeth</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                            <span>Access Category:</span>
                            <span className="font-bold text-slate-700 dark:text-gray-300">Staff & Faculty Only</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                            <span>Indexing Status:</span>
                            <span className="font-bold text-emerald-500 flex items-center gap-1">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> ONLINE
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/25 dark:hover:bg-rose-950/50 dark:text-rose-400 font-extrabold py-2.5 rounded-xl transition-all text-[11px] uppercase tracking-wider font-display flex items-center justify-center gap-1.5 cursor-pointer border-0"
                        >
                          Logout Session
                        </button>
                      </motion.div>
                    )}
                  </>
                )}
              </AnimatePresence>
            </div>
          </aside>
        )}

        {/* MAIN DISPLAY CANVAS CORES */}
        <div ref={mainCanvasRef} className={`flex-1 flex flex-col min-w-0 ${
          exportMode 
            ? "p-0 bg-white text-black h-auto overflow-visible" 
            : "p-2.5 sm:p-4 md:p-5 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-5 bg-[#f4f7fc] dark:bg-[#090d16] overflow-y-auto custom-scrollbar"
        } relative z-10`}>
          
          {/* Top general status notification banner */}
          {errorMessage && !exportMode && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center justify-between gap-3 no-print"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button onClick={() => setErrorMessage(null)} className="text-[10px] font-mono font-black uppercase text-slate-400 hover:text-slate-700 tracking-wider">
                Dismiss
              </button>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            
            {/* HOME VIEW: Dribbble Aesthetic layout */}
            {activeView === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4 sm:space-y-8 py-2 sm:py-8 mt-2 sm:my-auto"
              >
                {/* Brand Promos */}
                <div className="text-center space-y-1.5 sm:space-y-4 max-w-2xl mx-auto py-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5277f7]/10 border border-[#5277f7]/20 text-[10px] font-bold text-[#5277f7] dark:text-blue-400 font-mono uppercase tracking-widest scale-90 sm:scale-100">
                    <Sparkles className="w-3 h-3 text-[#5277f7] animate-pulse" /> PW Vidyapeeth Academic Portal
                  </div>
                  <h2 className="text-xl sm:text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display px-4">
                    PW Vidyapeeth Academic Assessment Portal
                  </h2>
                  <p className="hidden sm:block text-xs md:text-sm text-slate-500 dark:text-gray-400 max-w-md md:max-w-lg mx-auto font-sans leading-relaxed px-4">
                    Instantly view student academic cards, detailed subject scores, test metrics, and comprehensive division rosters.
                  </p>
                </div>

                {/* THREE DIRECTORY ACTIONS (Bento Cards to choice Search Type) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 max-w-5xl mx-auto px-4 md:px-0">
                  {/* Search Type 1: Batch */}
                  <button
                    onClick={() => { setSearchType("batch"); setActiveView("input"); }}
                    className="bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-2xl md:rounded-3xl p-4 md:p-6 text-left hover:border-[#5277f7] dark:hover:border-blue-500 hover:shadow-xl hover:shadow-[#5277f7]/5 transition-all duration-300 group cursor-pointer outline-none relative overflow-hidden flex flex-row md:flex-col md:justify-between items-start md:items-stretch gap-4 md:gap-0 min-h-0 md:min-h-[220px]"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/10 to-transparent group-hover:from-blue-500/20 group-hover:scale-110 transition-all duration-300 rounded-bl-full pointer-events-none"></div>
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-blue-500/5 text-[#5277f7] dark:bg-blue-500/10 dark:text-blue-400 group-hover:bg-[#5277f7] group-hover:text-white transition-all duration-300 flex items-center justify-center shrink-0 md:mb-6 group-hover:scale-110">
                      <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-white font-display group-hover:text-[#5277f7] transition-colors leading-tight">
                        Browse Student Directory
                      </h3>
                      <p className="text-[11px] text-slate-450 dark:text-gray-400 mt-1 md:mt-2 font-sans leading-relaxed">
                        Get full student rosters and class rankings compiled across Pune division batches.
                      </p>
                      {/* Mobile action link */}
                      <div className="md:hidden mt-2 flex items-center gap-1.5 text-xs font-bold text-[#5277f7]">
                        Browse Directory <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                    {/* Desktop-only action link */}
                    <div className="hidden md:flex mt-6 items-center gap-1.5 text-xs font-bold text-[#5277f7]">
                      Browse Directory <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>

                  {/* Search Type 2: Name */}
                  <button
                    onClick={() => { setSearchType("name"); setActiveView("input"); }}
                    className="bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-2xl md:rounded-3xl p-4 md:p-6 text-left hover:border-[#5277f7] dark:hover:border-blue-500 hover:shadow-xl hover:shadow-[#5277f7]/5 transition-all duration-300 group cursor-pointer outline-none relative overflow-hidden flex flex-row md:flex-col md:justify-between items-start md:items-stretch gap-4 md:gap-0 min-h-0 md:min-h-[220px]"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-teal-500/10 to-transparent group-hover:from-teal-500/20 group-hover:scale-110 transition-all duration-300 rounded-bl-full pointer-events-none"></div>
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-teal-500/5 text-teal-500 dark:bg-teal-500/10 dark:text-teal-400 group-hover:bg-teal-500 group-hover:text-white transition-all duration-300 flex items-center justify-center shrink-0 md:mb-6 group-hover:scale-110">
                      <User className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-white font-display group-hover:text-[#5277f7] transition-colors leading-tight">
                        Search Student by Name
                      </h3>
                      <p className="text-[11px] text-slate-450 dark:text-gray-400 mt-1 md:mt-2 font-sans leading-relaxed">
                        Search for individual student profiles using dynamic autocomplete search filters.
                      </p>
                      {/* Mobile action link */}
                      <div className="md:hidden mt-2 flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400">
                        Search Profile <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                    {/* Desktop-only action link */}
                    <div className="hidden md:flex mt-6 items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400">
                      Search Profile <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>

                  {/* Search Type 3: Reg No */}
                  <button
                    onClick={() => { setSearchType("reg"); setActiveView("input"); }}
                    className="bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-2xl md:rounded-3xl p-4 md:p-6 text-left hover:border-[#5277f7] dark:hover:border-blue-500 hover:shadow-xl hover:shadow-[#5277f7]/5 transition-all duration-300 group cursor-pointer outline-none relative overflow-hidden flex flex-row md:flex-col md:justify-between items-start md:items-stretch gap-4 md:gap-0 min-h-0 md:min-h-[220px]"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/10 to-transparent group-hover:from-purple-500/20 group-hover:scale-110 transition-all duration-300 rounded-bl-full pointer-events-none"></div>
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-purple-500/5 text-purple-500 dark:bg-purple-500/10 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300 flex items-center justify-center shrink-0 md:mb-6 group-hover:scale-110">
                      <Hash className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-white font-display group-hover:text-[#5277f7] transition-colors leading-tight">
                        Search Registration Number
                      </h3>
                      <p className="text-[11px] text-slate-450 dark:text-gray-400 mt-1 md:mt-2 font-sans leading-relaxed">
                        Locate complete student reports directly by entering their official roll or registration key.
                      </p>
                      {/* Mobile action link */}
                      <div className="md:hidden mt-2 flex items-center gap-1.5 text-xs font-bold text-purple-650 dark:text-purple-400">
                        Search Registration ID <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                    {/* Desktop-only action link */}
                    <div className="hidden md:flex mt-6 items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                      Search Registration ID <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                </div>

                {/* DB Metadata Tracker */}
                <div className="max-w-xl mx-auto p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#eaedf5] dark:bg-[#111827]/45 text-center flex flex-col justify-center items-center gap-1 mx-4 sm:mx-auto">
                  <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <Compass className="w-3.5 h-3.5 text-emerald-500 animate-spin" style={{ animationDuration: '3s' }} />
                    IN-MEMORY INDEX CACHE STATUS: <span className="text-emerald-500 font-bold tracking-widest uppercase">● ACTIVE OPTIMIZED</span>
                  </div>
                  {dbStatus.lastLoaded && (
                    <div className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1 font-medium justify-center flex-wrap">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Assessed database mapped: {new Date(dbStatus.lastLoaded).toLocaleDateString()} {new Date(dbStatus.lastLoaded).toLocaleTimeString()} ({dbStatus.sheetCount || 0} sheets cached)
                    </div>
                  )}
                </div>

                {/* INLINE FOOTER FOR HOME VIEW (MOBILE & DESKTOP) */}
                <footer className="w-full text-center py-4 mt-6 border-t border-slate-250/20 dark:border-gray-800/40 no-print">
                  <p className="text-slate-450 dark:text-gray-500 text-[11px] font-mono leading-relaxed flex items-center justify-center gap-1.5 flex-wrap">
                    <span>For technical issues, contact:</span>
                    <a
                      href="mailto:aniket.mishra2@pw.live"
                      className="text-[#5277f7] dark:text-blue-400 hover:underline font-extrabold transition-colors flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" /> aniket.mishra2@pw.live
                    </a>
                  </p>
                </footer>
              </motion.div>
            )}

            {/* INPUT PANEL SEARCH VIEWS */}
            {activeView === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-md mx-auto w-full space-y-4 sm:space-y-6 mt-2 sm:my-auto"
              >
                {/* Back Link */}
                <button
                  onClick={() => { setActiveView("home"); setErrorMessage(null); }}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors text-xs font-bold font-display cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
                </button>

                <div className="bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-3xl p-6 md:p-8 space-y-4 shadow-sm overflow-visible">
                  <div className="border-b border-slate-100 dark:border-gray-850 pb-3">
                    <span className="text-[9px] font-mono font-bold tracking-widest text-[#5277f7] uppercase block mb-1">
                      Query filters
                    </span>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display leading-tight">
                      {searchType === "batch" && "Division Class List"}
                      {searchType === "name" && "Student Profile search"}
                      {searchType === "reg" && "Registration Number Search"}
                    </h2>
                  </div>

                  {/* Batch Select Options */}
                  {searchType === "batch" && (
                    <div className="space-y-1.5 relative" ref={batchDropdownRef}>
                      <label className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase">SELECT DIVISION BATCH</label>
                      
                      {/* Trigger Button */}
                      <button
                        type="button"
                        onClick={() => setIsBatchDropdownOpen(!isBatchDropdownOpen)}
                        className="w-full bg-slate-50 dark:bg-gray-800/60 border border-slate-200/60 dark:border-gray-700/60 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-bold flex items-center justify-between text-xs cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-gray-800 transition-all focus:outline-none focus:ring-1 focus:ring-[#5277f7]"
                      >
                        <span className={selectedBatch ? "text-slate-800 dark:text-white" : "text-slate-400"}>
                          {selectedBatch || "Select class division..."}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isBatchDropdownOpen ? "rotate-180 text-[#5277f7]" : ""}`} />
                      </button>

                      {/* Dropdown Panel */}
                      {isBatchDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/60 rounded-2xl shadow-2xl z-50 p-2.5 space-y-2.5 max-h-72 overflow-hidden flex flex-col">
                          {/* Search bar inside */}
                          <div className="relative shrink-0">
                            <input
                              type="text"
                              placeholder="Search division..."
                              value={classSelectSearchQuery}
                              onChange={(e) => setClassSelectSearchQuery(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-gray-800 border border-slate-200/40 dark:border-gray-700/60 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#5277f7]"
                              autoFocus
                            />
                            <Search className="w-4 h-4 text-slate-450 dark:text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          </div>

                          {/* Options list */}
                          <div className="overflow-y-auto flex-1 custom-scrollbar max-h-48 space-y-0.5">
                            {(() => {
                              const filtered = dropdowns.batches.filter(b =>
                                b.toLowerCase().includes(classSelectSearchQuery.toLowerCase())
                              );

                              if (filtered.length === 0) {
                                return (
                                  <div className="text-[11px] text-slate-450 italic p-3 text-center">
                                    No divisions match.
                                  </div>
                                );
                              }

                              return filtered.map((b) => (
                                <button
                                  key={b}
                                  type="button"
                                  onClick={() => {
                                    setSelectedBatch(b);
                                    setIsBatchDropdownOpen(false);
                                    setClassSelectSearchQuery("");
                                  }}
                                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all hover:bg-slate-50 dark:hover:bg-gray-800/65 ${
                                    selectedBatch === b
                                      ? "text-[#5277f7] dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                                      : "text-slate-700 dark:text-slate-350"
                                  }`}
                                >
                                  <span>{b}</span>
                                  {selectedBatch === b && (
                                    <Check className="w-3.5 h-3.5 text-[#5277f7] dark:text-blue-400 shrink-0" />
                                  )}
                                </button>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Name Search fields */}
                  {searchType === "name" && (
                    <div className="space-y-1.5 relative overflow-visible">
                      <label className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase">STUDENT FULL NAME</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={nameQuery}
                          onChange={(e) => {
                            setNameQuery(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          placeholder="Type student name..."
                          autoComplete="off"
                          className="w-full bg-slate-50 dark:bg-gray-800/60 border border-slate-200/60 dark:border-gray-700/60 rounded-xl pl-10 pr-4 py-3 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-[#5277f7] text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handlePerformSearch();
                          }}
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      </div>

                      {/* Suggestions list popup */}
                      {showSuggestions && nameQuery.trim().length > 0 && nameSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-700/60 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar z-50 overflow-hidden text-xs">
                          {nameSuggestions.map((name) => (
                            <div
                              key={name}
                              onClick={() => handleSuggestClick(name)}
                              className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-slate-700 dark:text-gray-300 transition-colors font-medium border-b border-slate-100 dark:border-gray-800 last:border-0"
                            >
                              {name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* registration keys */}
                  {searchType === "reg" && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase">REGISTRATION NUMBER</label>
                      <input
                        type="text"
                        value={regInput}
                        onChange={(e) => setRegInput(e.target.value)}
                        placeholder="e.g. 195220"
                        autoComplete="off"
                        className="w-full bg-slate-50 dark:bg-gray-800/60 border border-slate-200/60 dark:border-gray-700/60 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-mono focus:outline-none focus:border-[#5277f7] text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handlePerformSearch();
                        }}
                      />
                    </div>
                  )}

                  {/* Primary Trigger Fetch */}
                  <button
                    onClick={() => handlePerformSearch()}
                    className="w-full text-white font-extrabold py-3 rounded-xl transition-all shadow-md shadow-blue-500/10 text-xs uppercase tracking-wider font-display cursor-pointer flex items-center justify-center gap-2 bg-[#5277f7] hover:bg-[#4062dd] outline-none"
                  >
                    <Search className="w-3.5 h-3.5" /> Pull performance sheet
                  </button>
                </div>
              </motion.div>
            )}

            {/* BATCH STUDENTS LIST SCREEN */}
            {activeView === "batchList" && studentsPayload && (
              <motion.div
                  key="batchList"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="max-w-4xl mx-auto w-full space-y-6"
                >
                  <button
                    onClick={() => { setActiveView(selectedSheetName ? "sheetsList" : "input"); setErrorMessage(null); setBatchSearchQuery(""); }}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors text-xs font-bold font-display cursor-pointer no-print"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> {selectedSheetName ? "Back to sheets directory" : "Select another division batch"}
                  </button>

                  <div className="bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-150 dark:border-gray-800">
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-500/10 text-[9px] text-[#5277f7] dark:text-blue-400 uppercase tracking-widest font-mono font-extrabold mb-1.5 no-print">
                          <BookOpen className="w-3 h-3" /> {selectedSheetName ? "Google Sheets filter" : "Active Database Sheet"}
                        </span>
                        <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider font-display leading-tight">
                          {selectedSheetName ? selectedSheetName : "Student Directory Roster"}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {batchSearchQuery && (
                          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
                            Filtered: {filteredStudents.length} of {studentsPayload.students.length}
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-extrabold px-3 py-1 rounded-full bg-blue-500/5 text-[#5277f7] border border-blue-500/15">
                          {studentsPayload.students.length} Pupils found
                        </span>
                      </div>
                    </div>

                    {/* INTERACTIVE SEARCH BAR */}
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
                      <input
                        type="text"
                        value={batchSearchQuery}
                        onChange={(e) => setBatchSearchQuery(e.target.value)}
                        placeholder="Search student by Name, Roll/Reg, or Class Batch..."
                        className="w-full bg-slate-50 dark:bg-[#090d16]/80 border border-slate-200/50 dark:border-gray-800/80 rounded-2xl pl-11 pr-10 py-3 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:outline-none focus:border-[#5277f7] focus:ring-2 focus:ring-[#5277f7]/10 transition-all font-sans"
                      />
                      {batchSearchQuery && (
                        <button
                          onClick={() => setBatchSearchQuery("")}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-800 text-slate-450 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          title="Clear search query"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {filteredStudents.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-none md:max-h-[55vh] overflow-y-visible md:overflow-y-auto custom-scrollbar pr-1 pt-1">
                        {filteredStudents.slice(0, batchPageSize).map(({ student, originalIdx }) => (
                          <button
                            key={student.profile.regNo + "_" + originalIdx}
                            onClick={() => selectStudentFromBatch(originalIdx)}
                            className="bg-slate-50/50 dark:bg-gray-800/20 hover:bg-white dark:hover:bg-gray-800/80 border border-slate-200/50 dark:border-gray-800/50 hover:border-[#5277f7] dark:hover:border-blue-500 rounded-2xl p-3 sm:p-4 flex items-center justify-between transition-all duration-300 text-left w-full cursor-pointer outline-none group hover:shadow-md hover:shadow-blue-500/5"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                alt="avatar"
                                src={getStudentAvatar(student.profile.name, originalIdx)}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-slate-200/20 dark:border-gray-800/40 shrink-0 group-hover:scale-105 transition-transform"
                                referrerPolicy="no-referrer"
                              />
                              <div className="min-w-0 space-y-1">
                                <div className="font-extrabold text-slate-800 dark:text-white text-xs sm:text-sm group-hover:text-[#5277f7] dark:group-hover:text-blue-400 transition-colors leading-tight truncate pr-1">
                                  {student.profile.name}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-slate-400 border border-slate-200/30 dark:border-gray-700/30">
                                    #{student.profile.regNo}
                                  </span>
                                  {student.profile.batch && (
                                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50/50 dark:bg-blue-950/20 text-[#5277f7] dark:text-blue-400 border border-blue-100/30 dark:border-blue-900/20 truncate max-w-[120px]" title={student.profile.batch}>
                                      {student.profile.batch}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  const shareUrl = `${window.location.origin}/student/${encodeURIComponent(student.profile.regNo || "")}/${encodeURIComponent(student.profile.shareToken || "")}`;
                                  safeCopyToClipboard(shareUrl).then((success) => {
                                    if (success) {
                                      setCopiedReg(student.profile.regNo);
                                      setTimeout(() => setCopiedReg(null), 2000);
                                    }
                                  });
                                }}
                                className="p-1.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-gray-850 dark:hover:bg-gray-750 text-slate-400 hover:text-[#5277f7] border border-slate-200/50 dark:border-gray-800 transition-all flex items-center justify-center cursor-pointer"
                                title="Copy shareable direct link to student performance card"
                              >
                                {copiedReg === student.profile.regNo ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Share2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                              {copiedReg === student.profile.regNo ? (
                                <span className="text-[9px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 whitespace-nowrap">
                                  Copied!
                                </span>
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-gray-600 group-hover:text-[#5277f7] transition-colors" />
                              )}
                            </div>
                          </button>
                        ))}
                        {filteredStudents.length > batchPageSize && (
                          <div className="col-span-full flex justify-center py-4">
                            <button
                              onClick={() => setBatchPageSize((prev) => prev + 50)}
                              className="px-6 py-2.5 rounded-xl bg-[#5277f7] hover:bg-[#4062dd] text-white text-xs font-bold uppercase tracking-wider cursor-pointer border-0 transition-all shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30"
                            >
                              Load More ({filteredStudents.length - batchPageSize} remaining)
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-12 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-gray-850 flex items-center justify-center mx-auto text-slate-400 dark:text-gray-600">
                          <Search className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-white">No matches found</h4>
                          <p className="text-xs text-slate-400 dark:text-gray-500 max-w-xs mx-auto">
                            We couldn't find any students matching "{batchSearchQuery}". Try search for another Name, Roll or Class.
                          </p>
                        </div>
                        <button
                          onClick={() => setBatchSearchQuery("")}
                          className="text-xs text-[#5277f7] font-bold hover:underline cursor-pointer"
                        >
                          Clear Search Filter
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
            )}
            {/* MAIN STUDENT REPORT CARDS & DASHBOARDS */}
            {activeView === "dashboard" && activeStudent && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 w-full"
              >
                
                {/* BACK CONTROL LINE WITH PRINT STRIPS */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print border-b border-slate-200/30 dark:border-gray-800/30 pb-4">
                  {loggedInUser ? (
                    <button
                      onClick={() => {
                        if (searchType === "batch" && studentsPayload && studentsPayload.students.length > 1) {
                          setActiveView("batchList");
                        } else {
                          setActiveView("input");
                        }
                        setErrorMessage(null);
                      }}
                      className="flex items-center gap-2 text-slate-505 dark:text-gray-400 hover:text-[#5277f7] transition-all text-xs font-bold font-sans cursor-pointer uppercase tracking-wider border-0 bg-transparent"
                    >
                      <ArrowLeft className="w-4 h-4 text-[#5277f7]" />
                      {searchType === "batch" && studentsPayload && studentsPayload.students.length > 1
                        ? "GO BACK TO GRID"
                        : "START NEW QUERY"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-[#5277f7] dark:text-blue-400 text-xs font-black font-display uppercase tracking-wider select-none">
                      <PWLogo size="w-6 h-6" /> Vidyapeeth Student Portal
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
                    <button
                      onClick={triggerPrint}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-650 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-750 transition-colors shadow-sm cursor-pointer text-xs font-bold font-display uppercase tracking-wider"
                      title="Print Report"
                    >
                      <Printer className="w-4 h-4" /> Print report
                    </button>
                    {loggedInUser && (
                      <button
                        onClick={handleShareReport}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition-all shadow-md shadow-orange-500/10 cursor-pointer text-xs font-bold font-display uppercase tracking-wider border-0"
                        title="Share Student Report Card Link"
                      >
                        {copiedShare ? (
                          <>
                            <Check className="w-4 h-4" /> Copied!
                          </>
                        ) : (
                          <>
                            <Share2 className="w-4 h-4" /> Share Card
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={downloadReportPdf}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#5277f7] hover:bg-[#4062dd] text-white transition-all shadow-md shadow-blue-500/10 cursor-pointer text-xs font-bold font-display uppercase tracking-wider border-0"
                      title="Download high-resolution PDF Report"
                    >
                      <Download className="w-4 h-4" /> Export PDF
                    </button>
                  </div>
                </div>

              {/* PDF REPORT AREA TARGET */}
              <div
                id="pdfContentArea"
                ref={exportAreaRef}
                className="space-y-4 w-full bg-transparent text-slate-800 dark:text-slate-100"
              >
                
                {/* HEADERS TO SHOW ONLY FOR PRINT & EXPORT SHIELDS */}
                <div className={`${exportMode ? "flex" : "hidden md:print:flex"} print-header dark:text-black flex justify-between items-center pb-2 mb-2 border-b border-slate-350`}>
                  <div className="flex items-center gap-2">
                    <PWLogo size="h-10 w-10" textSize="text-xs" className="bg-slate-950 text-white" />
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-black font-display leading-none">
                        PW Vidyapeeth
                      </h2>
                      <p className="text-[9px] text-gray-500 font-mono tracking-widest uppercase mt-0.5">
                        {activeStudent.profile.center || "Pimpri PW Vidyapeeth"} Student Analytics
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-base font-black text-slate-900 tracking-wider font-display uppercase leading-none">
                      PERFORMANCE METRICS
                    </h3>
                    <p className="text-[8px] text-slate-500 font-mono mt-0.5">
                      Generated: {new Date().toLocaleDateString("en-GB")} {new Date().toLocaleTimeString("en-GB")}
                    </p>
                  </div>
                </div>

                {/* VISUAL PROFILE BOARD CARD */}
                <div className={`${
                  exportMode 
                    ? "bg-slate-50 text-slate-900 border border-slate-200" 
                    : "bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 text-white border border-slate-805/85 shadow-lg"
                } rounded-2xl p-4 md:p-5 relative overflow-hidden print-card-shadow mb-4`}>
                  {!exportMode && (
                    <>
                      <div className="absolute top-0 right-0 w-64 h-64 bg-radial-gradient from-blue-500/10 to-transparent rounded-full blur-2xl pointer-events-none"></div>
                      <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-500/5 rounded-full blur-xl pointer-events-none"></div>
                    </>
                  )}
                  
                  <div className={`${
                    exportMode
                      ? "flex flex-row justify-between items-stretch"
                      : "flex flex-col md:flex-row justify-between items-start md:items-center"
                  } gap-4 relative z-10 w-full`}>
                    <div className="space-y-4 flex-1 min-w-0 w-full">
                      <div>
                        <span className={`inline-flex gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider font-mono mb-1.5 ${
                          exportMode 
                            ? "bg-blue-50 border-blue-100 text-blue-600" 
                            : "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                        }`}>
                          Student Assessment Portfolio
                        </span>
                        <div className="flex items-center gap-3">
                          <h2 className={`${exportMode ? "text-2xl" : "text-xl md:text-2xl"} font-black tracking-tight font-display leading-tight animate-fade-in ${
                            exportMode 
                              ? "text-slate-900" 
                              : "bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent"
                          }`}>
                            {activeStudent.profile.name}
                          </h2>
                          {!exportMode && activeStudent.profile.shareToken && (
                            <StudentQR
                              url={`${window.location.origin}/student/${encodeURIComponent(activeStudent.profile.regNo || "")}/${encodeURIComponent(activeStudent.profile.shareToken)}`}
                              name={activeStudent.profile.name}
                              regNo={activeStudent.profile.regNo}
                            />
                          )}
                        </div>
                      </div>

                      <div className={`grid ${
                        exportMode ? "grid-cols-4" : "grid-cols-2 md:grid-cols-4"
                      } gap-y-3 gap-x-4 w-full pt-2 border-t ${
                        exportMode ? "border-slate-200" : "border-white/5"
                      }`}>
                        <div className="space-y-0.5 min-w-0">
                          <span className={`text-[9px] uppercase tracking-widest font-mono font-bold block ${
                            exportMode ? "text-slate-500" : "text-slate-400"
                          }`}>
                            Registration ID
                          </span>
                          <span className={`text-xs font-semibold tracking-wide font-mono truncate block ${
                            exportMode ? "text-slate-800" : "text-slate-200"
                          }`}>
                            {activeStudent.profile.regNo || "N/A"}
                          </span>
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <span className={`text-[9px] uppercase tracking-widest font-mono font-bold block ${
                            exportMode ? "text-slate-500" : "text-slate-400"
                          }`}>
                            Assess Stream
                          </span>
                          <span className={`inline-flex font-black text-[9px] px-2 py-0.5 rounded-full tracking-wider uppercase border font-mono ${
                            exportMode 
                              ? "text-blue-600 bg-blue-50 border-blue-100" 
                              : "text-blue-400 bg-blue-500/10 border border-blue-500/20"
                          }`}>
                            {activeStudent.profile.stream || studentsPayload?.stream || "JEE"}
                          </span>
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <span className={`text-[9px] uppercase tracking-widest font-mono font-bold block ${
                            exportMode ? "text-slate-500" : "text-slate-400"
                          }`}>
                            Mapped Center
                          </span>
                          <span className={`text-xs font-semibold truncate block ${
                            exportMode ? "text-slate-800" : "text-slate-200"
                          }`} title={activeStudent.profile.center || "Pimpri PW Vidyapeeth"}>
                            {activeStudent.profile.center || "Pimpri PW Vidyapeeth"}
                          </span>
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <span className={`text-[9px] uppercase tracking-widest font-mono font-bold block ${
                            exportMode ? "text-slate-500" : "text-slate-400"
                          }`}>
                            Study Division
                          </span>
                          <span className={`text-xs font-bold block truncate ${
                            exportMode ? "text-indigo-600" : "text-indigo-300"
                          }`} title={activeStudent.profile.batch}>
                            {activeStudent.profile.batch || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={`rounded-xl p-3 flex flex-col items-center justify-center shrink-0 text-center ${
                      exportMode ? "w-40 self-stretch" : "w-full md:w-36"
                    } ${
                      exportMode 
                        ? "bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 shadow-sm" 
                        : "bg-white/5 backdrop-blur-md border border-white/10 shadow-md"
                    }`}>
                      <span className={`text-[9px] uppercase tracking-widest font-mono font-bold block mb-0.5 ${
                        exportMode ? "text-amber-700" : "text-slate-400"
                      }`}>
                        Latest Rank
                      </span>
                      <span className={`${exportMode ? "text-3xl" : "text-xl md:text-2xl"} font-black flex items-center gap-1 font-display tracking-tight ${
                        exportMode ? "text-amber-700" : "text-amber-400 drop-shadow-md"
                      }`}>
                        <Award className={`${exportMode ? "w-6 h-6" : "w-5 h-5"} shrink-0 ${exportMode ? "text-amber-600" : "text-yellow-400"}`} />
                        {activeStudent.profile.latestRank !== "N/A"
                          ? `#${activeStudent.profile.latestRank}`
                          : "N/A"}
                      </span>
                      {activeStudent.profile.latestRank !== "N/A" && activeStudent.profile.latestRankDate && activeStudent.profile.latestRankDate !== "N/A" && (
                        <span className={`text-[9px] font-bold font-mono uppercase tracking-wider mt-1.5 px-2.5 py-0.5 rounded-full border ${
                          exportMode 
                            ? "bg-white text-amber-800 border-amber-200" 
                            : "bg-white/10 text-slate-200 border-white/10"
                        }`}>
                          {formatDateString(activeStudent.profile.latestRankDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* REAL-TIME METRICS KPI DECK */}
                {(() => {
                  const totalTestsCount = activeStudent.tests.length;
                  const validGrades = activeStudent.tests.filter(
                    (t) => t.score !== "N/A" && t.score !== undefined && t.score !== "" && t.score !== "-"
                  );
                  
                  const overallParsedMarks = validGrades.reduce((sum, t) => {
                    const score = parseFloat(String(t.score));
                    return sum + (isNaN(score) ? 0 : score);
                  }, 0);
                  const overallMaxMarks = validGrades.reduce((sum, t) => {
                    const outOf = parseFloat(String(t.outOf));
                    return sum + (isNaN(outOf) ? 0 : outOf);
                  }, 0);
                  const averagePercentageValue = overallMaxMarks > 0 ? (overallParsedMarks / overallMaxMarks) * 100 : 0;
                  
                  const rankValues = validGrades
                    .map((t) => parseInt(String(t.centerRank)))
                    .filter((r) => !isNaN(r) && r > 0);
                  const bestRank = rankValues.length > 0 ? Math.min(...rankValues) : null;
                  
                  const totalUnattemptedCount = validGrades.reduce((sum, t) => {
                    const unatt = parseInt(String(t.unattempted));
                    return sum + (isNaN(unatt) ? 0 : unatt);
                  }, 0);
                  const avgUnattemptedValue = validGrades.length > 0 ? totalUnattemptedCount / validGrades.length : 0;
                  
                  return (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print mb-4 animate-fade-in">
                      {/* CARD 1 */}
                      <div className="bg-white dark:bg-[#111827] rounded-xl p-3 md:p-3.5 border border-slate-100 dark:border-gray-800/80 shadow-xs hover:shadow-md transition-all border-b-4 border-b-blue-600 dark:border-b-blue-500">
                        <span className="text-[9px] text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono font-bold block mb-0.5">AGGREGATE RATINGS</span>
                        <div className="text-lg md:text-xl lg:text-2xl font-black text-slate-800 dark:text-white font-display">
                          {averagePercentageValue > 0 ? `${averagePercentageValue.toFixed(1)}%` : "0.0%"}
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-gray-800 rounded-full h-1 mt-2 overflow-hidden">
                          <div className="bg-blue-600 h-1 rounded-full" style={{ width: `${Math.min(100, averagePercentageValue)}%` }} />
                        </div>
                      </div>

                      {/* CARD 2 */}
                      <div className="bg-white dark:bg-[#111827] rounded-xl p-3 md:p-3.5 border border-slate-100 dark:border-gray-800/80 shadow-xs hover:shadow-md transition-all border-b-4 border-b-emerald-600 dark:border-b-emerald-500">
                        <span className="text-[9px] text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono font-bold block mb-0.5">TOTAL EXAMINATIONS</span>
                        <div className="text-lg md:text-xl lg:text-2xl font-black text-slate-800 dark:text-white font-display">
                          {totalTestsCount} <span className="text-[10px] text-slate-400 dark:text-gray-400 font-medium">Recorded</span>
                        </div>
                        <p className="text-[9px] text-slate-400 dark:text-gray-500 mt-2 font-sans leading-none">Complete stream timeline</p>
                      </div>

                      {/* CARD 3 */}
                      <div className="bg-white dark:bg-[#111827] rounded-xl p-3 md:p-3.5 border border-slate-100 dark:border-gray-800/80 shadow-xs hover:shadow-md transition-all border-b-4 border-b-violet-600 dark:border-b-violet-500">
                        <span className="text-[9px] text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono font-bold block mb-0.5">OPTIMAL POSITION</span>
                        <div className="text-lg md:text-xl lg:text-2xl font-black text-violet-600 dark:text-violet-400 font-display">
                          {bestRank ? `#${bestRank}` : "N/A"}
                        </div>
                        <p className="text-[9px] text-slate-400 dark:text-gray-500 mt-2 font-sans leading-none">Best center rank record</p>
                      </div>

                      {/* CARD 4 */}
                      <div className="bg-white dark:bg-[#111827] rounded-xl p-3 md:p-3.5 border border-slate-100 dark:border-gray-800/80 shadow-xs hover:shadow-md transition-all border-b-4 border-b-amber-600 dark:border-b-amber-500">
                        <span className="text-[9px] text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono font-bold block mb-0.5">AVG UNATTEMPTED</span>
                        <div className="text-lg md:text-xl lg:text-2xl font-black text-amber-600 dark:text-amber-400 font-display">
                          {avgUnattemptedValue.toFixed(1)} <span className="text-[10px] text-slate-400 dark:text-gray-400 font-medium">Questions</span>
                        </div>
                        <p className="text-[9px] text-slate-400 dark:text-gray-500 mt-2 font-sans leading-none text-amber-600/75 dark:text-amber-400/85 font-semibold">Average questions skipped</p>
                      </div>
                    </div>
                  );
                })()}

                {/* DETAILED DATA LOG TABLE MARKS */}
                <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-205/60 dark:border-gray-800/80 shadow-md overflow-hidden print-card-shadow">
                  {/* Table Header toolbar for Desktop */}
                  <div className="hidden md:flex px-4 py-2.5 bg-slate-50/50 dark:bg-gray-900/10 border-b border-slate-200/65 dark:border-gray-800/80 items-center justify-between no-print">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-3.5 bg-blue-600 rounded-full" />
                      <h3 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-display">
                        Academic Assessment Index
                      </h3>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-250/20 dark:border-gray-700/50">
                      {activeStudent.tests.length} Examinations recorded
                    </span>
                  </div>

                  {/* Responsive table overflow wrapper */}
                  <div className="w-full overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs table-layout-fixed md:table">
                      <thead className="bg-[#1e293b]/5 dark:bg-gray-800/60 text-[9px] tracking-wider uppercase border-b border-slate-200/60 dark:border-gray-800/70 text-slate-500 dark:text-slate-350 font-semibold md:table-header-group hidden">
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left min-w-[110px]">Class</th>
                          <th className="px-3 py-2 text-left min-w-[190px]">Test Name</th>
                          <th className="px-3 py-2 text-center">Max Marks</th>
                          <th className="px-3 py-2 text-center font-bold">Obtained</th>
                          <th className="px-3 py-2 text-left text-blue-600 dark:text-blue-400 font-extrabold min-w-[130px]">Avg Score %</th>
                          {finalSubjects.map((sub) => (
                            <th key={sub} className="px-3 py-2 text-right capitalize">
                              {sub}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right">Skipped</th>
                          <th className="px-3 py-2 text-right font-black text-emerald-600 dark:text-emerald-400">Rank</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 dark:divide-gray-800 md:table-row-group block bg-transparent">
                        {activeStudent.tests.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6 + finalSubjects.length + 2}
                              className="px-6 py-12 text-center text-slate-400 dark:text-gray-500 text-sm font-medium font-display"
                            >
                              No assessment markers mapped for this student profile.
                            </td>
                          </tr>
                        ) : (
                          activeStudent.tests.map((test, index) => {
                            const expandedName = formatFullTestName(test.name);
                            return (
                              <tr
                                key={test.name + "_" + index}
                                className="hover:bg-slate-50/50 dark:hover:bg-gray-800/10 transition-colors md:table-row block p-3.5 border-b md:border-b-0 border-slate-200 dark:border-gray-800 mb-3.5 md:mb-0 rounded-xl md:rounded-none bg-white dark:bg-transparent"
                              >
                                {/* Date Block */}
                                <td className="px-3 py-1.5 md:py-2 md:table-cell flex justify-between items-center whitespace-nowrap">
                                  <span className="md:hidden text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono">
                                    Date:
                                  </span>
                                  <span className="font-mono text-slate-500 dark:text-gray-400 font-semibold text-[11px]">
                                    {formatDateString(test.date)}
                                  </span>
                                </td>

                                {/* Class Column */}
                                <td className="px-3 py-1.5 md:py-2 md:table-cell flex justify-between items-center min-w-[110px]">
                                  <span className="md:hidden text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono">
                                    Class:
                                  </span>
                                  <span className="font-bold text-slate-800 dark:text-slate-100 tracking-tight text-[11px]">
                                    {test.testClass && test.testClass !== "N/A" ? test.testClass : "-"}
                                  </span>
                                </td>

                                {/* Test Name Column */}
                                <td className="px-3 py-1.5 md:py-2 md:table-cell flex justify-between items-center min-w-[190px]">
                                  <span className="md:hidden text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono">
                                    Test:
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize tracking-wide inline-flex items-center gap-1 ${getTypeBadgeStyles(expandedName)}`}>
                                    <span className="inline-block w-1 h-1 rounded-full bg-current opacity-80" />
                                    {expandedName}
                                  </span>
                                </td>

                                {/* Out Of Marks */}
                                <td className="px-3 py-1.5 md:py-2 md:table-cell flex justify-between items-center text-center">
                                  <span className="md:hidden text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono">
                                    Max Marks:
                                  </span>
                                  <span className="font-mono font-bold text-slate-500 dark:text-gray-400 text-[11px]">
                                    {test.outOf}
                                  </span>
                                </td>

                                {/* Score Obtained */}
                                <td className="px-3 py-1.5 md:py-2 md:table-cell flex justify-between items-center text-center">
                                  <span className="md:hidden text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono">
                                    Score:
                                  </span>
                                  <span className="font-mono font-extrabold text-slate-900 dark:text-white text-[11px]">
                                    {test.score}
                                  </span>
                                </td>

                                {/* Student Average Percent Rating */}
                                <td className="px-3 py-1.5 md:py-2 md:table-cell flex justify-between items-center text-left md:bg-blue-50/10 dark:md:bg-blue-900/5 min-w-[130px]">
                                  <span className="md:hidden text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
                                    Avg %:
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 text-[11px]">
                                      {test.avgScore !== "N/A"
                                        ? `${parseFloat(test.avgScore).toFixed(1)}%`
                                        : "0.0%"}
                                    </span>
                                    {test.avgScore !== "N/A" && (
                                      <div className="w-10 bg-slate-100 dark:bg-gray-800 rounded-full h-1 overflow-hidden hidden lg:block border border-slate-200/10">
                                        <div 
                                          className="bg-blue-600 dark:bg-blue-500 h-1 rounded-full" 
                                          style={{ width: `${Math.min(100, parseFloat(test.avgScore))}%` }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* Subject scores breakdown */}
                                {finalSubjects.map((subName, subIdx) => {
                                  const normSub = subName.toLowerCase().trim().replace(/\./g, "");
                                  let scoreVal: any = "-";

                                  if (test.subjectScores && test.subjectScores.length > 0) {
                                    const subObj = test.subjectScores.find(
                                      (s) => s.subject.toLowerCase() === subName.toLowerCase()
                                    );
                                    scoreVal = subObj ? subObj.score : "-";
                                  } else {
                                    // Fallback to sub1/sub2/sub3/sub4 mapping for older records
                                    if (normSub.startsWith("phys")) {
                                      scoreVal = test.sub1;
                                    } else if (normSub.startsWith("chem")) {
                                      scoreVal = test.sub2;
                                    } else if (normSub.startsWith("math") || normSub.startsWith("mathem")) {
                                      scoreVal = test.sub3;
                                    } else if (normSub.startsWith("bot")) {
                                      scoreVal = test.sub3;
                                    } else if (normSub.startsWith("zoo")) {
                                      scoreVal = test.sub4;
                                    }
                                  }

                                  return (
                                    <td
                                      key={subName}
                                      className={`px-3 py-1.5 md:py-2 md:table-cell flex justify-between items-center text-right ${
                                        subIdx === 0
                                          ? "border-t border-slate-100 dark:border-gray-800/40 md:border-t-0"
                                          : ""
                                      }`}
                                    >
                                      <span className="md:hidden text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono">
                                        {subName}:
                                      </span>
                                      <span className="font-mono text-slate-700 dark:text-gray-300 font-bold text-[11px]">
                                        {formatRawScoreValue(scoreVal)}
                                      </span>
                                    </td>
                                  );
                                })}

                                {/* Unattempted question count */}
                                <td className="px-3 py-1.5 md:py-2 md:table-cell flex justify-between items-center text-right">
                                  <span className="md:hidden text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono">
                                    Unattempted:
                                  </span>
                                  <span className="font-mono text-slate-500 dark:text-slate-450 font-bold text-[11px]">
                                    {formatRawScoreValue(test.unattempted)}
                                  </span>
                                </td>

                                {/* Examination Rank */}
                                <td className="px-3 py-1.5 md:py-2 md:table-cell flex justify-between items-center text-right">
                                  <span className="md:hidden text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono">
                                    Center Rank:
                                  </span>
                                  <span className={`font-mono font-extrabold text-[12px] ${
                                    test.centerRank === "1"
                                      ? "text-yellow-500 drop-shadow-sm font-black"
                                      : test.centerRank !== "-" && test.centerRank !== ""
                                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                      : "text-slate-400"
                                  }`}>
                                    {test.centerRank !== "-" && test.centerRank !== ""
                                      ? `#${test.centerRank}`
                                      : "-"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* VISUAL FOOTER PRINT COMPONENT */}
                <div className={`${exportMode ? "block" : "hidden md:print:block"} print-footer mt-8 pt-4 border-t border-slate-200 text-center text-gray-500 text-[10px] italic`}>
                  This report was compiled and printed generated via automatic performance matrices on PW {activeStudent.profile.center || "Pimpri PW Vidyapeeth"} Hub database.
                </div>

              </div>
            </motion.div>
          )}

          {activeView === "sheetsList" && (
            <motion.div
              key="sheetsList"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 max-w-6xl mx-auto py-2 w-full"
            >
              {/* Header panel */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#111827] p-6 rounded-3xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm">
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#5277f7] dark:text-blue-400" />
                    Worksheet Directory
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">
                    Instantly query student test rosters by selecting a specific spreadsheet tab.
                  </p>
                </div>
                
                {/* Local Sheet Search/Filter input */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter sheets list..."
                    value={sheetFilterQuery || ""}
                    onChange={(e) => setSheetFilterQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 focus:outline-none focus:ring-1 focus:ring-[#5277f7] focus:border-transparent text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Grid of sheets */}
              {dropdowns.sheets && dropdowns.sheets.length > 0 ? (
                filteredSheets.length === 0 ? (
                  <div className="bg-white dark:bg-[#111827] rounded-3xl p-12 text-center border border-slate-200/50 dark:border-gray-800/40">
                    <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Sheets Found</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Try matching another date or grade name.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSheets.map((sheetName) => {
                      const dateRegex = /^(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)/i;
                      const dateMatch = sheetName.match(dateRegex);
                      let dateBadge = "Test";
                      let mainTitle = sheetName;
                      if (dateMatch) {
                        dateBadge = `${dateMatch[1]} ${dateMatch[2].toUpperCase().substring(0, 3)}`;
                        mainTitle = sheetName.replace(dateRegex, "").trim();
                      }

                      return (
                        <motion.button
                          key={sheetName}
                          onClick={() => handleLoadSheetStudents(sheetName)}
                          whileHover={{ y: -2 }}
                          className="bg-white dark:bg-[#111827] border border-slate-200/60 dark:border-gray-800/40 hover:border-[#5277f7] dark:hover:border-blue-500 rounded-2xl md:rounded-3xl p-5 text-left transition-all hover:shadow-lg hover:shadow-slate-200/40 dark:hover:shadow-none flex flex-col justify-between h-40 group cursor-pointer w-full relative overflow-hidden outline-none"
                        >
                          <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#5277f7]/5 rounded-full group-hover:scale-125 transition-transform duration-500"></div>

                          <div className="space-y-2 relative z-10 w-full">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex font-black text-[9px] text-[#5277f7] dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg uppercase tracking-widest font-mono">
                                {dateBadge}
                              </span>
                              <div className="flex items-center gap-2">
                                {dropdowns.sheetUrls && dropdowns.sheetUrls[sheetName] && (
                                  <a
                                    href={dropdowns.sheetUrls[sheetName]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded-lg hover:bg-[#5277f7]/10 dark:hover:bg-blue-500/15 text-slate-400 dark:text-gray-500 hover:text-[#5277f7] dark:hover:text-blue-400 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                                    title="Open in Google Sheets"
                                  >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#5277f7] dark:group-hover:text-blue-400 transition-colors shrink-0" />
                              </div>
                            </div>

                            <h3 className="line-clamp-2 text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#5277f7] dark:group-hover:text-blue-400 transition-colors leading-snug pr-4">
                              {mainTitle}
                            </h3>
                          </div>

                          <div className="pt-2 border-t border-slate-100 dark:border-gray-800/30 w-full flex items-center justify-between text-[11px] text-slate-400 dark:text-gray-500 font-mono relative z-10">
                            <span className="truncate max-w-[130px] font-semibold" title={sheetName}>
                              {sheetName}
                            </span>
                            {dropdowns.sheetStats && dropdowns.sheetStats[sheetName] !== undefined ? (
                              <span className="text-[10px] text-blue-650 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/10 px-1.5 py-0.5 rounded font-sans shrink-0">
                                {dropdowns.sheetStats[sheetName]} Pupils
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/15 px-1.5 py-0.5 rounded uppercase font-sans shrink-0">
                                Live Data
                              </span>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="bg-white dark:bg-[#111827] rounded-3xl p-12 text-center border border-slate-200/50 dark:border-gray-800/40">
                  <div className="animate-spin h-8 w-8 border-2 border-slate-250 dark:border-gray-800 border-t-blue-600 dark:border-t-blue-500 rounded-full mx-auto mb-4"></div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Loading sheets roster from Google database...</p>
                </div>
              )}
            </motion.div>
          )}

          {activeView === "admin" && isSuperAdmin && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 max-w-6xl mx-auto py-2 w-full text-slate-800 dark:text-slate-100"
            >
              {/* Header Panel */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#111827] p-6 rounded-3xl border border-slate-200/50 dark:border-gray-800/40 shadow-sm">
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#5277f7] dark:text-blue-400" />
                    App Control Center & System Settings
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">
                    Manage spreadsheet databases, custom tuition center configurations, and view portal guidelines.
                  </p>
                </div>
              </div>              {/* Helper: Resolution explanation calculator */}
              {(() => {
                const getSheetResolutionSource = (sheetName: string, sourceUrl: string) => {
                  const cleanSheetName = sheetName.trim().toLowerCase();
                  const cleanSourceUrl = String(sourceUrl || "").trim().toLowerCase();

                  // 1. Check tab-level overrides
                  for (const group of subsheetCenters) {
                    for (const pat of group.patterns) {
                      const cleanPat = String(pat).trim().toLowerCase();
                      if (!cleanPat) continue;

                      // Match by GID URL
                      const match = cleanPat.match(/[?&]gid=(\d+)/i);
                      const patGid = match ? match[1] : null;
                      if (patGid && cleanSheetName.includes(patGid)) {
                        return { type: "Tab Rule", pattern: pat, center: group.center };
                      }

                      // Match by Subsheet Name directly
                      if (cleanSheetName === cleanPat || cleanSheetName.includes(cleanPat)) {
                        return { type: "Tab Rule", pattern: pat, center: group.center };
                      }
                    }
                  }

                  // 2. Default fallback for the 12 default subsheets mapping to Pimple Saudagar
                  const isDefaultWorkbook = !cleanSourceUrl || 
                                            cleanSourceUrl.includes("1ztnvtyd4wrcv9bthqi1ek-nh8tsieszw5ifvhxtajpm") || 
                                            cleanSourceUrl.includes("2pacx-1vsvei4kdmjhmimnsclebffoavbwlct9sjf1kaphus7torlfuthc7m7jk3tgx6xclqltylnxxvpfxhei");
                  const defaultPimpleSaudagarSheets = [
                    "03 may 11th jee city test tc",
                    "10 may 11th jee milestone tc",
                    "24 may 11th jee city test 2",
                    "31th may 11th jee milestone",
                    "10 may 12th jee city test tc",
                    "931820364",
                    "17 may 12th jee milestone",
                    "31 may 12th jee city test tc",
                    "07th june 12th jee milestone",
                    "10 may 12th neet city test tc",
                    "1901367772",
                    "17 may 12th neet milestone",
                    "31 may 12th neet city test 2",
                    "07 june 12th neet phase 1 milestone"
                  ];
                  if (isDefaultWorkbook && defaultPimpleSaudagarSheets.some(s => cleanSheetName.includes(s.toLowerCase()))) {
                    return { type: "Default Fallback", pattern: "Default Subsheet List", center: "Pimple Saudagar Tuition Center" };
                  }

                  // 3. Check SPREADSHEET_CENTERS (spreadsheet file-level mappings)
                  for (const item of spreadsheetCenters) {
                    const cleanPat = String(item.pattern).trim().toLowerCase();
                    if (cleanPat && cleanSourceUrl.includes(cleanPat)) {
                      return { type: "Spreadsheet Rule", pattern: item.pattern, center: item.center };
                    }
                  }

                  return { type: "System Default", pattern: "N/A", center: "Pimpri PW Vidyapeeth" };
                };

                const allKnownCenters = Array.from(new Set([
                  "Pimpri PW Vidyapeeth",
                  "Pimple Saudagar Tuition Center",
                  ...spreadsheetCenters.map(c => c.center),
                  ...subsheetCenters.map(c => c.center),
                  ...activeSheets.map(s => s.center)
                ].map(c => c.trim()).filter(Boolean)));

                const handleQuickMapSheet = async (sheetName: string, targetCenter: string) => {
                  if (!targetCenter) return;
                  
                  let updatedGroups = subsheetCenters.map(group => {
                    return {
                      ...group,
                      patterns: group.patterns.filter(p => p.trim().toLowerCase() !== sheetName.trim().toLowerCase())
                    };
                  });

                  let centerFound = false;
                  updatedGroups = updatedGroups.map(group => {
                    if (group.center.trim().toLowerCase() === targetCenter.trim().toLowerCase()) {
                      centerFound = true;
                      return {
                        ...group,
                        patterns: Array.from(new Set([...group.patterns, sheetName.trim()]))
                      };
                    }
                    return group;
                  });

                  if (!centerFound) {
                    updatedGroups.push({
                      center: targetCenter.trim(),
                      patterns: [sheetName.trim()]
                    });
                  }

                  setSubsheetCenters(updatedGroups);
                  await handleSaveConfig(undefined, { subCenters: updatedGroups });
                };

                return (
                  <div className="space-y-6">
                    {/* Visual Tab Selection */}
                    <div className="flex bg-slate-100 dark:bg-gray-900/60 p-1.5 rounded-2xl max-w-md border border-slate-200/40 dark:border-gray-800/30">
                      <button
                        onClick={() => setAdminTab("config")}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          adminTab === "config"
                            ? "bg-white dark:bg-gray-800 text-[#5277f7] dark:text-white shadow-sm"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        }`}
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Rule Builder
                      </button>
                      <button
                        onClick={() => setAdminTab("debugger")}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          adminTab === "debugger"
                            ? "bg-white dark:bg-gray-800 text-[#5277f7] dark:text-white shadow-sm"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        }`}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Cache Debugger
                      </button>
                      <button
                        onClick={() => setAdminTab("guide")}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          adminTab === "guide"
                            ? "bg-white dark:bg-gray-800 text-[#5277f7] dark:text-white shadow-sm"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Setup Guide
                      </button>
                    </div>

                    {/* Mappings Configurator Section */}
                    {adminTab === "config" && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Interactive Form Controls */}
                        <div className="lg:col-span-8 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-6 shadow-sm space-y-6">
                          <div>
                            <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 font-mono mb-1">Google Spreadsheet Sources</h3>
                            <p className="text-[10px] text-slate-400 mb-3">Add URLs to Excel/XLSX exported workbooks. Cached sheets will automatically pull tests from these files.</p>
                            
                            <div className="space-y-2.5 mb-3">
                              {spreadsheetUrls.length === 0 ? (
                                <div className="p-4 border border-dashed border-slate-200 dark:border-gray-800/60 rounded-xl text-center text-xs text-slate-400 italic bg-slate-50/50 dark:bg-transparent">
                                  No spreadsheet workbooks registered yet.
                                </div>
                              ) : (
                                spreadsheetUrls.map((url, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-gray-900/40 border border-slate-200/50 dark:border-gray-800/40 rounded-xl">
                                    <span className="text-xs font-mono truncate max-w-[85%] text-slate-700 dark:text-slate-350 select-all" title={url}>
                                      {url}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setSpreadsheetUrls(spreadsheetUrls.filter((_, i) => i !== idx))}
                                      className="p-1 text-slate-400 hover:text-rose-500 rounded transition-all cursor-pointer"
                                      title="Delete source URL"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Paste Google Sheet Excel/XLSX export link..."
                                value={newUrlInput}
                                onChange={(e) => setNewUrlInput(e.target.value)}
                                className="flex-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5277f7]"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (newUrlInput.trim()) {
                                    setSpreadsheetUrls([...spreadsheetUrls, newUrlInput.trim()]);
                                    setNewUrlInput("");
                                  }
                                }}
                                className="bg-[#5277f7] hover:bg-[#3d62dd] text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm shadow-blue-500/10"
                              >
                                <Plus className="w-4 h-4 shrink-0" /> Add
                              </button>
                            </div>
                          </div>

                          <hr className="border-slate-100 dark:border-gray-800/30" />

                          {/* SPREADSHEET_CENTERS mapping Input */}
                          <div className="space-y-3">
                            <div>
                              <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 font-mono mb-1">File-Level Center Mappings</h3>
                              <p className="text-[10px] text-slate-400">Map an entire spreadsheet workbook directly to a single tuition center name using its ID substring.</p>
                            </div>

                            <div className="space-y-3">
                              {spreadsheetCenters.length === 0 ? (
                                <div className="p-3 border border-dashed border-slate-200 dark:border-gray-800/60 rounded-xl text-center text-xs text-slate-400 italic bg-slate-50/50 dark:bg-transparent">
                                  No file-level mappings added.
                                </div>
                              ) : (
                                spreadsheetCenters.map((item, idx) => (
                                  <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-3 bg-slate-50 dark:bg-gray-900/40 border border-slate-200/50 dark:border-gray-800/40 rounded-xl relative group w-full">
                                    <div className="flex-1 w-full space-y-1">
                                      <label className="text-[9px] font-bold text-slate-400 block uppercase">Spreadsheet ID/URL Keyword</label>
                                      <input
                                        type="text"
                                        placeholder="e.g. 1ztnvtyd4..."
                                        value={item.pattern}
                                        onChange={(e) => {
                                          const updated = [...spreadsheetCenters];
                                          updated[idx].pattern = e.target.value;
                                          setSpreadsheetCenters(updated);
                                        }}
                                        className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5277f7] font-mono"
                                      />
                                    </div>
                                    <div className="flex-1 w-full space-y-1">
                                      <label className="text-[9px] font-bold text-slate-400 block uppercase">Assigned Center Name</label>
                                      <select
                                        value={allKnownCenters.includes(item.center) ? item.center : "custom"}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const updated = [...spreadsheetCenters];
                                          if (val === "custom") {
                                            updated[idx].center = "";
                                          } else {
                                            updated[idx].center = val;
                                          }
                                          setSpreadsheetCenters(updated);
                                        }}
                                        className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5277f7]"
                                      >
                                        <option value="">-- Select Center --</option>
                                        {allKnownCenters.map(c => (
                                          <option key={c} value={c}>{c}</option>
                                        ))}
                                        <option value="custom">+ Custom Center Name...</option>
                                      </select>
                                      {(!allKnownCenters.includes(item.center) || item.center === "") && (
                                        <input
                                          type="text"
                                          placeholder="Type Custom Tuition Center Name..."
                                          value={item.center}
                                          onChange={(e) => {
                                            const updated = [...spreadsheetCenters];
                                            updated[idx].center = e.target.value;
                                            setSpreadsheetCenters(updated);
                                          }}
                                          className="w-full mt-1.5 p-2 text-xs rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5277f7]"
                                        />
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setSpreadsheetCenters(spreadsheetCenters.filter((_, i) => i !== idx))}
                                      className="p-2 text-slate-400 hover:text-rose-500 rounded transition-all cursor-pointer mt-0 sm:mt-5 shrink-0 self-end sm:self-center"
                                      title="Delete mapping"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setSpreadsheetCenters([...spreadsheetCenters, { pattern: "", center: "" }])}
                              className="border border-dashed border-slate-200 dark:border-gray-800 hover:border-[#5277f7] text-[#5277f7] hover:bg-[#5277f7]/5 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all w-full"
                            >
                              <Plus className="w-4 h-4 shrink-0" /> Add Spreadsheet File Mapping Rule
                            </button>
                          </div>

                          <hr className="border-slate-100 dark:border-gray-800/30" />

                          {/* SUBSHEET_CENTERS mapping Input */}
                          <div className="space-y-3">
                            <div>
                              <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 font-mono mb-1">Tab-Level Center Mappings</h3>
                              <p className="text-[10px] text-slate-400">Map specific tabs (subsheets) to centers. Ideal if multiple tuition centers share a single Google Sheet workbook.</p>
                            </div>

                            <div className="space-y-4">
                              {subsheetCenters.length === 0 ? (
                                <div className="p-3 border border-dashed border-slate-200 dark:border-gray-800/60 rounded-xl text-center text-xs text-slate-400 italic bg-slate-50/50 dark:bg-transparent">
                                  No tab-level mappings added.
                                </div>
                              ) : (
                                subsheetCenters.map((group, idx) => (
                                  <div key={idx} className="p-4 bg-slate-50/70 dark:bg-gray-900/40 border border-slate-200/50 dark:border-gray-800/40 rounded-2xl space-y-3 relative">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex-1">
                                        <label className="text-[9px] font-bold text-slate-400 block uppercase mb-1">Tuition Center Name</label>
                                        <select
                                          value={allKnownCenters.includes(group.center) ? group.center : "custom"}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const updated = [...subsheetCenters];
                                            if (val === "custom") {
                                              updated[idx].center = "";
                                            } else {
                                              updated[idx].center = val;
                                            }
                                            setSubsheetCenters(updated);
                                          }}
                                          className="p-2 text-xs rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5277f7] w-64 max-w-full"
                                        >
                                          <option value="">-- Select Center --</option>
                                          {allKnownCenters.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                          ))}
                                          <option value="custom">+ Custom Center Name...</option>
                                        </select>
                                        {(!allKnownCenters.includes(group.center) || group.center === "") && (
                                          <input
                                            type="text"
                                            placeholder="Type Tuition Center Name..."
                                            value={group.center}
                                            onChange={(e) => {
                                              const updated = [...subsheetCenters];
                                              updated[idx].center = e.target.value;
                                              setSubsheetCenters(updated);
                                            }}
                                            className="w-full mt-1.5 p-2 text-xs rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5277f7]"
                                          />
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setSubsheetCenters(subsheetCenters.filter((_, i) => i !== idx))}
                                        className="p-2 text-slate-400 hover:text-rose-500 rounded transition-all cursor-pointer self-start"
                                        title="Delete this tuition center group"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>

                                    <div className="space-y-2">
                                      <label className="text-[9px] font-bold text-slate-400 block uppercase">Matching Tab Name Keywords or GID URL Substrings</label>
                                      
                                      {/* Tags/Chips */}
                                      <div className="flex flex-wrap gap-1.5">
                                        {group.patterns.length === 0 ? (
                                          <span className="text-[10px] text-slate-400 italic">No rules defined yet. Add keywords or tab GIDs below.</span>
                                        ) : (
                                          group.patterns.map((pat, pIdx) => (
                                            <span key={pIdx} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#5277f7] dark:text-blue-300 text-xs border border-blue-200/50 dark:border-blue-800/30">
                                              {pat}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updated = [...subsheetCenters];
                                                  updated[idx].patterns = group.patterns.filter((_, i) => i !== pIdx);
                                                  setSubsheetCenters(updated);
                                                }}
                                                className="text-blue-400 hover:text-rose-500 font-bold ml-1 transition-all cursor-pointer text-xs"
                                                title="Delete rule keyword"
                                              >
                                                &times;
                                              </button>
                                            </span>
                                          ))
                                        )}
                                      </div>

                                      {/* Tags Add Input */}
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          placeholder="Type tab substring (e.g. 'milestone') or 'gid=...' and press Enter"
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              const val = e.currentTarget.value.trim();
                                              if (val) {
                                                const updated = [...subsheetCenters];
                                                updated[idx].patterns = Array.from(new Set([...group.patterns, val]));
                                                setSubsheetCenters(updated);
                                                e.currentTarget.value = "";
                                              }
                                            }
                                          }}
                                          className="flex-1 p-2 text-xs rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5277f7]"
                                        />
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            const inputEl = e.currentTarget.previousSibling as HTMLInputElement;
                                            const val = inputEl.value.trim();
                                            if (val) {
                                              const updated = [...subsheetCenters];
                                              updated[idx].patterns = Array.from(new Set([...group.patterns, val]));
                                              setSubsheetCenters(updated);
                                              inputEl.value = "";
                                            }
                                          }}
                                          className="bg-white dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-750 text-slate-700 dark:text-slate-350 px-3 py-2 rounded-lg text-xs font-bold border border-slate-200/50 dark:border-gray-800/40 cursor-pointer transition-all"
                                        >
                                          Add Rule
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setSubsheetCenters([...subsheetCenters, { center: "", patterns: [] }])}
                              className="border border-dashed border-slate-200 dark:border-gray-800 hover:border-[#5277f7] text-[#5277f7] hover:bg-[#5277f7]/5 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all w-full"
                            >
                              <Plus className="w-4 h-4 shrink-0" /> Add Tuition Center Tab Mappings Group
                            </button>
                          </div>

                          <hr className="border-slate-100 dark:border-gray-800/30" />

                          {/* STAFF_ACCESS ACL Configurator */}
                          <div className="space-y-3">
                            <div>
                              <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 font-mono mb-1">Staff Access Controls (ACL)</h3>
                              <p className="text-[10px] text-slate-400">Restrict which Tuition Centers staff members can view. You can enter multiple emails separated by commas to assign the same mapping. Users not listed default to full admin access (all centers).</p>
                            </div>

                            <div className="space-y-4">
                              {staffAccess.length === 0 ? (
                                <div className="p-3 border border-dashed border-slate-200 dark:border-gray-800/60 rounded-xl text-center text-xs text-slate-400 italic bg-slate-50/50 dark:bg-transparent">
                                  No access control restrictions configured.
                                </div>
                              ) : (
                                staffAccess.map((item, idx) => (
                                  <div key={idx} className="p-4 bg-slate-50/70 dark:bg-gray-900/40 border border-slate-200/50 dark:border-gray-800/40 rounded-2xl space-y-3 relative w-full">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex-1">
                                        <label className="text-[9px] font-bold text-slate-400 block uppercase mb-1">Staff Email Addresses</label>
                                        <div 
                                          onClick={(e) => {
                                            const input = e.currentTarget.querySelector("input");
                                            if (input) input.focus();
                                          }}
                                          className="w-full p-2 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-wrap items-center gap-1.5 focus-within:ring-1 focus-within:ring-[#5277f7] cursor-text transition-all min-h-[42px] max-w-2xl"
                                        >
                                          {item.email.split(",").map(e => e.trim()).filter(Boolean).map((email, emailIdx) => (
                                            <div 
                                              key={emailIdx} 
                                              className="flex items-center gap-1.5 bg-blue-55/60 dark:bg-blue-950/40 text-[#5277f7] pl-2.5 pr-1.5 py-0.5 rounded-full text-[11px] font-semibold border border-blue-200/50 dark:border-blue-900/30 select-none animate-in fade-in zoom-in-95 duration-150"
                                            >
                                              <span>{email}</span>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const emails = item.email.split(",").map(x => x.trim()).filter(Boolean);
                                                  const updatedEmails = emails.filter((_, i) => i !== emailIdx);
                                                  const updated = [...staffAccess];
                                                  updated[idx].email = updatedEmails.join(",");
                                                  setStaffAccess(updated);
                                                }}
                                                className="p-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 text-[#5277f7]/70 hover:text-[#5277f7] transition-all cursor-pointer flex items-center justify-center"
                                                title="Remove email"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            </div>
                                          ))}
                                          <input
                                            type="text"
                                            placeholder={item.email ? "Add email..." : "e.g. member@pw.live (press Enter, Comma, or Tab to add)"}
                                            value={typedEmails[idx] || ""}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (val.endsWith(",")) {
                                                const cleanVal = val.slice(0, -1).trim();
                                                if (cleanVal) {
                                                  const emails = item.email.split(",").map(x => x.trim()).filter(Boolean);
                                                  if (!emails.includes(cleanVal)) {
                                                    const updated = [...staffAccess];
                                                    updated[idx].email = [...emails, cleanVal].join(",");
                                                    setStaffAccess(updated);
                                                  }
                                                }
                                                setTypedEmails(prev => ({ ...prev, [idx]: "" }));
                                              } else {
                                                setTypedEmails(prev => ({ ...prev, [idx]: val }));
                                              }
                                            }}
                                            onBlur={() => {
                                              const val = (typedEmails[idx] || "").trim();
                                              if (val) {
                                                const emails = item.email.split(",").map(x => x.trim()).filter(Boolean);
                                                if (!emails.includes(val)) {
                                                  const updated = [...staffAccess];
                                                  updated[idx].email = [...emails, val].join(",");
                                                  setStaffAccess(updated);
                                                }
                                              }
                                              setTypedEmails(prev => ({ ...prev, [idx]: "" }));
                                            }}
                                            onKeyDown={(e) => {
                                              const val = (typedEmails[idx] || "").trim();
                                              const emails = item.email.split(",").map(x => x.trim()).filter(Boolean);
                                              
                                              if (e.key === "Enter" || e.key === "Tab") {
                                                if (val) {
                                                  e.preventDefault();
                                                  if (!emails.includes(val)) {
                                                    const updated = [...staffAccess];
                                                    updated[idx].email = [...emails, val].join(",");
                                                    setStaffAccess(updated);
                                                  }
                                                  setTypedEmails(prev => ({ ...prev, [idx]: "" }));
                                                }
                                              } else if (e.key === " " && val.includes("@")) {
                                                e.preventDefault();
                                                if (!emails.includes(val)) {
                                                  const updated = [...staffAccess];
                                                  updated[idx].email = [...emails, val].join(",");
                                                  setStaffAccess(updated);
                                                }
                                                setTypedEmails(prev => ({ ...prev, [idx]: "" }));
                                              } else if (e.key === "Backspace" && !typedEmails[idx] && emails.length > 0) {
                                                e.preventDefault();
                                                const updatedEmails = [...emails];
                                                updatedEmails.pop();
                                                const updated = [...staffAccess];
                                                updated[idx].email = updatedEmails.join(",");
                                                setStaffAccess(updated);
                                              }
                                            }}
                                            className="flex-1 outline-none border-none bg-transparent text-xs text-slate-800 dark:text-white p-1 min-w-[150px] focus:ring-0 focus:outline-none"
                                          />
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setStaffAccess(staffAccess.filter((_, i) => i !== idx))}
                                        className="p-2 text-slate-400 hover:text-rose-500 rounded transition-all cursor-pointer self-start"
                                        title="Remove access rule"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>

                                    <div className="space-y-2">
                                      <label className="text-[9px] font-bold text-slate-400 block uppercase">Allowed Tuition Centers</label>
                                      <div className="flex flex-wrap gap-2">
                                        {/* All Centers Option */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...staffAccess];
                                            updated[idx].centers = ["*"];
                                            setStaffAccess(updated);
                                          }}
                                          className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                            item.centers.includes("*") || item.centers.includes("All")
                                              ? "bg-[#5277f7] text-white border-[#5277f7] shadow-sm"
                                              : "bg-white dark:bg-gray-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-900"
                                          }`}
                                        >
                                          Full Access (All Centers)
                                        </button>
                                        
                                        {/* Individual Centers */}
                                        {allKnownCenters.filter(c => c !== "*" && c.toLowerCase() !== "all").map((center) => {
                                          const isSelected = item.centers.includes(center) && !item.centers.includes("*");
                                          return (
                                            <button
                                              key={center}
                                              type="button"
                                              onClick={() => {
                                                const updated = [...staffAccess];
                                                // Remove * wildcard if selecting individual
                                                let current = item.centers.filter(c => c !== "*" && c !== "All");
                                                if (current.includes(center)) {
                                                  current = current.filter(c => c !== center);
                                                } else {
                                                  current.push(center);
                                                }
                                                // If empty, reset to wild card
                                                updated[idx].centers = current.length > 0 ? current : ["*"];
                                                setStaffAccess(updated);
                                              }}
                                              className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                                isSelected
                                                  ? "bg-[#5277f7] text-white border-[#5277f7] shadow-sm"
                                                  : "bg-white dark:bg-gray-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-900"
                                              }`}
                                            >
                                              {center}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setStaffAccess([...staffAccess, { email: "", centers: ["*"] }])}
                              className="border border-dashed border-slate-200 dark:border-gray-800 hover:border-[#5277f7] text-[#5277f7] hover:bg-[#5277f7]/5 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all w-full"
                            >
                              <Plus className="w-4 h-4 shrink-0" /> Add Staff Access Control Rule
                            </button>
                          </div>
                        </div>

                        {/* Save Trigger Panel & Rules Checklist */}
                        <div className="lg:col-span-4 space-y-6">
                          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-6 shadow-sm space-y-4">
                            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">Publish Rules</h3>
                            <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                              Saving will update the system cache in the background. Changes will take effect immediately for all active student queries.
                            </p>

                            {/* Status notifications */}
                            {configSaveMessage && (
                              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[11px] rounded-xl flex items-center gap-2">
                                <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                                <span>{configSaveMessage}</span>
                              </div>
                            )}
                            
                            {configSaveError && (
                              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-[11px] rounded-xl flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                                <span className="break-all">{configSaveError}</span>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleSaveConfig()}
                              disabled={isSavingConfig}
                              className="w-full bg-[#5277f7] hover:bg-[#3d62dd] text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider font-display transition-all disabled:opacity-50 shrink-0 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
                            >
                              {isSavingConfig ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  Hot-Reloading Cache...
                                </>
                              ) : (
                                "Save Configurations & Refresh"
                              )}
                            </button>
                          </div>

                          <div className="bg-[#5277f7]/5 border border-[#5277f7]/10 dark:bg-blue-950/5 dark:border-blue-900/20 rounded-3xl p-5 space-y-3">
                            <span className="text-[10px] uppercase font-mono tracking-widest font-black text-[#5277f7] dark:text-blue-400 block">Precedence Hierarchy</span>
                            <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed">
                              When matching sheet data to tuition centers, the resolver applies:
                            </p>
                            <ol className="list-decimal list-inside text-xs text-slate-600 dark:text-slate-350 space-y-2 leading-relaxed font-semibold">
                              <li><span className="text-blue-600 dark:text-blue-400">Tab-level mappings</span> (highest priority)</li>
                              <li><span className="text-blue-600 dark:text-blue-400">Default 12-sheet templates</span></li>
                              <li><span className="text-blue-600 dark:text-blue-400">File-level mappings</span> (spreadsheet ID match)</li>
                                              <li><span className="text-blue-600 dark:text-blue-400">System Fallback center</span> (Pimpri PW Vidyapeeth)</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Active Cache Roster Debugger Tab */}
                    {adminTab === "debugger" && (() => {
                      const currentUserAccess = loggedInUser
                        ? staffAccess.find(item => {
                            const emails = item.email.split(",").map(e => e.trim().toLowerCase());
                            return emails.includes(loggedInUser.email.trim().toLowerCase());
                          })
                        : null;
                      const isRestricted = currentUserAccess && 
                        !currentUserAccess.centers.includes("*") && 
                        !currentUserAccess.centers.includes("All") &&
                        currentUserAccess.centers.length > 0;

                      return (
                        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-6 shadow-sm space-y-6">
                          
                          {/* Summary & Sync Row */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50 dark:bg-gray-900/40 border border-slate-200/50 dark:border-gray-800/30 p-4 rounded-2xl">
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-mono tracking-widest font-black text-slate-400 block">Roster Overview</span>
                              <div className="text-xs text-slate-650 dark:text-slate-350 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                                <span>Cached: <strong>{activeSheets.length} Sheet Tabs</strong></span>
                                {dbStatus.lastLoaded && (
                                  <span>Refreshed: <strong>{new Date(dbStatus.lastLoaded).toLocaleTimeString()}</strong></span>
                                )}
                                {isRestricted && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30 text-[10px] font-bold">
                                    <Lock className="w-3 h-3 shrink-0" />
                                    Restricted View ({currentUserAccess.centers.join(", ")})
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={handleDatabaseSync}
                              disabled={isRefreshing}
                              className="bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-800 dark:text-white border border-slate-200 dark:border-gray-700 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 select-none"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-500" : ""}`} />
                              Force Database Sync
                            </button>
                          </div>

                          {/* Search and Filters */}
                          <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 dark:text-gray-500 absolute left-3.5 top-3" />
                            <input
                              type="text"
                              placeholder="Filter active sheet tabs by name, source, or center..."
                              value={debuggerFilter}
                              onChange={(e) => setDebuggerFilter(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-950 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5277f7]"
                            />
                          </div>

                          {/* Grouped Accordion List */}
                          <div className="space-y-4">
                            {(() => {
                              const filtered = activeSheets.filter(s => {
                                const query = debuggerFilter.toLowerCase();
                                return s.name.toLowerCase().includes(query) || 
                                       s.sourceUrl.toLowerCase().includes(query) || 
                                       s.center.toLowerCase().includes(query);
                              });

                              if (filtered.length === 0) {
                                return (
                                  <div className="p-8 text-center text-slate-400 italic bg-slate-50/50 dark:bg-gray-900/30 border border-dashed border-slate-200 dark:border-gray-800 rounded-2xl">
                                    No active sheets found matching filter criteria.
                                  </div>
                                );
                              }

                              const sheetsByCenter: Record<string, typeof activeSheets> = {};
                              filtered.forEach(sheet => {
                                const ctr = sheet.center || "Unmapped / Unknown";
                                if (!sheetsByCenter[ctr]) {
                                  sheetsByCenter[ctr] = [];
                                }
                                sheetsByCenter[ctr].push(sheet);
                              });

                              const centerNames = Object.keys(sheetsByCenter).sort();

                              return centerNames.map((centerName) => {
                                const sheets = sheetsByCenter[centerName];
                                const isCollapsed = openCenter !== centerName;

                                return (
                                  <div key={centerName} className="border border-slate-200 dark:border-gray-800/50 rounded-2xl overflow-hidden bg-white dark:bg-gray-950 shadow-sm transition-all duration-200">
                                    {/* Group Header */}
                                    <button
                                      type="button"
                                      onClick={() => setOpenCenter(prev => prev === centerName ? null : centerName)}
                                      className="w-full flex items-center justify-between p-4 bg-slate-50/70 dark:bg-gray-900/40 hover:bg-slate-100/50 dark:hover:bg-gray-900/60 transition-colors border-b border-slate-200 dark:border-gray-800/50 text-left select-none cursor-pointer"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl border ${
                                          centerName.toLowerCase().includes("pimpri")
                                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30"
                                            : centerName.toLowerCase().includes("pimple")
                                              ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-800/30"
                                              : "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 border-purple-100 dark:border-purple-800/30"
                                        }`}>
                                          <MapPin className="w-4 h-4 shrink-0" />
                                        </div>
                                        <div>
                                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{centerName}</h4>
                                          <p className="text-[10px] text-slate-450 dark:text-slate-400 font-mono mt-0.5">
                                            Contains {sheets.length} resolved {sheets.length === 1 ? "sheet tab" : "sheet tabs"}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="text-[10px] uppercase font-mono tracking-wider font-semibold bg-slate-200/60 dark:bg-gray-800/70 text-slate-500 dark:text-slate-450 px-2 py-0.5 rounded-md">
                                          {sheets.length}
                                        </span>
                                        <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-gray-500 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : "rotate-0"}`} />
                                      </div>
                                    </button>

                                    {/* Group Content */}
                                    <AnimatePresence initial={false}>
                                      {!isCollapsed && (
                                        <motion.div
                                          initial={{ height: 0 }}
                                          animate={{ height: "auto" }}
                                          exit={{ height: 0 }}
                                          transition={{ duration: 0.2, ease: "easeInOut" }}
                                          className="overflow-hidden"
                                        >
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs border-collapse">
                                              <thead>
                                                <tr className="bg-slate-50/50 dark:bg-gray-900/10 text-slate-450 dark:text-gray-500 font-mono text-[9px] font-bold uppercase border-b border-slate-200 dark:border-gray-800/50">
                                                  <th className="p-3 pl-4">Sheet Tab Name</th>
                                                  <th className="p-3">Source Spreadsheet</th>
                                                  <th className="p-3">Resolution Rule</th>
                                                  <th className="p-3 text-right pr-4">Quick Map Action</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100 dark:divide-gray-800/30 text-slate-700 dark:text-slate-350 bg-white dark:bg-gray-950">
                                                {sheets.map((sheet, idx) => {
                                                  const explanation = getSheetResolutionSource(sheet.name, sheet.sourceUrl);
                                                  const spreadsheetId = sheet.sourceUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] || "";
                                                  const shortId = spreadsheetId ? `${spreadsheetId.slice(0, 8)}...${spreadsheetId.slice(-6)}` : "Workbook URL";

                                                  return (
                                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-gray-900/10 transition-colors">
                                                      <td className="p-3 pl-4 font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[240px]">
                                                        <div className="flex items-center gap-2">
                                                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                          <span title={sheet.name}>{sheet.name}</span>
                                                        </div>
                                                      </td>
                                                      <td className="p-3 font-mono text-[10px] text-slate-450 dark:text-slate-400">
                                                        <div className="flex items-center gap-1.5">
                                                          <span title={sheet.sourceUrl}>{shortId}</span>
                                                          <a
                                                            href={sheet.sourceUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-slate-400 hover:text-blue-500 transition-colors"
                                                            title="Open full Google Spreadsheet"
                                                          >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                          </a>
                                                        </div>
                                                      </td>
                                                      <td className="p-3">
                                                        <div className="space-y-0.5">
                                                          <div className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">{explanation.type}</div>
                                                          {explanation.pattern !== "N/A" && (
                                                            <div className="text-[9px] text-slate-400 font-mono">"{explanation.pattern}"</div>
                                                          )}
                                                        </div>
                                                      </td>
                                                      <td className="p-3 text-right pr-4">
                                                        <select
                                                          value=""
                                                          onChange={(e) => handleQuickMapSheet(sheet.name, e.target.value)}
                                                          className="p-1.5 text-[10px] rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-slate-700 dark:text-slate-350 focus:outline-none focus:ring-1 focus:ring-[#5277f7] cursor-pointer"
                                                        >
                                                          <option value="">Move / Map to...</option>
                                                          {allKnownCenters.map(c => (
                                                            <option key={c} value={c}>{c}</option>
                                                          ))}
                                                        </select>
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Setup Guide instructions */}
                    {adminTab === "guide" && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Instructions documentation */}
                        <div className="lg:col-span-7 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-6 space-y-6 shadow-sm">
                          <div className="space-y-4">
                            <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 font-mono">How to Add a Google Sheet</h3>
                            <ol className="list-decimal list-inside text-xs text-slate-650 dark:text-slate-350 space-y-3.5 leading-relaxed">
                              <li>
                                <strong className="text-slate-900 dark:text-white">Open the workbook:</strong> Open the Google Sheet holding academic scores.
                              </li>
                              <li>
                                <strong className="text-slate-900 dark:text-white">Publish to web:</strong> Go to <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-gray-800 rounded font-mono text-[10px]">File &rarr; Share &rarr; Publish to web</code>.
                              </li>
                              <li>
                                <strong className="text-slate-900 dark:text-white">Choose XLSX Export format:</strong> Select the <strong className="text-slate-800 dark:text-slate-200">Link</strong> tab, change the publication type dropdown from "Web Page" to <strong className="text-slate-800 dark:text-slate-200">Microsoft Excel (.xlsx)</strong>.
                              </li>
                              <li>
                                <strong className="text-slate-900 dark:text-white">Copy the URL:</strong> Click <strong className="text-slate-800 dark:text-slate-200">Publish</strong> and copy the generated link.
                              </li>
                              <li>
                                <strong className="text-slate-900 dark:text-white">Register in Rule Builder:</strong> Paste the copied link under Spreadsheet Sources inside the settings configurator, then click <strong className="text-slate-850 dark:text-slate-200">Add</strong>.
                              </li>
                            </ol>
                          </div>

                          <hr className="border-slate-100 dark:border-gray-800/30" />

                          <div className="space-y-4">
                            <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 font-mono">How Center Resolution Works</h3>
                            <div className="space-y-3 text-xs text-slate-650 dark:text-slate-350 leading-relaxed">
                              <p>
                                The academic backend processes student records from multiple centers concurrently. To allocate a parsed sheet tab to its correct tuition center, the server parses configuration rules defined by administrators.
                              </p>
                              <p>
                                <strong className="text-slate-900 dark:text-white">Tab-level mapping:</strong> When a center contains different tests or classrooms inside the same workbook, you define matching tab keywords. For example, if a sheet tab name includes `city test` or `milestone`, adding these patterns to a center ensures precise mapping.
                              </p>
                              <p>
                                <strong className="text-slate-900 dark:text-white">File-level mapping:</strong> When a Google Sheet spreadsheet belongs entirely to a specific center, adding the workbook ID to the File-Level mappings matches all subsheets inside it to that center instantly.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Credits & Identity card */}
                        <div className="lg:col-span-5 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/50 dark:border-gray-800/40 p-6 space-y-4 shadow-sm">
                          <div>
                            <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 font-mono mb-3">System Information</h3>
                            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl space-y-2">
                              <span className="text-[10px] uppercase font-mono tracking-widest font-black text-[#5277f7] dark:text-blue-400 block font-bold">Identity & Credits</span>
                              <p className="text-xs text-slate-650 dark:text-slate-350 leading-relaxed">
                                This High-Performance Student Portal was built and is managed by:
                                <span className="font-extrabold text-slate-900 dark:text-white block mt-1">aniket.mishra2@pw.live</span>
                              </p>
                              <a
                                href="mailto:aniket.mishra2@pw.live"
                                className="inline-flex items-center gap-1.5 text-xs text-[#5277f7] hover:underline font-semibold"
                              >
                                <Mail className="w-3.5 h-3.5" /> Email support
                              </a>
                            </div>
                          </div>

                          <div className="p-4 bg-slate-50 dark:bg-gray-900/40 rounded-2xl text-xs text-slate-500 dark:text-gray-400 space-y-1">
                            <div>Version: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">2.1.0-release</span></div>
                            <div>Build environment: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">production-huggingface</span></div>
                            <div>Target database: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">Google Sheets API v4</span></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {activeView === "timetable" && isSuperAdmin && (
            <motion.div
              key="timetable"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 max-w-6xl mx-auto py-2 w-full text-slate-800 dark:text-slate-100"
            >
              <TimetableViewer adminHeaders={adminHeaders} />
            </motion.div>
          )}

        </AnimatePresence>


      </div>

      {/* MOBILE SPECIAL BOTTOM BAR */}
      {!exportMode && loggedInUser && (
        <nav className="md:hidden flex fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#111827] min-h-[4.5rem] pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] border-t border-slate-200/50 dark:border-gray-800/40 items-stretch justify-around px-2 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] select-none no-print">
          {/* Home Tab */}
          <button
            onClick={() => { setActiveView("home"); setErrorMessage(null); }}
            className={`flex flex-col items-center justify-center gap-1 w-14 py-1 rounded-xl transition-all cursor-pointer outline-none ${
              activeView === "home"
                ? "text-[#5277f7] dark:text-blue-400"
                : "text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <LayoutGrid className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-semibold tracking-tight font-sans leading-tight">Home</span>
          </button>

          {/* Search Tab */}
          <button
            onClick={() => { setSearchType("reg"); setActiveView("input"); setErrorMessage(null); }}
            className={`flex flex-col items-center justify-center gap-1 w-14 py-1 rounded-xl transition-all cursor-pointer outline-none ${
              activeView === "input"
                ? "text-[#5277f7] dark:text-blue-400"
                : "text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <Search className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-semibold tracking-tight font-sans leading-tight">Search</span>
          </button>

          {/* Directory Tab */}
          <button
            onClick={handleLoadAllStudents}
            className={`flex flex-col items-center justify-center gap-1 w-14 py-1 rounded-xl transition-all cursor-pointer outline-none ${
              activeView === "batchList"
                ? "text-[#5277f7] dark:text-blue-400"
                : "text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <GraduationCap className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-semibold tracking-tight font-sans leading-tight">Directory</span>
          </button>

          {/* Sheets Directory Tab */}
          <button
            onClick={() => { setActiveView("sheetsList"); setErrorMessage(null); }}
            className={`flex flex-col items-center justify-center gap-1 w-14 py-1 rounded-xl transition-all cursor-pointer outline-none ${
              activeView === "sheetsList"
                ? "text-[#5277f7] dark:text-blue-400"
                : "text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <BookOpen className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-semibold tracking-tight font-sans leading-tight">Sheets</span>
          </button>

          {/* Config Settings Tab — super-admin only */}
          {isSuperAdmin && (
          <button
            onClick={() => { setActiveView("admin"); setErrorMessage(null); }}
            className={`flex flex-col items-center justify-center gap-1 w-14 py-1 rounded-xl transition-all cursor-pointer outline-none ${
              activeView === "admin"
                ? "text-[#5277f7] dark:text-blue-400"
                : "text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <Settings className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-semibold tracking-tight font-sans leading-tight">Settings</span>
          </button>
          )}

          {/* Timetable Tab — super-admin only */}
          {isSuperAdmin && (
          <button
            onClick={() => { setActiveView("timetable"); setErrorMessage(null); }}
            className={`flex flex-col items-center justify-center gap-1 w-14 py-1 rounded-xl transition-all cursor-pointer outline-none ${
              activeView === "timetable"
                ? "text-[#5277f7] dark:text-blue-400"
                : "text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <Calendar className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-semibold tracking-tight font-sans leading-tight">Timetable</span>
          </button>
          )}
        </nav>
      )}
    </div>

      {/* ===== Admin Roles & Settings panel (Google Sheet-backed) — admins only ===== */}
      {isAdmin && loggedInUser && !showAdminPanel && (
        <button
          onClick={() => { setShowAdminPanel(true); refreshUnread(); }}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 right-4 z-[60] flex items-center gap-2 bg-[#5277f7] hover:bg-[#4062dd] text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-xl shadow-[#5277f7]/30 no-print cursor-pointer"
          title="Admin Roles & Settings"
        >
          <Shield className="w-4 h-4" />
          <span className="hidden sm:inline">Admin</span>
          {notifUnread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center leading-none">
              {notifUnread > 9 ? "9+" : notifUnread}
            </span>
          )}
        </button>
      )}
      {isAdmin && loggedInUser && showAdminPanel && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm overflow-y-auto p-2 sm:p-6 no-print">
          <div className="min-h-full flex items-start justify-center py-2 sm:py-4">
            <AdminSettings
              currentUser={{ email: loggedInUser.email, name: loggedInUser.name, role: userRole, center: userCenter } as SessionUser}
              onClose={() => setShowAdminPanel(false)}
              onUnreadChange={(n) => setNotifUnread(n)}
            />
          </div>
        </div>
      )}
  </div>
  );
}
