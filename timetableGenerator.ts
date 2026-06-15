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
import { HISTORICAL_PATTERNS } from "./historicalPatterns";

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
  for (const f of faculty) {
    if (f.status && f.status.toLowerCase() !== "active") continue;
    for (const b of f.batches) {
      const bNorm = b.trim();
      if (!bNorm) continue;
      if (!batchTeachers.has(bNorm)) batchTeachers.set(bNorm, []);
      batchTeachers.get(bNorm)!.push(f.code);
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

  // Track teacher variety per batch (avoid same teacher all week)
  // batchWeekTeachers[batchCode] = Map<teacherCode, count>
  const batchWeekTeachers = new Map<string, Map<string, number>>();

  const collisions = new SlotCollisionTracker();

  for (const day of DAYS) {
    if (holidaySet.has(day)) continue;

    const dateStr = dayDates.get(day) || "";
    const dayTracker = new DayTracker();
    
    // Track last assigned teacher per batch THIS day (for variety within a day)
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
        const lastTeacherForBatch = batchDayLastTeacher.get(batch.code);

        // Get weekly usage for this batch
        if (!batchWeekTeachers.has(batch.code)) {
          batchWeekTeachers.set(batch.code, new Map());
        }
        const batchWeekUsage = batchWeekTeachers.get(batch.code)!;

        const candidateOrder: string[] = [];
        const seen = new Set<string>();

        // Layer 1: Runtime historical (last week) — but NOT if same as last slot
        if (runtimeTeacher && eligible.includes(runtimeTeacher) && activeTeachers.has(runtimeTeacher)) {
          if (runtimeTeacher !== lastTeacherForBatch) {
            candidateOrder.push(runtimeTeacher);
          }
          seen.add(runtimeTeacher);
        }

        // Layer 2: Pattern AI suggestions — filter out last-used teacher
        for (const t of patternSuggestions) {
          if (!seen.has(t) && eligible.includes(t) && activeTeachers.has(t)) {
            if (t !== lastTeacherForBatch) {
              candidateOrder.push(t);
            }
            seen.add(t);
          }
        }

        // Layer 3: Remaining eligible, sorted by:
        //   a) NOT the teacher from previous slot (variety within day)
        //   b) Fewer weekly usages for THIS batch (variety across week)
        //   c) Slot preference match
        //   d) Lower overall weekly load
        const remaining = eligible
          .filter(t => !seen.has(t) && activeTeachers.has(t))
          .map(t => ({
            code: t,
            load: weeklyLoad.get(t) || 0,
            prefersSlot: teacherPrefersSlot(t, slot),
            batchUse: batchWeekUsage.get(t) || 0,
            isRepeat: t === lastTeacherForBatch,
          }))
          .sort((a, b) => {
            // Don't repeat same teacher in consecutive slots
            if (a.isRepeat !== b.isRepeat) return a.isRepeat ? 1 : -1;
            // Prefer teachers less-used for THIS batch this week
            if (a.batchUse !== b.batchUse) return a.batchUse - b.batchUse;
            // Prefer teachers who like this slot
            if (a.prefersSlot !== b.prefersSlot) return a.prefersSlot ? -1 : 1;
            // Then by lower overall load
            return a.load - b.load;
          });

        for (const r of remaining) {
          candidateOrder.push(r.code);
        }

        // If all candidates were filtered (only 1 teacher available), add back the repeat
        if (candidateOrder.length === 0 && lastTeacherForBatch && eligible.includes(lastTeacherForBatch)) {
          candidateOrder.push(lastTeacherForBatch);
        }
        // Also add runtime teacher back if it was skipped
        if (candidateOrder.length === 0 && runtimeTeacher && eligible.includes(runtimeTeacher)) {
          candidateOrder.push(runtimeTeacher);
        }

        // ── TRY CANDIDATES ──
        let assigned = false;
        for (const teacher of candidateOrder) {
          if (collisions.isBooked(day, slot, teacher)) continue;
          if (dayTracker.slotCount(teacher) >= maxSlotsPerDay) continue;
          if (dayTracker.wouldExceedConsecutive(teacher, slot, maxConsecutive)) continue;

          result.push({
            day, date: dateStr, slotNum: slot,
            startTime: SLOT_TIMES[slot].start, endTime: SLOT_TIMES[slot].end,
            batchCode: batch.code, teacherCode: teacher,
            room: batch.room, section: batch.section,
          });
          collisions.book(day, slot, teacher);
          dayTracker.assign(teacher, slot);
          weeklyLoad.set(teacher, (weeklyLoad.get(teacher) || 0) + 1);
          batchDayLastTeacher.set(batch.code, teacher);
          batchWeekUsage.set(teacher, (batchWeekUsage.get(teacher) || 0) + 1);
          assigned = true;
          break;
        }

        if (!assigned) {
          warnings.push(
            `${day} Slot ${slot}: No available teacher for batch ${batch.code} ` +
            `(${candidateOrder.length} candidates all conflicted)`,
          );
        }
      }
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
