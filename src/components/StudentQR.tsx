import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, X, Download, Copy, Check } from "lucide-react";

/**
 * Shows a small QR code for a student's private share link.
 * A student can scan it to open ONLY their own report (no login needed) —
 * the link carries a per-student HMAC token, so it can't be guessed/edited.
 */
export default function StudentQR({
  url,
  name,
  regNo,
}: {
  url: string;
  name?: string;
  regNo?: string;
}) {
  const [bigUrl, setBigUrl] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate the big QR only when the modal actually opens — avoids
  // re-encoding on every dashboard render (was causing visible flicker).
  useEffect(() => {
    if (!open || !url || bigUrl) return;
    QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setBigUrl)
      .catch(() => setBigUrl(""));
  }, [open, url, bigUrl]);

  if (!url) return null;

  const copyLink = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadQR = () => {
    if (!bigUrl) return;
    const a = document.createElement("a");
    a.href = bigUrl;
    a.download = `${(name || regNo || "student").replace(/[^a-zA-Z0-9]/g, "_")}_QR.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <>
      {/* Compact icon button — opens scannable QR modal */}
      <button
        onClick={() => setOpen(true)}
        title="Show QR — student scans to view their report"
        className="shrink-0 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20 border border-white/20 hover:border-white/40 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer no-print"
      >
        <QrCode className="w-5 h-5" strokeWidth={2.25} />
      </button>

      {/* Fullscreen scannable QR modal */}
      {open && (
        <div
          className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 no-print animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5277f7]/10 border border-[#5277f7]/20 mb-4">
              <QrCode className="w-3.5 h-3.5 text-[#5277f7]" />
              <span className="text-[10px] font-mono font-black tracking-widest text-[#5277f7] uppercase">
                Private Result QR
              </span>
            </div>

            {name && (
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-display mb-1 leading-tight">
                {name}
              </h3>
            )}
            {regNo && (
              <p className="text-[10px] font-mono text-slate-400 mb-5">Reg No: {regNo}</p>
            )}

            <div className="bg-white rounded-2xl p-4 inline-block border-2 border-slate-100 shadow-inner">
              {bigUrl ? (
                <img src={bigUrl} alt="Report QR code" className="w-60 h-60" />
              ) : (
                <div className="w-60 h-60 flex items-center justify-center text-slate-300">
                  <QrCode className="w-20 h-20" />
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-5 leading-relaxed px-2">
              The student scans this QR from their phone to view <span className="font-bold text-slate-700 dark:text-white">only their own result</span>. No login required.
            </p>

            <div className="flex gap-2 mt-5">
              <button
                onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 font-bold py-3 rounded-xl text-[11px] uppercase tracking-wider font-display cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy Link"}
              </button>
              <button
                onClick={downloadQR}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#5277f7] hover:bg-[#4062dd] text-white font-bold py-3 rounded-xl text-[11px] uppercase tracking-wider font-display cursor-pointer transition-colors shadow-md shadow-[#5277f7]/30"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
