import React, { useState, useEffect, useRef } from "react";
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
  GraduationCap,
  Share2,
  Settings,
  X,
} from "lucide-react";
import { Student, Dropdowns, TestRecord, Profile } from "./types";
import AdminSettings, { Role, SessionUser } from "./components/AdminSettings";

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

function getStudentAvatar(name: string, index: number) {
  // Returns a beautifully clean default silhouette avatar representing the classic student/user outline as requested by the user.
  // Dark slate-gray avatar silhouette over a soft slate-100 background.
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <rect width="100" height="100" rx="30" fill="#f1f5f9"/>
      <circle cx="50" cy="38" r="17" fill="#475569"/>
      <path d="M20 80c0-14 13-24 30-24s30 10 30 24" fill="#475569"/>
    </svg>
  `)}`;
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

  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") || "light"
  );
  const [activeView, setActiveView] = useState<"home" | "input" | "batchList" | "dashboard" | "sheetsList" | "settings">("home");
  const [searchType, setSearchType] = useState<"batch" | "name" | "reg" | null>(null);
  const [sheetFilterQuery, setSheetFilterQuery] = useState<string>("");
  
  // Real PW ID Login system
  const [loggedInUser, setLoggedInUser] = useState<{ email: string; name?: string; picture?: string } | null>(() => {
    const saved = localStorage.getItem("pwUserEmail");
    const savedName = localStorage.getItem("pwUserName");
    const savedPicture = localStorage.getItem("pwUserPicture");
    return saved ? { email: saved, name: savedName || undefined, picture: savedPicture || undefined } : null;
  });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Role-based access control + admin notifications
  const [userRole, setUserRole] = useState<Role>(() => (localStorage.getItem("pwUserRole") as Role) || "staff");
  const [userCenter, setUserCenter] = useState<string>(() => localStorage.getItem("pwUserCenter") || "");
  const [notifUnread, setNotifUnread] = useState<number>(0);
  const isAdmin = userRole === "admin";

  // Establish a session with the backend: records audit log + returns the user's role
  const establishSession = async (email: string, name: string | undefined, event: "login" | "resume") => {
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, event }),
      });
      if (res.ok) {
        const data = await res.json();
        const role: Role = data.role || "staff";
        setUserRole(role);
        localStorage.setItem("pwUserRole", role);
        setUserCenter(data.center || "");
        localStorage.setItem("pwUserCenter", data.center || "");
        return role;
      }
    } catch (err) {
      console.error("Session establish failed:", err);
    }
    return "staff" as Role;
  };

  // Poll unread notification count for admins
  const refreshUnread = async (email: string) => {
    try {
      const res = await fetch("/api/admin/notifications", { headers: { "x-user-email": email } });
      if (res.ok) {
        const data = await res.json();
        setNotifUnread(data.unread || 0);
      }
    } catch (_) {}
  };

  // Input fields
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [nameQuery, setNameQuery] = useState<string>("");
  const [regInput, setRegInput] = useState<string>("");
  const [batchSearchQuery, setBatchSearchQuery] = useState<string>("");

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

  const [exportMode, setExportMode] = useState<boolean>(false);
  const exportAreaRef = useRef<HTMLDivElement>(null);

  // Sync theme changes with document body
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Fetch initial dropdown metadata from Express server backend
  const fetchDropdowns = async () => {
    try {
      setDropdowns((prev) => ({ ...prev, isLoading: true }));
      const response = await fetch("/api/dropdowns");
      if (!response.ok) {
        throw new Error(`Failed to initialize dropdown parameters. Code: ${response.status}`);
      }
      const data = await response.json();
      setDropdowns({
        batches: data.batches || [],
        names: data.names || [],
        sheets: data.sheets || [],
        sheetStats: data.sheetStats || {},
        isLoading: false,
        lastLoaded: data.lastLoaded,
      });

      // Also get general database health summary
      const healthRes = await fetch("/api/health");
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
    fetchDropdowns();

    // Resume an existing session (records audit + refreshes role) when already logged in
    if (loggedInUser?.email) {
      establishSession(loggedInUser.email, loggedInUser.name, "resume").then((role) => {
        if (role === "admin") refreshUnread(loggedInUser.email);
      });
    }

    // Support sharing deep-linking via query parameters on mount
    const params = new URLSearchParams(window.location.search);
    const regParam = params.get("reg");
    const nameParam = params.get("name");
    const batchParam = params.get("batch");

    const loadSharedStudent = async (queryVal: string, type: "reg" | "name" | "batch") => {
      setErrorMessage(null);
      setIsSearching(true);
      try {
        const encodeQuery = encodeURIComponent(queryVal.trim());
        const res = await fetch(`/api/student?query=${encodeQuery}`);
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
      const response = await fetch("/api/auth/google/url");
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
      // The OAuth popup is served from this same backend, so same-origin is the
      // primary trusted source. Also allow Cloud Run / localhost for dev previews.
      const isAllowedOrigin =
        origin === window.location.origin ||
        origin.endsWith(".run.app") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1");
      if (!isAllowedOrigin) return;

      if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
        const email = event.data.email;
        const name = event.data.name || "";
        const picture = event.data.picture || "";
        localStorage.setItem("pwUserEmail", email);
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
        // Register the session: writes audit log entry + resolves role
        establishSession(email, name, "login").then((role) => {
          if (role === "admin") refreshUnread(email);
        });
      } else if (event.data?.type === "GOOGLE_AUTH_FAILURE") {
        setLoginError(event.data.error || "Google authentication rejected.");
        setIsLoggingIn(false);
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("pwUserEmail");
    localStorage.removeItem("pwUserName");
    localStorage.removeItem("pwUserPicture");
    localStorage.removeItem("pwUserRole");
    localStorage.removeItem("pwUserCenter");
    setLoggedInUser(null);
    setUserRole("staff");
    setUserCenter("");
    setNotifUnread(0);
    setActiveView("home");
    setStudentsPayload(null);
    setShowProfileModal(false);
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

  // Force Database Synchronization with Google Sheets again via Express backend
  const handleDatabaseSync = async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/refresh", {
        method: "POST",
        headers: loggedInUser?.email ? { "x-user-email": loggedInUser.email } : undefined,
      });
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
      if (isAdmin && loggedInUser?.email) refreshUnread(loggedInUser.email);
      setIsRefreshing(false);
    } catch (err: any) {
      setErrorMessage(err.message || "Manual database synchronization failed.");
      setIsRefreshing(false);
    }
  };

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
      const res = await fetch(`/api/student?query=${encodeQuery}`, {
        headers: loggedInUser?.email ? { "x-user-email": loggedInUser.email } : undefined,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "No students found matching your criteria.");
      }

      const data = await res.json();
      setStudentsPayload(data);
      setSelectedStudentIndex(0);

      if (searchType === "batch" && data.students && data.students.length > 1) {
        setActiveView("batchList");
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
      const res = await fetch(`/api/student?query=${encodeURIComponent(sheetName)}&singleSheet=true&exactSheet=${encodeURIComponent(sheetName)}`);
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
      const res = await fetch(`/api/student?query=all`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "No students found in the database.");
      }

      const data = await res.json();
      setStudentsPayload(data);
      setSelectedStudentIndex(0);
      setSearchType("batch");
      setActiveView("batchList");
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
    window.print();
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
    };

    // Wait slightly for DOM adjustment (CSS repaint)
    setTimeout(() => {
      // @ts-ignore
      if (typeof html2pdf !== "undefined") {
        // @ts-ignore
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
      } else {
        alert("PDF printing engine is setting up. Please use native Browser Print (Print Icon) instead!");
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

    const shareUrl = `${window.location.origin}${window.location.pathname}?reg=${encodeURIComponent(activeStudent.profile.regNo || "")}`;
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
    navigator.clipboard.writeText(url).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }).catch(err => {
      console.error("Failed to copy link: ", err);
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
      "science", "mat", "sst", "english", "hindi"
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
      return ["Science", "Mathematics", "English", "MAT", "SST", "Hindi"];
    } else {
      return ["Physics", "Chemistry", "Mathematics"];
    }
  }, [dynamicSubjects, activeStudent?.profile?.stream, studentsPayload?.stream]);

  if (!loggedInUser) {
    return (
      <div className={`min-h-screen font-sans flex flex-col justify-center items-center transition-all bg-[#4e74e6] dark:bg-[#0c0e17] p-4 text-slate-800 dark:text-slate-100 ${theme === "dark" ? "dark" : ""}`}>
        <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-[32px] shadow-2xl border border-slate-200/50 dark:border-gray-800 p-6 sm:p-8 flex flex-col items-center relative overflow-hidden">
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
              Vidyapeeth Pune
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
    <div className={`h-[100dvh] w-screen overflow-hidden font-sans flex flex-col justify-center items-center transition-all bg-[#4e74e6] dark:bg-[#0c0e17] p-0 sm:p-4 md:p-6 text-slate-800 dark:text-slate-100 ${theme === "dark" && !exportMode ? "dark" : ""} ${exportMode ? "export-mode bg-white p-0 text-black" : ""}`}>
      
      {/* INITIAL BLUR SPINNER IF SYSTEM DROP DOWNS PRE-LOAD */}
      {dropdowns.isLoading && activeView === "home" && (
        <div id="initialSplash" className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white dark:bg-[#0b0f19]">
          <div className="animate-spin h-10 w-10 border-2 border-slate-250 dark:border-gray-800 border-t-blue-600 dark:border-t-blue-500 rounded-full mb-6"></div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display uppercase tracking-widest">
            Vidyapeeth Pune
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

      {/* MAIN HARDWARE DECK CASING */}
      <div className={`w-full max-w-[1400px] h-full md:h-[88vh] bg-[#f0f4fa] dark:bg-[#090d16] rounded-none md:rounded-[40px] shadow-none md:shadow-2xl overflow-hidden flex flex-col md:flex-row relative transition-all border-0 md:border border-white/15 ${exportMode ? "border-0 shadow-none rounded-none bg-white min-h-screen w-full text-black" : ""}`}>
        
        {/* MOBILE SPECIAL TOP NAV BAR */}
        {!exportMode && (
          <header className="md:hidden flex bg-white dark:bg-[#111827] h-14 w-full border-b border-slate-200/50 dark:border-gray-800/40 shrink-0 items-center justify-between px-4 relative z-30 shadow-sm">
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
              <button
                onClick={handleDatabaseSync}
                disabled={isRefreshing}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#5277f7] hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-all cursor-pointer relative"
                title="Synchronize Google Sheets"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#5277f7]" : ""}`} />
              </button>

              <button
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-all cursor-pointer"
                title="Toggle Mode"
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
              </button>

              {isAdmin && (
                <button
                  onClick={() => {
                    setActiveView("settings");
                    setErrorMessage(null);
                    if (loggedInUser?.email) refreshUnread(loggedInUser.email);
                  }}
                  className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#5277f7] hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-all cursor-pointer"
                  title="Admin Settings"
                >
                  <Settings className="w-4 h-4" />
                  {notifUnread > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-rose-500 text-white text-[7px] font-black flex items-center justify-center leading-none">
                      {notifUnread > 9 ? "9+" : notifUnread}
                    </span>
                  )}
                </button>
              )}

              <div className="relative">
                <button
                  onClick={() => setShowProfileModal(!showProfileModal)}
                  className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200/50 dark:border-gray-850 hover:border-[#5277f7] transition-all cursor-pointer bg-slate-50 dark:bg-gray-800/60 flex items-center justify-center shrink-0 focus:outline-none"
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
                    <span className="font-extrabold text-[10px] text-slate-800 dark:text-white">PW</span>
                  )}
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
                              <span className="font-bold text-slate-700 dark:text-gray-300">Vidyapeeth Pune</span>
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
            </div>
          </header>
        )}

        {/* RESPONSIVE LEFT SIDEBAR BAR (DESKTOP ONLY) */}
        {!exportMode && (
          <aside className="hidden md:flex bg-white dark:bg-[#111827] md:flex-col justify-between items-center md:py-8 md:w-24 border-r border-slate-200/50 dark:border-gray-800/40 shrink-0 relative z-30">
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
                onClick={() => { setSearchType("name"); setActiveView("input"); setErrorMessage(null); }}
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

              {/* Workspace Color Preferences */}
              <button
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-gray-800/60 transition-all cursor-pointer"
                title="Toggle Mode"
              >
                {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
              </button>

              {/* Admin-only Settings (with unread notification badge) */}
              {isAdmin && (
                <button
                  onClick={() => {
                    setActiveView("settings");
                    setErrorMessage(null);
                    if (loggedInUser?.email) refreshUnread(loggedInUser.email);
                  }}
                  className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                    activeView === "settings"
                      ? "bg-[#5277f7] text-white shadow-lg shadow-[#5277f7]/20"
                      : "text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/60"
                  }`}
                  title="Admin Settings"
                >
                  <Settings className="w-5 h-5" />
                  {notifUnread > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center leading-none">
                      {notifUnread > 9 ? "9+" : notifUnread}
                    </span>
                  )}
                </button>
              )}
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
                            <span className="font-bold text-slate-700 dark:text-gray-300">Vidyapeeth Pune</span>
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
        <div className={`flex-1 flex flex-col min-w-0 ${exportMode ? "p-0 bg-white text-black" : "p-2.5 sm:p-4 md:p-5 bg-[#f4f7fc] dark:bg-[#090d16]"} overflow-y-auto custom-scrollbar relative z-10`}>
          
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

            {/* ADMIN SETTINGS VIEW (admins only) */}
            {activeView === "settings" && isAdmin && loggedInUser && (
              <AdminSettings
                key="settings"
                currentUser={{ email: loggedInUser.email, name: loggedInUser.name, role: userRole, center: userCenter } as SessionUser}
                onClose={() => setActiveView("home")}
                onUnreadChange={(n) => setNotifUnread(n)}
              />
            )}

            {/* HOME VIEW: Dribbble Aesthetic layout */}
            {activeView === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-8 my-auto"
              >
                {/* Brand Promos */}
                <div className="text-center space-y-4 max-w-2xl mx-auto py-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5277f7]/10 border border-[#5277f7]/20 text-[10px] font-bold text-[#5277f7] dark:text-blue-400 font-mono uppercase tracking-widest">
                    <Sparkles className="w-3 h-3 text-[#5277f7]" /> PW Vidyapeeth Academic Portal
                  </div>
                  <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
                    PW Vidyapeeth Academic Assessment Portal
                  </h2>
                  <p className="text-xs md:text-sm text-slate-500 dark:text-gray-400 max-w-lg mx-auto font-sans leading-relaxed">
                    Instantly view student academic cards, detailed subject scores, test metrics, and comprehensive division rosters.
                  </p>
                </div>

                {/* THREE DIRECTORY ACTIONS (Bento Cards to choice Search Type) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                  {/* Search Type 1: Batch */}
                  <button
                    onClick={() => { setSearchType("batch"); setActiveView("input"); }}
                    className="bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-3xl p-6 text-left hover:border-[#5277f7] dark:hover:border-blue-500 hover:shadow-xl hover:shadow-[#5277f7]/5 transition-all duration-300 group cursor-pointer outline-none relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-full pointer-events-none"></div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/5 text-[#5277f7] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-display group-hover:text-[#5277f7] transition-colors">
                      Browse Cohort Batches
                    </h3>
                    <p className="text-[11px] text-slate-450 dark:text-gray-400 mt-2 font-sans leading-relaxed">
                      Get full student rosters and class rankings compiled across Pune division batches.
                    </p>
                    <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-[#5277f7]">
                      Browse Divisions <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>

                  {/* Search Type 2: Name */}
                  <button
                    onClick={() => { setSearchType("name"); setActiveView("input"); }}
                    className="bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-3xl p-6 text-left hover:border-[#5277f7] dark:hover:border-blue-500 hover:shadow-xl hover:shadow-[#5277f7]/5 transition-all duration-300 group cursor-pointer outline-none relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-teal-500/5 to-transparent rounded-bl-full pointer-events-none"></div>
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/5 text-teal-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <User className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-display group-hover:text-[#5277f7] transition-colors">
                      Search Student by Name
                    </h3>
                    <p className="text-[11px] text-slate-450 dark:text-gray-400 mt-2 font-sans leading-relaxed">
                      Search for individual student profiles using dynamic autocomplete search filters.
                    </p>
                    <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400">
                      Search Profile <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>

                  {/* Search Type 3: Reg No */}
                  <button
                    onClick={() => { setSearchType("reg"); setActiveView("input"); }}
                    className="bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-3xl p-6 text-left hover:border-[#5277f7] dark:hover:border-blue-500 hover:shadow-xl hover:shadow-[#5277f7]/5 transition-all duration-300 group cursor-pointer outline-none relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/5 to-transparent rounded-bl-full pointer-events-none"></div>
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/5 text-purple-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Hash className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-display group-hover:text-[#5277f7] transition-colors">
                      Search by Roll Number / Registration ID
                    </h3>
                    <p className="text-[11px] text-slate-450 dark:text-gray-400 mt-2 font-sans leading-relaxed">
                      Locate complete student reports directly by entering their official roll or registration key.
                    </p>
                    <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                      Search Roll Key <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                </div>

                {/* DB Metadata Tracker */}
                <div className="max-w-xl mx-auto p-4 rounded-2xl bg-[#eaedf5] dark:bg-[#111827]/45 text-center flex flex-col justify-center items-center gap-1.5">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 dark:text-slate-500">
                    <Compass className="w-3.5 h-3.5 text-emerald-500" />
                    IN-MEMORY INDEX CACHE STATUS: <span className="text-emerald-500 font-bold tracking-widest uppercase">● ACTIVE OPTIMIZED</span>
                  </div>
                  {dbStatus.lastLoaded && (
                    <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Assessed database mapped: {new Date(dbStatus.lastLoaded).toLocaleDateString()} {new Date(dbStatus.lastLoaded).toLocaleTimeString()} ({dbStatus.sheetCount || 0} worksheets cached)
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* INPUT PANEL SEARCH VIEWS */}
            {activeView === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-md mx-auto w-full space-y-6 my-auto"
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
                      {searchType === "reg" && "Sequence Roll Key"}
                    </h2>
                  </div>

                  {/* Batch Select Options */}
                  {searchType === "batch" && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase">SELECT DIVISION BATCH</label>
                      <select
                        value={selectedBatch}
                        onChange={(e) => setSelectedBatch(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-gray-800/60 border border-slate-200/60 dark:border-gray-700/60 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-bold focus:outline-none focus:border-[#5277f7] text-xs cursor-pointer"
                      >
                        <option value="">Select class division...</option>
                        {dropdowns.batches.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
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
            {activeView === "batchList" && studentsPayload && (() => {
              const query = batchSearchQuery.toLowerCase().trim();
              const filteredStudents = studentsPayload.students
                .map((student, originalIdx) => ({ student, originalIdx }))
                .filter(({ student }) => {
                  if (!query) return true;
                  const name = (student.profile.name || "").toLowerCase();
                  const regNo = (student.profile.regNo || "").toLowerCase();
                  const batch = (student.profile.batch || "").toLowerCase();
                  return name.includes(query) || regNo.includes(query) || batch.includes(query);
                });

              return (
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

                  <div className="bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-gray-800">
                      <div>
                        <span className="text-[9px] text-[#5277f7] uppercase tracking-widest font-mono font-bold block mb-1">
                          {selectedSheetName ? "Google Sheets filter" : "Active Database Sheet"}
                        </span>
                        <h2 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-display leading-none">
                          {selectedSheetName ? selectedSheetName : "Student Directory Roster"}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {batchSearchQuery && (
                          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            Filtered: {filteredStudents.length} of {studentsPayload.students.length}
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-blue-500/5 text-[#5277f7] border border-blue-500/15">
                          {studentsPayload.students.length} Pupils found
                        </span>
                      </div>
                    </div>

                    {/* INTERACTIVE SEARCH BAR */}
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450 dark:text-gray-500" />
                      <input
                        type="text"
                        value={batchSearchQuery}
                        onChange={(e) => setBatchSearchQuery(e.target.value)}
                        placeholder="Search student by Name, Roll/Reg, or Class Batch..."
                        className="w-full bg-slate-50 dark:bg-[#090d16]/80 border border-slate-200/60 dark:border-gray-800/80 rounded-2xl pl-11 pr-10 py-3 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:outline-none focus:border-[#5277f7] focus:ring-1 focus:ring-[#5277f7]/30 transition-all font-sans"
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1 pt-1">
                        {filteredStudents.map(({ student, originalIdx }) => (
                          <button
                            key={student.profile.regNo + "_" + originalIdx}
                            onClick={() => selectStudentFromBatch(originalIdx)}
                            className="bg-slate-50 dark:bg-gray-800/30 hover:bg-slate-100 dark:hover:bg-gray-800/60 border border-slate-200/40 dark:border-gray-700/40 rounded-2xl p-4 flex items-center justify-between transition-all text-left w-full cursor-pointer outline-none group"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                alt="avatar"
                                src={getStudentAvatar(student.profile.name, originalIdx)}
                                className="w-9 h-9 rounded-xl object-cover border border-slate-200/20"
                                referrerPolicy="no-referrer"
                              />
                              <div className="space-y-1">
                                <div className="font-extrabold text-slate-800 dark:text-white text-xs group-hover:text-[#5277f7] transition-colors leading-tight">
                                  {student.profile.name}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <div className="text-[10px] text-slate-500 dark:text-gray-400 font-mono font-bold flex items-center gap-1">
                                    <span className="text-[9px] text-slate-400 font-normal">Roll:</span>
                                    {student.profile.regNo}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-gray-400 font-mono font-bold flex items-center gap-1 truncate max-w-[170px]" title={student.profile.batch}>
                                    <span className="text-[9px] text-slate-400 font-normal">Class:</span>
                                    <span className="truncate">{student.profile.batch || "N/A"}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  const shareUrl = `${window.location.origin}${window.location.pathname}?reg=${encodeURIComponent(student.profile.regNo || "")}`;
                                  navigator.clipboard.writeText(shareUrl).then(() => {
                                    setCopiedReg(student.profile.regNo);
                                    setTimeout(() => setCopiedReg(null), 2000);
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
              );
            })()}            {/* MAIN STUDENT REPORT CARDS & DASHBOARDS */}
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
                  <button
                    onClick={() => {
                      if (searchType === "batch" && studentsPayload && studentsPayload.students.length > 1) {
                        setActiveView("batchList");
                      } else {
                        setActiveView("input");
                      }
                      setErrorMessage(null);
                    }}
                    className="flex items-center gap-2 text-slate-505 dark:text-gray-400 hover:text-[#5277f7] transition-all text-xs font-bold font-sans cursor-pointer uppercase tracking-wider"
                  >
                    <ArrowLeft className="w-4 h-4 text-[#5277f7]" />
                    {searchType === "batch" && studentsPayload && studentsPayload.students.length > 1
                      ? "GO BACK TO GRID"
                      : "START NEW QUERY"}
                  </button>

                  <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
                    <button
                      onClick={triggerPrint}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-650 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-750 transition-colors shadow-sm cursor-pointer text-xs font-bold font-display uppercase tracking-wider"
                      title="Print Report"
                    >
                      <Printer className="w-4 h-4" /> Print report
                    </button>
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
                        Vidyapeeth Pune Student Analytics
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
                <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 text-white rounded-2xl p-4 md:p-5 shadow-lg border border-slate-805/85 relative overflow-hidden print-card-shadow mb-4">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle,rgba(59,130,246,0.1),transparent)] rounded-full blur-2xl pointer-events-none"></div>
                  <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-500/5 rounded-full blur-xl pointer-events-none"></div>
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10 w-full">
                    <div className="space-y-4 flex-1 w-full">
                      <div>
                        <span className="inline-flex gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold uppercase tracking-wider text-blue-400 font-mono mb-1.5">
                          Student Assessment Portfolio
                        </span>
                        <h2 className="text-xl md:text-2xl font-black tracking-tight font-display bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent leading-tight animate-fade-in">
                          {activeStudent.profile.name}
                        </h2>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-4 w-full pt-2 border-t border-white/5">
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-bold block">
                            Registration ID
                          </span>
                          <span className="text-xs font-semibold tracking-wide text-slate-200 font-mono">
                            {activeStudent.profile.regNo || "N/A"}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-bold block">
                            Assess Stream
                          </span>
                          <span className="inline-flex font-black text-[9px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full tracking-wider uppercase border border-blue-500/20 font-mono">
                            {activeStudent.profile.stream || studentsPayload?.stream || "JEE"}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-bold block">
                            Mapped center
                          </span>
                          <span className="text-xs font-semibold text-slate-200">
                            {activeStudent.profile.center || "Vidyapeeth Pune"}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-bold block">
                            Study Division
                          </span>
                          <span className="text-xs font-bold text-indigo-300 block truncate" title={activeStudent.profile.batch}>
                            {activeStudent.profile.batch || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col items-center justify-center shrink-0 w-full md:w-36 text-center shadow-md">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-bold block mb-0.5">
                        Latest Rank
                      </span>
                      <span className="text-xl md:text-2xl font-black text-amber-400 flex items-center gap-1 font-display tracking-tight drop-shadow-md">
                        <Award className="w-5 h-5 text-yellow-400 shrink-0" />
                        {activeStudent.profile.latestRank !== "N/A"
                          ? `#${activeStudent.profile.latestRank}`
                          : "N/A"}
                      </span>
                      {activeStudent.profile.latestRank !== "N/A" && activeStudent.profile.latestRankDate && activeStudent.profile.latestRankDate !== "N/A" && (
                        <span className="text-[9px] font-bold font-mono uppercase tracking-wider mt-1.5 bg-white/10 text-slate-200 px-2.5 py-0.5 rounded-full border border-white/10">
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
                          <th className="px-2 py-2 text-center">Max Marks</th>
                          <th className="px-2 py-2 text-center font-bold">Obtained</th>
                          <th className="px-3 py-2 text-left text-blue-600 dark:text-blue-400 font-extrabold min-w-[130px]">Avg Score %</th>
                          {finalSubjects.map((sub) => (
                            <th key={sub} className="px-2 py-2 text-right capitalize">
                              {sub}
                            </th>
                          ))}
                          <th className="px-2 py-2 text-right">Skipped</th>
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
                                <td className="px-2 py-1.5 md:py-2 md:table-cell flex justify-between items-center text-center">
                                  <span className="md:hidden text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono">
                                    Max Marks:
                                  </span>
                                  <span className="font-mono font-bold text-slate-500 dark:text-gray-400 text-[11px]">
                                    {test.outOf}
                                  </span>
                                </td>

                                {/* Score Obtained */}
                                <td className="px-2 py-1.5 md:py-2 md:table-cell flex justify-between items-center text-center">
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
                                      className={`px-2 py-1.5 md:py-2 md:table-cell flex justify-between items-center text-right ${
                                        subIdx === 0
                                          ? "border-t border-slate-100 dark:border-gray-800/40 md:border-t-0"
                                          : ""
                                      }`}
                                    >
                                      <span className="md:hidden text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest font-mono">
                                        {subName}:
                                      </span>
                                      <span className="font-mono text-slate-600 dark:text-gray-300 font-bold bg-slate-50 dark:bg-slate-800 md:bg-transparent px-2 md:px-0 py-0.5 md:py-0 rounded text-[11px]">
                                        {formatRawScoreValue(scoreVal)}
                                      </span>
                                    </td>
                                  );
                                })}

                                {/* Unattempted question count */}
                                <td className="px-2 py-1.5 md:py-2 md:table-cell flex justify-between items-center text-right">
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
                  This report was compiled and printed generated via automatic performance matrices on PW Vidyapeeth Pune Hub database.
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
              {dropdowns.sheets && dropdowns.sheets.length > 0 ? (() => {
                const queryLower = (sheetFilterQuery || "").toLowerCase().trim();
                const filteredSheets = dropdowns.sheets.filter(sheet => 
                  sheet.toLowerCase().includes(queryLower)
                );

                if (filteredSheets.length === 0) {
                  return (
                    <div className="bg-white dark:bg-[#111827] rounded-3xl p-12 text-center border border-slate-200/50 dark:border-gray-800/40">
                      <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Sheets Found</h3>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Try matching another date or grade name.</p>
                    </div>
                  );
                }

                return (
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
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#5277f7] dark:group-hover:text-blue-400 transition-colors" />
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
                );
              })() : (
                <div className="bg-white dark:bg-[#111827] rounded-3xl p-12 text-center border border-slate-200/50 dark:border-gray-800/40">
                  <div className="animate-spin h-8 w-8 border-2 border-slate-250 dark:border-gray-800 border-t-blue-600 dark:border-t-blue-500 rounded-full mx-auto mb-4"></div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Loading sheets roster from Google database...</p>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* MOBILE SPECIAL BOTTOM BAR */}
      {!exportMode && (
        <nav className="md:hidden flex bg-white dark:bg-[#111827] h-16 w-full border-t border-slate-200/50 dark:border-gray-800/40 shrink-0 items-center justify-around px-2 pb-safe relative z-20 shadow-lg select-none">
          {/* Home Tab */}
          <button
            onClick={() => { setActiveView("home"); setErrorMessage(null); }}
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all cursor-pointer outline-none ${
              activeView === "home"
                ? "text-[#5277f7] dark:text-blue-400"
                : "text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <LayoutGrid className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-semibold tracking-tight font-sans">Home</span>
          </button>

          {/* Search Tab */}
          <button
            onClick={() => { setSearchType("name"); setActiveView("input"); setErrorMessage(null); }}
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all cursor-pointer outline-none ${
              activeView === "input"
                ? "text-[#5277f7] dark:text-blue-400"
                : "text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <Search className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-semibold tracking-tight font-sans">Search</span>
          </button>

          {/* Batches Tab */}
          <button
            onClick={handleLoadAllStudents}
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all cursor-pointer outline-none ${
              activeView === "batchList"
                ? "text-[#5277f7] dark:text-blue-400"
                : "text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <GraduationCap className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-semibold tracking-tight font-sans">Batches</span>
          </button>

          {/* Sheets Directory Tab */}
          <button
            onClick={() => { setActiveView("sheetsList"); setErrorMessage(null); }}
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all cursor-pointer outline-none ${
              activeView === "sheetsList"
                ? "text-[#5277f7] dark:text-blue-400"
                : "text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <BookOpen className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-semibold tracking-tight font-sans">Sheets</span>
          </button>
        </nav>
      )}
    </div>

      {/* FOOTER (desktop only — hidden on mobile to avoid clashing with bottom nav) */}
      <footer className="hidden md:block w-full text-center py-6 border-t border-slate-200/60 dark:border-gray-800/60 mt-auto no-print">
        <p className="text-slate-400 dark:text-gray-500 text-xs font-mono">
          For technical issues contact with:{" "}
          <a
            href="mailto:aniket.mishra2@pw.live"
            className="text-blue-600 dark:text-blue-400 hover:underline font-bold"
          >
            aniket.mishra2@pw.live
          </a>
        </p>
      </footer>
    </div>
  );
}
