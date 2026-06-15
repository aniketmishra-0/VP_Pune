/**
 * Timetable Auto-Generator — v2 (Historical + Constraint-Based)
 *
 * Strategy:
 *   1. Load the LAST week's actual timetable from the Google Sheet
 *   2. Use it as a TEMPLATE — copy teacher assignments that still work
 *   3. For remaining unassigned slots, use constraint-based assignment
 *      prioritizing teachers who taught the same batch historically
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

/** Historical slot = what was used in a previous week */
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

  // Build batch → teacher mapping
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

  // Historical lookup: "DAY-SLOT-BATCH" → teacherCode
  const histLookup = new Map<string, string>();
  for (const hs of historicalData) {
    histLookup.set(`${hs.day}-${hs.slotNum}-${hs.batchCode}`, hs.teacherCode);
  }
  const hasHistorical = histLookup.size > 0;

  // Test-slot lookup
  const testSlotMap = new Map<string, string>();
  for (const ts of testSlots) {
    testSlotMap.set(`${ts.day.toUpperCase()}-${ts.slot}-${ts.batchCode.trim()}`, ts.label);
  }

  // Active teacher codes
  const activeTeachers = new Set(
    faculty.filter(f => !f.status || f.status.toLowerCase() === "active").map(f => f.code)
  );

  const collisions = new SlotCollisionTracker();

  for (const day of DAYS) {
    if (holidaySet.has(day)) continue;

    const dateStr = dayDates.get(day) || "";
    const dayTracker = new DayTracker();

    // ── PHASE 1: Pre-assign from historical data ──
    if (hasHistorical) {
      for (const batch of batches) {
        const validSlots = getValidSlots(batch.code);
        for (const slot of validSlots) {
          if (testSlotMap.has(`${day}-${slot}-${batch.code}`)) continue;

          const histTeacher = histLookup.get(`${day}-${slot}-${batch.code}`);
          if (!histTeacher || !activeTeachers.has(histTeacher)) continue;

          // Validate eligibility
          const eligible = batchTeachers.get(batch.code) || [];
          if (!eligible.includes(histTeacher)) continue;

          // Check constraints
          if (collisions.isBooked(day, slot, histTeacher)) continue;
          if (dayTracker.slotCount(histTeacher) >= maxSlotsPerDay) continue;
          if (dayTracker.wouldExceedConsecutive(histTeacher, slot, maxConsecutive)) continue;

          result.push({
            day, date: dateStr, slotNum: slot,
            startTime: SLOT_TIMES[slot].start, endTime: SLOT_TIMES[slot].end,
            batchCode: batch.code, teacherCode: histTeacher,
            room: batch.room, section: batch.section,
          });
          collisions.book(day, slot, histTeacher);
          dayTracker.assign(histTeacher, slot);
        }
      }
    }

    // ── PHASE 2: Fill remaining slots ──
    for (const batch of batches) {
      const validSlots = getValidSlots(batch.code);
      const eligible = batchTeachers.get(batch.code) || [];

      for (const slot of validSlots) {
        const testKey = `${day}-${slot}-${batch.code}`;
        if (testSlotMap.has(testKey)) {
          // Check if test slot already added in phase 1 (it won't be, but safety check)
          const exists = result.some(r => r.day === day && r.slotNum === slot && r.batchCode === batch.code);
          if (!exists) {
            result.push({
              day, date: dateStr, slotNum: slot,
              startTime: SLOT_TIMES[slot].start, endTime: SLOT_TIMES[slot].end,
              batchCode: batch.code, teacherCode: testSlotMap.get(testKey)!,
              room: batch.room, section: batch.section,
            });
          }
          continue;
        }

        // Already assigned in Phase 1?
        const alreadyAssigned = result.some(
          r => r.day === day && r.slotNum === slot && r.batchCode === batch.code
        );
        if (alreadyAssigned) continue;

        if (eligible.length === 0) {
          warnings.push(`${day}: No teachers found for batch ${batch.code}`);
          continue;
        }

        // Prioritize: historical teachers for this batch (any day/slot), then others
        const histForBatch: string[] = [];
        for (const s of [1,2,3,4,5,6]) {
          const ht = histLookup.get(`${day}-${s}-${batch.code}`);
          if (ht && eligible.includes(ht) && activeTeachers.has(ht)) {
            if (!histForBatch.includes(ht)) histForBatch.push(ht);
          }
        }

        const candidates = [
          ...histForBatch,
          ...shuffle([...eligible]).filter(t => !histForBatch.includes(t))
        ];

        let assigned = false;
        for (const teacher of candidates) {
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
          assigned = true;
          break;
        }

        if (!assigned) {
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

