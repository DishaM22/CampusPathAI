"""
Shared pytest setup for the recommendation engine tests.

1. Makes `backend/` importable so `import recommendation_engine` works.
2. Disables the Sentence-BERT model for every test. This keeps the tests
   fast, deterministic and independent of internet access / model download.
   With the model disabled, semantic similarity is 0.0 for every event, so
   these tests exercise the rule-based parts of the engine only.
"""

import os
import sys

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import recommendation_engine as engine  # noqa: E402


@pytest.fixture(autouse=True)
def disable_embedding_model(monkeypatch):
    monkeypatch.setattr(engine, "get_embedding_model", lambda: None)


@pytest.fixture
def student():
    """A fully filled-in student, shaped like the merged student + profile."""
    return {
        "student_id": "s1",
        "department": "CSE",
        "year": "4",
        "interests": ["artificial intelligence", "hackathon"],
        "skills": ["python", "machine learning"],
        "career_goal": "AI Engineer",
        "preferred_domains": ["technical"],
    }


@pytest.fixture
def events():
    """
    Events shaped like the real documents in MongoDB: `date` is an ISO
    string and `time` is a range string; there is no `status` and no
    `registered` count. Dates are in 2099 so tests never expire.
    """
    return [
        {
            "_id": "e1",
            "title": "AI Hackathon",
            "description": "Build artificial intelligence solutions.",
            "category": "Hackathon",
            "organizer": "AI Club",
            "date": "2099-11-20",          # a Friday
            "time": "10:00 AM – 1:00 PM",
            "location": "Main Hall",
            "skills": ["python", "machine learning"],
            "capacity": 100,
        },
        {
            "_id": "e2",
            "title": "Cultural Fest Dance Night",
            "description": "Annual dance and music evening.",
            "category": "Cultural",
            "organizer": "Cultural Club",
            "date": "2099-11-21",          # a Saturday
            "time": "6:00 PM – 9:00 PM",
            "location": "Auditorium",
            "skills": [],
            "capacity": 300,
        },
        {
            "_id": "e3",
            "title": "Web Development Workshop",
            "description": "Learn modern frontend web development.",
            "category": "Workshop",
            "organizer": "Coding Club",
            "date": "2099-11-23",          # a Monday
            "time": "11:00 AM – 1:00 PM",
            "location": "Lab 2",
            "skills": ["react", "javascript"],
            "capacity": 50,
        },
    ]


@pytest.fixture
def timetable_doc():
    """The saved timetable document shape (see db.timetables)."""
    return {
        "student_id": "s1",
        "config": {
            "collegeStartTime": "09:00",
            "collegeEndTime": "16:15",
            "slotDuration": 60,
        },
        "preferences": {"bufferTime": 30},
        "timetable": {
            "monday": [
                {
                    "id": "b1",
                    "subject": "cyber security",
                    "courseCode": "CSE009",
                    "type": "lecture",
                    "startTime": "10:50",
                    "endTime": "11:45",
                }
            ],
            "tuesday": [],
            "wednesday": [],
            "thursday": [
                {
                    "id": "b2",
                    "subject": "lunch",
                    "type": "lunch",
                    "startTime": "13:00",
                    "endTime": "14:00",
                }
            ],
            "friday": [],
        },
    }
