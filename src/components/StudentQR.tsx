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
  const [dataUrl, setDataUrl] = useState<string>("");
  const [bigUrl, setBigUrl] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url) {
      setDataUrl("");
      return;
    }
    QRCode.toDataURL(url, { width: 120, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
    QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setBigUrl)
      .catch(() => setBigUrl(""));
  }, [url]);

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
      {/* Small QR thumbnail (click to enlarge for scanning) */}
      <button
        onClick={() => setOpen(true)}
        title="Show QR — scan to view this report"
        className="shrink-0 rounded-xl border border-white/20 bg-white p-1 hover:scale-105 transition-transform cursor-pointer no-print"
      >
        {dataUrl ? (
          <img src={dataUrl} alt="Report QR" className="w-12 h-12 rounded-md" />
        ) : (
          <div className="w-12 h-12 flex items-center justify-center text-slate-400">
            <QrCode className="w-6 h-6" />
          </div>
        )}
      </button>

      {/* Fullscreen modal with large scannable QR */}
      {open && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 no-print"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#111827] rounded-3xl p-6 max-w-sm w-full text-center relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center gap-2 mb-1">
              <QrCode className="w-4 h-4 text-[#5277f7]" />
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#5277f7] uppercase">
                Scan to view result
              </span>
            </div>
            {name && (
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-display mb-4">
                {name}
              </h3>
            )}

            <div className="bg-white rounded-2xl p-3 inline-block border border-slate-200 shadow-sm">
              {bigUrl ? (
                <img src={bigUrl} alt="Report QR code" className="w-56 h-56" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-300">
                  <QrCode className="w-16 h-16" />
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 leading-relaxed">
              Student scans this to open <span className="font-bold">only their own</span> report — no login needed.
            </p>

            <div className="flex gap-2 mt-4">
              <button
                onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 font-bold py-2.5 rounded-xl text-[11px] uppercase tracking-wider font-display cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy Link"}
              </button>
              <button
                onClick={downloadQR}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#5277f7] hover:bg-[#4062dd] text-white font-bold py-2.5 rounded-xl text-[11px] uppercase tracking-wider font-display cursor-pointer transition-colors"
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
