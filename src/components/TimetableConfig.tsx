import React, { useState, useEffect } from "react";
import {
  Calendar,
  Check,
  AlertCircle,
  RefreshCw,
  Users,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface TimetableConfigProps {
  adminHeaders: () => Record<string, string>;
}

export default function TimetableConfig({ adminHeaders }: TimetableConfigProps) {
  const [ttUrlSaved, setTtUrlSaved] = useState<null | "saving" | "saved" | "error">(null);
  const [ttUrlMsg, setTtUrlMsg] = useState("");
  const [teacherList, setTeacherList] = useState<Array<{ code: string; name: string }>>([]);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [teacherSaved, setTeacherSaved] = useState<null | "saving" | "saved" | "error">(null);
  const [teacherMsg, setTeacherMsg] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [autoTimetable, setAutoTimetable] = useState(true);
  const [autoToggling, setAutoToggling] = useState(false);

  // Load existing teachers + URL
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/timetable/teachers", { headers: adminHeaders() });
        if (r.ok) {
          const d = await r.json();
          const list = Object.entries(d.teachers || {}).map(([code, name]) => ({ code, name: name as string }));
          list.sort((a, b) => a.code.localeCompare(b.code));
          setTeacherList(list);
        }
      } catch {}
      try {
        const r = await fetch("/api/timetable/config", { headers: adminHeaders() });
        if (r.ok) {
          const d = await r.json();
          if (d.url) setUrlValue(d.url);
          if (typeof d.autoTimetable === "boolean") setAutoTimetable(d.autoTimetable);
        }
      } catch {}
    })();
  }, []);

  const saveUrl = async () => {
    setTtUrlSaved("saving");
    try {
      const res = await fetch("/api/timetable/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ url: urlValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setTtUrlSaved("saved");
        setTtUrlMsg(data.message || "Saved!");
        setTimeout(() => setTtUrlSaved(null), 3000);
      } else {
        setTtUrlSaved("error");
        setTtUrlMsg(data.error || "Failed");
      }
    } catch (e: any) {
      setTtUrlSaved("error");
      setTtUrlMsg(e.message);
    }
  };

  const addTeacher = async () => {
    if (!newCode.trim() || !newName.trim()) return;
    setTeacherSaved("saving");
    try {
      const res = await fetch("/api/timetable/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ add: { code: newCode.toUpperCase().trim(), name: newName.trim() } }),
      });
      if (res.ok) {
        const code = newCode.toUpperCase().trim();
        setTeacherList(prev => [...prev.filter(t => t.code !== code), { code, name: newName.trim() }].sort((a, b) => a.code.localeCompare(b.code)));
        setNewCode("");
        setNewName("");
        setTeacherSaved("saved");
        setTeacherMsg("Teacher added!");
        setTimeout(() => setTeacherSaved(null), 2000);
      }
    } catch (e: any) {
      setTeacherSaved("error");
      setTeacherMsg(e.message);
    }
  };

  const removeTeacher = async (code: string) => {
    try {
      await fetch("/api/timetable/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ remove: code }),
      });
      setTeacherList(prev => prev.filter(t => t.code !== code));
    } catch {}
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* URL Config Card */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 p-4 md:p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#5277f7]/10 flex items-center justify-center">
            <Calendar className="w-3.5 h-3.5 text-[#5277f7]" />
          </div>
          <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">Sheet URL</h3>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={urlValue}
            onChange={e => setUrlValue(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
            className="flex-1 bg-slate-50 dark:bg-gray-900/40 rounded-xl border border-slate-200 dark:border-gray-800 px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-[#5277f7] transition-colors font-mono"
          />
          <button
            onClick={saveUrl}
            disabled={ttUrlSaved === "saving"}
            className={`font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              ttUrlSaved === "saved"
                ? "bg-emerald-500 text-white"
                : ttUrlSaved === "error"
                ? "bg-red-500 text-white"
                : "bg-[#5277f7] hover:bg-[#4062dd] text-white"
            }`}
          >
            {ttUrlSaved === "saved" ? <><Check className="w-3.5 h-3.5" /> Saved!</> :
             ttUrlSaved === "error" ? <><AlertCircle className="w-3.5 h-3.5" /> Error</> :
             ttUrlSaved === "saving" ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...</> :
             <><Check className="w-3.5 h-3.5" /> Save URL</>}
          </button>
        </div>

        {ttUrlSaved && ttUrlMsg && (
          <div className={`text-[10px] px-3 py-1.5 rounded-lg ${
            ttUrlSaved === "saved" ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600" :
            ttUrlSaved === "error" ? "bg-red-50 dark:bg-red-950/30 text-red-600" :
            "text-slate-400"
          }`}>
            {ttUrlMsg}
          </div>
        )}

        <button
          onClick={async () => {
            try {
              await fetch("/api/timetable/refresh", { method: "POST", headers: adminHeaders() });
              setTtUrlSaved("saved");
              setTtUrlMsg("Refreshing data in background...");
              setTimeout(() => setTtUrlSaved(null), 3000);
            } catch {}
          }}
          className="flex items-center gap-1.5 text-[11px] font-bold text-[#5277f7] hover:text-[#4062dd] cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Refresh Data
        </button>
      </div>

      {/* Auto-Timetable Toggle */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 p-4 md:p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Auto Timetable for Teachers</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {autoTimetable ? "Teachers apna timetable login ke baad automatically dekhte hain" : "Teachers ko manually code search karna padega"}
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              setAutoToggling(true);
              try {
                const r = await fetch("/api/timetable/toggle-auto", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...adminHeaders() },
                  body: JSON.stringify({ enabled: !autoTimetable }),
                });
                if (r.ok) {
                  const d = await r.json();
                  setAutoTimetable(d.enabled);
                }
              } catch {}
              setAutoToggling(false);
            }}
            disabled={autoToggling}
            className="cursor-pointer transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {autoTimetable ? (
              <ToggleRight className="w-10 h-10 text-emerald-500" />
            ) : (
              <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Teacher Name-Code Management */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 p-4 md:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">Teacher Codes</h3>
          </div>
          <span className="text-[9px] text-slate-400 font-mono">{teacherList.length} mapped</span>
        </div>

        <p className="text-[10px] text-slate-400">Map teacher codes (like CSI) to full names. Data saves to config.json on the server.</p>

        {/* Add new */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newCode}
            onChange={e => setNewCode(e.target.value.toUpperCase())}
            placeholder="Code"
            maxLength={5}
            className="w-20 bg-slate-50 dark:bg-gray-900/40 rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-purple-500 transition-colors font-mono text-center uppercase"
          />
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Full Name (e.g., Mohd Shazil Iqbal)"
            className="flex-1 bg-slate-50 dark:bg-gray-900/40 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-purple-500 transition-colors"
            onKeyDown={e => { if (e.key === "Enter") addTeacher(); }}
          />
          <button
            onClick={addTeacher}
            disabled={!newCode.trim() || !newName.trim()}
            className="bg-purple-500 hover:bg-purple-600 disabled:bg-slate-300 disabled:dark:bg-gray-700 text-white font-bold text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            + Add
          </button>
        </div>

        {/* Feedback */}
        {teacherSaved && teacherMsg && (
          <div className={`text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
            teacherSaved === "saved" ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600" :
            "bg-red-50 dark:bg-red-950/30 text-red-600"
          }`}>
            {teacherSaved === "saved" ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {teacherMsg}
          </div>
        )}

        {/* Teacher List */}
        {teacherList.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
            {teacherList.map(t => (
              <div key={t.code} className="flex items-center justify-between bg-slate-50 dark:bg-gray-900/30 rounded-lg px-3 py-2 group">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-black text-[#5277f7] font-mono w-10 shrink-0">{t.code}</span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">{t.name}</span>
                </div>
                <button
                  onClick={() => removeTeacher(t.code)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 cursor-pointer transition-all p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {teacherList.length === 0 && (
          <div className="text-center py-4 text-xs text-slate-400 italic">
            No teacher mappings yet. Add your first one above!
          </div>
        )}
      </div>

      {/* How to use */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 p-4 md:p-5 shadow-sm">
        <p className="text-[9px] font-bold tracking-widest uppercase text-slate-400 font-mono mb-2">How it works</p>
        <ol className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 list-decimal list-inside">
          <li>Paste your Google Sheet URL above (with <code className="bg-slate-200 dark:bg-gray-800 px-1 py-0.5 rounded text-[9px] font-mono">gid=...</code> for specific tab)</li>
          <li>Click <strong className="text-slate-700 dark:text-slate-200">Save URL</strong> → data loads in background</li>
          <li>Add teacher codes + names below for easy identification</li>
          <li>All data saves to <code className="bg-slate-200 dark:bg-gray-800 px-1 py-0.5 rounded text-[9px] font-mono">config.json</code> on server</li>
          <li>Go to <strong className="text-[#5277f7]">Timetable</strong> sidebar tab to view schedules</li>
        </ol>
      </div>
    </div>
  );
}
