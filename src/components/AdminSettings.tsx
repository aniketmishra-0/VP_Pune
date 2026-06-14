import React, { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
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
  Eye,
  Pencil,
  ShieldCheck,
} from "lucide-react";

export type Role = "admin" | "teacher" | "staff";

export interface SessionUser {
  email: string;
  name?: string;
  role: Role;
  center?: string;
}

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

type Tab = "users" | "activity" | "notifications" | "sync" | "export" | "import";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "users", label: "User Roles", icon: Users },
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
  onClose: () => void;
  onUnreadChange?: (n: number) => void;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({
  currentUser,
  onClose,
  onUnreadChange,
}) => {
  const [tab, setTab] = useState<Tab>("users");
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

  const authHeaders = useCallback(
    (extra: Record<string, string> = {}) => ({
      "x-user-email": currentUser.email,
      "x-staff-token": localStorage.getItem("pwStaffToken") || "",
      ...extra,
    }),
    [currentUser.email]
  );

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
    <motion.div
      key="settings"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="max-w-4xl mx-auto w-full space-y-5"
    >
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors text-xs font-bold font-display cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
      </button>

      <div className="bg-white dark:bg-[#111827] border border-slate-200/50 dark:border-gray-800/40 rounded-3xl p-5 md:p-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-gray-800">
          <div className="w-11 h-11 rounded-2xl bg-[#5277f7]/10 text-[#5277f7] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-bold tracking-widest text-[#5277f7] uppercase block">
              Admin Control Center
            </span>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-display leading-tight">
              Settings &amp; Access Management
            </h2>
          </div>
          <span className={`ml-auto text-[9px] font-mono font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${roleStyles[currentUser.role]}`}>
            <RoleIcon role={currentUser.role} /> {currentUser.role.toUpperCase()}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto custom-scrollbar py-3 -mx-1 px-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer font-display ${
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
            {users.map((u) => (
              <div
                key={u.email}
                className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-800"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 dark:text-white truncate">
                        {u.name || u.email.split("@")[0]}
                      </span>
                      {u.email === currentUser.email && (
                        <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#5277f7]/10 text-[#5277f7]">YOU</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate block">{u.email}</span>
                    <span className="text-[9px] text-slate-300 dark:text-slate-600 font-mono">
                      {u.lastLogin ? `Last login ${relTime(u.lastLogin)}` : `Added ${fmtTime(u.addedAt)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {(["admin", "teacher", "staff"] as Role[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => u.role !== r && changeRole(u.email, r)}
                        className={`text-[9px] font-mono font-bold px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1 transition-all cursor-pointer ${
                          u.role === r
                            ? roleStyles[r]
                            : "border-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800"
                        }`}
                        title={`Set as ${r}`}
                      >
                        <RoleIcon role={r} /> {r}
                      </button>
                    ))}
                    <button
                      onClick={() => removeUser(u.email)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                      title="Remove user"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Per-user center assignment (drives center-based access) */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase shrink-0">Center:</span>
                  <input
                    type="text"
                    defaultValue={u.center || ""}
                    placeholder="e.g. Vidyapeeth Pune (blank = all)"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (u.center || "")) changeRole(u.email, u.role, v);
                    }}
                    className="flex-1 bg-white dark:bg-gray-900/60 border border-slate-200/60 dark:border-gray-700/60 rounded-lg px-3 py-1.5 text-[11px] text-slate-700 dark:text-gray-200 font-medium focus:outline-none focus:border-[#5277f7]"
                  />
                </div>
              </div>
            ))}
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
              {(["staff", "teacher", "admin"] as Role[]).map((r) => (
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
      </div>
    </motion.div>
  );
};

export default AdminSettings;
