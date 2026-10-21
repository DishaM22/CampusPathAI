"""Tests for backend/recommender_schedule.py (time parsing and timetable checks)."""

from datetime import datetime

import pytest

import recommender_schedule as sch


# ---------------- clock and range parsing ----------------

@pytest.mark.parametrize(
    "text, expected",
    [
        ("10:50", 650), ("14:30", 870), ("2:30 PM", 870), ("11 AM", 660),
        ("12:00 AM", 0), ("12:00 PM", 720), ("9:05 am", 545), ("1 p.m.", 780),
    ],
)
def test_parse_clock(text, expected):
    assert sch.parse_clock(text) == expected


@pytest.mark.parametrize("text", [None, "", "noon", "25:00", "13:00 PM", "10:75", 5])
def test_parse_clock_rejects_bad_input(text):
    assert sch.parse_clock(text) is None


@pytest.mark.parametrize(
    "text, expected",
    [
        ("11:00 AM – 1:00 PM", (660, 780)),      # the real stored format (en dash)
        ("11:00 AM - 1:00 PM", (660, 780)),
        ("11:00 AM — 1:00 PM", (660, 780)),
        ("10:00 to 12:00", (600, 720)),
        ("1:00 - 3:00 PM", (780, 900)),          # AM/PM inherited from the end
        ("9:00 - 1:00 PM", (540, 780)),
        ("11:00 AM", (660, None)),               # end unknown: not guessed
        ("3:00 PM – 1:00 PM", (900, None)),      # end before start: unreliable
    ],
)
def test_parse_time_range(text, expected):
    assert sch.parse_time_range(text) == expected


@pytest.mark.parametrize("text", [None, "", "TBA", "1 - 2 - 3", 42])
def test_parse_time_range_unreadable(text):
    assert sch.parse_time_range(text) == (None, None)


def test_parse_event_date():
    assert sch.parse_event_date("2026-11-06").isoformat() == "2026-11-06"
    assert sch.parse_event_date("2026-11-06T10:00:00Z").isoformat() == "2026-11-06"
    assert sch.parse_event_date("06/11/2026") is None      # ambiguous, not guessed
    assert sch.parse_event_date("2026-13-40") is None
    assert sch.parse_event_date(None) is None


def test_real_event_document_is_read_correctly():
    event = {"date": "2026-11-06", "time": "11:00 AM – 1:00 PM"}
    schedule = sch.get_event_schedule(event)
    assert schedule.weekday == "friday"
    assert (schedule.start, schedule.end) == (660, 780)


def test_separate_start_and_end_fields_are_accepted():
    event = {"date": "2026-11-06", "start_time": "10:00 AM", "end_time": "12:00 PM"}
    schedule = sch.get_event_schedule(event)
    assert (schedule.start, schedule.end) == (600, 720)


# ---------------- expiry ----------------

def test_expiry_rules():
    now = datetime(2026, 10, 13, 12, 0)
    assert sch.is_event_expired({"date": "2026-10-12", "time": "9:00 AM"}, now) is True
    assert sch.is_event_expired({"date": "2026-10-14", "time": "9:00 AM"}, now) is False
    assert sch.is_event_expired({"date": "2026-10-13", "time": "9:00 AM – 11:00 AM"}, now) is True
    assert sch.is_event_expired({"date": "2026-10-13", "time": "9:00 AM – 2:00 PM"}, now) is False
    # today, end unknown: cannot prove it is over
    assert sch.is_event_expired({"date": "2026-10-13", "time": "9:00 AM"}, now) is False
    # no usable date: cannot prove anything
    assert sch.is_event_expired({"title": "x"}, now) is False


# ---------------- timetable adapter ----------------

def test_adapter_reads_the_saved_document(timetable_doc):
    slots = sch.timetable_to_busy_slots(timetable_doc)
    assert len(slots) == 2
    monday = next(slot for slot in slots if slot.day == "monday")
    assert (monday.start, monday.end, monday.hard) == (650, 705, True)
    lunch = next(slot for slot in slots if slot.day == "thursday")
    assert lunch.hard is False


def test_adapter_accepts_inner_dict_and_legacy_list(timetable_doc):
    inner = sch.timetable_to_busy_slots(timetable_doc["timetable"])
    assert len(inner) == 2

    legacy = sch.timetable_to_busy_slots(
        [{"day": "Monday", "start_time": "9:00 AM", "end_time": "1:00 PM"}]
    )
    assert [(s.day, s.start, s.end) for s in legacy] == [("monday", 540, 780)]


def test_adapter_skips_unreadable_blocks_and_empty_input():
    assert sch.timetable_to_busy_slots(None) == []
    assert sch.timetable_to_busy_slots({}) == []
    bad = {"timetable": {"monday": [{"startTime": "", "endTime": "10:00"},
                                    {"startTime": "11:00", "endTime": "10:00"},
                                    "not a block"]}}
    assert sch.timetable_to_busy_slots(bad) == []


def test_buffer_minutes(timetable_doc):
    assert sch.get_buffer_minutes(timetable_doc) == 30
    assert sch.get_buffer_minutes({"preferences": {"bufferTime": "abc"}}) == 0
    assert sch.get_buffer_minutes({"preferences": {"bufferTime": 999}}) == sch.MAX_BUFFER_MINUTES
    assert sch.get_buffer_minutes(None) == 0


# ---------------- conflict check ----------------

def check(event, timetable_doc):
    slots = sch.timetable_to_busy_slots(timetable_doc)
    return sch.check_event_schedule(event, slots, sch.get_buffer_minutes(timetable_doc))


def test_overlap_is_conflict(timetable_doc):
    event = {"date": "2099-11-23", "time": "11:00 AM – 1:00 PM"}      # Monday
    assert check(event, timetable_doc).status == sch.CONFLICT


def test_touching_ranges_do_not_overlap(timetable_doc):
    # class ends 11:45, event starts 11:45 -> no overlap (but inside the buffer)
    event = {"date": "2099-11-23", "time": "11:45 AM – 1:00 PM"}
    assert check(event, timetable_doc).status == sch.TIGHT


def test_far_from_class_is_free(timetable_doc):
    event = {"date": "2099-11-23", "time": "2:00 PM – 4:00 PM"}
    assert check(event, timetable_doc).status == sch.FREE


def test_unknown_end_only_conflicts_if_start_is_inside_a_class(timetable_doc):
    inside = {"date": "2099-11-23", "time": "11:00 AM"}
    outside = {"date": "2099-11-23", "time": "3:00 PM"}
    assert check(inside, timetable_doc).status == sch.CONFLICT
    assert check(outside, timetable_doc).status == sch.UNKNOWN


def test_no_timetable_is_unknown():
    event = {"date": "2099-11-23", "time": "11:00 AM – 1:00 PM"}
    assert sch.check_event_schedule(event, []).status == sch.UNKNOWN
