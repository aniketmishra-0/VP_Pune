import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Shield,
  Activity,
  Bell,
  Download,
  Upload,
  Trash2,
  Check,
  X,
  Clock,
  Database,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  Eye,
  Pencil,
  ShieldCheck,
  QrCode,
  Printer,
  Copy,
  Link,
  Smartphone,
  Globe,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  Power,
  Zap,
  FileSpreadsheet,
  Save,
} from "lucide-react";
import QRCode from "qrcode";

export type { Role, SessionUser } from "../types";
import type { Role, SessionUser } from "../types";


interface AppUser {
  email: string;
  name?: string;
  role: Role;
  center?: string;
  addedAt: string;
  addedBy?: string;
  lastLogin?: string;
}

interface ActivityEntry {
  id: string;
  ts: string;
  email: string;
  action: string;
  detail?: string;
}

interface AppNotification {
  id: string;
  ts: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  read: boolean;
}

interface SheetSync {
  name: string;
  rows: number;
  lastSync: string;
}

type Tab = "users" | "activity" | "notifications" | "sync" | "export" | "import" | "portal" | "system";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "users", label: "User Roles", icon: Users },
  { id: "portal", label: "Result Portal", icon: QrCode },
  { id: "activity", label: "Activity Log", icon: Activity },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "sync", label: "Last Sync", icon: Clock },
  { id: "export", label: "Export Cache", icon: Download },
  { id: "import", label: "Bulk Import", icon: Upload },
];

function fmtTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relTime(iso: string) {
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

const roleStyles: Record<Role, string> = {
  admin: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/40",
  teacher: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40",
  staff: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-gray-800/60 dark:text-gray-300 dark:border-gray-700/50",
};

const RoleIcon = ({ role }: { role: Role }) =>
  role === "admin" ? <ShieldCheck className="w-3 h-3" /> : role === "teacher" ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />;

interface AdminSettingsProps {
  currentUser: SessionUser;
  isSuperAdmin?: boolean;
  onClose: () => void;
  onUnreadChange?: (n: number) => void;
  featureFlags?: { timetableGenerator: boolean; sheetEditor: boolean };
  onFeatureFlagsChange?: (flags: { timetableGenerator: boolean; sheetEditor: boolean }) => void;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({
  currentUser,
  isSuperAdmin = false,
  onClose,
  onUnreadChange,
  featureFlags = { timetableGenerator: false, sheetEditor: false },
  onFeatureFlagsChange,
}) => {
  const [tab, setTab] = useState<Tab>("users");
  const tabsList = isSuperAdmin
    ? [...TABS, { id: "system" as Tab, label: "Feature Flags", icon: Zap }]
    : TABS;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [sheetConfigured, setSheetConfigured] = useState<boolean>(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [sheets, setSheets] = useState<SheetSync[]>([]);
  const [syncMeta, setSyncMeta] = useState<{ lastLoaded?: string; sheetCount?: number }>({});
  const [loading, setLoading] = useState(false);

  const [bulkText, setBulkText] = useState("");
  const [bulkRole, setBulkRole] = useState<Role>("staff");
  const [bulkCenter, setBulkCenter] = useState("");
  const [bulkResult, setBulkResult] = useState<{ added: string[]; updated: string[]; invalid: string[] } | null>(null);

  // Per-row expand/collapse state for the User Roles list
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  // User pending deletion (drives the confirmation dialog)
  const [pendingDelete, setPendingDelete] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Portal tab state
  const [portalQr, setPortalQr] = useState<string>("");
  const [portalCopied, setPortalCopied] = useState(false);
  const [deviceBindings, setDeviceBindings] = useState<any[]>([]);
  const [bindingsCount, setBindingsCount] = useState(0);
  const [bindingsLoading, setBindingsLoading] = useState(false);
  const [resetRegInput, setResetRegInput] = useState("");
  const [resetResult, setResetResult] = useState<string | null>(null);

  // Portal settings toggles
  const [portalEnabled, setPortalEnabled] = useState(true);
  const [qrEnabled, setQrEnabled] = useState(true);
  const [cooldownEnabled, setCooldownEnabled] = useState(true);
  const [cooldownHours, setCooldownHours] = useState(3);
  const [qrLogoText, setQrLogoText] = useState("PW Vidyapeeth Pune");
  const [qrSubtitleText, setQrSubtitleText] = useState("Student Result Portal");
  const [qrFooterText, setQrFooterText] = useState("");

  // Temp states for text fields to allow editing
  const [tempLogo, setTempLogo] = useState("PW Vidyapeeth Pune");
  const [tempSubtitle, setTempSubtitle] = useState("Student Result Portal");
  const [tempFooter, setTempFooter] = useState("");

  const [portalSettingsLoading, setPortalSettingsLoading] = useState(false);

  // Load portal settings
  useEffect(() => {
    fetch("/api/portal-settings").then(r => r.json()).then(data => {
      if (typeof data.portalEnabled === "boolean") setPortalEnabled(data.portalEnabled);
      if (typeof data.qrEnabled === "boolean") setQrEnabled(data.qrEnabled);
      if (typeof data.cooldownEnabled === "boolean") setCooldownEnabled(data.cooldownEnabled);
      if (typeof data.cooldownHours === "number") setCooldownHours(data.cooldownHours);
      if (typeof data.qrLogoText === "string") {
        setQrLogoText(data.qrLogoText);
        setTempLogo(data.qrLogoText);
      }
      if (typeof data.qrSubtitleText === "string") {
        setQrSubtitleText(data.qrSubtitleText);
        setTempSubtitle(data.qrSubtitleText);
      }
      if (typeof data.qrFooterText === "string") {
        setQrFooterText(data.qrFooterText);
        setTempFooter(data.qrFooterText);
      }
    }).catch(() => {});
  }, []);

  const toggleExpand = useCallback(
    (email: string) => setExpandedEmail((cur) => (cur === email ? null : email)),
    []
  );

  const authHeaders = useCallback(
    (extra: Record<string, string> = {}) => ({
      "x-user-email": currentUser.email,
      "x-staff-token": localStorage.getItem("pwStaffToken") || "",
      ...extra,
    }),
    [currentUser.email]
  );

  const savePortalSettings = useCallback(async (updates: Record<string, any>) => {
    setPortalSettingsLoading(true);
    try {
      const res = await fetch("/api/portal-settings", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.ok) {
        if (typeof data.portalEnabled === "boolean") setPortalEnabled(data.portalEnabled);
        if (typeof data.qrEnabled === "boolean") setQrEnabled(data.qrEnabled);
        if (typeof data.cooldownEnabled === "boolean") setCooldownEnabled(data.cooldownEnabled);
        if (typeof data.cooldownHours === "number") setCooldownHours(data.cooldownHours);
        if (typeof data.qrLogoText === "string") {
          setQrLogoText(data.qrLogoText);
          setTempLogo(data.qrLogoText);
        }
        if (typeof data.qrSubtitleText === "string") {
          setQrSubtitleText(data.qrSubtitleText);
          setTempSubtitle(data.qrSubtitleText);
        }
        if (typeof data.qrFooterText === "string") {
          setQrFooterText(data.qrFooterText);
          setTempFooter(data.qrFooterText);
        }
        setNotice("Portal settings updated successfully.");
      }
    } catch { setError("Failed to update portal settings."); }
    setPortalSettingsLoading(false);
  }, [authHeaders]);

  const [isUpdatingFeatures, setIsUpdatingFeatures] = useState(false);
  const toggleFeatureFlag = useCallback(async (key: "timetableGenerator" | "sheetEditor", value: boolean) => {
    setIsUpdatingFeatures(true);
    setError(null);
    setNotice(null);
    try {
      const newFlags = { ...featureFlags, [key]: value };
      const res = await fetch("/api/features", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(newFlags),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && onFeatureFlagsChange) {
          onFeatureFlagsChange(data.featureFlags);
          setNotice(`${key === "timetableGenerator" ? "Auto Timetable Generator" : "Sheet Editor"} ${value ? "enabled" : "disabled"} successfully.`);
        }
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update feature flags.");
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setIsUpdatingFeatures(false);
    }
  }, [authHeaders, featureFlags, onFeatureFlagsChange]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load users.");
      const data = await res.json();
      setUsers(data.users || []);
      setSheetConfigured(!!data.sheetConfigured);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/activity", { headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load activity.");
      setActivity((await res.json()).activity || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications", { headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load notifications.");
      const data = await res.json();
      setNotifications(data.notifications || []);
      onUnreadChange?.(data.unread || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, onUnreadChange]);

  const loadSync = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sync-status", { headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load sync status.");
      const data = await res.json();
      setSheets(data.sheets || []);
      setSyncMeta({ lastLoaded: data.lastLoaded, sheetCount: data.sheetCount });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    setError(null);
    if (tab === "users") loadUsers();
    else if (tab === "activity") loadActivity();
    else if (tab === "notifications") loadNotifications();
    else if (tab === "sync") loadSync();
  }, [tab, loadUsers, loadActivity, loadNotifications, loadSync]);

  // ESC closes the delete confirmation dialog
  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingDelete(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingDelete]);

  const changeRole = async (email: string, role: Role, center?: string) => {
    setError(null);
    try {
      const res = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(center !== undefined ? { email, role, center } : { email, role }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update role.");
      flash(`${email} updated`);
      loadUsers();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const removeUser = async (email: string) => {
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to remove user.");
      flash(`Removed ${email}`);
      loadUsers();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const markAllRead = async () => {
    await fetch("/api/admin/notifications/read", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    });
    loadNotifications();
  };

  const clearNotifications = async () => {
    await fetch("/api/admin/notifications/clear", {
      method: "POST",
      headers: authHeaders(),
    });
    loadNotifications();
  };

  const submitBulk = async () => {
    setError(null);
    setBulkResult(null);
    try {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ emails: bulkText, role: bulkRole, center: bulkCenter }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Bulk import failed.");
      const data = await res.json();
      setBulkResult(data);
      flash(`${data.added.length} added, ${data.updated.length} updated`);
      setBulkText("");
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ---- Portal functions ----
  // Generate QR code when portal tab opens
  useEffect(() => {
    if (tab !== "portal" || portalQr) return;
    const pageUrl = `${window.location.origin}/result`;
    QRCode.toDataURL(pageUrl, {
      width: 512,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setPortalQr)
      .catch(() => setPortalQr(""));
  }, [tab, portalQr]);

  // Auto-load bindings when portal tab opens
  useEffect(() => {
    if (tab === "portal") loadBindings();
  }, [tab]);

  const loadBindings = async () => {
    setBindingsLoading(true);
    try {
      const res = await fetch("/api/device-bindings", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load bindings");
      const data = await res.json();
      setDeviceBindings(data.bindings || []);
      setBindingsCount(data.count || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBindingsLoading(false);
    }
  };

  const resetBinding = async (regNo: string) => {
    if (!regNo.trim()) return;
    try {
      const res = await fetch("/api/device-bindings/reset", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ regNo: regNo.trim() }),
      });
      const data = await res.json();
      setResetResult(data.message || `Cleared bindings for ${regNo}`);
      setResetRegInput("");
      setTimeout(() => setResetResult(null), 4000);
      loadBindings();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const clearAllBindings = async () => {
    if (!confirm("Are you sure you want to clear ALL device locks? This will allow every device to search again.")) return;
    try {
      const res = await fetch("/api/device-bindings/reset-all", {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      flash(data.message || "All bindings cleared");
      loadBindings();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const exportCache = (format: "xlsx" | "csv") => {
    // Use a temporary anchor; auth header can't be set on a plain link, so fetch+blob
    fetch(`/api/admin/export-cache?format=${format}`, { headers: authHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Export failed.");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vp-cache-${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        flash(`Cache exported as ${format.toUpperCase()}`);
      })
      .catch((e) => setError(e.message));
  };

  const notifColor: Record<AppNotification["type"], string> = {
    info: "text-blue-500 bg-blue-500/10",
    success: "text-emerald-500 bg-emerald-500/10",
    warning: "text-amber-500 bg-amber-500/10",
    error: "text-rose-500 bg-rose-500/10",
  };

  return (
    <div
      key="settings"
      className="max-w-4xl mx-auto w-full space-y-3 sm:space-y-5"
    >
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors text-xs font-bold font-display cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
      </button>

      <div className="bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-3xl p-4 md:p-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-gray-800">
          <div className="w-11 h-11 rounded-2xl bg-[#5277f7]/10 text-[#5277f7] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-bold tracking-widest text-[#5277f7] uppercase block">
              Admin Control Center
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-display leading-tight">
              Settings &amp; Access Management
            </h2>
          </div>
          <span className={`ml-auto shrink-0 text-[9px] font-mono font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${roleStyles[currentUser.role]}`}>
            <RoleIcon role={currentUser.role} /> {currentUser.role.toUpperCase()}
          </span>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/60 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs — wrap on mobile so all are visible (no hidden horizontal scroll) */}
        <div className="flex flex-wrap gap-1.5 py-3">
          {tabsList.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer font-display ${
                  active
                    ? "bg-[#5277f7] text-white shadow-md shadow-[#5277f7]/20"
                    : "text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Flash / errors */}
        {error && (
          <div className="mb-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {notice && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" /> {notice}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono py-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading...
          </div>
        )}

        {/* ---- USERS / ROLES ---- */}
        {tab === "users" && (
          <div className="space-y-2.5 mt-1">
            <div className={`p-3 rounded-xl border text-[11px] font-medium flex items-center gap-2 ${sheetConfigured ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-300" : "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-300"}`}>
              <Database className="w-3.5 h-3.5 shrink-0" />
              {sheetConfigured
                ? "Roles are saved to the Google settings spreadsheet (Admin / Teacher / Staff tabs)."
                : "Settings spreadsheet not connected — roles are stored locally. Add service-account credentials to sync to Sheets."}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mb-1">
              Admins see all centers + Settings. Teachers can sync &amp; view their center. Staff can only view their center's reports.
            </p>
            {users.length === 0 && !loading && (
              <p className="text-xs text-slate-400 py-6 text-center">No users yet.</p>
            )}
            {users.map((u) => {
              const isExpanded = expandedEmail === u.email;
              const isSelf = u.email === currentUser.email;
              const initial = (u.name || u.email).trim().charAt(0).toUpperCase() || "?";
              return (
                <div
                  key={u.email}
                  className={`rounded-2xl border overflow-hidden transition-colors ${
                    isExpanded
                      ? "bg-white dark:bg-gray-900/40 border-[#5277f7]/30 dark:border-[#5277f7]/30 shadow-sm"
                      : "bg-slate-50 dark:bg-gray-800/40 border-slate-100 dark:border-gray-800"
                  }`}
                >
                  {/* ─── Collapsed/header row (always visible, click to toggle) ─── */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(u.email)}
                    aria-expanded={isExpanded}
                    aria-controls={`user-row-${u.email}`}
                    className="w-full flex items-center gap-3 p-3 text-left cursor-pointer hover:bg-slate-100/60 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5277f7] to-[#3a56c5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                      {initial}
                    </div>

                    {/* Name + email */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 dark:text-white truncate">
                          {u.name || u.email.split("@")[0]}
                        </span>
                        {isSelf && (
                          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#5277f7]/10 text-[#5277f7] shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate block">
                        {u.email}
                      </span>
                    </div>

                    {/* Role chip */}
                    <span
                      className={`shrink-0 text-[9px] font-mono font-bold px-2 py-1 rounded-md border inline-flex items-center gap-1 ${roleStyles[u.role]}`}
                    >
                      <RoleIcon role={u.role} /> {u.role}
                    </span>

                    {/* Center pill (only when set, hidden on small screens to save room) */}
                    {u.center && (
                      <span
                        className="hidden md:inline-flex shrink-0 max-w-[140px] truncate text-[9px] font-mono px-2 py-1 rounded-md bg-slate-200/60 dark:bg-gray-700/60 text-slate-500 dark:text-slate-300"
                        title={u.center}
                      >
                        {u.center}
                      </span>
                    )}

                    {/* Delete (hidden for self) — uses span+role to avoid nested <button> */}
                    {!isSelf && (
                      <span
                        role="button"
                        aria-label={`Remove ${u.email}`}
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDelete(u);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            setPendingDelete(u);
                          }
                        }}
                        className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                        title="Remove user"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    )}

                    {/* Chevron */}
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* ─── Expanded body ─── */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        id={`user-row-${u.email}`}
                        key="body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 pt-2.5 space-y-2.5 border-t border-slate-100 dark:border-gray-800">
                          {/* Role buttons */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase shrink-0">
                              Role:
                            </span>
                            {/* Only super-admin can assign admin role; other admins see teacher/staff only */}
                            {(["admin", "teacher", "staff"] as Role[]).filter(r => r !== "admin" || isSuperAdmin).map((r) => (
                              <button
                                key={r}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (u.role !== r) changeRole(u.email, r);
                                }}
                                className={`text-[9px] font-mono font-bold px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1 transition-all cursor-pointer ${
                                  u.role === r
                                    ? roleStyles[r]
                                    : "border-slate-200 dark:border-gray-700 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800"
                                }`}
                                title={`Set as ${r}`}
                              >
                                <RoleIcon role={r} /> {r}
                              </button>
                            ))}
                          </div>

                          {/* Center input */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase shrink-0">
                              Center:
                            </span>
                            <input
                              type="text"
                              defaultValue={u.center || ""}
                              placeholder="e.g. Vidyapeeth Pune (blank = all)"
                              onClick={(e) => e.stopPropagation()}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== (u.center || "")) changeRole(u.email, u.role, v);
                              }}
                              className="flex-1 bg-white dark:bg-gray-900/60 border border-slate-200/60 dark:border-gray-700/60 rounded-lg px-3 py-1.5 text-[11px] text-slate-700 dark:text-gray-200 font-medium focus:outline-none focus:border-[#5277f7]"
                            />
                          </div>

                          {/* Meta line */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400 dark:text-slate-500 font-mono pt-1">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {u.lastLogin ? `Last login ${relTime(u.lastLogin)}` : `Added ${fmtTime(u.addedAt)}`}
                            </span>
                            {u.addedBy && <span>· invited by {u.addedBy}</span>}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {/* ---- ACTIVITY LOG ---- */}
        {tab === "activity" && (
          <div className="space-y-1.5 mt-1 max-h-[55vh] overflow-y-auto custom-scrollbar">
            {activity.length === 0 && !loading && (
              <p className="text-xs text-slate-400 py-6 text-center">No activity recorded yet.</p>
            )}
            {activity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-[#5277f7] shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-gray-200">{a.email}</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500"> — {a.action}</span>
                  {a.detail && <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate font-mono">{a.detail}</span>}
                </div>
                <span className="text-[9px] text-slate-400 font-mono shrink-0">{fmtTime(a.ts)}</span>
              </div>
            ))}
          </div>
        )}

        {/* ---- NOTIFICATIONS ---- */}
        {tab === "notifications" && (
          <div className="mt-1">
            <div className="flex justify-end gap-2 mb-2">
              <button onClick={markAllRead} className="text-[10px] font-bold font-mono text-[#5277f7] hover:underline cursor-pointer">
                Mark all read
              </button>
              <button onClick={clearNotifications} className="text-[10px] font-bold font-mono text-rose-500 hover:underline cursor-pointer">
                Clear all
              </button>
            </div>
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 && !loading && (
                <p className="text-xs text-slate-400 py-6 text-center">No notifications.</p>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border ${
                    n.read
                      ? "border-slate-100 dark:border-gray-800 opacity-60"
                      : "border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/40"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${notifColor[n.type]}`}>
                    <Bell className="w-3 h-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-white">{n.title}</span>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">{n.message}</p>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono shrink-0">{relTime(n.ts)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- LAST SYNC PER SHEET/CENTER ---- */}
        {tab === "sync" && (
          <div className="mt-1 space-y-2.5">
            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 font-mono mb-1">
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              {syncMeta.sheetCount || 0} sheets cached · Full sync {syncMeta.lastLoaded ? relTime(syncMeta.lastLoaded) : "—"}
            </div>
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {sheets.map((s) => (
                <div key={s.name} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-800">
                  <Clock className="w-3.5 h-3.5 text-[#5277f7] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-gray-200 truncate block">{s.name}</span>
                    <span className="text-[9px] text-slate-400 font-mono">{s.rows} students</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono shrink-0">{fmtTime(s.lastSync)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- EXPORT CACHE ---- */}
        {tab === "export" && (
          <div className="mt-1 space-y-3">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              Download the entire in-memory cache (all worksheets) for offline debugging or backup.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => exportCache("xlsx")}
                className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-400 transition-all cursor-pointer text-left"
              >
                <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white block">Excel (.xlsx)</span>
                  <span className="text-[10px] text-slate-400">One tab per worksheet</span>
                </div>
              </button>
              <button
                onClick={() => exportCache("csv")}
                className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 hover:border-blue-400 transition-all cursor-pointer text-left"
              >
                <Download className="w-5 h-5 text-[#5277f7] shrink-0" />
                <div>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white block">CSV (.csv)</span>
                  <span className="text-[10px] text-slate-400">Flattened single file</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ---- RESULT PORTAL ---- */}
        {tab === "portal" && (() => {
          const portalUrl = `${window.location.origin}/result`;
          return (
            <div className="mt-1 space-y-5">
              {/* Portal Controls — Settings & Toggles */}
              <div className="bg-white dark:bg-[#111827] border border-slate-200/60 dark:border-gray-800/80 overflow-hidden p-5 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <Power className="w-4 h-4 text-[#5277f7]" />
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Portal Controls</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                      portalEnabled
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                        : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${portalEnabled ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                      {portalEnabled ? "Live" : "Off"}
                    </span>
                  </div>
                </div>

                {/* Toggle Rows */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-gray-800/40 border border-slate-200/50 dark:border-gray-705/40 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-[11px] font-bold text-slate-800 dark:text-white">Student Result Portal</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Students can search & view results publicly</p>
                    </div>
                    <button
                      onClick={() => savePortalSettings({ portalEnabled: !portalEnabled })}
                      disabled={portalSettingsLoading}
                      className="cursor-pointer disabled:opacity-50"
                    >
                      {portalEnabled ? <ToggleRight className="w-8 h-8 text-emerald-500" /> : <ToggleLeft className="w-8 h-8 text-slate-400" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 dark:bg-gray-800/40 border border-slate-200/50 dark:border-gray-705/40 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-[11px] font-bold text-slate-800 dark:text-white">QR Code Display</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Show QR code on the student result page</p>
                    </div>
                    <button
                      onClick={() => savePortalSettings({ qrEnabled: !qrEnabled })}
                      disabled={portalSettingsLoading}
                      className="cursor-pointer disabled:opacity-50"
                    >
                      {qrEnabled ? <ToggleRight className="w-8 h-8 text-emerald-500" /> : <ToggleLeft className="w-8 h-8 text-slate-400" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 dark:bg-gray-800/40 border border-slate-200/50 dark:border-gray-705/40 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-[11px] font-bold text-slate-800 dark:text-white">Device Lock Cooldown</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Prevent students from checking multiple registrations</p>
                    </div>
                    <button
                      onClick={() => savePortalSettings({ cooldownEnabled: !cooldownEnabled })}
                      disabled={portalSettingsLoading}
                      className="cursor-pointer disabled:opacity-50"
                    >
                      {cooldownEnabled ? <ToggleRight className="w-8 h-8 text-emerald-500" /> : <ToggleLeft className="w-8 h-8 text-slate-400" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 dark:bg-gray-800/40 border border-slate-200/50 dark:border-gray-705/40 rounded-xl px-4 py-3">
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-slate-800 dark:text-white">Cooldown Duration (Hours)</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Dynamic freeze timer (in decimal hours)</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0.1"
                        max="168"
                        step="0.5"
                        disabled={!cooldownEnabled || portalSettingsLoading}
                        value={cooldownHours}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > 0) {
                            savePortalSettings({ cooldownHours: val });
                          }
                        }}
                        className="w-16 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800 dark:text-white text-center focus:outline-none focus:border-[#5277f7] disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Printable Card Design & QR Customization */}
              <div className="bg-white dark:bg-[#111827] border border-slate-200/60 dark:border-gray-800/80 overflow-hidden p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <QrCode className="w-4 h-4 text-[#5277f7]" />
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">QR Card Customization & Print</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Card Mockup Preview Column */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-50 dark:bg-gray-900/30 border border-slate-150 dark:border-gray-850 rounded-2xl p-4">
                    <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 dark:text-gray-500 mb-3">Card Live Preview</span>
                    
                    {/* The Actual HTML structure to print/download */}
                    <div 
                      id="qr-card-print-target-modal" 
                      className="w-full max-w-[280px] bg-white border-[3px] border-slate-900 rounded-[20px] p-5 text-center text-slate-950 shadow-sm"
                    >
                      <div className="text-lg font-black text-[#5277f7] tracking-tight mb-0.5 leading-tight select-none">
                        {tempLogo}
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold mb-4 leading-none select-none">
                        {tempSubtitle}
                      </div>
                      {portalQr ? (
                        <img src={portalQr} alt="QR Code" className="w-36 h-36 mx-auto mb-4 object-contain" />
                      ) : (
                        <div className="w-36 h-36 mx-auto mb-4 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-[10px]">
                          Generating QR...
                        </div>
                      )}
                      <div className="font-mono text-[9px] text-[#5277f7] bg-slate-100 px-3 py-1.5 rounded-lg break-all font-bold select-none">
                        {tempFooter || portalUrl}
                      </div>
                      
                      <div className="mt-4 text-left border-t border-slate-100 pt-3 space-y-1.5 text-[9px] text-slate-600 leading-relaxed select-none">
                        <strong>How to check your result:</strong>
                        <div className="flex gap-1.5 items-center">
                          <span className="w-3.5 h-3.5 bg-[#5277f7] text-white rounded-full flex items-center justify-center font-bold text-[7px] shrink-0">1</span>
                          <span>Scan QR code or open link</span>
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <span className="w-3.5 h-3.5 bg-[#5277f7] text-white rounded-full flex items-center justify-center font-bold text-[7px] shrink-0">2</span>
                          <span>Enter Registration Number</span>
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <span className="w-3.5 h-3.5 bg-[#5277f7] text-white rounded-full flex items-center justify-center font-bold text-[7px] shrink-0">3</span>
                          <span>View results instantly</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form Fields & Controls Column */}
                  <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500 block mb-1">Card Logo Title</label>
                        <input
                          type="text"
                          placeholder="e.g. PW Vidyapeeth Pune"
                          value={tempLogo}
                          onChange={(e) => setTempLogo(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-gray-800/40 border border-slate-200 dark:border-gray-700/60 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-[#5277f7] placeholder-slate-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500 block mb-1">Card Subtitle / Description</label>
                        <input
                          type="text"
                          placeholder="e.g. Student Result Portal"
                          value={tempSubtitle}
                          onChange={(e) => setTempSubtitle(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-gray-800/40 border border-slate-200 dark:border-gray-700/60 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-[#5277f7] placeholder-slate-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500 block mb-1">Card URL / Link text (Leave empty to use actual link)</label>
                        <input
                          type="text"
                          placeholder={portalUrl}
                          value={tempFooter}
                          onChange={(e) => setTempFooter(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-gray-800/40 border border-slate-200 dark:border-gray-700/60 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white font-mono focus:outline-none focus:border-[#5277f7] placeholder-slate-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-gray-800/50">
                      <div className="flex gap-2">
                        <button
                          disabled={tempLogo === qrLogoText && tempSubtitle === qrSubtitleText && tempFooter === qrFooterText}
                          onClick={() => savePortalSettings({
                            qrLogoText: tempLogo,
                            qrSubtitleText: tempSubtitle,
                            qrFooterText: tempFooter,
                          })}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white border border-emerald-500/25 rounded-xl text-[11px] font-extrabold uppercase tracking-wide transition-all cursor-pointer shadow-sm shadow-emerald-600/10"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Save Card Details
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(portalUrl);
                            setPortalCopied(true);
                            setTimeout(() => setPortalCopied(false), 2000);
                          }}
                          className="flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-xl text-[10px] font-bold text-slate-650 dark:text-slate-355 transition-all cursor-pointer"
                        >
                          {portalCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {portalCopied ? "Copied!" : "Copy Link"}
                        </button>
                        <button
                          onClick={() => {
                            const w = window.open('', '_blank');
                            if (!w || !portalQr) return;
                            w.document.write(`<!DOCTYPE html><html><head><title>${tempLogo} - Result QR</title>
                              <style>body{font-family:'Inter',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff;color:#0f172a}.card{border:3px solid #0f172a;border-radius:24px;padding:40px;text-align:center;max-width:400px}.logo{font-size:32px;font-weight:900;color:#5277f7;margin-bottom:8px}.subtitle{font-size:14px;color:#64748b;margin-bottom:24px}.qr{width:280px;height:280px;margin:0 auto 20px}.url{font-family:monospace;font-size:13px;color:#5277f7;background:#f1f5f9;padding:10px 16px;border-radius:12px;word-break:break-all}.instructions{margin-top:20px;font-size:13px;color:#475569;line-height:1.6}.step{display:flex;align-items:flex-start;gap:8px;text-align:left;margin-top:8px}.step-num{background:#5277f7;color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
                              <body><div class="card"><div class="logo">${tempLogo}</div><div class="subtitle">${tempSubtitle}</div>
                              <img src="${portalQr}" class="qr" alt="QR"/><div class="url">${tempFooter || portalUrl}</div>
                              <div class="instructions">
                                <strong>How to check your result:</strong>
                                <div class="step"><span class="step-num">1</span><span>Scan QR code or open the link above</span></div>
                                <div class="step"><span class="step-num">2</span><span>Enter your Registration Number</span></div>
                                <div class="step"><span class="step-num">3</span><span>View your exam results instantly</span></div>
                              </div>
                              </div></body></html>`);
                            w.document.close();
                            setTimeout(() => w.print(), 500);
                          }}
                          className="flex items-center justify-center gap-1.5 py-2 bg-[#5277f7]/10 dark:bg-[#5277f7]/20 hover:bg-[#5277f7]/20 border border-[#5277f7]/25 rounded-xl text-[10px] font-bold text-[#5277f7] transition-all cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print QR
                        </button>
                        <button
                          onClick={async () => {
                            const element = document.getElementById("qr-card-print-target-modal");
                            if (!element) return;
                            try {
                              const getHtml2Pdf = async () => {
                                // @ts-ignore
                                return (await import("html2pdf.js")).default || window.html2pdf;
                              };
                              const html2pdf = await getHtml2Pdf();
                              const opt = {
                                margin: [10, 10, 10, 10],
                                filename: `${tempLogo.replace(/[^a-z0-9]/gi, '_')}_Result_QR.pdf`,
                                image: { type: "jpeg", quality: 0.98 },
                                html2canvas: { scale: 3, useCORS: true, backgroundColor: "#ffffff" },
                                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
                              };
                              html2pdf().set(opt).from(element).save();
                            } catch (err) {
                              console.error(err);
                              alert("Failed to download PDF.");
                            }
                          }}
                          className="flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-xl text-[10px] font-bold text-slate-655 dark:text-slate-355 transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            {/* Device Bindings Management — Enhanced */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200/60 dark:border-gray-800/80 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/60 dark:border-gray-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-3.5 bg-amber-500 rounded-full" />
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Active Device Locks</span>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/40">
                    {bindingsCount} {bindingsCount === 1 ? "Student" : "Students"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadBindings}
                    disabled={bindingsLoading}
                    className="text-[10px] font-bold text-[#5277f7] hover:text-[#4062dd] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${bindingsLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                  {bindingsCount > 0 && (
                    <button
                      onClick={clearAllBindings}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer bg-rose-50 dark:bg-rose-950/20 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-900/30"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Unlock */}
              <div className="px-5 py-3 border-b border-slate-200/50 dark:border-gray-800/60 bg-slate-50/50 dark:bg-gray-900/20">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={resetRegInput}
                    onChange={(e) => setResetRegInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && resetBinding(resetRegInput)}
                    placeholder="Enter Reg No to unlock..."
                    className="flex-1 bg-white dark:bg-gray-800/60 border border-slate-200/60 dark:border-gray-700/60 rounded-xl px-3 py-2 text-[11px] text-slate-800 dark:text-white font-mono focus:outline-none focus:border-[#5277f7] placeholder-slate-400"
                  />
                  <button
                    onClick={() => resetBinding(resetRegInput)}
                    disabled={!resetRegInput.trim()}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold py-2 px-4 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer flex items-center gap-1.5 shrink-0 transition-all"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Unlock
                  </button>
                </div>
                {resetResult && (
                  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                    ✓ {resetResult}
                  </div>
                )}
              </div>

              {/* Bindings Table */}
              {deviceBindings.length > 0 ? (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50/80 dark:bg-gray-800/40 text-[9px] uppercase tracking-wider text-slate-500 dark:text-gray-500 font-bold border-b border-slate-200/50 dark:border-gray-800/60">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Reg No</th>
                          <th className="px-4 py-2.5 text-left">IP Address</th>
                          <th className="px-4 py-2.5 text-left">Lock Type</th>
                          <th className="px-4 py-2.5 text-left">Locked At</th>
                          <th className="px-4 py-2.5 text-left">Time Left</th>
                          <th className="px-4 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-gray-800/40">
                        {deviceBindings.map((b: any, i: number) => {
                          const remainH = Math.floor(b.remainingMin / 60);
                          const remainM = b.remainingMin % 60;
                          const maxMinutes = (cooldownHours || 3) * 60;
                          const pct = Math.min(100, (b.remainingMin / maxMinutes) * 100);
                          return (
                            <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-gray-800/20 transition-colors">
                              <td className="px-4 py-2.5">
                                <span className="font-bold text-slate-800 dark:text-white font-mono text-[11px]">{b.regNo}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-slate-500 dark:text-gray-400 font-mono text-[10px]">{b.ip || "—"}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex gap-1">
                                  {(b.types || []).map((t: string) => (
                                    <span key={t} className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${
                                      t === "Device"
                                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                                        : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40"
                                    }`}>
                                      {t === "Device" ? "📱 Device" : "🌐 IP"}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[10px]">{b.lockedAt ? fmtTime(b.lockedAt) : "—"}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-slate-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                    <div className={`h-1.5 rounded-full transition-all ${pct > 50 ? "bg-amber-500" : pct > 20 ? "bg-orange-500" : "bg-rose-500"}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-600 dark:text-gray-400 font-mono whitespace-nowrap">
                                    {remainH > 0 ? `${remainH}h ${remainM}m` : `${remainM}m`}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => resetBinding(b.regNo)}
                                  className="text-[9px] font-bold text-rose-500 hover:text-white bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-500 border border-rose-200 dark:border-rose-900/40 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                                >
                                  Unlock
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-slate-100 dark:divide-gray-800/40">
                    {deviceBindings.map((b: any, i: number) => {
                      const remainH = Math.floor(b.remainingMin / 60);
                      const remainM = b.remainingMin % 60;
                      const maxMinutes = (cooldownHours || 3) * 60;
                      const pct = Math.min(100, (b.remainingMin / maxMinutes) * 100);
                      return (
                        <div key={i} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-800 dark:text-white font-mono text-[12px]">{b.regNo}</span>
                            <button
                              onClick={() => resetBinding(b.regNo)}
                              className="text-[9px] font-bold text-rose-500 hover:text-white bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-500 border border-rose-200 dark:border-rose-900/40 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                            >
                              Unlock
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            <span className="text-slate-400 font-mono">{b.ip || "—"}</span>
                            <span className="text-slate-300 dark:text-gray-700">·</span>
                            {(b.types || []).map((t: string) => (
                              <span key={t} className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase ${
                                t === "Device"
                                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                                  : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40"
                              }`}>
                                {t === "Device" ? "📱" : "🌐"} {t}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[9px] text-slate-400">{b.lockedAt ? fmtTime(b.lockedAt) : ""}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-12 bg-slate-100 dark:bg-gray-800 rounded-full h-1 overflow-hidden">
                                <div className={`h-1 rounded-full ${pct > 50 ? "bg-amber-500" : pct > 20 ? "bg-orange-500" : "bg-rose-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[9px] font-bold text-slate-500 font-mono">
                                {remainH > 0 ? `${remainH}h ${remainM}m` : `${remainM}m`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-slate-400 dark:text-slate-600">
                  <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-[11px] font-bold">No active device locks</p>
                  <p className="text-[9px] mt-1 text-slate-400 dark:text-slate-600">
                    When students search results, their devices get locked here
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

        {/* ---- BULK EMAIL IMPORT ---- */}
        {tab === "import" && (
          <div className="mt-1 space-y-3">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              Paste multiple emails (separated by commas, spaces or new lines) to grant access in one go.
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              placeholder={"aniket.mishra@pw.live\nacademic.coordinator@physicswallah.org\n..."}
              className="w-full bg-slate-50 dark:bg-gray-800/60 border border-slate-200/60 dark:border-gray-700/60 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-mono focus:outline-none focus:border-[#5277f7] text-xs resize-y"
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase shrink-0">Center:</span>
              <input
                type="text"
                value={bulkCenter}
                onChange={(e) => setBulkCenter(e.target.value)}
                placeholder="e.g. Vidyapeeth Pune (blank = all centers)"
                className="flex-1 bg-slate-50 dark:bg-gray-800/60 border border-slate-200/60 dark:border-gray-700/60 rounded-lg px-3 py-2 text-[11px] text-slate-700 dark:text-gray-200 font-medium focus:outline-none focus:border-[#5277f7]"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Assign role:</span>
              {(["staff", "teacher", "admin"] as Role[]).filter(r => r !== "admin" || isSuperAdmin).map((r) => (
                <button
                  key={r}
                  onClick={() => setBulkRole(r)}
                  className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg border inline-flex items-center gap-1 transition-all cursor-pointer ${
                    bulkRole === r ? roleStyles[r] : "border-slate-200 dark:border-gray-700 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <RoleIcon role={r} /> {r}
                </button>
              ))}
              <button
                onClick={submitBulk}
                disabled={!bulkText.trim()}
                className="ml-auto bg-[#5277f7] hover:bg-[#4062dd] disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold py-2 px-5 rounded-xl text-[11px] uppercase tracking-wider font-display cursor-pointer flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" /> Import
              </button>
            </div>
            {bulkResult && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-800 text-[11px] space-y-1">
                <p className="text-emerald-600 dark:text-emerald-400 font-bold">{bulkResult.added.length} added · {bulkResult.updated.length} updated</p>
                {bulkResult.invalid.length > 0 && (
                  <p className="text-rose-500 font-mono break-words">Skipped invalid: {bulkResult.invalid.join(", ")}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---- SYSTEM / FEATURE FLAGS ---- */}
        {tab === "system" && isSuperAdmin && (
          <div className="mt-1 space-y-5">
            <div className="bg-white dark:bg-[#111827] border border-slate-200/60 dark:border-gray-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
                <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Feature Flags</span>
              </div>
              <p className="text-[10px] text-slate-400">Enable or disable heavy application modules. Disabled features won't load, optimizing startup performance.</p>

              {/* Timetable Generator Toggle */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-gray-800/60 border border-slate-200/50 dark:border-gray-700/50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-white">Auto Timetable Generator</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">AI-powered timetable generation engine (~77KB chunk)</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleFeatureFlag("timetableGenerator", !featureFlags.timetableGenerator)}
                  disabled={isUpdatingFeatures}
                  className="cursor-pointer disabled:opacity-50 transition-all shrink-0"
                >
                  {featureFlags.timetableGenerator ? (
                    <ToggleRight className="w-10 h-10 text-emerald-500 drop-shadow-sm" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-400" />
                  )}
                </button>
              </div>

              {/* Sheet Editor Toggle */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-gray-800/60 border border-slate-200/50 dark:border-gray-700/50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-white">Sheet Editor</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Quick-edit timetable sheets in-app (~33KB chunk)</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleFeatureFlag("sheetEditor", !featureFlags.sheetEditor)}
                  disabled={isUpdatingFeatures}
                  className="cursor-pointer disabled:opacity-50 transition-all shrink-0"
                >
                  {featureFlags.sheetEditor ? (
                    <ToggleRight className="w-10 h-10 text-emerald-500 drop-shadow-sm" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Delete confirmation dialog ─── */}
      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            key="delete-confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => !deleting && setPendingDelete(null)}
          >
            <motion.div
              key="delete-confirm-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-confirm-title"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#111827] rounded-3xl shadow-2xl border border-slate-200/50 dark:border-gray-800 p-5 sm:p-6 max-w-md w-full"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-500 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-mono font-bold tracking-widest text-rose-500 uppercase block">
                    Confirm Removal
                  </span>
                  <h3
                    id="delete-confirm-title"
                    className="text-sm font-extrabold text-slate-900 dark:text-white font-display leading-tight"
                  >
                    Remove user access?
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1.5 leading-relaxed">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {pendingDelete.name || pendingDelete.email.split("@")[0]}
                    </span>{" "}
                    will lose access immediately. They'll need to be re-invited to log in again.
                  </p>

                  <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-800 space-y-1.5">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">Email</span>
                      <p className="text-[11px] font-mono text-slate-700 dark:text-slate-200 truncate">
                        {pendingDelete.email}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">Current role</span>
                      <span
                        className={`mt-0.5 inline-flex text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border items-center gap-1 ${roleStyles[pendingDelete.role]}`}
                      >
                        <RoleIcon role={pendingDelete.role} /> {pendingDelete.role}
                      </span>
                    </div>
                    {pendingDelete.center && (
                      <div>
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">Center</span>
                        <p className="text-[11px] font-mono text-slate-700 dark:text-slate-200 truncate">
                          {pendingDelete.center}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setPendingDelete(null)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl text-[11px] font-bold font-display text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!pendingDelete || deleting) return;
                    const target = pendingDelete;
                    setDeleting(true);
                    try {
                      await removeUser(target.email);
                      if (expandedEmail === target.email) setExpandedEmail(null);
                      setPendingDelete(null);
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl text-[11px] font-extrabold font-display text-white bg-rose-500 hover:bg-rose-600 inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-rose-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" /> Yes, remove
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminSettings;
