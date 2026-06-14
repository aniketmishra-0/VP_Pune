import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

/**
 * Lightweight "Install app" pill.
 * - On Chrome/Edge/Android: uses the captured `beforeinstallprompt` event.
 * - On iOS Safari: shows a one-time hint that explains "Share → Add to Home Screen".
 * Hidden once installed or dismissed (remembered in localStorage).
 */
export default function InstallPrompt() {
  const [evt, setEvt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Don't show if already installed (running standalone) or user dismissed earlier
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-ignore - iOS-only property
      window.navigator.standalone === true;
    if (standalone) return;
    if (localStorage.getItem("pwInstallDismissed") === "1") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari: no beforeinstallprompt — show a manual hint instead.
    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
    if (isIOS && isSafari) {
      setIosHint(true);
      setShow(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem("pwInstallDismissed", "1");
    setShow(false);
  };

  const install = async () => {
    if (!evt) return;
    evt.prompt();
    try {
      await evt.userChoice;
    } catch (_) {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[65] no-print">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl p-3 shadow-2xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#5277f7]/10 text-[#5277f7] flex items-center justify-center shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight">
            Install VP Pune app
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
            {iosHint
              ? "Tap Share → Add to Home Screen"
              : "Faster access, works like an app"}
          </p>
        </div>
        {!iosHint && evt && (
          <button
            onClick={install}
            className="bg-[#5277f7] hover:bg-[#4062dd] text-white font-bold text-[10px] uppercase tracking-wider px-3 py-2 rounded-xl cursor-pointer shrink-0"
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800 cursor-pointer shrink-0"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
