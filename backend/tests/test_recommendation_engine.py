"""
Tests for backend/recommendation_engine.py  (Phase 3, Steps 1 and 2)

Step 1 tests pinned down the behaviour before any change. In Step 2 the four
known bugs were fixed, so their xfail markers were removed and they are now
ordinary tests. The two "current behaviour" tests that described the old
timetable/availability problems were rewritten to describe the new behaviour.

The Sentence-BERT model is disabled in conftest.py unless a test installs a
fake one, so semantic similarity is unavailable in most tests here.
"""

import math
from datetime import datetime

import numpy as np
import pytest

import recommendation_engine as engine


def ids_of(results):
    return [engine.get_id(item) for item in results]


# ============================================================
# 1. BEHAVIOUR THAT ALREADY WORKS
# ============================================================

class TestBasicPipeline:

    def test_no_student_returns_empty_list(self, events):
        assert engine.get_recommendations({}, events) == []

    def test_no_events_returns_empty_list(self, student):
        assert engine.get_recommendations(student, []) == []

    def test_non_dict_events_are_skipped(self, student, events):
        mixed = events + ["not-an-event", None, 42]
        results = engine.get_recommendations(student, mixed, top_k=10)
        assert len(results) == len(events)

    def test_top_k_is_respected_and_ranks_are_sequential(self, student, events):
        results = engine.get_recommendations(student, events, top_k=2)
        assert len(results) == 2
        assert [item["rank"] for item in results] == [1, 2]

    def test_scores_are_between_0_and_100(self, student, events):
        results = engine.get_recommendations(student, events, top_k=10)
        for item in results:
            assert 0.0 <= item["matchScore"] <= 100.0
            for value in item["breakdown"].values():
                if value is not None:
                    assert 0.0 <= value <= 100.0

    def test_matching_event_ranks_above_unrelated_event(self, student, events):
        results = engine.get_recommendations(student, events, top_k=3)
        assert ids_of(results)[0] == "e1"          # AI Hackathon
        assert ids_of(results)[-1] != "e1"

    def test_without_trained_model_method_is_hybrid_weighted(self, student, events):
        results = engine.get_recommendations(student, events, top_k=3)
        assert all(
            item["recommendation_model"] == "Hybrid Weighted Ranking"
            for item in results
        )
        assert all(item["mlp_score"] is None for item in results)

    def test_every_result_has_at_least_one_reason(self, student, events):
        results = engine.get_recommendations(student, events, top_k=3)
        assert all(len(item["reasons"]) >= 1 for item in results)

    def test_hybrid_weights_sum_to_one(self):
        total = (
            engine.CONTENT_WEIGHT
            + engine.SEMANTIC_WEIGHT
            + engine.FEEDBACK_WEIGHT
            + engine.TIMETABLE_WEIGHT
            + engine.AVAILABILITY_WEIGHT
            + engine.CONTEXT_WEIGHT
        )
        assert total == pytest.approx(1.0)


class TestColdStart:
    """Cold start must never crash and must still return recommendations."""

    def test_new_student_with_only_a_year(self, events):
        sparse_student = {"student_id": "new", "year": "2"}
        results = engine.get_recommendations(sparse_student, events, top_k=3)
        assert len(results) == 3

    def test_new_student_with_empty_profile_lists(self, events):
        empty_profile = {
            "student_id": "new",
            "interests": [],
            "skills": [],
            "career_goal": "",
            "preferred_domains": [],
            "year": "",
        }
        results = engine.get_recommendations(empty_profile, events, top_k=3)
        assert len(results) == 3

    def test_new_event_without_any_interaction_history(self, student):
        brand_new_event = {
            "_id": "new-event",
            "title": "Robotics Bootcamp",
            "description": "Hands-on robotics with Python.",
            "category": "Workshop",
            "skills": ["python"],
            "capacity": 40,
        }
        results = engine.get_recommendations(student, [brand_new_event])
        assert ids_of(results) == ["new-event"]

    def test_event_with_missing_fields_does_not_crash(self, student):
        bare_event = {"_id": "bare", "title": "Mystery Event"}
        results = engine.get_recommendations(student, [bare_event])
        assert ids_of(results) == ["bare"]

    def test_empty_feedback_and_timetable_are_accepted(self, student, events):
        results = engine.get_recommendations(
            student, events, feedback={}, timetable=None
        )
        assert len(results) == len(events)


class TestTimeParsing:

    @pytest.mark.parametrize(
        "text, expected",
        [
            ("09:30", 9 * 60 + 30),
            ("14:00", 14 * 60),
            ("9:30 AM", 9 * 60 + 30),
            ("2 PM", 14 * 60),
            ("12:00 AM", 0),
            ("12:00 PM", 12 * 60),
        ],
    )
    def test_supported_formats(self, text, expected):
        assert engine.parse_time(text) == expected

    @pytest.mark.parametrize("text", [None, "", "not a time", "25:99:99x"])
    def test_unparseable_values_return_none(self, text):
        assert engine.parse_time(text) is None


class TestMetrics:
    """Small hand-calculated examples for the metric functions."""

    recommended = ["a", "b", "c"]
    relevant = ["a", "c"]

    def test_precision_at_k(self):
        assert engine.precision_at_k(self.recommended, self.relevant, 3) == (
            pytest.approx(2 / 3)
        )

    def test_recall_at_k(self):
        assert engine.recall_at_k(self.recommended, self.relevant, 3) == (
            pytest.approx(1.0)
        )

    def test_average_precision_at_k(self):
        # hits at rank 1 (precision 1/1) and rank 3 (precision 2/3)
        expected = (1.0 + 2 / 3) / 2
        assert engine.average_precision_at_k(
            self.recommended, self.relevant, 3
        ) == pytest.approx(expected)

    def test_ndcg_at_k(self):
        dcg = 1.0 + 1.0 / math.log2(4)
        ideal = 1.0 + 1.0 / math.log2(3)
        assert engine.ndcg_at_k(
            self.recommended, self.relevant, 3
        ) == pytest.approx(dcg / ideal)

    def test_metrics_with_no_relevant_items_are_zero(self):
        assert engine.recall_at_k(["a"], [], 1) == 0.0
        assert engine.ndcg_at_k(["a"], [], 1) == 0.0
        assert engine.average_precision_at_k(["a"], [], 1) == 0.0


# ============================================================
# 2. TIMETABLE (real saved-document shape)
# ============================================================

class TestTimetable:

    def test_class_overlap_is_a_hard_conflict(self, student, events, timetable_doc):
        # e3 is Monday 11:00 AM - 1:00 PM, the class is Monday 10:50 - 11:45
        scored = engine.score_event(student, events[2], timetable=timetable_doc)
        assert scored["schedule_status"] == "conflict"
        assert scored["timetable_score"] == 0.0

    def test_conflicting_event_is_still_recommended_but_flagged(
        self, student, events, timetable_doc
    ):
        results = engine.get_recommendations(
            student, events, timetable=timetable_doc, top_k=10
        )
        assert {"e1", "e2", "e3"} <= set(ids_of(results))

        e3 = next(item for item in results if item["_id"] == "e3")
        assert e3["schedule_status"] == "conflict"
        assert e3["schedule_conflict"] is True
        assert e3["schedule_detail"].startswith("overlaps")

        e1 = next(item for item in results if item["_id"] == "e1")
        assert e1["schedule_conflict"] is False

    def test_the_schedule_never_changes_the_percentage(
        self, student, events, timetable_doc
    ):
        for event in events:
            without = engine.score_event(student, event, timetable=None)
            with_timetable = engine.score_event(
                student, event, timetable=timetable_doc
            )
            assert with_timetable["matchScore"] == without["matchScore"]

    def test_timetable_is_not_listed_as_a_scoring_signal(
        self, student, events, timetable_doc
    ):
        scored = engine.score_event(student, events[0], timetable=timetable_doc)
        assert "timetable" not in scored["signals_used"]
        assert "timetable" not in scored["signal_weights"]

    def test_conflicts_can_be_hidden_by_a_setting(
        self, student, events, timetable_doc, monkeypatch
    ):
        monkeypatch.setattr(engine, "HIDE_TIMETABLE_CONFLICTS", True)
        results = engine.get_recommendations(
            student, events, timetable=timetable_doc, top_k=10
        )
        assert "e3" not in ids_of(results)
        assert {"e1", "e2"} <= set(ids_of(results))

    def test_free_day_fits_timetable_and_says_so(self, student, events, timetable_doc):
        # e1 is Friday, no classes saved on Friday
        scored = engine.score_event(student, events[0], timetable=timetable_doc)
        assert scored["schedule_status"] == "free"
        assert scored["timetable_score"] == 100.0

        results = engine.get_recommendations(
            student, events, timetable=timetable_doc, top_k=10
        )
        e1 = next(item for item in results if item["_id"] == "e1")
        assert "Fits your timetable" in e1["reasons"]

    def test_no_timetable_is_unknown_not_free(self, student, events):
        for timetable in (None, {}, []):
            scored = engine.score_event(student, events[0], timetable=timetable)
            assert scored["schedule_status"] == "unknown"
            assert scored["schedule_conflict"] is False
            assert "timetable" not in scored["signals_used"]

    def test_unknown_timetable_never_claims_to_fit(self, student, events):
        results = engine.get_recommendations(student, events, top_k=10)
        assert all("Fits your timetable" not in item["reasons"] for item in results)

    def test_weekend_event_is_unknown_because_timetable_has_weekdays_only(
        self, student, events, timetable_doc
    ):
        scored = engine.score_event(student, events[1], timetable=timetable_doc)
        assert scored["schedule_status"] == "unknown"

    def test_event_without_reliable_time_is_unknown_and_kept(
        self, student, timetable_doc
    ):
        event = {"_id": "x", "title": "Open Day", "date": "2099-11-23"}
        results = engine.get_recommendations(student, [event], timetable=timetable_doc)
        assert ids_of(results) == ["x"]
        assert results[0]["schedule_status"] == "unknown"

    def test_break_overlap_is_soft_not_a_conflict(self, student, timetable_doc):
        # Thursday lunch 13:00 - 14:00
        event = {
            "_id": "lunch-talk", "title": "Lunch Talk", "date": "2099-11-19",
            "time": "1:00 PM – 2:00 PM",
        }
        results = engine.get_recommendations(student, [event], timetable=timetable_doc)
        assert ids_of(results) == ["lunch-talk"]
        assert results[0]["schedule_status"] == "tight"

    def test_buffer_time_makes_the_status_tight(self, student, timetable_doc):
        # Monday class ends 11:45; event 12:00 is inside the 30 min buffer
        event = {
            "_id": "close", "title": "Close", "date": "2099-11-23",
            "time": "12:00 PM – 1:00 PM",
        }
        scored = engine.score_event(student, event, timetable=timetable_doc)
        assert scored["schedule_status"] == "tight"
        assert 0.0 < scored["timetable_score"] < 100.0


# ============================================================
# 3. AVAILABILITY, EXPIRY AND ALREADY-JOINED EVENTS
# ============================================================

class TestEligibility:

    def test_availability_unknown_without_registered_count(self, student, events):
        assert "registered" not in events[0]
        scored = engine.score_event(student, events[0])
        assert "availability" in scored["signals_unavailable"]

    def test_availability_used_when_registered_count_is_supplied(self, student, events):
        event = dict(events[0], registered=40)
        scored = engine.score_event(student, event)
        assert "availability" in scored["signals_used"]
        assert scored["availability_score"] == pytest.approx(60.0)

    def test_full_event_is_not_recommended(self, student, events):
        full = dict(events[0], registered=100)
        results = engine.get_recommendations(student, [full, events[1]], top_k=10)
        assert "e1" not in ids_of(results)

    def test_expired_event_is_not_recommended(self, student, events):
        past = dict(events[0], date="2020-01-01")
        results = engine.get_recommendations(student, [past, events[1]], top_k=10)
        assert "e1" not in ids_of(results)

    def test_event_with_unreadable_date_is_kept(self, student, events):
        odd = dict(events[0], date="sometime in November")
        results = engine.get_recommendations(student, [odd], top_k=10)
        assert ids_of(results) == ["e1"]

    def test_today_event_expires_only_after_its_end_time(self, student, events):
        event = dict(events[0], date="2026-10-13", time="10:00 AM – 1:00 PM")
        before = datetime(2026, 10, 13, 12, 0)
        after = datetime(2026, 10, 13, 13, 30)
        assert ids_of(engine.get_recommendations(student, [event], now=before)) == ["e1"]
        assert engine.get_recommendations(student, [event], now=after) == []

    def test_already_registered_event_is_not_recommended(self, student, events):
        results = engine.get_recommendations(
            student, events, feedback={"registered_ids": ["e1"]}, top_k=10
        )
        assert "e1" not in ids_of(results)

    def test_already_attended_event_is_not_recommended(self, student, events):
        results = engine.get_recommendations(
            student, events, feedback={"attended_ids": ["e1"]}, top_k=10
        )
        assert "e1" not in ids_of(results)

    def test_saved_event_is_still_recommended_with_an_honest_reason(
        self, student, events
    ):
        results = engine.get_recommendations(
            student, events, feedback={"saved_ids": ["e1"]}, top_k=10
        )
        e1 = next(item for item in results if item["_id"] == "e1")
        assert "feedback" in e1["signals_used"]
        assert "You saved this event" in e1["reasons"]


# ============================================================
# 4. SIGNALS USED AND ADAPTIVE WEIGHTS
# ============================================================

class TestAdaptiveWeights:

    def test_weights_used_always_sum_to_one(self, student, events, timetable_doc):
        for kwargs in ({}, {"timetable": timetable_doc},
                       {"feedback": {"saved_ids": ["e1"]}}):
            scored = engine.score_event(student, events[0], **kwargs)
            assert sum(scored["signal_weights"].values()) == pytest.approx(1.0, abs=1e-3)

    def test_missing_signals_are_not_counted_as_zero(self):
        scores = {"content": 80.0, "semantic": 0.0, "feedback": 0.0,
                  "timetable": 50.0, "availability": 50.0, "context": 50.0}
        only_content = {"content": True}
        value, weights = engine.calculate_adaptive_hybrid_score(scores, only_content)
        assert value == pytest.approx(80.0)
        assert weights == {"content": 1.0}

    def test_signal_is_dropped_when_unavailable(self, student, events):
        scored = engine.score_event(student, events[0])
        assert "semantic" in scored["signals_unavailable"]
        assert "feedback" in scored["signals_unavailable"]
        # without the semantic model, the keyword fallback takes its place
        assert scored["signals_used"] == ["content", "lexical"]

    def test_new_student_without_history_gets_no_feedback_signal(self, student, events):
        results = engine.get_recommendations(student, events, feedback={})
        assert all("feedback" not in item["signals_used"] for item in results)

    def test_semantic_signal_is_used_when_a_model_is_available(
        self, student, events, monkeypatch
    ):
        class FakeModel:
            def encode(self, texts, normalize_embeddings=True):
                return np.array([[1.0, 0.0] for _ in texts])

        monkeypatch.setattr(engine, "get_embedding_model", lambda: FakeModel())

        scored = engine.score_event(student, events[0])
        assert "semantic" in scored["signals_used"]
        assert scored["semantic_score"] > 90.0

    def test_hybrid_function_returns_a_score(self):
        assert engine.calculate_hybrid_score(100, 100, 100, 100, 100, 100) == pytest.approx(100.0)


# ============================================================
# 5. HONEST METADATA
# ============================================================

def test_algorithm_info_does_not_claim_an_untrained_mlp():
    methods = " ".join(engine.RECOMMENDATION_ALGORITHM["methods"]).lower()
    assert "mlp" not in methods


def test_recommending_does_not_print_to_stdout(student, events, capsys):
    engine.get_recommendations(student, events, top_k=3)
    assert capsys.readouterr().out == ""


def test_engine_survives_a_failing_model_loader(student, events, monkeypatch):
    """A blocked DLL / failed download must fall back, never crash."""
    monkeypatch.setattr(engine, "get_embedding_model", lambda: None)
    results = engine.get_recommendations(student, events, top_k=3)
    assert len(results) == 3


# The real loader, captured at import time (before conftest replaces it).
REAL_GET_EMBEDDING_MODEL = engine.get_embedding_model


def test_real_loader_returns_none_when_the_model_cannot_load(monkeypatch):
    """Simulates the Windows 'Application Control' / failed-download case."""

    class BrokenModel:
        def __init__(self, *args, **kwargs):
            raise OSError("An Application Control policy has blocked this file.")

    monkeypatch.setattr(engine, "SENTENCE_TRANSFORMERS_AVAILABLE", True)
    monkeypatch.setattr(engine, "SentenceTransformer", BrokenModel, raising=False)
    monkeypatch.setattr(engine, "_embedding_model", None)
    monkeypatch.setattr(engine, "_embedding_model_failed", False)

    assert REAL_GET_EMBEDDING_MODEL() is None
    # the failure is remembered, so later calls do not retry
    assert engine._embedding_model_failed is True
    assert REAL_GET_EMBEDDING_MODEL() is None


def test_semantic_model_can_be_switched_off_by_environment_variable():
    """DISABLE_SEMANTIC_MODEL=true must skip the slow torch/transformers import."""
    import os
    import subprocess
    import sys

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    code = (
        "import sys, recommendation_engine as e; "
        "print(e.SENTENCE_TRANSFORMERS_AVAILABLE, e.get_embedding_model(), "
        "'sentence_transformers' in sys.modules)"
    )

    env = dict(os.environ, DISABLE_SEMANTIC_MODEL="true")
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=backend_dir, env=env, capture_output=True, text=True, timeout=60,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "False None False"



# ============================================================
# 6. KEYWORD FALLBACK (used only when the semantic model is unavailable)
# ============================================================

@pytest.fixture
def cyber_student():
    """Like the real student: interests/domains written as 'Cyber Security'."""
    return {
        "student_id": "s9",
        "department": "CSE",
        "year": "1",
        "interests": ["Cyber Security", "UI/UX Design", "Cloud Computing"],
        "skills": ["Python", "MongoDB", "SQL"],
        "career_goal": "App Developer, Higher Studies",
        "preferred_domains": ["Cyber Security"],
    }


@pytest.fixture
def cyber_events():
    return [
        {"_id": "c1", "title": "CyberShield 2026",
         "description": "A cybersecurity competition for students.",
         "category": "Other", "skills": [], "date": "2099-11-20"},
        {"_id": "c2", "title": "AI & Cybersecurity Startup Challenge 2026",
         "description": "Pitch ideas that protect systems.",
         "category": "Other", "skills": [], "date": "2099-11-21"},
        {"_id": "c3", "title": "AI-Powered Web Development Workshop",
         "description": "Build web apps with Python and MongoDB.",
         "category": "Technical Workshops", "skills": ["Python", "MongoDB"],
         "date": "2099-11-22"},
        {"_id": "c4", "title": "Annual Dance Night",
         "description": "Music, dance and food.",
         "category": "Cultural", "skills": [], "date": "2099-11-23"},
    ]


class TestLexicalFallback:

    def test_cybersecurity_events_no_longer_score_zero(self, cyber_student, cyber_events):
        results = engine.get_recommendations(cyber_student, cyber_events, top_k=10)
        by_id = {item["_id"]: item for item in results}
        assert by_id["c1"]["matchScore"] > 0
        assert by_id["c2"]["matchScore"] > 0
        assert by_id["c3"]["matchScore"] > 0

    def test_unrelated_event_scores_below_the_relevant_ones(self, cyber_student, cyber_events):
        results = engine.get_recommendations(cyber_student, cyber_events, top_k=10)
        by_id = {item["_id"]: item for item in results}
        assert by_id["c4"]["matchScore"] < by_id["c1"]["matchScore"]
        assert by_id["c4"]["matchScore"] < by_id["c3"]["matchScore"]

    def test_compound_words_match_but_short_words_do_not(self):
        words = engine._tokens("cybershield 2026 application")
        assert engine._token_matches("cyber", words)         # inside "cybershield"
        assert engine._token_matches("security", ["cybersecurity"])
        assert not engine._token_matches("app", words)       # too short to match
        assert not engine._token_matches("web", ["website"])

    def test_fallback_is_labelled_lexical_never_semantic(self, cyber_student, cyber_events):
        results = engine.get_recommendations(cyber_student, cyber_events, top_k=10)
        for item in results:
            assert "lexical" in item["signals_used"]
            assert "semantic" not in item["signals_used"]
            assert "Semantically similar to your profile" not in item["reasons"]

    def test_reason_matches_the_signal_used(self, cyber_student, cyber_events):
        results = engine.get_recommendations(cyber_student, cyber_events, top_k=10)
        c1 = next(item for item in results if item["_id"] == "c1")
        assert "Mentions topics from your profile" in c1["reasons"]

    def test_semantic_and_lexical_never_count_together(
        self, cyber_student, cyber_events, monkeypatch
    ):
        class FakeModel:
            def encode(self, texts, normalize_embeddings=True):
                return np.array([[1.0, 0.0] for _ in texts])

        monkeypatch.setattr(engine, "get_embedding_model", lambda: FakeModel())

        scored = engine.score_event(cyber_student, cyber_events[0])
        assert "semantic" in scored["signals_used"]
        assert "lexical" not in scored["signals_used"]

    def test_empty_profile_has_no_lexical_signal(self, cyber_events):
        scored = engine.score_event({"student_id": "new"}, cyber_events[0])
        assert "lexical" in scored["signals_unavailable"]
        assert scored["lexical_score"] == 0.0

    def test_lexical_score_is_between_0_and_100(self, cyber_student, cyber_events):
        for event in cyber_events:
            assert 0.0 <= engine.calculate_lexical_score(cyber_student, event) <= 100.0



# ============================================================
# 7. YOUR REAL CASE: every upcoming event clashes with a class
# ============================================================

def test_events_that_clash_with_classes_still_get_a_percentage(cyber_student):
    """
    Real situation from the dashboard: all future events overlap a class.
    They must still be recommended, ranked by skills/interests/goals, with
    the schedule shown only as a flag.
    """
    timetable = {
        "preferences": {"bufferTime": 30},
        "timetable": {
            "monday": [], "tuesday": [
                {"subject": "cyber security", "type": "lecture",
                 "startTime": "08:50", "endTime": "09:45"}],
            "wednesday": [], "thursday": [], "friday": [
                {"subject": "genetic AI", "type": "lecture",
                 "startTime": "10:40", "endTime": "11:30"}],
        },
    }
    events = [
        {"_id": "h", "title": "HACKinDAY", "description": "24/7 HACKTHON",
         "category": "Technical", "skills": ["AI", "CYBER", "PYTHON"],
         "date": "2099-11-20", "time": "11:00 AM - 1:00 PM"},          # Friday, clashes
        {"_id": "w", "title": "AI-Powered Web Development Workshop",
         "description": "Build intelligent web apps.",
         "category": "Workshop", "skills": ["Python", "FastAPI"],
         "date": "2099-11-17", "time": "09:00 AM - 12:00 PM"},         # Tuesday, clashes
        {"_id": "d", "title": "Annual Dance Night", "description": "Music and dance",
         "category": "Cultural", "skills": [],
         "date": "2099-11-18", "time": "6:00 PM - 9:00 PM"},           # Wednesday, free
    ]

    results = engine.get_recommendations(cyber_student, events, timetable=timetable)
    by_id = {item["_id"]: item for item in results}

    assert set(by_id) == {"h", "w", "d"}                   # nothing hidden
    assert by_id["h"]["schedule_conflict"] and by_id["w"]["schedule_conflict"]
    assert not by_id["d"]["schedule_conflict"]
    assert by_id["h"]["matchScore"] > 0 and by_id["w"]["matchScore"] > 0
    # ranked by relevance, not by free time: the free dance event is last
    assert ids_of(results)[-1] == "d"