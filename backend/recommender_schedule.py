"""
recommender_schedule.py

Pure helper functions (no database, no network, no ML) that let the
recommendation engine understand TIME:

  * how an event stores its schedule      ("2026-11-06", "11:00 AM – 1:00 PM")
  * how a student's timetable is stored   ({"monday": [{"startTime": "10:50", ...}]})
  * whether an event clashes with classes

Rules followed here
-------------------
* All times are campus-local "wall clock" times with no time zone. Events
  and timetables are both entered in campus time, so they are compared as is.
  Do not mix in UTC values (e.g. `created_at`) here.
* Nothing is invented. If an event has no reliable start, or no reliable
  end, the result says "unknown" instead of guessing a duration.
* A missing or empty timetable is NEVER treated as "the student is free".
* A hard clash (overlapping a class) is different from a soft issue
  (overlapping lunch/break, or too little buffer time between a class and
  the event). Only hard clashes are meant to remove an event.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple

# ============================================================
# CONFIGURATION
# ============================================================

WEEKDAYS: Tuple[str, ...] = (
    "monday", "tuesday", "wednesday", "thursday",
    "friday", "saturday", "sunday",
)

# The onboarding timetable only has Monday-Friday.
TIMETABLE_DAYS: Tuple[str, ...] = WEEKDAYS[:5]

# Timetable block types that count as a HARD commitment (a real class).
# Anything not listed as soft is treated as hard, so an unfamiliar type is
# never silently ignored.
SOFT_BLOCK_TYPES = frozenset({"lunch", "break", "personal", "travel"})

# Schedule check results
CONFLICT = "conflict"   # hard clash with a class
TIGHT = "tight"         # soft issue: overlaps a break, or inside buffer time
FREE = "free"           # reliable data says there is no clash
UNKNOWN = "unknown"     # not enough reliable data to say

MAX_BUFFER_MINUTES = 120


# ============================================================
# CLOCK AND RANGE PARSING
# ============================================================

_CLOCK_RE = re.compile(
    r"^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?\s*$",
    re.IGNORECASE,
)
_CLOCK_24H_RE = re.compile(r"^\s*(\d{1,2}):(\d{2})\s*$")
_RANGE_SPLIT_RE = re.compile(r"\s*(?:–|—|-|\bto\b)\s*", re.IGNORECASE)


def parse_clock(value: Any) -> Optional[int]:
    """
    "14:30" -> 870, "2:30 PM" -> 870, "11 AM" -> 660.
    Returns minutes after midnight, or None if the text is not a clock time.
    """
    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    match = _CLOCK_RE.match(text)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        is_pm = match.group(3).lower() == "p"

        if not 1 <= hour <= 12 or not 0 <= minute <= 59:
            return None

        if hour == 12:
            hour = 0
        return (hour + (12 if is_pm else 0)) * 60 + minute

    match = _CLOCK_24H_RE.match(text)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2))
        if not 0 <= hour <= 23 or not 0 <= minute <= 59:
            return None
        return hour * 60 + minute

    return None


def _meridiem(text: str) -> Optional[str]:
    match = re.search(r"([ap])\.?\s*m\.?\s*$", text.strip(), re.IGNORECASE)
    return f"{match.group(1).upper()}M" if match else None


def parse_time_range(value: Any) -> Tuple[Optional[int], Optional[int]]:
    """
    "11:00 AM – 1:00 PM" -> (660, 780)
    "11:00 AM"           -> (660, None)     (end is unknown, NOT guessed)
    "1:00 - 3:00 PM"     -> (780, 900)      (AM/PM inherited from the end)
    anything else        -> (None, None)

    An end that is not after the start is treated as unreliable (None).
    """
    if not isinstance(value, str) or not value.strip():
        return None, None

    parts = [part for part in _RANGE_SPLIT_RE.split(value.strip()) if part]

    if len(parts) == 1:
        return parse_clock(parts[0]), None

    if len(parts) != 2:
        return None, None

    start_text, end_text = parts
    start = parse_clock(start_text)
    end = parse_clock(end_text)

    # "1:00 - 3:00 PM": give the start the same AM/PM as the end
    # when that makes it earlier than the end.
    end_meridiem = _meridiem(end_text)
    if end is not None and end_meridiem and not _meridiem(start_text):
        inherited = parse_clock(f"{start_text.strip()} {end_meridiem}")
        if inherited is not None and inherited < end:
            start = inherited

    if start is None:
        return None, None

    if end is None or end <= start:
        return start, None

    return start, end


def parse_event_date(value: Any) -> Optional[date]:
    """
    Accepts "2026-11-06" (also a datetime/date object or an ISO datetime
    string starting with that date). Other formats such as 06/11/2026 are
    ambiguous (day-first or month-first), so they return None.
    """
    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    if not isinstance(value, str):
        return None

    match = re.match(r"^\s*(\d{4})-(\d{2})-(\d{2})", value)
    if not match:
        return None

    try:
        return date(
            int(match.group(1)),
            int(match.group(2)),
            int(match.group(3)),
        )
    except ValueError:
        return None


def weekday_name(day: Optional[date]) -> Optional[str]:
    return WEEKDAYS[day.weekday()] if day else None


def normalize_day_name(value: Any) -> Optional[str]:
    """"Mon" / "monday" / "MONDAY" -> "monday". Unknown -> None."""
    if not isinstance(value, str):
        return None

    text = value.strip().lower()
    if len(text) < 3:
        return None

    for name in WEEKDAYS:
        if name.startswith(text[:3]):
            return name
    return None


# ============================================================
# EVENT SCHEDULE
# ============================================================

@dataclass(frozen=True)
class EventSchedule:
    day: Optional[date]
    weekday: Optional[str]
    start: Optional[int]      # minutes after midnight
    end: Optional[int]        # None when the end is unknown


def get_event_schedule(event: Dict[str, Any]) -> EventSchedule:
    """
    Reads the schedule from the real stored fields:
        date: "2026-11-06"
        time: "11:00 AM – 1:00 PM"
    Separate start_time / end_time fields are also accepted if present.
    """
    day = parse_event_date(event.get("date"))

    start_field = event.get("start_time") or event.get("startTime")
    end_field = event.get("end_time") or event.get("endTime")

    start: Optional[int]
    end: Optional[int]

    if start_field:
        start = parse_clock(start_field)
        end = parse_clock(end_field) if end_field else None
        if end is not None and start is not None and end <= start:
            end = None
    else:
        start, end = parse_time_range(event.get("time"))

    weekday = weekday_name(day) or normalize_day_name(event.get("day"))

    return EventSchedule(day=day, weekday=weekday, start=start, end=end)


def is_event_expired(
    event: Dict[str, Any],
    now: Optional[datetime] = None,
) -> bool:
    """
    True only when we can prove the event is over:
      * its date is before today, or
      * it is today and its (known) end time has passed.
    A missing or unreadable date is NOT treated as expired.
    """
    now = now or datetime.now()
    schedule = get_event_schedule(event)

    if schedule.day is None:
        return False

    if schedule.day < now.date():
        return True

    if schedule.day == now.date() and schedule.end is not None:
        return now.hour * 60 + now.minute >= schedule.end

    return False


# ============================================================
# TIMETABLE ADAPTER
# ============================================================

@dataclass(frozen=True)
class BusySlot:
    day: str
    start: int
    end: int
    label: str
    hard: bool


def _block_to_slot(day: Optional[str], block: Any) -> Optional[BusySlot]:
    if not isinstance(block, dict) or day is None:
        return None

    start = parse_clock(
        block.get("startTime") or block.get("start_time")
    )
    end = parse_clock(
        block.get("endTime") or block.get("end_time")
    )

    if start is None or end is None or end <= start:
        return None

    block_type = str(block.get("type") or "").strip().lower()
    label = str(block.get("subject") or block.get("courseCode") or "").strip()

    return BusySlot(
        day=day,
        start=start,
        end=end,
        label=label,
        hard=block_type not in SOFT_BLOCK_TYPES,
    )


def timetable_to_busy_slots(timetable: Any) -> List[BusySlot]:
    """
    Accepts any of:
      1. the saved document:   {"timetable": {"monday": [...]}, "config": ..., "preferences": ...}
      2. the inner dict:       {"monday": [{startTime, endTime, type, subject}], ...}
      3. a legacy flat list:   [{"day": "Monday", "start_time": "9:00 AM", "end_time": "1:00 PM"}]
    Blocks with unreadable times are skipped.
    """
    if not timetable:
        return []

    slots: List[BusySlot] = []

    if isinstance(timetable, dict):
        inner = timetable.get("timetable", timetable)

        if isinstance(inner, dict):
            for day_key, blocks in inner.items():
                day = normalize_day_name(day_key)
                if day is None or not isinstance(blocks, list):
                    continue
                for block in blocks:
                    slot = _block_to_slot(day, block)
                    if slot:
                        slots.append(slot)

    elif isinstance(timetable, (list, tuple)):
        for block in timetable:
            if not isinstance(block, dict):
                continue
            day = normalize_day_name(
                block.get("day") or block.get("dayName") or block.get("weekday")
            )
            slot = _block_to_slot(day, block)
            if slot:
                slots.append(slot)

    return slots


def get_buffer_minutes(timetable: Any, default: int = 0) -> int:
    """Reads preferences.bufferTime from the saved document (0-120 min)."""
    if not isinstance(timetable, dict):
        return default

    preferences = timetable.get("preferences")
    if not isinstance(preferences, dict):
        return default

    try:
        value = int(preferences.get("bufferTime"))
    except (TypeError, ValueError):
        return default

    return max(0, min(MAX_BUFFER_MINUTES, value))


# ============================================================
# CONFLICT CHECK
# ============================================================

@dataclass(frozen=True)
class ScheduleCheck:
    status: str     # CONFLICT / TIGHT / FREE / UNKNOWN
    detail: str


def _overlaps(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return a_start < b_end and a_end > b_start


def check_event_schedule(
    event: Dict[str, Any],
    slots: Sequence[BusySlot],
    buffer_minutes: int = 0,
) -> ScheduleCheck:
    """
    Compare one event with the student's busy slots.

    CONFLICT  event overlaps a class (hard clash)
    TIGHT     event overlaps lunch/break, or is closer to a class than the
              student's buffer time (soft issue)
    FREE      reliable data shows no clash
    UNKNOWN   no timetable, no reliable event time, or a day the timetable
              does not cover
    """
    if not slots:
        return ScheduleCheck(UNKNOWN, "no timetable saved")

    schedule = get_event_schedule(event)

    if schedule.weekday is None or schedule.start is None:
        return ScheduleCheck(UNKNOWN, "event date or time is not reliable")

    if schedule.weekday not in TIMETABLE_DAYS:
        return ScheduleCheck(UNKNOWN, "timetable covers weekdays only")

    day_slots = [slot for slot in slots if slot.day == schedule.weekday]

    # ---- end time unknown: only a start-inside-a-class clash is provable
    if schedule.end is None:
        for slot in day_slots:
            if slot.hard and slot.start <= schedule.start < slot.end:
                return ScheduleCheck(
                    CONFLICT, f"starts during {slot.label or 'a class'}"
                )
        return ScheduleCheck(UNKNOWN, "event end time is not known")

    # ---- hard clash
    for slot in day_slots:
        if slot.hard and _overlaps(
            schedule.start, schedule.end, slot.start, slot.end
        ):
            return ScheduleCheck(
                CONFLICT, f"overlaps {slot.label or 'a class'}"
            )

    # ---- soft issues
    for slot in day_slots:
        if not slot.hard and _overlaps(
            schedule.start, schedule.end, slot.start, slot.end
        ):
            return ScheduleCheck(
                TIGHT, f"overlaps {slot.label or 'a break'}"
            )

    if buffer_minutes > 0:
        for slot in day_slots:
            if not slot.hard:
                continue
            if _overlaps(
                schedule.start - buffer_minutes,
                schedule.end + buffer_minutes,
                slot.start,
                slot.end,
            ):
                return ScheduleCheck(
                    TIGHT,
                    f"less than {buffer_minutes} min from "
                    f"{slot.label or 'a class'}",
                )

    return ScheduleCheck(FREE, "no clash with saved classes")
