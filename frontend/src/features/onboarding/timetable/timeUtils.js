// timeUtils.js
// Pure functions for slot generation, conflict detection, free-time analysis
// and weekly summary math. No React, no side effects — easy to unit test and
// easy to hand off to the future ML pipeline as-is.

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

export const DAY_LABELS = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

export const CLASS_TYPES = ["lecture", "lab", "tutorial", "seminar", "other"];
export const BREAK_TYPES = ["lunch", "break", "personal", "travel", "other"];

/** "14:30" -> 870 (minutes since midnight) */
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 870 -> "14:30" */
export function toHHMM(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "14:30" -> "2:30 PM" */
export function formatTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;

  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/**
 * Generates the row structure for the grid based on college hours + slot size.
 * Returns [{ start: "08:00", end: "09:00", label: "8:00 AM – 9:00 AM" }, ...]
 */
export function generateTimeSlots(
  collegeStartTime,
  collegeEndTime,
  slotDuration
) {
  const slots = [];

  let cursor = toMinutes(collegeStartTime);
  const end = toMinutes(collegeEndTime);

  while (cursor < end) {
    const slotEnd = Math.min(cursor + slotDuration, end);

    slots.push({
      start: toHHMM(cursor),
      end: toHHMM(slotEnd),
      label: `${formatTime(toHHMM(cursor))} – ${formatTime(
        toHHMM(slotEnd)
      )}`,
    });

    cursor = slotEnd;
  }

  return slots;
}

/** Does [aStart,aEnd) overlap [bStart,bEnd)? All args are "HH:MM" strings. */
export function timesOverlap(aStart, aEnd, bStart, bEnd) {
  return (
    toMinutes(aStart) < toMinutes(bEnd) &&
    toMinutes(aEnd) > toMinutes(bStart)
  );
}

/**
 * Returns the first block on `day` that overlaps the given time range,
 * excluding a block by id (used when editing an existing block).
 */
export function findConflict(
  timetable,
  day,
  startTime,
  endTime,
  excludeId = null
) {
  const dayBlocks = timetable[day] || [];

  return (
    dayBlocks.find(
      (b) =>
        b.id !== excludeId &&
        timesOverlap(startTime, endTime, b.startTime, b.endTime)
    ) || null
  );
}

/**
 * Given a day's blocks + the configured college hours, returns the gaps
 * that are not covered by any block (class or break), each >= minGap minutes.
 * These are candidate "free" windows the recommendation engine can use.
 */
export function computeFreeRanges(
  dayBlocks,
  collegeStartTime,
  collegeEndTime,
  minGap = 20
) {
  const sorted = [...dayBlocks].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
  );

  const ranges = [];

  let cursor = toMinutes(collegeStartTime);
  const dayEnd = toMinutes(collegeEndTime);

  for (const block of sorted) {
    const bStart = toMinutes(block.startTime);
    const bEnd = toMinutes(block.endTime);

    if (bStart > cursor) {
      const gap = bStart - cursor;

      if (gap >= minGap) {
        ranges.push({
          start: toHHMM(cursor),
          end: toHHMM(bStart),
          minutes: gap,
        });
      }
    }

    cursor = Math.max(cursor, bEnd);
  }

  if (dayEnd > cursor) {
    const gap = dayEnd - cursor;

    if (gap >= minGap) {
      ranges.push({
        start: toHHMM(cursor),
        end: toHHMM(dayEnd),
        minutes: gap,
      });
    }
  }

  return ranges;
}

/**
 * Rolls the whole week up into the numbers the "Your Week" summary card
 * (and later, the recommendation engine) needs.
 */
export function computeWeekSummary(timetable, config) {
  let classes = 0;
  let labs = 0;
  let freePeriods = 0;
  let freeMinutes = 0;

  const perDay = {};

  DAYS.forEach((day) => {
    const blocks = timetable[day] || [];

    classes += blocks.filter((b) => b.type !== "break").length;

    labs += blocks.filter((b) => b.type === "lab").length;

    const free = computeFreeRanges(
      blocks,
      config.collegeStartTime,
      config.collegeEndTime
    );

    const occupiedMinutes = blocks.reduce(
      (sum, b) =>
        sum + (toMinutes(b.endTime) - toMinutes(b.startTime)),
      0
    );

    const dayFreeMinutes = free.reduce(
      (sum, r) => sum + r.minutes,
      0
    );

    freePeriods += free.length;
    freeMinutes += dayFreeMinutes;

    perDay[day] = {
      occupiedMinutes,
      freeMinutes: dayFreeMinutes,
      freeRanges: free,
    };
  });

  const busiestDay = DAYS.reduce((a, b) =>
    perDay[a].occupiedMinutes >= perDay[b].occupiedMinutes ? a : b
  );

  const mostAvailableDay = DAYS.reduce((a, b) =>
    perDay[a].freeMinutes >= perDay[b].freeMinutes ? a : b
  );

  return {
    classes,
    labs,
    freePeriods,
    freeMinutes,
    perDay,
    busiestDay,
    mostAvailableDay,
  };
}

/**
 * Turns the week summary into a plain-language observation.
 * This is UI copy only — it does NOT run any model.
 */
export function generateAIInsight(summary) {
  const {
    perDay,
    mostAvailableDay,
    freeMinutes,
  } = summary;

  if (freeMinutes === 0) {
    return "Your week looks fully booked so far. Add your classes and we'll start spotting realistic windows for opportunities.";
  }

  // Look for the single largest afternoon-or-later free window in the week.
  let best = null;

  DAYS.forEach((day) => {
    perDay[day].freeRanges.forEach((r) => {
      if (
        toMinutes(r.start) >= 12 * 60 &&
        (!best || r.minutes > best.minutes)
      ) {
        best = { ...r, day };
      }
    });
  });

  if (best && best.minutes >= 60) {
    return `You have ${formatDuration(
      best.minutes
    )} free on ${DAY_LABELS[best.day]} afternoon, from ${formatTime(
      best.start
    )}. We'll prioritize opportunities that fit this window.`;
  }

  if (perDay[mostAvailableDay].freeMinutes >= 60) {
    return `${DAY_LABELS[mostAvailableDay]} is your most open day. We'll lean on it when recommending workshops and events.`;
  }

  return "Your schedule is fairly tight this week — we'll favor shorter opportunities (30–60 min) that fit between classes.";
}