import React, { useState, useEffect, useCallback } from "react";
import {
  QrCode,
  Copy,
  Check,
  Printer,
  RefreshCw,
  Trash2,
  ShieldAlert,
  Globe,
  Smartphone,
  ToggleLeft,
  ToggleRight,
  Power,
  Link,
  ExternalLink,
  Download,
  Save,
} from "lucide-react";
import QRCode from "qrcode";
import type { SessionUser } from "./AdminSettings";

interface Props {
  currentUser: SessionUser;
}

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

const PortalAdmin: React.FC<Props> = ({ currentUser }) => {
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

  const [settingsLoading, setSettingsLoading] = useState(false);

  const [portalQr, setPortalQr] = useState("");
  const [copied, setCopied] = useState(false);

  const [bindings, setBindings] = useState<any[]>([]);
  const [bindingsCount, setBindingsCount] = useState(0);
  const [bindingsLoading, setBindingsLoading] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [resetResult, setResetResult] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  const authHeaders = useCallback(
    (extra: Record<string, string> = {}) => ({
      "x-user-email": currentUser.email,
      "x-staff-token": localStorage.getItem("pwStaffToken") || "",
      ...extra,
    }),
    [currentUser.email]
  );

  // Load settings on mount
  useEffect(() => {
    fetch("/api/portal-settings")
      .then((r) => r.json())
      .then((data) => {
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
      })
      .catch(() => {});
  }, []);

  // Generate QR
  useEffect(() => {
    const url = `${window.location.origin}/result`;
    QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setPortalQr)
      .catch(() => setPortalQr(""));
  }, []);

  // Load bindings
  const loadBindings = useCallback(async () => {
    setBindingsLoading(true);
    try {
      const res = await fetch("/api/device-bindings", { headers: authHeaders() });
      const data = await res.json();
      setBindings(data.bindings || []);
      setBindingsCount(data.count || 0);
    } catch {}
    setBindingsLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    loadBindings();
  }, [loadBindings]);

  const saveSettings = async (updates: Record<string, any>) => {
    setSettingsLoading(true);
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
        flash("Portal settings saved successfully");
      }
    } catch {
      alert("Failed to save portal settings.");
    }
    setSettingsLoading(false);
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
      setResetInput("");
      setTimeout(() => setResetResult(null), 4000);
      loadBindings();
    } catch {}
  };

  const clearAllBindings = async () => {
    if (!confirm("Clear ALL device locks? Every device can search again.")) return;
    try {
      await fetch("/api/device-bindings/reset-all", { method: "POST", headers: authHeaders() });
      flash("All device locks cleared");
      loadBindings();
    } catch {}
  };

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const portalUrl = `${window.location.origin}/result`;

  return (
    <div className="space-y-5">
      {/* Notice Toast */}
      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl px-4 py-2.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <Check className="w-3.5 h-3.5" /> {notice}
        </div>
      )}      {/* Portal Controls — Settings & Toggles */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 overflow-hidden p-5">
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
          <div className="flex items-center justify-between bg-slate-50 dark:bg-gray-800/40 border border-slate-150 dark:border-gray-700/40 rounded-xl px-4 py-3">
            <div>
              <p className="text-[11px] font-bold text-slate-800 dark:text-white">Student Result Portal</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Students can search & view results publicly</p>
            </div>
            <button
              onClick={() => saveSettings({ portalEnabled: !portalEnabled })}
              disabled={settingsLoading}
              className="cursor-pointer disabled:opacity-50"
            >
              {portalEnabled ? <ToggleRight className="w-8 h-8 text-emerald-500" /> : <ToggleLeft className="w-8 h-8 text-slate-400" />}
            </button>
          </div>

          <div className="flex items-center justify-between bg-slate-50 dark:bg-gray-800/40 border border-slate-150 dark:border-gray-700/40 rounded-xl px-4 py-3">
            <div>
              <p className="text-[11px] font-bold text-slate-800 dark:text-white">QR Code Display</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Show QR code on the student result page</p>
            </div>
            <button
              onClick={() => saveSettings({ qrEnabled: !qrEnabled })}
              disabled={settingsLoading}
              className="cursor-pointer disabled:opacity-50"
            >
              {qrEnabled ? <ToggleRight className="w-8 h-8 text-emerald-500" /> : <ToggleLeft className="w-8 h-8 text-slate-400" />}
            </button>
          </div>

          <div className="flex items-center justify-between bg-slate-50 dark:bg-gray-800/40 border border-slate-150 dark:border-gray-700/40 rounded-xl px-4 py-3">
            <div>
              <p className="text-[11px] font-bold text-slate-800 dark:text-white">Device Lock Cooldown</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Prevent students from checking multiple registrations</p>
            </div>
            <button
              onClick={() => saveSettings({ cooldownEnabled: !cooldownEnabled })}
              disabled={settingsLoading}
              className="cursor-pointer disabled:opacity-50"
            >
              {cooldownEnabled ? <ToggleRight className="w-8 h-8 text-emerald-500" /> : <ToggleLeft className="w-8 h-8 text-slate-400" />}
            </button>
          </div>

          <div className="flex items-center justify-between bg-slate-50 dark:bg-gray-800/40 border border-slate-150 dark:border-gray-700/40 rounded-xl px-4 py-3">
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
                disabled={!cooldownEnabled || settingsLoading}
                value={cooldownHours}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    saveSettings({ cooldownHours: val });
                  }
                }}
                className="w-16 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800 dark:text-white text-center focus:outline-none focus:border-[#5277f7] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Printable Card Design & QR Customization */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 overflow-hidden p-5 space-y-4">
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
              id="qr-card-print-target" 
              className="w-full max-w-[280px] bg-white border-[3px] border-slate-900 rounded-[20px] p-5 text-center text-slate-955 shadow-sm"
            >
              <div className="text-lg font-black text-[#5277f7] tracking-tight mb-0.5 leading-tight select-none">
                {tempLogo}
              </div>
              <div className="text-[10px] text-slate-505 font-semibold mb-4 leading-none select-none">
                {tempSubtitle}
              </div>
              {portalQr ? (
                <img src={portalQr} alt="QR Code" className="w-36 h-36 mx-auto mb-4 object-contain" />
              ) : (
                <div className="w-36 h-36 mx-auto mb-4 bg-slate-100 rounded-xl flex items-center justify-center text-slate-405 text-[10px]">
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
                  onClick={() => saveSettings({
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
                  onClick={() => { navigator.clipboard.writeText(portalUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-xl text-[10px] font-bold text-slate-650 dark:text-slate-350 transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy Link"}
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
                    const element = document.getElementById("qr-card-print-target");
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
                  className="flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-xl text-[10px] font-bold text-slate-650 dark:text-slate-350 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Device Locks Table */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/50 dark:border-gray-800/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/50 dark:border-gray-800/40">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-3.5 bg-amber-500 rounded-full" />
            <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Active Device Locks</span>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/40">
              {bindingsCount} {bindingsCount === 1 ? "Student" : "Students"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadBindings} disabled={bindingsLoading} className="text-[10px] font-bold text-[#5277f7] flex items-center gap-1 cursor-pointer disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${bindingsLoading ? "animate-spin" : ""}`} /> Refresh
            </button>
            {bindingsCount > 0 && (
              <button onClick={clearAllBindings} className="text-[10px] font-bold text-rose-500 flex items-center gap-1 cursor-pointer bg-rose-50 dark:bg-rose-950/20 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-900/30">
                <Trash2 className="w-3 h-3" /> Clear All
              </button>
            )}
          </div>
        </div>

        {/* Quick Unlock */}
        <div className="px-5 py-2.5 border-b border-slate-100 dark:border-gray-800/30 bg-slate-50/50 dark:bg-gray-900/20">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && resetBinding(resetInput)}
              placeholder="Enter Reg No to unlock..."
              className="flex-1 bg-white dark:bg-gray-800/60 border border-slate-200/60 dark:border-gray-700/60 rounded-xl px-3 py-2 text-[11px] text-slate-800 dark:text-white font-mono focus:outline-none focus:border-[#5277f7] placeholder-slate-400"
            />
            <button
              onClick={() => resetBinding(resetInput)}
              disabled={!resetInput.trim()}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Unlock
            </button>
          </div>
          {resetResult && <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">✓ {resetResult}</p>}
        </div>

        {/* Table */}
        {bindings.length > 0 ? (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/80 dark:bg-gray-800/40 text-[9px] uppercase tracking-wider text-slate-500 dark:text-gray-500 font-bold border-b border-slate-100 dark:border-gray-800/40">
                  <tr>
                    <th className="px-4 py-2 text-left">Reg No</th>
                    <th className="px-4 py-2 text-left">IP</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Locked</th>
                    <th className="px-4 py-2 text-left">Remaining</th>
                    <th className="px-4 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800/30">
                  {bindings.map((b: any, i: number) => {
                    const h = Math.floor(b.remainingMin / 60), m = b.remainingMin % 60;
                    const maxMinutes = (cooldownHours || 3) * 60;
                    const pct = Math.min(100, (b.remainingMin / maxMinutes) * 100);
                    return (
                      <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-2.5"><span className="font-bold text-slate-800 dark:text-white font-mono text-[11px]">{b.regNo}</span></td>
                        <td className="px-4 py-2.5"><span className="text-slate-500 dark:text-gray-400 font-mono text-[10px]">{b.ip || "—"}</span></td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            {(b.types || []).map((t: string) => (
                              <span key={t} className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase ${
                                t === "Device" ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                                  : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40"
                              }`}>{t === "Device" ? "📱" : "🌐"} {t}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><span className="text-slate-500 dark:text-gray-400 text-[10px]">{fmtTime(b.lockedAt)}</span></td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-14 bg-slate-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-1.5 rounded-full ${pct > 50 ? "bg-amber-500" : pct > 20 ? "bg-orange-500" : "bg-rose-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-gray-400 font-mono">{h > 0 ? `${h}h ${m}m` : `${m}m`}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => resetBinding(b.regNo)} className="text-[9px] font-bold text-rose-500 hover:text-white bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-500 border border-rose-200 dark:border-rose-900/40 px-3 py-1 rounded-lg cursor-pointer transition-all">
                            Unlock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-gray-800/30">
              {bindings.map((b: any, i: number) => {
                const h = Math.floor(b.remainingMin / 60), m = b.remainingMin % 60;
                const maxMinutes = (cooldownHours || 3) * 60;
                const pct = Math.min(100, (b.remainingMin / maxMinutes) * 100);
                return (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-800 dark:text-white font-mono text-[12px]">{b.regNo}</span>
                      <button onClick={() => resetBinding(b.regNo)} className="text-[9px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-500 hover:text-white border border-rose-200 dark:border-rose-900/40 px-3 py-1 rounded-lg cursor-pointer transition-all">
                        Unlock
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="text-slate-400 font-mono">{b.ip || "—"}</span>
                      {(b.types || []).map((t: string) => (
                        <span key={t} className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase ${
                          t === "Device" ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                            : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40"
                        }`}>{t === "Device" ? "📱" : "🌐"} {t}</span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[9px] text-slate-400">{fmtTime(b.lockedAt)}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 bg-slate-100 dark:bg-gray-800 rounded-full h-1 overflow-hidden">
                          <div className={`h-1 rounded-full ${pct > 50 ? "bg-amber-500" : pct > 20 ? "bg-orange-500" : "bg-rose-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 font-mono">{h > 0 ? `${h}h ${m}m` : `${m}m`}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-slate-400 dark:text-slate-600">
            <ShieldAlert className="w-7 h-7 mx-auto mb-2 opacity-30" />
            <p className="text-[11px] font-bold">No active device locks</p>
            <p className="text-[9px] mt-0.5">When students search results, their devices get locked here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortalAdmin;
