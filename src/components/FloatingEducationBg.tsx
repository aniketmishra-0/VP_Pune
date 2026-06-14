import React from "react";

/**
 * Animated education/science floating background.
 * Used behind the login screen, dashboard, and other shells so the
 * "atoms / DNA / stars / formulas" vibe is consistent across views.
 *
 * Each icon carries the `fbg-icon` utility class so the cursor can
 * hover-bounce it (see `fbg-bounce` keyframes in `src/index.css`).
 * The parent stays `pointer-events-none`; individual icons re-enable
 * pointer events via `.fbg-icon` so they don't block the foreground UI.
 */
export default function FloatingEducationBg() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none no-print" aria-hidden="true">

          {/* ═══════════════ ATOMS ═══════════════ */}
          {/* Large Atom — top left */}
          <svg className="fbg-icon absolute w-20 h-20 text-white/[0.2] dark:text-white/[0.1] animate-float-drift" style={{ top: "5%", left: "3%", animationDuration: "25s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            <ellipse cx="12" cy="12" rx="10" ry="4" />
            <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
            <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
          </svg>

          {/* Medium Atom — bottom right */}
          <svg className="fbg-icon absolute w-16 h-16 text-white/[0.15] dark:text-white/[0.08] animate-float-drift-reverse" style={{ bottom: "8%", right: "4%", animationDuration: "30s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <ellipse cx="12" cy="12" rx="10" ry="4" />
            <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
            <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
          </svg>

          {/* Small Atom — center right */}
          <svg className="fbg-icon absolute w-12 h-12 text-sky-200/[0.2] dark:text-sky-300/[0.1] animate-float-sway" style={{ top: "45%", right: "2%", animationDuration: "20s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <ellipse cx="12" cy="12" rx="9" ry="3.5" />
            <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)" />
            <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)" />
          </svg>

          {/* NEW — Mid-left atom (fills the big empty zone on the left) */}
          <svg className="fbg-icon absolute w-14 h-14 text-sky-200/[0.22] dark:text-sky-300/[0.1] animate-float-zigzag" style={{ top: "38%", left: "16%", animationDuration: "23s", animationDelay: "1.5s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <ellipse cx="12" cy="12" rx="10" ry="4" />
            <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
            <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
          </svg>

          {/* NEW — Right-mid atom (fills the big empty zone on the right) */}
          <svg className="fbg-icon absolute w-14 h-14 text-purple-200/[0.2] dark:text-purple-300/[0.09] animate-float-drift" style={{ top: "32%", right: "18%", animationDuration: "27s", animationDelay: "2s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
            <circle cx="12" cy="12" r="2.2" fill="currentColor" />
            <ellipse cx="12" cy="12" rx="10" ry="4" />
            <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
            <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
          </svg>

          {/* ═══════════════ DNA HELIX ═══════════════ */}
          {/* DNA — left side tall */}
          <svg className="fbg-icon absolute w-14 h-28 text-white/[0.18] dark:text-white/[0.09] animate-float-rise" style={{ top: "15%", left: "5%", animationDuration: "18s" }} viewBox="0 0 30 60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 2 C8 10, 22 10, 22 18 C22 26, 8 26, 8 34 C8 42, 22 42, 22 50 C22 58, 8 58, 8 58" />
            <path d="M22 2 C22 10, 8 10, 8 18 C8 26, 22 26, 22 34 C22 42, 8 42, 8 50 C8 58, 22 58, 22 58" />
            <line x1="8" y1="10" x2="22" y2="10" strokeWidth="1" opacity="0.6" />
            <line x1="8" y1="18" x2="22" y2="18" strokeWidth="1" opacity="0.6" />
            <line x1="8" y1="26" x2="22" y2="26" strokeWidth="1" opacity="0.6" />
            <line x1="8" y1="34" x2="22" y2="34" strokeWidth="1" opacity="0.6" />
            <line x1="8" y1="42" x2="22" y2="42" strokeWidth="1" opacity="0.6" />
            <line x1="8" y1="50" x2="22" y2="50" strokeWidth="1" opacity="0.6" />
          </svg>

          {/* DNA — right side */}
          <svg className="fbg-icon absolute w-12 h-24 text-purple-200/[0.18] dark:text-purple-300/[0.08] animate-float-zigzag" style={{ bottom: "20%", right: "5%", animationDuration: "22s", animationDelay: "3s" }} viewBox="0 0 30 60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 2 C8 10, 22 10, 22 18 C22 26, 8 26, 8 34 C8 42, 22 42, 22 50 C22 58, 8 58, 8 58" />
            <path d="M22 2 C22 10, 8 10, 8 18 C8 26, 22 26, 22 34 C22 42, 8 42, 8 50 C8 58, 22 58, 22 58" />
            <line x1="10" y1="10" x2="20" y2="10" strokeWidth="1" opacity="0.5" />
            <line x1="10" y1="18" x2="20" y2="18" strokeWidth="1" opacity="0.5" />
            <line x1="10" y1="26" x2="20" y2="26" strokeWidth="1" opacity="0.5" />
            <line x1="10" y1="34" x2="20" y2="34" strokeWidth="1" opacity="0.5" />
            <line x1="10" y1="42" x2="20" y2="42" strokeWidth="1" opacity="0.5" />
            <line x1="10" y1="50" x2="20" y2="50" strokeWidth="1" opacity="0.5" />
          </svg>

          {/* NEW — DNA mid-right (fills empty right-center column) */}
          <svg className="fbg-icon absolute w-12 h-24 text-sky-200/[0.18] dark:text-sky-300/[0.09] animate-float-rise" style={{ top: "48%", right: "20%", animationDuration: "20s", animationDelay: "1s" }} viewBox="0 0 30 60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 2 C8 10, 22 10, 22 18 C22 26, 8 26, 8 34 C8 42, 22 42, 22 50 C22 58, 8 58, 8 58" />
            <path d="M22 2 C22 10, 8 10, 8 18 C8 26, 22 26, 22 34 C22 42, 8 42, 8 50 C8 58, 22 58, 22 58" />
            <line x1="10" y1="14" x2="20" y2="14" strokeWidth="1" opacity="0.5" />
            <line x1="10" y1="22" x2="20" y2="22" strokeWidth="1" opacity="0.5" />
            <line x1="10" y1="30" x2="20" y2="30" strokeWidth="1" opacity="0.5" />
            <line x1="10" y1="38" x2="20" y2="38" strokeWidth="1" opacity="0.5" />
            <line x1="10" y1="46" x2="20" y2="46" strokeWidth="1" opacity="0.5" />
          </svg>

          {/* ═══════════════ STARS & SPARKLES ═══════════════ */}
          {/* Big Star — top right */}
          <svg className="fbg-icon absolute w-12 h-12 text-yellow-300/30 dark:text-yellow-300/15 animate-twinkle" style={{ top: "8%", right: "6%", animationDuration: "4s" }} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4l-6.4 4.8L8 14 2 9.2h7.6z" />
          </svg>

          {/* 4-point Sparkle — center top */}
          <svg className="fbg-icon absolute w-10 h-10 text-white/[0.25] dark:text-white/[0.12] animate-twinkle" style={{ top: "4%", left: "35%", animationDuration: "3.5s", animationDelay: "1s" }} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10Z" />
          </svg>

          {/* Small Star — bottom left */}
          <svg className="fbg-icon absolute w-8 h-8 text-amber-200/25 dark:text-amber-200/12 animate-twinkle" style={{ bottom: "12%", left: "8%", animationDuration: "5s", animationDelay: "2s" }} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4l-6.4 4.8L8 14 2 9.2h7.6z" />
          </svg>

          {/* NEW — Star bottom-center (fills empty bottom-center band) */}
          <svg className="fbg-icon absolute w-9 h-9 text-yellow-200/25 dark:text-yellow-200/12 animate-twinkle" style={{ bottom: "5%", left: "48%", animationDuration: "4.5s", animationDelay: "1.5s" }} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4l-6.4 4.8L8 14 2 9.2h7.6z" />
          </svg>

          {/* NEW — 4-point sparkle top-center under header */}
          <svg className="fbg-icon absolute w-9 h-9 text-white/[0.22] dark:text-white/[0.1] animate-twinkle" style={{ top: "10%", left: "52%", animationDuration: "3s", animationDelay: "0.4s" }} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10Z" />
          </svg>

          {/* Sparkle dot cluster — top left area */}
          <div className="fbg-icon absolute w-3 h-3 rounded-full bg-white/30 dark:bg-white/15 animate-twinkle" style={{ top: "20%", left: "12%", animationDuration: "2.5s" }}></div>
          <div className="fbg-icon absolute w-2 h-2 rounded-full bg-white/25 dark:bg-white/12 animate-twinkle" style={{ top: "22%", left: "14%", animationDuration: "4s", animationDelay: "1s" }}></div>
          <div className="fbg-icon absolute w-2.5 h-2.5 rounded-full bg-sky-200/30 dark:bg-sky-200/15 animate-twinkle" style={{ top: "18%", left: "10%", animationDuration: "3s", animationDelay: "0.5s" }}></div>

          {/* Sparkle dots — right area */}
          <div className="fbg-icon absolute w-2.5 h-2.5 rounded-full bg-white/25 dark:bg-white/12 animate-twinkle" style={{ top: "35%", right: "8%", animationDuration: "3.5s", animationDelay: "2s" }}></div>
          <div className="fbg-icon absolute w-3 h-3 rounded-full bg-purple-200/25 dark:bg-purple-200/12 animate-twinkle" style={{ top: "55%", right: "12%", animationDuration: "4.5s", animationDelay: "0.7s" }}></div>

          {/* Sparkle dots — bottom area */}
          <div className="fbg-icon absolute w-2 h-2 rounded-full bg-white/30 dark:bg-white/15 animate-twinkle" style={{ bottom: "25%", left: "18%", animationDuration: "3s", animationDelay: "1.5s" }}></div>
          <div className="fbg-icon absolute w-3 h-3 rounded-full bg-amber-200/20 dark:bg-amber-200/10 animate-twinkle" style={{ bottom: "35%", right: "15%", animationDuration: "5s", animationDelay: "3s" }}></div>

          {/* NEW — Sparkle dots in the formerly-empty mid zones */}
          <div className="fbg-icon absolute w-2.5 h-2.5 rounded-full bg-white/25 dark:bg-white/12 animate-twinkle" style={{ top: "52%", left: "20%", animationDuration: "3.2s", animationDelay: "0.8s" }}></div>
          <div className="fbg-icon absolute w-2 h-2 rounded-full bg-sky-200/30 dark:bg-sky-200/15 animate-twinkle" style={{ top: "44%", left: "22%", animationDuration: "4s", animationDelay: "2.4s" }}></div>
          <div className="fbg-icon absolute w-2.5 h-2.5 rounded-full bg-white/25 dark:bg-white/12 animate-twinkle" style={{ top: "30%", right: "25%", animationDuration: "3.6s", animationDelay: "1.2s" }}></div>
          <div className="fbg-icon absolute w-2 h-2 rounded-full bg-purple-200/30 dark:bg-purple-200/15 animate-twinkle" style={{ top: "60%", right: "26%", animationDuration: "4.2s", animationDelay: "2.6s" }}></div>
          <div className="fbg-icon absolute w-2.5 h-2.5 rounded-full bg-white/30 dark:bg-white/12 animate-twinkle" style={{ bottom: "8%", left: "40%", animationDuration: "3.4s", animationDelay: "1.8s" }}></div>

          {/* ═══════════════ BOOK ═══════════════ */}
          <svg className="fbg-icon absolute w-14 h-14 text-white/[0.2] dark:text-white/[0.1] animate-float-sway" style={{ top: "60%", right: "3%", animationDuration: "20s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <line x1="9" y1="7" x2="17" y2="7" strokeWidth="1" opacity="0.5" />
            <line x1="9" y1="10" x2="15" y2="10" strokeWidth="1" opacity="0.4" />
            <line x1="9" y1="13" x2="16" y2="13" strokeWidth="1" opacity="0.3" />
          </svg>

          {/* NEW — Book mid-left (fills empty left-center) */}
          <svg className="fbg-icon absolute w-12 h-12 text-white/[0.18] dark:text-white/[0.09] animate-float-drift-reverse" style={{ top: "55%", left: "14%", animationDuration: "21s", animationDelay: "2.5s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <line x1="9" y1="7" x2="17" y2="7" strokeWidth="1" opacity="0.5" />
            <line x1="9" y1="10" x2="15" y2="10" strokeWidth="1" opacity="0.4" />
          </svg>

          {/* ═══════════════ INFINITY SYMBOL ═══════════════ */}
          <svg className="fbg-icon absolute w-16 h-10 text-white/[0.22] dark:text-white/[0.1] animate-float-drift" style={{ top: "3%", left: "55%", animationDuration: "26s" }} viewBox="0 0 40 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M20 12c-3-5-8-8-12-5s-2 10 2 13 8 1 10-2" />
            <path d="M20 12c3 5 8 8 12 5s2-10-2-13-8-1-10 2" />
          </svg>

          {/* ═══════════════ PI SYMBOL ═══════════════ */}
          <svg className="fbg-icon absolute w-12 h-12 text-white/[0.2] dark:text-white/[0.1] animate-float-drift-reverse" style={{ bottom: "5%", left: "40%", animationDuration: "28s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 8h16" />
            <path d="M8 8v12" />
            <path d="M14 8v8c0 3 1.5 4 3.5 4" />
          </svg>

          {/* ═══════════════ PLUS SIGNS ═══════════════ */}
          {/* Big Plus — right upper */}
          <svg className="fbg-icon absolute w-10 h-10 text-white/[0.22] dark:text-white/[0.1] animate-float-zigzag" style={{ top: "20%", right: "3%", animationDuration: "18s" }} viewBox="0 0 24 24" fill="currentColor">
            <rect x="10" y="2" width="4" height="20" rx="2" />
            <rect x="2" y="10" width="20" height="4" rx="2" />
          </svg>

          {/* Small Plus — bottom left area */}
          <svg className="fbg-icon absolute w-6 h-6 text-white/[0.25] dark:text-white/[0.12] animate-float-sway" style={{ bottom: "30%", left: "4%", animationDuration: "14s", animationDelay: "2s" }} viewBox="0 0 24 24" fill="currentColor">
            <rect x="10" y="2" width="4" height="20" rx="2" />
            <rect x="2" y="10" width="20" height="4" rx="2" />
          </svg>

          {/* NEW — Plus mid-right (fills empty right-center) */}
          <svg className="fbg-icon absolute w-7 h-7 text-white/[0.22] dark:text-white/[0.1] animate-float-zigzag" style={{ top: "40%", right: "23%", animationDuration: "17s", animationDelay: "1.2s" }} viewBox="0 0 24 24" fill="currentColor">
            <rect x="10" y="2" width="4" height="20" rx="2" />
            <rect x="2" y="10" width="20" height="4" rx="2" />
          </svg>

          {/* ═══════════════ TRIANGLES ═══════════════ */}
          {/* Big Triangle outline — left mid */}
          <svg className="fbg-icon absolute w-14 h-14 text-white/[0.18] dark:text-white/[0.08] animate-float-sway" style={{ top: "40%", left: "2%", animationDuration: "22s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            <polygon points="12,3 22,21 2,21" />
          </svg>

          {/* Small Triangle — bottom right area */}
          <svg className="fbg-icon absolute w-8 h-8 text-sky-200/20 dark:text-sky-200/10 animate-float-drift" style={{ bottom: "40%", right: "7%", animationDuration: "19s", animationDelay: "4s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            <polygon points="12,3 22,21 2,21" />
          </svg>

          {/* NEW — Triangle bottom-center */}
          <svg className="fbg-icon absolute w-10 h-10 text-white/[0.18] dark:text-white/[0.09] animate-float-drift" style={{ bottom: "10%", left: "55%", animationDuration: "20s", animationDelay: "2.2s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            <polygon points="12,3 22,21 2,21" />
          </svg>

          {/* ═══════════════ HEXAGONS ═══════════════ */}
          {/* Large Hexagon — bottom center-right */}
          <svg className="fbg-icon absolute w-16 h-16 text-white/[0.15] dark:text-white/[0.07] animate-slow-spin" style={{ bottom: "6%", right: "20%", animationDuration: "40s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
          </svg>

          {/* Small Hexagon — top left */}
          <svg className="fbg-icon absolute w-10 h-10 text-white/[0.2] dark:text-white/[0.1] animate-float-drift-reverse" style={{ top: "30%", left: "8%", animationDuration: "24s", animationDelay: "5s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
          </svg>

          {/* NEW — Hexagon top-center */}
          <svg className="fbg-icon absolute w-9 h-9 text-white/[0.18] dark:text-white/[0.09] animate-slow-spin" style={{ top: "14%", left: "60%", animationDuration: "45s", animationDelay: "1s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
          </svg>

          {/* ═══════════════ DIAMONDS ═══════════════ */}
          {/* Big Diamond — left lower */}
          <div className="fbg-icon absolute w-10 h-10 border-2 border-white/[0.2] dark:border-white/[0.1] animate-float-drift rotate-45" style={{ bottom: "18%", left: "6%", animationDuration: "20s" }}></div>

          {/* Small Diamond — right upper */}
          <div className="fbg-icon absolute w-6 h-6 border-2 border-sky-200/25 dark:border-sky-200/12 animate-float-zigzag rotate-45" style={{ top: "15%", right: "15%", animationDuration: "16s", animationDelay: "1s" }}></div>

          {/* NEW — Diamond mid-right (fills the right empty zone) */}
          <div className="fbg-icon absolute w-8 h-8 border-2 border-white/[0.22] dark:border-white/[0.11] animate-float-sway rotate-45" style={{ top: "62%", right: "22%", animationDuration: "18s", animationDelay: "2.8s" }}></div>

          {/* ═══════════════ GRADUATION CAP ═══════════════ */}
          <svg className="fbg-icon absolute w-14 h-14 text-white/[0.18] dark:text-white/[0.08] animate-float-drift-reverse" style={{ top: "25%", left: "4%", animationDuration: "26s", animationDelay: "2s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10l-10-5L2 10l10 5 10-5z" />
            <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
            <line x1="22" y1="10" x2="22" y2="16" />
          </svg>

          {/* NEW — Graduation cap mid-right */}
          <svg className="fbg-icon absolute w-12 h-12 text-white/[0.18] dark:text-white/[0.09] animate-float-sway" style={{ top: "20%", right: "25%", animationDuration: "22s", animationDelay: "1.6s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10l-10-5L2 10l10 5 10-5z" />
            <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
            <line x1="22" y1="10" x2="22" y2="16" />
          </svg>

          {/* ═══════════════ BEAKER / FLASK ═══════════════ */}
          <svg className="fbg-icon absolute w-12 h-12 text-white/[0.2] dark:text-white/[0.1] animate-float-rise" style={{ bottom: "15%", left: "15%", animationDuration: "16s", animationDelay: "1s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3h6" />
            <path d="M10 3v7.4a4 4 0 0 1-1.17 2.83L5 17a2 2 0 0 0 1.5 3.4h11A2 2 0 0 0 19 17l-3.83-3.77A4 4 0 0 1 14 10.4V3" />
            <path d="M7.5 16h9" opacity="0.4" />
          </svg>

          {/* NEW — Beaker mid-left fills mid-left empty area */}
          <svg className="fbg-icon absolute w-11 h-11 text-sky-200/[0.2] dark:text-sky-300/[0.1] animate-float-rise" style={{ top: "26%", left: "20%", animationDuration: "17s", animationDelay: "0.8s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3h6" />
            <path d="M10 3v7.4a4 4 0 0 1-1.17 2.83L5 17a2 2 0 0 0 1.5 3.4h11A2 2 0 0 0 19 17l-3.83-3.77A4 4 0 0 1 14 10.4V3" />
            <path d="M7.5 16h9" opacity="0.4" />
          </svg>

          {/* ═══════════════ PENCIL ═══════════════ */}
          <svg className="fbg-icon absolute w-10 h-10 text-white/[0.18] dark:text-white/[0.08] animate-float-sway" style={{ top: "70%", left: "3%", animationDuration: "17s", animationDelay: "3s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>

          {/* NEW — Pencil bottom-center */}
          <svg className="fbg-icon absolute w-9 h-9 text-white/[0.2] dark:text-white/[0.1] animate-float-zigzag" style={{ bottom: "8%", left: "32%", animationDuration: "18s", animationDelay: "3.4s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>

          {/* ═══════════════ SIGMA / MATH ═══════════════ */}
          <svg className="fbg-icon absolute w-12 h-12 text-white/[0.2] dark:text-white/[0.1] animate-float-drift" style={{ top: "75%", right: "5%", animationDuration: "24s", animationDelay: "6s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 4H6l6 8-6 8h12" />
          </svg>

          {/* NEW — Sigma bottom-center-right */}
          <svg className="fbg-icon absolute w-10 h-10 text-white/[0.18] dark:text-white/[0.09] animate-float-drift-reverse" style={{ bottom: "12%", right: "32%", animationDuration: "23s", animationDelay: "1.4s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 4H6l6 8-6 8h12" />
          </svg>

          {/* ═══════════════ CIRCLE RINGS ═══════════════ */}
          {/* Big ring — top area */}
          <div className="fbg-icon absolute w-14 h-14 rounded-full border-2 border-white/[0.15] dark:border-white/[0.07] animate-pulse-glow" style={{ top: "10%", left: "25%", animationDuration: "6s" }}></div>

          {/* Medium ring — bottom area */}
          <div className="fbg-icon absolute w-10 h-10 rounded-full border-2 border-white/[0.18] dark:border-white/[0.08] animate-float-sway" style={{ bottom: "22%", right: "10%", animationDuration: "15s", animationDelay: "4s" }}></div>

          {/* Small ring — center */}
          <div className="fbg-icon absolute w-6 h-6 rounded-full border-2 border-sky-200/20 dark:border-sky-200/10 animate-pulse-glow" style={{ top: "50%", left: "8%", animationDuration: "5s", animationDelay: "2s" }}></div>

          {/* NEW — Ring mid-right (fills empty right zone) */}
          <div className="fbg-icon absolute w-12 h-12 rounded-full border-2 border-white/[0.16] dark:border-white/[0.08] animate-pulse-glow" style={{ top: "55%", right: "30%", animationDuration: "6.5s", animationDelay: "1.2s" }}></div>

          {/* NEW — Ring top-center */}
          <div className="fbg-icon absolute w-9 h-9 rounded-full border-2 border-sky-200/25 dark:border-sky-200/12 animate-pulse-glow" style={{ top: "8%", left: "48%", animationDuration: "5.5s", animationDelay: "0.6s" }}></div>

          {/* ═══════════════ CALCULATOR ═══════════════ */}
          <svg className="fbg-icon absolute w-10 h-10 text-white/[0.15] dark:text-white/[0.07] animate-float-zigzag" style={{ top: "65%", right: "8%", animationDuration: "21s", animationDelay: "5s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <rect x="8" y="6" width="8" height="4" rx="1" opacity="0.5" />
            <circle cx="8" cy="14" r="0.8" fill="currentColor" />
            <circle cx="12" cy="14" r="0.8" fill="currentColor" />
            <circle cx="16" cy="14" r="0.8" fill="currentColor" />
            <circle cx="8" cy="18" r="0.8" fill="currentColor" />
            <circle cx="12" cy="18" r="0.8" fill="currentColor" />
            <circle cx="16" cy="18" r="0.8" fill="currentColor" />
          </svg>

          {/* ═══════════════ LIGHTBULB ═══════════════ */}
          <svg className="fbg-icon absolute w-10 h-10 text-yellow-200/[0.2] dark:text-yellow-200/[0.1] animate-pulse-glow" style={{ top: "12%", left: "45%", animationDuration: "7s", animationDelay: "1s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
          </svg>

          {/* ═══════════════ GLOBE / EARTH ═══════════════ */}
          <svg className="fbg-icon absolute w-14 h-14 text-white/[0.15] dark:text-white/[0.07] animate-slow-spin" style={{ bottom: "10%", left: "30%", animationDuration: "50s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="12" cy="12" r="10" />
            <ellipse cx="12" cy="12" rx="4" ry="10" />
            <path d="M2 12h20" />
            <path d="M4.5 6.5h15" opacity="0.5" />
            <path d="M4.5 17.5h15" opacity="0.5" />
          </svg>

          {/* ═══════════════ SQUARE ROOT / RADICAL ═══════════════ */}
          <svg className="fbg-icon absolute w-10 h-10 text-white/[0.2] dark:text-white/[0.1] animate-float-rise" style={{ top: "80%", left: "20%", animationDuration: "14s", animationDelay: "3s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h3l3 8 5-16h7" />
          </svg>

          {/* ═══════════════ MUSIC NOTE (creativity) ═══════════════ */}
          <svg className="fbg-icon absolute w-8 h-8 text-white/[0.15] dark:text-white/[0.07] animate-float-drift-reverse" style={{ top: "85%", right: "12%", animationDuration: "22s", animationDelay: "4s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>

          {/* ═══════════════ EXTRA FLOATING BARS ═══════════════ */}
          <div className="fbg-icon absolute w-10 h-2 rounded-full bg-white/[0.15] dark:bg-white/[0.06] animate-float-drift rotate-12" style={{ bottom: "28%", left: "2%", animationDuration: "19s", animationDelay: "6s" }}></div>
          <div className="fbg-icon absolute w-8 h-1.5 rounded-full bg-white/[0.12] dark:bg-white/[0.05] animate-float-sway -rotate-6" style={{ top: "50%", right: "4%", animationDuration: "16s", animationDelay: "8s" }}></div>
          <div className="fbg-icon absolute w-12 h-2 rounded-full bg-white/[0.1] dark:bg-white/[0.04] animate-float-drift-reverse rotate-3" style={{ top: "88%", left: "10%", animationDuration: "21s", animationDelay: "2s" }}></div>

          {/* NEW — extra bars in the formerly empty zones */}
          <div className="fbg-icon absolute w-9 h-1.5 rounded-full bg-white/[0.12] dark:bg-white/[0.05] animate-float-drift -rotate-12" style={{ top: "70%", right: "26%", animationDuration: "18s", animationDelay: "3s" }}></div>
          <div className="fbg-icon absolute w-10 h-2 rounded-full bg-sky-200/[0.18] dark:bg-sky-200/[0.07] animate-float-sway rotate-6" style={{ bottom: "16%", left: "44%", animationDuration: "17s", animationDelay: "1.7s" }}></div>

    </div>
  );
}
