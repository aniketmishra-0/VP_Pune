/**
 * Timetable Auto-Generator — Core Algorithm
 *
 * Generates a weekly timetable by assigning teachers to batch slots while
 * respecting hard scheduling constraints:
 *   1. Batch suffix determines valid time slots (MA→1-2, NA→3-4, EA→5-6, MP→1|3)
 *   2. Teachers can only teach their assigned batches
 *   3. No teacher collision (1 teacher in 1 slot at a time)
 *   4. Max N slots per teacher per day (default 4)
 *   5. Max N consecutive slots per teacher (default 3)
 *   6. Skip holidays
 *   7. Saturday is always off
 *
 * Uses randomized assignment with conflict-aware selection.
 */

import type { FacultyMember } from "./settingsStore";

// ── Public types ────────────────────────────────────────────────────────

export interface GeneratorConfig {
  weekStartDate: string;       // e.g., "2026-06-15" (Monday)
  maxConsecutive: number;      // max consecutive slots per teacher (default 3)
  maxSlotsPerDay: number;      // max total slots per teacher per day (default 4)
  holidays: string[];          // day names to skip, e.g. ["THURSDAY"]
  testSlots: TestSlotOverride[];
}

export interface TestSlotOverride {
  day: string;       // e.g., "TUESDAY"
  slot: number;      // 1-6
  batchCode: string; // batch to override
  label: string;     // e.g., "VP AIR TEST"
}

export interface GeneratedSlot {
  day: string;        // MONDAY, TUESDAY, etc.
  date: string;       // e.g., "15-Jun-2026"
  slotNum: number;    // 1-6
  startTime: string;
  endTime: string;
  batchCode: string;
  teacherCode: string;
  room: string;
  section: "JEE" | "NEET";
}

export interface BatchInfo {
  code: string;
  room: string;
  section: "JEE" | "NEET";
}

export interface GenerationResult {
  slots: GeneratedSlot[];
  warnings: string[];
}

// ── Constants ───────────────────────────────────────────────────────────

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;

/** Slot timings (1-indexed): slot 1 = 8:45-10:15, etc. */
const SLOT_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "8:45",  end: "10:15" },
  2: { start: "10:30", end: "12:00" },
  3: { start: "12:25", end: "1:55"  },
  4: { start: "2:15",  end: "3:45"  },
  5: { start: "4:10",  end: "5:40"  },
  6: { start: "5:55",  end: "7:20"  },
};

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Extract the batch suffix (MA, NA, EA, MP, NP) from a batch code.
 * Batch codes look like "27-JL999MA 2026" — the suffix is the two
 * characters just before the space-separated year.
 */
function getBatchSuffix(batchCode: string): string {
  const trimmed = batchCode.trim();
  // Try to match the 2-char suffix before the year (e.g., "MA" from "27-JL999MA 2026")
  const match = trimmed.match(/([A-Z]{2})\s+\d{4}$/i);
  if (match) return match[1].toUpperCase();

  // Fallback: last two alpha chars before end or whitespace
  const alphaMatch = trimmed.replace(/\s+\d{4}$/, "").match(/([A-Z]{2})$/i);
  if (alphaMatch) return alphaMatch[1].toUpperCase();

  return "";
}

/**
 * Determine valid slot numbers for a batch based on its suffix.
 *   MA → slots 1-2 (Morning)
 *   NA / NP → slots 3-4 (Afternoon)
 *   EA → slots 5-6 (Evening)
 *   MP → slot 1 or 3 (Master/Merged)
 */
function getValidSlots(batchCode: string): number[] {
  const suffix = getBatchSuffix(batchCode);
  switch (suffix) {
    case "MA": return [1, 2];
    case "NA": case "NP": return [3, 4];
    case "EA": return [5, 6];
    case "MP": return [1, 3];
    default:
      // Unknown suffix — default to morning slots
      return [1, 2];
  }
}

/**
 * Format a Date as "15-Jun-2026".
 */
function formatDate(d: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

/**
 * Fisher-Yates shuffle (in-place, returns same array).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build a map of day name → date string for the week starting at `weekStartDate`.
 * `weekStartDate` should be a Monday.
 */
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

// ── Constraint tracker ──────────────────────────────────────────────────

/**
 * Tracks per-teacher scheduling state for a single day so we can enforce
 * max-slots-per-day and max-consecutive-slots constraints efficiently.
 */
class DayTracker {
  /** teacher → set of slot numbers assigned today */
  private slotsPerTeacher = new Map<string, Set<number>>();
  /** teacher → sorted array of slot numbers (for consecutive check) */
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

  /** How many slots has this teacher been assigned today? */
  slotCount(teacher: string): number {
    return this.slotsPerTeacher.get(teacher)?.size ?? 0;
  }

  /**
   * Would assigning `slot` to `teacher` create a run longer than `maxConsec`?
   * We temporarily add the slot, compute the longest consecutive run, then
   * remove it.
   */
  wouldExceedConsecutive(teacher: string, slot: number, maxConsec: number): boolean {
    const ordered = [...(this.orderedSlots.get(teacher) || []), slot].sort((a, b) => a - b);
    let run = 1;
    let maxRun = 1;
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i] === ordered[i - 1] + 1) {
        run++;
        maxRun = Math.max(maxRun, run);
      } else {
        run = 1;
      }
    }
    return maxRun > maxConsec;
  }
}

/**
 * Global slot-level collision tracker: ensures no teacher is double-booked
 * within the same time slot across ALL batches.
 */
class SlotCollisionTracker {
  /** "DAY-SLOT" → Set of teacher codes already booked */
  private booked = new Map<string, Set<string>>();

  private key(day: string, slot: number): string {
    return `${day}-${slot}`;
  }

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
  } = config;

  const warnings: string[] = [];
  const result: GeneratedSlot[] = [];

  // Normalise holiday names to uppercase
  const holidaySet = new Set(holidays.map((h) => h.toUpperCase().trim()));

  // Day → date map
  const dayDates = buildDayDates(weekStartDate);

  // Build a lookup: batchCode → list of teacher codes that can teach it
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

  // Build a test-slot lookup for quick checks: "DAY-SLOT-BATCH" → label
  const testSlotMap = new Map<string, string>();
  for (const ts of testSlots) {
    testSlotMap.set(
      `${ts.day.toUpperCase()}-${ts.slot}-${ts.batchCode.trim()}`,
      ts.label,
    );
  }

  // Global collision tracker
  const collisions = new SlotCollisionTracker();

  // Process each working day
  for (const day of DAYS) {
    // Skip holidays and Saturdays (Saturdays are implicitly not in DAYS)
    if (holidaySet.has(day)) {
      warnings.push(`${day}: Skipped (holiday)`);
      continue;
    }

    const dateStr = dayDates.get(day) || "";
    const dayTracker = new DayTracker();

    // Iterate over each batch
    for (const batch of batches) {
      const validSlots = getValidSlots(batch.code);

      // Get teachers eligible for this batch
      const eligible = batchTeachers.get(batch.code) || [];
      if (eligible.length === 0) {
        warnings.push(`${day}: No teachers found for batch ${batch.code}`);
      }

      // Try to fill each valid slot
      for (const slot of validSlots) {
        // Check if this is a test slot override
        const testKey = `${day}-${slot}-${batch.code}`;
        if (testSlotMap.has(testKey)) {
          result.push({
            day,
            date: dateStr,
            slotNum: slot,
            startTime: SLOT_TIMES[slot].start,
            endTime: SLOT_TIMES[slot].end,
            batchCode: batch.code,
            teacherCode: testSlotMap.get(testKey)!, // The test label
            room: batch.room,
            section: batch.section,
          });
          continue;
        }

        // Randomize teacher order for fairness
        const candidates = shuffle([...eligible]);
        let assigned = false;

        for (const teacher of candidates) {
          // Constraint 3: No collision (teacher already booked this slot)
          if (collisions.isBooked(day, slot, teacher)) continue;

          // Constraint 4: Max slots per day
          if (dayTracker.slotCount(teacher) >= maxSlotsPerDay) continue;

          // Constraint 5: Max consecutive slots
          if (dayTracker.wouldExceedConsecutive(teacher, slot, maxConsecutive)) continue;

          // All constraints passed — assign
          result.push({
            day,
            date: dateStr,
            slotNum: slot,
            startTime: SLOT_TIMES[slot].start,
            endTime: SLOT_TIMES[slot].end,
            batchCode: batch.code,
            teacherCode: teacher,
            room: batch.room,
            section: batch.section,
          });

          collisions.book(day, slot, teacher);
          dayTracker.assign(teacher, slot);
          assigned = true;
          break;
        }

        if (!assigned) {
          // No valid teacher found — leave empty and warn
          warnings.push(
            `${day} Slot ${slot}: No available teacher for batch ${batch.code} ` +
            `(${candidates.length} candidates all conflicted)`,
          );
        }
      }
    }
  }

  return { slots: result, warnings };
}
