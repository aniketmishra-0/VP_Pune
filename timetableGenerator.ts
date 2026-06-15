/**
 * Timetable Auto-Generator — v3 (14-Week Pattern AI + Constraint-Based)
 *
 * Strategy:
 *   1. Load 14-week historical patterns (embedded at build time)
 *   2. For each batch+day+slot, look up the MOST COMMON teacher from history
 *   3. Assign historical teacher if they pass constraints
 *   4. Fall back to batch-level frequency ranking if slot-specific data unavailable
 *   5. Final fallback: any eligible teacher with fewest current assignments
 *
 * Pattern AI (not external API — all local):
 *   - sh[batch_DAY_SLOT] = [teacher1, teacher2] — slot-specific history
 *   - bt[batch] = [teacher1, teacher2, ...] — overall batch frequency
 *   - tp[teacher] = [slot1, slot2, ...] — teacher's preferred slots
 *
 * Constraints:
 *   1. Batch suffix → valid slots (MA→1-2, NA→3-4, EA→5-6, MP→1|3)
 *   2. Teachers can only teach assigned batches
 *   3. No teacher collision (1 teacher = 1 slot at a time)
 *   4. Max N slots per teacher per day (default 4)
 *   5. Max N consecutive slots per teacher (default 3)
 *   6. Skip holidays, Saturday always off
 */

import type { FacultyMember } from "./settingsStore";
import { HISTORICAL_PATTERNS as STATIC_PATTERNS } from "./historicalPatterns";

// Dynamic patterns — starts with static 14-week data, can be updated at runtime
let HISTORICAL_PATTERNS: {
  bt: Record<string, string[]>;
  sh: Record<string, string[]>;
  tp: Record<string, number[]>;
} = STATIC_PATTERNS;

/** Update historical patterns at runtime (e.g. from fetching all subsheets) */
export function setHistoricalPatterns(newPatterns: typeof HISTORICAL_PATTERNS): void {
  HISTORICAL_PATTERNS = newPatterns;
  console.log(`[Pattern AI] Updated: ${Object.keys(newPatterns.sh).length} slot patterns, ${Object.keys(newPatterns.bt).length} batches, ${Object.keys(newPatterns.tp).length} teachers`);
}

/** Get current pattern stats */
export function getPatternStats(): { slotPatterns: number; batches: number; teachers: number } {
  return {
    slotPatterns: Object.keys(HISTORICAL_PATTERNS.sh).length,
    batches: Object.keys(HISTORICAL_PATTERNS.bt).length,
    teachers: Object.keys(HISTORICAL_PATTERNS.tp).length,
  };
}

// ── Pattern Builder from Sheet Data ──────────────────────────────────────

const SLOT_TIME_MAP: Record<string, number> = {
  '8:45 AM': 1, '10:15 AM': 1,
  '10:30 AM': 2, '12:00 PM': 2,
  '12:25 PM': 3, '12:26 PM': 3, '1:55 PM': 3, '1:56 PM': 3,
  '2:15 PM': 4, '2:16 PM': 4, '3:45 PM': 4, '3:46 PM': 4,
  '4:00 PM': 5, '4:10 PM': 5, '5:30 PM': 5, '5:40 PM': 5,
  '5:55 PM': 6, '7:20 PM': 6, '7:25 PM': 6,
};

const DAY_NAMES_MAP = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function extractShortBatch(fullCode: string): string {
  const m = fullCode.match(/\d+-([A-Z0-9]+)/i);
  return m ? m[1].toUpperCase() : '';
}

function isTeacherCode(val: string): boolean {
  if (!val || val.length < 2 || val.length > 5) return false;
  if (/^\d/.test(val)) return false;
  if (/^(Room|Start|End|DAY|DATE|MHT|HOLIDAY|VP|PRACTICE|No|PM|AM)/i.test(val)) return false;
  if (/^[A-Z]{2,5}$/.test(val)) return true;
  return false;
}

/**
 * Build pattern data from raw sheet tab data (fetched from Google Sheets API).
 * Each tab = 1 week of timetable data.
 */
export function buildPatternsFromSheetData(
  tabs: { tabName: string; rows: string[][] }[]
): typeof HISTORICAL_PATTERNS {
  const teacherBatchFreq: Record<string, Record<string, number>> = {};
  const teacherSlotFreq: Record<string, Record<string, number>> = {};
  const batchTeacherHistory: Record<string, Record<string, number>> = {};

  for (const tab of tabs) {
    const { rows } = tab;
    if (rows.length < 3) continue;

    // Find header row (contains batch codes starting with "27-")
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      if (rows[i].some(c => (c || '').trim().startsWith('27-'))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx < 0) continue;

    // Build column → batch mapping
    const colBatch: Record<number, string> = {};
    for (let c = 0; c < rows[headerIdx].length; c++) {
      const val = (rows[headerIdx][c] || '').trim();
      if (val.startsWith('27-')) {
        colBatch[c] = extractShortBatch(val);
      }
    }

    // Find DAY, Start Time columns
    let dayCol = -1, startCol = -1;
    for (let c = 0; c < Math.min(rows[headerIdx].length, 10); c++) {
      const h = (rows[headerIdx][c] || '').trim().toUpperCase();
      if (h === 'DAY') dayCol = c;
      if (h.includes('START')) startCol = c;
    }
    // Fallback: try row above header
    if (dayCol < 0 && headerIdx > 0) {
      for (let c = 0; c < Math.min(rows[headerIdx - 1].length, 10); c++) {
        const h = (rows[headerIdx - 1][c] || '').trim().toUpperCase();
        if (h === 'DAY') dayCol = c;
        if (h.includes('START')) startCol = c;
      }
    }

    // Parse data rows
    let currentDay = '';
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      
      // Get day
      if (dayCol >= 0 && row[dayCol]) {
        const d = row[dayCol].trim().toUpperCase();
        if (DAY_NAMES_MAP.includes(d)) currentDay = d;
      }
      if (!currentDay) continue;

      // Get start time → slot
      let slotNum = 0;
      if (startCol >= 0 && row[startCol]) {
        const t = row[startCol].trim();
        slotNum = SLOT_TIME_MAP[t] || 0;
      }
      if (!slotNum) continue;

      // Parse teacher codes from batch columns
      for (const [colStr, batchShort] of Object.entries(colBatch)) {
        const col = parseInt(colStr);
        const cellVal = (row[col] || '').trim();
        if (!isTeacherCode(cellVal)) continue;

        const teacher = cellVal.toUpperCase();
        const slotKey = `${batchShort}_${currentDay}_${slotNum}`;

        // Track batch→teacher history for slot
        if (!batchTeacherHistory[slotKey]) batchTeacherHistory[slotKey] = {};
        batchTeacherHistory[slotKey][teacher] = (batchTeacherHistory[slotKey][teacher] || 0) + 1;

        // Track teacher→batch frequency
        if (!teacherBatchFreq[teacher]) teacherBatchFreq[teacher] = {};
        teacherBatchFreq[teacher][batchShort] = (teacherBatchFreq[teacher][batchShort] || 0) + 1;

        // Track teacher slot preferences
        if (!teacherSlotFreq[teacher]) teacherSlotFreq[teacher] = {};
        teacherSlotFreq[teacher][String(slotNum)] = (teacherSlotFreq[teacher][String(slotNum)] || 0) + 1;
      }
    }
  }

  // Build output format
  // bt: batch → [teacher1, teacher2, ...] ordered by frequency
  const bt: Record<string, string[]> = {};
  const batchTotals: Record<string, Record<string, number>> = {};
  for (const [teacher, batches] of Object.entries(teacherBatchFreq)) {
    for (const [batch, count] of Object.entries(batches)) {
      if (!batchTotals[batch]) batchTotals[batch] = {};
      batchTotals[batch][teacher] = (batchTotals[batch][teacher] || 0) + count;
    }
  }
  for (const [batch, teachers] of Object.entries(batchTotals)) {
    bt[batch] = Object.entries(teachers)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
  }

  // sh: batch_DAY_SLOT → [teacher1, teacher2] ordered by frequency
  const sh: Record<string, string[]> = {};
  for (const [key, teachers] of Object.entries(batchTeacherHistory)) {
    sh[key] = Object.entries(teachers)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
  }

  // tp: teacher → [slot1, slot2, ...] ordered by frequency
  const tp: Record<string, number[]> = {};
  for (const [teacher, slots] of Object.entries(teacherSlotFreq)) {
    tp[teacher] = Object.entries(slots)
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => parseInt(s));
  }

  console.log(`[buildPatterns] Built from ${tabs.length} tabs: ${Object.keys(sh).length} slot patterns, ${Object.keys(bt).length} batches, ${Object.keys(tp).length} teachers`);
  
  return { bt, sh, tp };
}

// ── Public types ────────────────────────────────────────────────────────

export interface GeneratorConfig {
  weekStartDate: string;
  maxConsecutive: number;
  maxSlotsPerDay: number;
  holidays: string[];
  testSlots: TestSlotOverride[];
  historicalData?: HistoricalSlot[];
}

export interface TestSlotOverride {
  day: string;
  slot: number;
  batchCode: string;
  label: string;
}

export interface GeneratedSlot {
  day: string;
  date: string;
  slotNum: number;
  startTime: string;
  endTime: string;
  batchCode: string;
  teacherCode: string;
  room: string;
  section: "JEE" | "NEET" | "DROPPER";
}

export interface BatchInfo {
  code: string;
  room: string;
  section: "JEE" | "NEET" | "DROPPER";
}

export interface GenerationResult {
  slots: GeneratedSlot[];
  warnings: string[];
}

/** Historical slot = what was used in a previous week (runtime data) */
export interface HistoricalSlot {
  day: string;
  slotNum: number;
  batchCode: string;
  teacherCode: string;
}

// ── Constants ───────────────────────────────────────────────────────────

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;

const SLOT_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "8:45",  end: "10:15" },
  2: { start: "10:30", end: "12:00" },
  3: { start: "12:25", end: "1:55"  },
  4: { start: "2:15",  end: "3:45"  },
  5: { start: "4:10",  end: "5:40"  },
  6: { start: "5:55",  end: "7:20"  },
};

// ── Helpers ─────────────────────────────────────────────────────────────

function getBatchSuffix(batchCode: string): string {
  const trimmed = batchCode.trim();
  const match = trimmed.match(/([A-Z]{2})\s+\d{4}$/i);
  if (match) return match[1].toUpperCase();
  const alphaMatch = trimmed.replace(/\s+\d{4}$/, "").match(/([A-Z]{2})$/i);
  if (alphaMatch) return alphaMatch[1].toUpperCase();
  return "";
}

function getValidSlots(batchCode: string): number[] {
  const suffix = getBatchSuffix(batchCode);
  switch (suffix) {
    case "MA": return [1, 2];
    case "NA": case "NP": return [3, 4];
    case "EA": return [5, 6];
    case "MP": return [1, 3];
    default: return [1, 2];
  }
}

function formatDate(d: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDayDates(weekStartDate: string): Map<string, string> {
  const base = new Date(weekStartDate + "T00:00:00");
  const map = new Map<string, string>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const dayName = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"][i];
    map.set(dayName, formatDate(d));
  }
  return map;
}

/** Extract short batch code like "LJ151MA" from "27-LJ151MA 2026" */
function extractShort(fullCode: string): string {
  const m = fullCode.match(/\d+-([A-Z0-9]+)/i);
  return m ? m[1].toUpperCase() : fullCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ── Pattern AI Lookup ──────────────────────────────────────────────────

/**
 * Get ranked teacher suggestions for a specific batch+day+slot
 * using 14-week historical patterns.
 */
function getPatternSuggestions(batchCode: string, day: string, slot: number): string[] {
  const short = extractShort(batchCode);
  const suggestions: string[] = [];
  const seen = new Set<string>();

  // Priority 1: Exact slot history (batch_DAY_SLOT)
  const slotKey = `${short}_${day}_${slot}`;
  const slotTeachers = (HISTORICAL_PATTERNS.sh as Record<string, string[]>)[slotKey] || [];
  for (const t of slotTeachers) {
    if (!seen.has(t)) { suggestions.push(t); seen.add(t); }
  }

  // Priority 2: Same batch, any slot on same day
  for (let s = 1; s <= 6; s++) {
    if (s === slot) continue;
    const key = `${short}_${day}_${s}`;
    const teachers = (HISTORICAL_PATTERNS.sh as Record<string, string[]>)[key] || [];
    for (const t of teachers) {
      if (!seen.has(t)) { suggestions.push(t); seen.add(t); }
    }
  }

  // Priority 3: Overall batch frequency
  const batchTeachers = (HISTORICAL_PATTERNS.bt as Record<string, string[]>)[short] || [];
  for (const t of batchTeachers) {
    if (!seen.has(t)) { suggestions.push(t); seen.add(t); }
  }

  return suggestions;
}

/**
 * Check if a teacher prefers a given slot (based on historical data)
 */
function teacherPrefersSlot(teacherCode: string, slot: number): boolean {
  const prefs = (HISTORICAL_PATTERNS.tp as Record<string, number[]>)[teacherCode];
  if (!prefs || prefs.length === 0) return true; // no data = no restriction
  // Top 3 preferred slots
  return prefs.slice(0, 3).includes(slot);
}

// ── Constraint tracker ──────────────────────────────────────────────────

class DayTracker {
  private slotsPerTeacher = new Map<string, Set<number>>();
  private orderedSlots = new Map<string, number[]>();

  assign(teacher: string, slot: number): void {
    if (!this.slotsPerTeacher.has(teacher)) {
      this.slotsPerTeacher.set(teacher, new Set());
      this.orderedSlots.set(teacher, []);
    }
    this.slotsPerTeacher.get(teacher)!.add(slot);
    const ordered = this.orderedSlots.get(teacher)!;
    ordered.push(slot);
    ordered.sort((a, b) => a - b);
  }

  slotCount(teacher: string): number {
    return this.slotsPerTeacher.get(teacher)?.size ?? 0;
  }

  wouldExceedConsecutive(teacher: string, slot: number, maxConsec: number): boolean {
    const ordered = [...(this.orderedSlots.get(teacher) || []), slot].sort((a, b) => a - b);
    let run = 1, maxRun = 1;
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i] === ordered[i - 1] + 1) { run++; maxRun = Math.max(maxRun, run); }
      else { run = 1; }
    }
    return maxRun > maxConsec;
  }
}

class SlotCollisionTracker {
  private booked = new Map<string, Set<string>>();
  private key(day: string, slot: number): string { return `${day}-${slot}`; }

  isBooked(day: string, slot: number, teacher: string): boolean {
    return this.booked.get(this.key(day, slot))?.has(teacher) ?? false;
  }

  book(day: string, slot: number, teacher: string): void {
    const k = this.key(day, slot);
    if (!this.booked.has(k)) this.booked.set(k, new Set());
    this.booked.get(k)!.add(teacher);
  }
}

// ── Main generation function ────────────────────────────────────────────

export function generateTimetable(
  faculty: FacultyMember[],
  batches: BatchInfo[],
  config: GeneratorConfig,
): GenerationResult {
  const {
    weekStartDate,
    maxConsecutive = 3,
    maxSlotsPerDay = 4,
    holidays = [],
    testSlots = [],
    historicalData = [],
  } = config;

  const warnings: string[] = [];
  const result: GeneratedSlot[] = [];
  const holidaySet = new Set(holidays.map((h) => h.toUpperCase().trim()));
  const dayDates = buildDayDates(weekStartDate);

  // Build batch → teacher mapping (from Faculty Details sheet)
  const batchTeachers = new Map<string, string[]>();
  const allTeacherCodes = new Set<string>(); // all known active teachers
  for (const f of faculty) {
    if (f.status && f.status.toLowerCase() !== "active") continue;
    allTeacherCodes.add(f.code);
    for (const b of f.batches) {
      const bNorm = b.trim();
      if (!bNorm) continue;
      if (!batchTeachers.has(bNorm)) batchTeachers.set(bNorm, []);
      if (!batchTeachers.get(bNorm)!.includes(f.code)) {
        batchTeachers.get(bNorm)!.push(f.code);
      }
    }
  }

  // CRITICAL: Supplement Faculty Details with historical pattern data
  // If a batch only has 1-2 teachers from Faculty Details, but historical
  // patterns show other teachers also taught it — add them as candidates.
  // This prevents "PKK all week" when Faculty Details is incomplete.
  for (const [batchCode, teachers] of batchTeachers) {
    if (teachers.length >= 3) continue; // already has enough variety
    const originalCount = teachers.length;
    const shortBatch = extractShort(batchCode);
    const historicalTeachers = (HISTORICAL_PATTERNS.bt as Record<string, string[]>)[shortBatch] || [];
    for (const ht of historicalTeachers) {
      if (!teachers.includes(ht) && allTeacherCodes.has(ht)) {
        teachers.push(ht);
      }
    }
    if (teachers.length > originalCount) {
      console.log(`[generate] Supplemented ${batchCode} (${shortBatch}): ${originalCount} → ${teachers.length} teachers [${teachers.join(", ")}] using pattern AI`);
    }
  }

  // Runtime historical lookup (last week's actual data from loaded timetable)
  const runtimeHistLookup = new Map<string, string>();
  for (const hs of historicalData) {
    runtimeHistLookup.set(`${hs.day}-${hs.slotNum}-${hs.batchCode}`, hs.teacherCode);
  }

  // Test-slot lookup
  const testSlotMap = new Map<string, string>();
  for (const ts of testSlots) {
    testSlotMap.set(`${ts.day.toUpperCase()}-${ts.slot}-${ts.batchCode.trim()}`, ts.label);
  }

  // Active teacher codes
  const activeTeachers = new Set(
    faculty.filter(f => !f.status || f.status.toLowerCase() === "active").map(f => f.code)
  );

  // Track total weekly assignments for load balancing
  const weeklyLoad = new Map<string, number>();

  // Track teacher variety per batch ACROSS THE ENTIRE WEEK
  // batchWeekTeachers[batchCode] = Map<teacherCode, count>
  const batchWeekTeachers = new Map<string, Map<string, number>>();
  
  // Track ALL teachers assigned to each batch on PREVIOUS day (not just last one!)
  // This prevents "PKK slot 1, CAA slot 2" → next day PKK again
  const batchPrevDayTeachers = new Map<string, Set<string>>();

  const collisions = new SlotCollisionTracker();

  for (const day of DAYS) {
    if (holidaySet.has(day)) continue;

    const dateStr = dayDates.get(day) || "";
    const dayTracker = new DayTracker();
    
    // Track ALL teachers assigned to this batch TODAY
    const batchDayTeachers = new Map<string, Set<string>>();
    // Track last assigned teacher per batch THIS day (for consecutive slot variety)
    const batchDayLastTeacher = new Map<string, string>();

    for (const batch of batches) {
      const validSlots = getValidSlots(batch.code);
      const eligible = batchTeachers.get(batch.code) || [];

      for (const slot of validSlots) {
        const testKey = `${day}-${slot}-${batch.code}`;
        if (testSlotMap.has(testKey)) {
          result.push({
            day, date: dateStr, slotNum: slot,
            startTime: SLOT_TIMES[slot].start, endTime: SLOT_TIMES[slot].end,
            batchCode: batch.code, teacherCode: testSlotMap.get(testKey)!,
            room: batch.room, section: batch.section,
          });
          continue;
        }

        // Already assigned? (safety)
        if (result.some(r => r.day === day && r.slotNum === slot && r.batchCode === batch.code)) continue;

        if (eligible.length === 0) {
          warnings.push(`${day}: No teachers found for batch ${batch.code}`);
          continue;
        }

        // ── BUILD RANKED CANDIDATE LIST ──
        const patternSuggestions = getPatternSuggestions(batch.code, day, slot);
        const runtimeTeacher = runtimeHistLookup.get(`${day}-${slot}-${batch.code}`);
        const lastTeacherToday = batchDayLastTeacher.get(batch.code);
        const yesterdayTeachers = batchPrevDayTeachers.get(batch.code) || new Set<string>();

        // Get weekly usage for this batch
        if (!batchWeekTeachers.has(batch.code)) {
          batchWeekTeachers.set(batch.code, new Map());
        }
        const batchWeekUsage = batchWeekTeachers.get(batch.code)!;

        // Build candidate list with ALL eligible teachers, sorted by score
        const allCandidates: { code: string; score: number }[] = [];
        
        for (const t of eligible) {
          if (!activeTeachers.has(t)) continue;
          
          let score = 0;
          
          // HIGHEST PRIORITY: Variety across the week (lower usage = better)
          const weekUse = batchWeekUsage.get(t) || 0;
          score -= weekUse * 1000; // Each weekly use costs 1000 points
          
          // HIGH PRIORITY: Don't repeat ANY of yesterday's teachers (not just last!)
          if (yesterdayTeachers.has(t)) score -= 800;
          
          // HIGH PRIORITY: Don't repeat same-day teacher (consecutive slots)
          if (t === lastTeacherToday) score -= 500;
          
          // MEDIUM: Pattern AI match (slot-specific history)
          const slotKey = `${extractShort(batch.code)}_${day}_${slot}`;
          const slotHist = (HISTORICAL_PATTERNS.sh as Record<string, string[]>)[slotKey] || [];
          const slotIdx = slotHist.indexOf(t);
          if (slotIdx === 0) score += 200;      // Most common historical teacher for this exact slot
          else if (slotIdx > 0) score += 100;   // In historical list
          
          // MEDIUM: Runtime historical match (last week's actual)
          if (t === runtimeTeacher) score += 150;
          
          // LOWER: Pattern AI batch frequency
          const batchHist = (HISTORICAL_PATTERNS.bt as Record<string, string[]>)[extractShort(batch.code)] || [];
          const batchIdx = batchHist.indexOf(t);
          if (batchIdx >= 0) score += (50 - batchIdx * 10);
          
          // LOWER: Slot preference
          if (teacherPrefersSlot(t, slot)) score += 30;
          
          // LOWEST: Overall load balancing
          const load = weeklyLoad.get(t) || 0;
          score -= load * 5;
          
          allCandidates.push({ code: t, score });
        }
        
        // Sort by score (highest first)
        allCandidates.sort((a, b) => b.score - a.score);

        // ── TRY CANDIDATES ──
        let assigned = false;
        for (const candidate of allCandidates) {
          if (collisions.isBooked(day, slot, candidate.code)) continue;
          if (dayTracker.slotCount(candidate.code) >= maxSlotsPerDay) continue;
          if (dayTracker.wouldExceedConsecutive(candidate.code, slot, maxConsecutive)) continue;

          result.push({
            day, date: dateStr, slotNum: slot,
            startTime: SLOT_TIMES[slot].start, endTime: SLOT_TIMES[slot].end,
            batchCode: batch.code, teacherCode: candidate.code,
            room: batch.room, section: batch.section,
          });
          collisions.book(day, slot, candidate.code);
          dayTracker.assign(candidate.code, slot);
          weeklyLoad.set(candidate.code, (weeklyLoad.get(candidate.code) || 0) + 1);
          batchDayLastTeacher.set(batch.code, candidate.code);
          // Track ALL teachers for this batch today
          if (!batchDayTeachers.has(batch.code)) batchDayTeachers.set(batch.code, new Set());
          batchDayTeachers.get(batch.code)!.add(candidate.code);
          batchWeekUsage.set(candidate.code, (batchWeekUsage.get(candidate.code) || 0) + 1);
          assigned = true;
          break;
        }

        if (!assigned) {
          warnings.push(
            `${day} Slot ${slot}: No available teacher for batch ${batch.code} ` +
            `(${allCandidates.length} candidates all conflicted)`,
          );
        }
      }
    }
    
    // At end of each day, save ALL of today's teachers as "yesterday" for next day
    for (const [batchCode, teachers] of batchDayTeachers) {
      batchPrevDayTeachers.set(batchCode, new Set(teachers));
    }
  }

  return { slots: result, warnings };
}

// ── AI Resolve (Pattern-Based) ──────────────────────────────────────────

export interface AISuggestion {
  conflict: string;
  teacher: string;
  reason: string;
  confidence: number; // 0-100
}

/**
 * Resolve timetable conflicts using 14-week historical patterns.
 * No external API needed — purely local intelligence.
 */
export function aiResolveConflicts(
  warningsList: string[],
  faculty: FacultyMember[],
  currentSlots: GeneratedSlot[],
): AISuggestion[] {
  const suggestions: AISuggestion[] = [];

  // Build current assignments map
  const currentAssignments = new Map<string, Set<string>>(); // "DAY-SLOT" → Set<teacher>
  const teacherLoad = new Map<string, number>();
  for (const s of currentSlots) {
    const key = `${s.day}-${s.slotNum}`;
    if (!currentAssignments.has(key)) currentAssignments.set(key, new Set());
    currentAssignments.get(key)!.add(s.teacherCode);
    teacherLoad.set(s.teacherCode, (teacherLoad.get(s.teacherCode) || 0) + 1);
  }

  for (const warning of warningsList) {
    // Parse warning: "THURSDAY Slot 3: No available teacher for batch 27-AJ253MA 2026 (2 candidates all conflicted)"
    const match = warning.match(/(\w+)\s+Slot\s+(\d+).*?batch\s+([\w\-\s]+?)(?:\s*\(|$)/);
    if (!match) {
      suggestions.push({ conflict: warning, teacher: "", reason: "Could not parse warning", confidence: 0 });
      continue;
    }

    const [, day, slotStr, batchCode] = match;
    const slot = parseInt(slotStr);
    const batch = batchCode.trim();

    // Get pattern suggestions
    const patternTeachers = getPatternSuggestions(batch, day, slot);
    
    // Find who's already booked at this slot
    const bookedAtSlot = currentAssignments.get(`${day}-${slot}`) || new Set();

    // Find eligible teachers (assigned to this batch in faculty data)
    const eligibleCodes = new Set<string>();
    for (const f of faculty) {
      if (f.status && f.status.toLowerCase() !== "active") continue;
      if (f.batches.some(b => b.trim() === batch)) {
        eligibleCodes.add(f.code);
      }
    }

    // Try pattern suggestions first
    let bestTeacher = "";
    let bestReason = "";
    let confidence = 0;

    for (const t of patternTeachers) {
      if (!eligibleCodes.has(t)) continue;
      if (bookedAtSlot.has(t)) continue; // already teaching another batch at this time

      const load = teacherLoad.get(t) || 0;
      const prefersSlot = teacherPrefersSlot(t, slot);

      bestTeacher = t;
      confidence = 85;
      bestReason = `Historical data shows ${t} taught this batch on ${day} Slot ${slot} in ${
        ((HISTORICAL_PATTERNS.sh as Record<string, string[]>)[`${extractShort(batch)}_${day}_${slot}`] || []).length
      } previous weeks. Current load: ${load} slots.`;
      
      if (prefersSlot) {
        confidence = 92;
        bestReason += ` Slot ${slot} is in their preferred range.`;
      }
      break;
    }

    // Fallback: find least-loaded eligible teacher not booked
    if (!bestTeacher) {
      const available = [...eligibleCodes]
        .filter(t => !bookedAtSlot.has(t))
        .map(t => ({ code: t, load: teacherLoad.get(t) || 0 }))
        .sort((a, b) => a.load - b.load);

      if (available.length > 0) {
        bestTeacher = available[0].code;
        confidence = 60;
        bestReason = `No historical match. Suggesting ${bestTeacher} (least loaded: ${available[0].load} slots). ` +
          `May need to swap another teacher from this time slot.`;
      } else {
        bestReason = `All eligible teachers (${[...eligibleCodes].join(", ")}) are already booked at ${day} Slot ${slot}. ` +
          `Consider swapping one of their other assignments.`;
        confidence = 20;
      }
    }

    suggestions.push({
      conflict: warning,
      teacher: bestTeacher,
      reason: bestReason,
      confidence,
    });
  }

  // If no real warnings (validation mode), proactively analyze the timetable
  if (warningsList.length <= 1 && warningsList[0]?.startsWith("Validate")) {
    const validationIssues = validateTimetable(currentSlots, faculty);
    suggestions.push(...validationIssues);
  }

  return suggestions;
}

/**
 * Proactively validate a generated timetable against 14-week historical patterns.
 * Returns suggestions for improvements even when there are no conflicts.
 */
function validateTimetable(
  slots: GeneratedSlot[],
  faculty: FacultyMember[],
): AISuggestion[] {
  const issues: AISuggestion[] = [];

  // 1. Check for same teacher repeating in consecutive slots for same batch
  const batchDaySlots = new Map<string, { slot: number; teacher: string }[]>();
  for (const s of slots) {
    const key = `${s.batchCode}_${s.day}`;
    if (!batchDaySlots.has(key)) batchDaySlots.set(key, []);
    batchDaySlots.get(key)!.push({ slot: s.slotNum, teacher: s.teacherCode });
  }

  for (const [key, daySlots] of batchDaySlots) {
    const sorted = daySlots.sort((a, b) => a.slot - b.slot);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].teacher === sorted[i-1].teacher) {
        const [batch, day] = key.split('_');
        const shortBatch = extractShort(batch);
        
        // Find alternative teacher from patterns
        const altTeachers = getPatternSuggestions(batch, day, sorted[i].slot);
        const currentTeacher = sorted[i].teacher;
        const alternative = altTeachers.find(t => t !== currentTeacher) || "";
        
        issues.push({
          conflict: `${day} Slots ${sorted[i-1].slot}-${sorted[i].slot}: Same teacher ${currentTeacher} teaches ${shortBatch} consecutively`,
          teacher: alternative,
          reason: alternative 
            ? `Historical data suggests ${alternative} for ${shortBatch} on ${day} Slot ${sorted[i].slot}. Rotating teachers improves variety.`
            : `${currentTeacher} is the only available teacher for this batch. Consider assigning additional teachers.`,
          confidence: alternative ? 75 : 30,
        });
      }
    }
  }

  // 2. Check for non-historical assignments (teacher not in pattern data for this batch)
  let nonHistorical = 0;
  for (const s of slots) {
    if (s.teacherCode === "TEST" || s.teacherCode === "HOLIDAY") continue;
    const short = extractShort(s.batchCode);
    const batchTeachers = (HISTORICAL_PATTERNS.bt as Record<string, string[]>)[short] || [];
    if (batchTeachers.length > 0 && !batchTeachers.includes(s.teacherCode)) {
      nonHistorical++;
    }
  }
  if (nonHistorical > 0) {
    issues.push({
      conflict: `${nonHistorical} assignments differ from 14-week historical patterns`,
      teacher: "",
      reason: `${nonHistorical} out of ${slots.length} slots have teachers not historically associated with the batch. This may be fine for new batches but could indicate unexpected assignments.`,
      confidence: 50,
    });
  }

  // 3. Teacher load distribution
  const teacherLoad = new Map<string, number>();
  for (const s of slots) {
    teacherLoad.set(s.teacherCode, (teacherLoad.get(s.teacherCode) || 0) + 1);
  }
  const loads = [...teacherLoad.entries()].sort((a, b) => b[1] - a[1]);
  if (loads.length >= 2) {
    const maxLoad = loads[0][1];
    const minLoad = loads[loads.length - 1][1];
    if (maxLoad > minLoad * 3) {
      issues.push({
        conflict: `Load imbalance: ${loads[0][0]} has ${maxLoad} slots, ${loads[loads.length-1][0]} has only ${minLoad}`,
        teacher: "",
        reason: `Consider redistributing workload. Top 3: ${loads.slice(0, 3).map(([t, c]) => `${t}(${c})`).join(", ")}. Bottom 3: ${loads.slice(-3).map(([t, c]) => `${t}(${c})`).join(", ")}.`,
        confidence: 60,
      });
    }
  }

  // 4. Historical pattern match score
  let matchCount = 0;
  let totalChecked = 0;
  for (const s of slots) {
    if (s.teacherCode === "TEST" || s.teacherCode === "HOLIDAY") continue;
    const short = extractShort(s.batchCode);
    const slotKey = `${short}_${s.day}_${s.slotNum}`;
    const histTeachers = (HISTORICAL_PATTERNS.sh as Record<string, string[]>)[slotKey] || [];
    totalChecked++;
    if (histTeachers.includes(s.teacherCode)) matchCount++;
  }
  
  if (totalChecked > 0) {
    const matchPct = Math.round((matchCount / totalChecked) * 100);
    issues.unshift({
      conflict: `📊 Pattern Match Score: ${matchPct}% (${matchCount}/${totalChecked} slots match history)`,
      teacher: "",
      reason: matchPct >= 80 
        ? `Excellent! ${matchPct}% of assignments match the 14-week historical patterns. This timetable closely follows established patterns.`
        : matchPct >= 50
        ? `${matchPct}% of assignments match history. Some new assignments detected — review for accuracy.`
        : `Only ${matchPct}% match history. Many assignments are new or different from established patterns.`,
      confidence: matchPct,
    });
  }

  return issues;
}
