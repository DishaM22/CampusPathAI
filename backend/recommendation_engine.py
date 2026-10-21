"""
recommendation_engine.py

Hybrid Event Recommendation Engine

Methods used:
1. Content-Based Filtering
2. Sentence-BERT Semantic Similarity
3. Vector Similarity / Retrieval
4. Implicit Feedback
5. Timetable-Aware Ranking
6. Availability-Aware Ranking
7. Context-Aware Ranking
8. MLP Neural Ranking
9. Diversity Re-ranking
10. Precision@K, Recall@K, NDCG@K, MAP@K
"""


from __future__ import annotations

import logging
import math
import os
import re
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

import numpy as np

import recommender_schedule as schedule

logger = logging.getLogger(__name__)

# ============================================================
# OPTIONAL ML IMPORTS
# ============================================================

# Set DISABLE_SEMANTIC_MODEL=true in backend/.env to skip the semantic model
# completely. Importing sentence-transformers (and PyTorch) can take many
# seconds, even when it ends in an error, so on a machine where it cannot
# work (for example Windows blocking torch DLLs) it is better not to try.
_SEMANTIC_DISABLED = os.getenv("DISABLE_SEMANTIC_MODEL", "").strip().lower() in (
    "1", "true", "yes", "on"
)

if _SEMANTIC_DISABLED:
    SentenceTransformer = None
    SENTENCE_TRANSFORMERS_AVAILABLE = False
else:
    try:
        from sentence_transformers import SentenceTransformer
        SENTENCE_TRANSFORMERS_AVAILABLE = True
    except Exception:  # ImportError, or OSError when Windows blocks a DLL
        SentenceTransformer = None
        SENTENCE_TRANSFORMERS_AVAILABLE = False


try:
    SKLEARN_AVAILABLE = True
except ImportError:
    cosine_similarity = None
    MLPRegressor = None
    SKLEARN_AVAILABLE = False


# ============================================================
# CONFIGURATION
# ============================================================

SEMANTIC_MODEL_NAME = os.getenv(
    "RECOMMENDATION_SEMANTIC_MODEL",
    "all-MiniLM-L6-v2"
)

TOP_K_DEFAULT = 10

# Hybrid weights
CONTENT_WEIGHT = 0.30
SEMANTIC_WEIGHT = 0.30
FEEDBACK_WEIGHT = 0.15
TIMETABLE_WEIGHT = 0.10
AVAILABILITY_WEIGHT = 0.10
CONTEXT_WEIGHT = 0.05

# Timetable handling (product decision):
#   * A clash with a class is shown as a "Schedule conflict" label, but the
#     event is still recommended, and the match percentage is based on
#     skills, interests, career goals, feedback etc. - NOT on the schedule.
#   * Set HIDE_TIMETABLE_CONFLICTS=true in .env to remove clashing events instead.
#   * Set TIMETABLE_AFFECTS_SCORE=true in .env to let free/busy change the score.
HIDE_TIMETABLE_CONFLICTS = os.getenv(
    "HIDE_TIMETABLE_CONFLICTS", "").strip().lower() in ("1", "true", "yes", "on")
TIMETABLE_AFFECTS_SCORE = os.getenv(
    "TIMETABLE_AFFECTS_SCORE", "").strip().lower() in ("1", "true", "yes", "on")

# Keyword-based fallback that is used ONLY when the semantic model is not
# available. It takes the semantic signal's place, so the two never count
# together (see score_event).
LEXICAL_WEIGHT = 0.30

# How many matching profile phrases count as a "full" text match (100).
TEXT_FULL_MATCH_PHRASES = 3.0

# MLP
MLP_MIN_TRAINING_SAMPLES = 10


# ============================================================
# MODEL CACHE
# ============================================================

_embedding_model = None
_embedding_model_failed = False

# Two dashboard requests arriving together used to load the model twice.
_model_load_lock = threading.Lock()

# Text -> embedding vector. Student/event text rarely changes, so most
# requests need no model work at all after the first one.
_EMBEDDING_CACHE: Dict[str, Any] = {}
_EMBEDDING_CACHE_MAX = 5000
_embedding_cache_lock = threading.Lock()


def get_embedding_model():
    """
    Load Sentence-BERT lazily.

    Returns None (and remembers the failure) if the library or the model
    cannot be loaded, so the engine falls back to its other signals instead
    of crashing or retrying on every event.
    """

    global _embedding_model, _embedding_model_failed

    if not SENTENCE_TRANSFORMERS_AVAILABLE or _embedding_model_failed:
        return None

    if _embedding_model is None:
        with _model_load_lock:
            # Another request may have finished loading while we waited
            if _embedding_model is None and not _embedding_model_failed:
                try:
                    _embedding_model = SentenceTransformer(
                        SEMANTIC_MODEL_NAME
                    )
                except Exception as error:
                    _embedding_model_failed = True
                    logger.warning(
                        "Semantic model unavailable, continuing without it: %s",
                        error,
                    )
                    return None

    return _embedding_model


def embed_texts(model, texts):
    """
    Normalised embeddings for `texts`, one row per text, in order.
    Texts seen before come from the cache; only new ones go to the model.
    """
    texts = list(texts)

    with _embedding_cache_lock:
        known = {
            text: _EMBEDDING_CACHE[text]
            for text in texts
            if text in _EMBEDDING_CACHE
        }

    missing = [
        text for text in dict.fromkeys(texts) if text not in known
    ]

    if missing:
        vectors = model.encode(missing, normalize_embeddings=True)
        fresh = dict(zip(missing, vectors))

        with _embedding_cache_lock:
            if len(_EMBEDDING_CACHE) + len(fresh) > _EMBEDDING_CACHE_MAX:
                _EMBEDDING_CACHE.clear()
            _EMBEDDING_CACHE.update(fresh)

        known.update(fresh)

    return np.array([known[text] for text in texts])


# ============================================================
# BASIC UTILITIES
# ============================================================

def safe_number(value: Any, default: float = 0.0) -> float:
    """
    Safely convert a value to float.
    """

    try:
        if value is None:
            return default

        number = float(value)

        if math.isnan(number) or math.isinf(number):
            return default

        return number

    except (TypeError, ValueError):
        return default


def clamp_score(
    value: Any,
    minimum: float = 0.0,
    maximum: float = 100.0
) -> float:
    """
    Clamp a score to a specified range.
    """

    value = safe_number(value, minimum)

    return max(
        minimum,
        min(maximum, value)
    )


def normalize_text(value: Any) -> str:
    """
    Convert text to normalized lowercase form.
    """

    if value is None:
        return ""

    if isinstance(value, list):
        value = " ".join(
            str(item) for item in value
        )

    if isinstance(value, dict):
        value = " ".join(
            str(v) for v in value.values()
        )

    return " ".join(
        str(value)
        .lower()
        .strip()
        .split()
    )


def to_list(value: Any) -> List[str]:
    """
    Convert strings, lists or tuples into a normalized list.
    """

    if value is None:
        return []

    if isinstance(value, list):
        return [
            normalize_text(item)
            for item in value
            if normalize_text(item)
        ]

    if isinstance(value, tuple):
        return [
            normalize_text(item)
            for item in value
            if normalize_text(item)
        ]

    if isinstance(value, str):

        if "," in value:
            parts = value.split(",")

        elif "|" in value:
            parts = value.split("|")

        else:
            parts = [value]

        return [
            normalize_text(item)
            for item in parts
            if normalize_text(item)
        ]

    return [normalize_text(value)]


def get_id(item: Dict[str, Any]) -> str:
    """
    Get event/student identifier.
    """

    value = (
        item.get("_id")
        or item.get("id")
        or item.get("event_id")
        or item.get("eventId")
    )

    return str(value) if value is not None else ""


# ============================================================
# STUDENT FEATURE EXTRACTION
# ============================================================

def get_student_skills(student: Dict[str, Any]) -> List[str]:

    return to_list(
        student.get("skills")
        or student.get("skill")
        or student.get("technicalSkills")
    )


def get_student_interests(student: Dict[str, Any]) -> List[str]:

    return to_list(
        student.get("interests")
        or student.get("interest")
        or student.get("domains")
        or student.get("preferred_domains")
        or student.get("preferredDomains")
    )


def get_student_career_goals(
    student: Dict[str, Any]
) -> List[str]:

    return to_list(
        student.get("career_goal")
        or student.get("careerGoal")
        or student.get("career")
        or student.get("goal")
    )


def get_student_categories(
    student: Dict[str, Any]
) -> List[str]:

    return to_list(
        student.get("categories")
        or student.get("category")
        or student.get("domains")
        or student.get("preferred_domains")
        or student.get("preferredDomains")
    )


# ============================================================
# EVENT FEATURE EXTRACTION
# ============================================================

def get_event_skills(event: Dict[str, Any]) -> List[str]:

    return to_list(
        event.get("skills")
        or event.get("required_skills")
        or event.get("requiredSkills")
        or event.get("skill")
    )


def get_event_categories(
    event: Dict[str, Any]
) -> List[str]:

    return to_list(
        event.get("category")
        or event.get("categories")
        or event.get("domain")
        or event.get("type")
    )


# ============================================================
# TEXT REPRESENTATION
# ============================================================

def student_text(student: Dict[str, Any]) -> str:
    """
    Build semantic representation of a student.
    """

    skills = get_student_skills(student)
    interests = get_student_interests(student)
    career = get_student_career_goals(student)
    categories = get_student_categories(student)

    values = [
        "skills: " + " ".join(skills),
        "interests: " + " ".join(interests),
        "career goals: " + " ".join(career),
        "preferred domains: " + " ".join(categories),
        "department: " + normalize_text(
            student.get("department")
        ),
        "year: " + normalize_text(
            student.get("year")
        ),
        "branch: " + normalize_text(
            student.get("branch")
        ),
    ]

    return " ".join(
        value for value in values
        if value.strip()
    )


def event_text(event: Dict[str, Any]) -> str:
    """
    Build semantic representation of an event.
    """

    skills = get_event_skills(event)
    categories = get_event_categories(event)

    values = [
        "title: " + normalize_text(
            event.get("title")
        ),
        "description: " + normalize_text(
            event.get("description")
        ),
        "category: " + " ".join(categories),
        "skills: " + " ".join(skills),
        "organizer: " + normalize_text(
            event.get("organizer")
            or event.get("club")
            or event.get("club_name")
        ),
        "location: " + normalize_text(
            event.get("location")
        ),
    ]

    return " ".join(
        value for value in values
        if value.strip()
    )


# ============================================================
# CONTENT-BASED FILTERING
# ============================================================

def count_matches(
    student_values: Sequence[str],
    event_values: Sequence[str]
) -> int:
    """
    Count overlapping student/event features.
    """

    student_values = {
        normalize_text(value)
        for value in student_values
        if normalize_text(value)
    }

    event_values = {
        normalize_text(value)
        for value in event_values
        if normalize_text(value)
    }

    if not student_values or not event_values:
        return 0

    matches = 0

    for student_value in student_values:

        for event_value in event_values:

            if (
                student_value == event_value
                or student_value in event_value
                or event_value in student_value
            ):
                matches += 1
                break

    return matches


def match_percentage(
    student_values: Sequence[str],
    event_values: Sequence[str]
) -> float:
    """
    Calculate percentage overlap.
    """

    student_values = {
        normalize_text(value)
        for value in student_values
        if normalize_text(value)
    }

    if not student_values:
        return 0.0

    matches = count_matches(
        list(student_values),
        event_values
    )

    return clamp_score(
        (matches / len(student_values)) * 100
    )


def calculate_skill_match(
    student: Dict[str, Any],
    event: Dict[str, Any]
) -> float:

    return match_percentage(
        get_student_skills(student),
        get_event_skills(event)
    )


def calculate_interest_match(
    student: Dict[str, Any],
    event: Dict[str, Any]
) -> float:

    return match_percentage(
        get_student_interests(student),
        get_event_categories(event)
        + get_event_skills(event)
    )


def calculate_career_match(
    student: Dict[str, Any],
    event: Dict[str, Any]
) -> float:

    return match_percentage(
        get_student_career_goals(student),
        get_event_categories(event)
        + get_event_skills(event)
        + [
            normalize_text(event.get("title")),
            normalize_text(event.get("description")),
        ]
    )


def calculate_category_match(
    student: Dict[str, Any],
    event: Dict[str, Any]
) -> float:

    return match_percentage(
        get_student_categories(student),
        get_event_categories(event)
    )


def calculate_content_score(
    student: Dict[str, Any],
    event: Dict[str, Any]
) -> float:
    """
    Content-based recommendation score.

    Weight:
    Skills       = 35%
    Interests    = 30%
    Career       = 20%
    Category     = 15%
    """

    skill_score = calculate_skill_match(
        student,
        event
    )

    interest_score = calculate_interest_match(
        student,
        event
    )

    career_score = calculate_career_match(
        student,
        event
    )

    category_score = calculate_category_match(
        student,
        event
    )

    score = (
        skill_score * 0.35
        + interest_score * 0.30
        + career_score * 0.20
        + category_score * 0.15
    )

    return clamp_score(score)


# ============================================================
# SENTENCE-BERT SEMANTIC SIMILARITY
# ============================================================

def calculate_semantic_similarity(
    student: Dict[str, Any],
    event: Dict[str, Any]
) -> float:
    """
    Sentence-BERT cosine similarity.

    Returns a value between 0 and 100.
    """

    model = get_embedding_model()

    if model is None:
        return 0.0

    student_text_value = student_text(student)
    event_text_value = event_text(event)

    if not student_text_value or not event_text_value:
        return 0.0

    try:

        embeddings = embed_texts(
            model,
            [
                student_text_value,
                event_text_value
            ]
        )

        similarity = float(
            np.dot(
                embeddings[0],
                embeddings[1]
            )
        )

        # Cosine similarity is normally [-1, 1].
        # Convert to [0, 100].
        similarity = (
            (similarity + 1.0) / 2.0
        ) * 100.0

        return clamp_score(similarity)

    except Exception:
        return 0.0


# ============================================================
# VECTOR RETRIEVAL
# ============================================================

def vector_retrieval(
    student: Dict[str, Any],
    events: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Rank events using Sentence-BERT vector similarity.
    """

    model = get_embedding_model()

    if model is None:
        return events

    if not events:
        return []

    student_representation = student_text(student)

    event_texts = [
        event_text(event)
        for event in events
    ]

    if not student_representation:
        return events

    try:

        student_embedding = embed_texts(
            model,
            [student_representation]
        )

        event_embeddings = embed_texts(
            model,
            event_texts
        )

        similarities = np.dot(
            event_embeddings,
            student_embedding[0]
        )

        ranked = []

        for event, similarity in zip(
            events,
            similarities
        ):

            similarity = float(similarity)

            similarity_score = (
                (similarity + 1.0) / 2.0
            ) * 100.0

            updated_event = dict(event)

            updated_event[
                "vector_similarity"
            ] = similarity_score

            updated_event[
                "semantic_score"
            ] = clamp_score(
                similarity_score
            )

            ranked.append(updated_event)

        ranked.sort(
            key=lambda item: safe_number(
                item.get("semantic_score")
            ),
            reverse=True
        )

        return ranked

    except Exception:
        return events


# ============================================================
# IMPLICIT FEEDBACK
# ============================================================

def feedback_score(
    event_id: Any,
    saved_ids: Optional[Sequence[Any]] = None,
    registered_ids: Optional[Sequence[Any]] = None,
    attended_ids: Optional[Sequence[Any]] = None
) -> float:
    """
    Implicit feedback score.

    Attended  = 100
    Registered = 75
    Saved      = 45
    """

    event_id = str(event_id)

    saved_ids = {
        str(value)
        for value in (saved_ids or [])
    }

    registered_ids = {
        str(value)
        for value in (registered_ids or [])
    }

    attended_ids = {
        str(value)
        for value in (attended_ids or [])
    }

    if event_id in attended_ids:
        return 100.0

    if event_id in registered_ids:
        return 75.0

    if event_id in saved_ids:
        return 45.0

    return 0.0


def calculate_feedback_score(
    event: Dict[str, Any],
    feedback: Optional[Dict[str, Any]] = None
) -> float:

    feedback = feedback or {}

    event_id = get_id(event)

    saved_ids = (
        feedback.get("saved_ids")
        or feedback.get("saved")
        or []
    )

    registered_ids = (
        feedback.get("registered_ids")
        or feedback.get("registered")
        or []
    )

    attended_ids = (
        feedback.get("attended_ids")
        or feedback.get("attended")
        or []
    )

    return feedback_score(
        event_id,
        saved_ids,
        registered_ids,
        attended_ids
    )


# ============================================================
# TIMETABLE
# ============================================================

DAY_NAMES = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def get_day_name(value: Any) -> Optional[str]:

    if value is None:
        return None

    text = normalize_text(value)

    for name in DAY_NAMES:

        if text.startswith(name[:3]):
            return name

    return None


def parse_time(value: Any) -> Optional[int]:
    """
    Convert time to minutes after midnight.
    Supports:
    09:30
    9:30 AM
    2 PM
    14:00
    """

    if value is None:
        return None

    text = normalize_text(value)

    if not text:
        return None

    try:

        if "am" in text or "pm" in text:

            text = text.replace(" ", "")

            is_pm = text.endswith("pm")

            text = (
                text[:-2]
                .replace("am", "")
                .replace("pm", "")
            )

            if ":" in text:

                hour, minute = text.split(":", 1)

                hour = int(hour)
                minute = int(minute)

            else:

                hour = int(text)
                minute = 0

            if is_pm and hour != 12:
                hour += 12

            if not is_pm and hour == 12:
                hour = 0

            return hour * 60 + minute

        if ":" in text:

            hour, minute = text.split(":", 1)

            return (
                int(hour) * 60
                + int(minute)
            )

        return int(text) * 60

    except Exception:
        return None


def get_event_day(event: Dict[str, Any]) -> Optional[str]:

    return get_day_name(
        event.get("day")
        or event.get("dayName")
        or event.get("weekday")
    )


def event_time_range(
    event: Dict[str, Any]
) -> Tuple[Optional[int], Optional[int]]:

    start = (
        event.get("start_time")
        or event.get("startTime")
        or event.get("from_time")
        or event.get("fromTime")
        or event.get("time")
    )

    end = (
        event.get("end_time")
        or event.get("endTime")
        or event.get("to_time")
        or event.get("toTime")
    )

    start_minutes = parse_time(start)
    end_minutes = parse_time(end)

    return start_minutes, end_minutes


def has_timetable_conflict(
    event: Dict[str, Any],
    timetable: Optional[Sequence[Dict[str, Any]]]
) -> bool:

    if not timetable:
        return False

    event_day = get_event_day(event)

    event_start, event_end = event_time_range(event)

    if event_day is None or event_start is None:
        return False

    if event_end is None:
        event_end = event_start + 60

    for slot in timetable:

        slot_day = get_day_name(
            slot.get("day")
            or slot.get("dayName")
            or slot.get("weekday")
        )

        if slot_day != event_day:
            continue

        slot_start = parse_time(
            slot.get("start_time")
            or slot.get("startTime")
            or slot.get("from_time")
            or slot.get("fromTime")
        )

        slot_end = parse_time(
            slot.get("end_time")
            or slot.get("endTime")
            or slot.get("to_time")
            or slot.get("toTime")
        )

        if slot_start is None:
            continue

        if slot_end is None:
            slot_end = slot_start + 60

        overlap = (
            event_start < slot_end
            and event_end > slot_start
        )

        if overlap:
            return True

    return False


def calculate_timetable_score(
    event: Dict[str, Any],
    timetable: Optional[Sequence[Dict[str, Any]]]
) -> float:

    if not timetable:
        return 50.0

    if has_timetable_conflict(
        event,
        timetable
    ):
        return 0.0

    return 100.0


# ============================================================
# AVAILABILITY
# ============================================================

def calculate_availability_score(
    event: Dict[str, Any]
) -> float:
    """
    Availability based on remaining seats.
    """

    capacity = safe_number(
        event.get("capacity")
        or event.get("max_capacity")
        or event.get("maxCapacity")
    )

    registered = safe_number(
        event.get("registered")
        or event.get("registered_count")
        or event.get("registeredCount")
        or event.get("registrations")
    )

    seats = event.get(
        "seats_available"
    ) or event.get(
        "seatsAvailable"
    )

    if seats is not None:
        seats = safe_number(seats)

        if capacity > 0:
            return clamp_score(
                (seats / capacity) * 100
            )

        return 100.0 if seats > 0 else 0.0

    if capacity <= 0:
        return 50.0

    remaining = max(
        0.0,
        capacity - registered
    )

    return clamp_score(
        (remaining / capacity) * 100
    )


# ============================================================
# CONTEXT SCORE
# ============================================================

def calculate_context_score(
    timetable_score: float,
    availability_score: float
) -> float:
    """
    Context score combines practical constraints.
    """

    return clamp_score(
        timetable_score * 0.60
        + availability_score * 0.40
    )


# ============================================================
# HYBRID SCORE
# ============================================================

def calculate_hybrid_score(
    content_score,
    semantic_score,
    feedback_score,
    timetable_score,
    availability_score,
    context_score
):
    """
    Fixed-weight hybrid score. Kept for compatibility.
    The pipeline itself uses calculate_adaptive_hybrid_score(), which only
    counts signals that are actually available.
    """
    return clamp_score(
        CONTENT_WEIGHT * content_score
        + SEMANTIC_WEIGHT * semantic_score
        + FEEDBACK_WEIGHT * feedback_score
        + TIMETABLE_WEIGHT * timetable_score
        + AVAILABILITY_WEIGHT * availability_score
        + CONTEXT_WEIGHT * context_score
    )


# ============================================================
# MLP RANKER
# ============================================================

def build_feature_vector(
    content_score: float,
    semantic_score: float,
    feedback_score_value: float,
    timetable_score: float,
    availability_score: float,
    context_score: float
) -> List[float]:

    return [
        clamp_score(content_score) / 100.0,
        clamp_score(semantic_score) / 100.0,
        clamp_score(feedback_score_value) / 100.0,
        clamp_score(timetable_score) / 100.0,
        clamp_score(availability_score) / 100.0,
        clamp_score(context_score) / 100.0,
    ]


def train_mlp(
    training_data: Sequence[Dict[str, Any]]
):
    """
    Train MLP ranker.

    Expected format:

    [
        {
            "features": [0.8, 0.7, ...],
            "label": 1
        }
    ]
    """

    if not SKLEARN_AVAILABLE:
        return None

    if MLPRegressor is None:
        return None

    if len(training_data) < MLP_MIN_TRAINING_SAMPLES:
        return None

    X = []
    y = []

    for row in training_data:

        features = row.get("features")

        label = row.get("label")

        if not features or label is None:
            continue

        X.append(
            [
                safe_number(value)
                for value in features
            ]
        )

        y.append(
            safe_number(label)
        )

    if len(X) < MLP_MIN_TRAINING_SAMPLES:
        return None

    X = np.asarray(X, dtype=float)
    y = np.asarray(y, dtype=float)

    model = MLPRegressor(
        hidden_layer_sizes=(64, 32),
        activation="relu",
        solver="adam",
        max_iter=500,
        random_state=42,
    )

    try:

        model.fit(X, y)

        return model

    except Exception:
        return None


def predict_mlp_score(
    model,
    features: Sequence[float]
) -> Optional[float]:

    if model is None:
        return None

    try:

        prediction = model.predict(
            [list(features)]
        )[0]

        # If training labels are 0-1
        # convert them into 0-100.
        if prediction <= 1.0:
            prediction *= 100.0

        return clamp_score(
            prediction
        )

    except Exception:
        return None


# ============================================================
# EVENT SCORING
# ============================================================

# ============================================================
# SIGNAL AVAILABILITY, ELIGIBILITY AND ADAPTIVE WEIGHTS
# ============================================================

BASE_WEIGHTS: Dict[str, float] = {
    "content": CONTENT_WEIGHT,
    "semantic": SEMANTIC_WEIGHT,
    "lexical": LEXICAL_WEIGHT,
    "feedback": FEEDBACK_WEIGHT,
    "timetable": TIMETABLE_WEIGHT,
    "availability": AVAILABILITY_WEIGHT,
    "context": CONTEXT_WEIGHT,
}

# Numeric score for each timetable check result.
# UNKNOWN gets a neutral number for display only; the signal is excluded
# from the weighted score (see score_event).
if not TIMETABLE_AFFECTS_SCORE:
    BASE_WEIGHTS.pop("timetable", None)

SCHEDULE_SCORES: Dict[str, float] = {
    schedule.CONFLICT: 0.0,
    schedule.TIGHT: 60.0,
    schedule.FREE: 100.0,
    schedule.UNKNOWN: 50.0,
}



# ============================================================
# LEXICAL TEXT MATCH (fallback when the semantic model is unavailable)
# ============================================================

_TOKEN_RE = re.compile(r"[a-z0-9]+")

_STOPWORDS = frozenset({
    "and", "the", "for", "with", "from", "your", "you", "our", "are",
    "this", "that", "into", "all", "any", "new", "more", "other",
})


def _tokens(text: Any) -> List[str]:
    """Lowercase words of 3+ characters, without common filler words."""
    return [
        word
        for word in _TOKEN_RE.findall(normalize_text(text))
        if len(word) >= 3 and word not in _STOPWORDS
    ]


def _token_matches(word: str, event_words: Sequence[str]) -> bool:
    """
    A profile word matches an event word if they are equal, or if one
    contains the other and the shorter has 4+ letters. This lets
    "cyber" and "security" match "CyberShield" and "cybersecurity",
    while short words such as "app" or "web" never match by accident.
    """
    for other in event_words:
        if word == other:
            return True
        if min(len(word), len(other)) >= 4 and (
            word in other or other in word
        ):
            return True
    return False


def calculate_lexical_score(
    student: Dict[str, Any],
    event: Dict[str, Any]
) -> float:
    """
    0-100: how many of the student's interests, preferred domains, skills
    and career goals are mentioned in the event's title, description,
    category or skills.

    Each profile phrase counts by the share of its words that appear in the
    event text. TEXT_FULL_MATCH_PHRASES matching phrases give 100.
    This is plain keyword matching, NOT semantic understanding.
    """
    event_words = _tokens(" ".join([
        normalize_text(event.get("title")),
        normalize_text(event.get("description")),
        " ".join(get_event_categories(event)),
        " ".join(get_event_skills(event)),
    ]))

    if not event_words:
        return 0.0

    phrases = (
        get_student_interests(student)
        + get_student_categories(student)
        + get_student_skills(student)
        + get_student_career_goals(student)
    )

    coverage = 0.0

    for phrase in phrases:
        words = _tokens(phrase)
        if not words:
            continue
        matched = sum(1 for word in words if _token_matches(word, event_words))
        coverage += matched / len(words)

    return clamp_score(100.0 * min(1.0, coverage / TEXT_FULL_MATCH_PHRASES))


def lexical_signal_available(
    student: Dict[str, Any],
    event: Dict[str, Any]
) -> bool:
    """Only used when the semantic model is NOT available."""
    return (
        not semantic_signal_available(student, event)
        and has_profile_content(student)
        and has_event_content(event)
    )


def build_schedule_context(
    timetable: Any
) -> Tuple[List[schedule.BusySlot], int]:
    """Parse the timetable once per request: (busy slots, buffer minutes)."""
    return (
        schedule.timetable_to_busy_slots(timetable),
        schedule.get_buffer_minutes(timetable),
    )


def _id_set(feedback: Optional[Dict[str, Any]], *keys: str) -> Set[str]:
    values: List[Any] = []

    for key in keys:
        value = (feedback or {}).get(key)
        if value:
            values.extend(value)

    return {str(value) for value in values}


def collect_feedback_ids(
    feedback: Optional[Dict[str, Any]]
) -> Dict[str, Set[str]]:
    return {
        "saved": _id_set(feedback, "saved_ids", "saved"),
        "registered": _id_set(feedback, "registered_ids", "registered"),
        "attended": _id_set(feedback, "attended_ids", "attended"),
    }


def has_feedback_history(feedback: Optional[Dict[str, Any]]) -> bool:
    """A student with no saves/registrations/attendance has no feedback signal."""
    return any(collect_feedback_ids(feedback).values())


def has_profile_content(student: Dict[str, Any]) -> bool:
    """True if the student has any interests, skills, goals or domains.
    (student_text() always contains labels such as "skills:", so it cannot
    be used to test for real content.)"""
    return bool(
        get_student_skills(student)
        or get_student_interests(student)
        or get_student_career_goals(student)
        or get_student_categories(student)
    )


def has_event_content(event: Dict[str, Any]) -> bool:
    """True if the event has a title, description, category or skills."""
    return bool(
        normalize_text(event.get("title"))
        or normalize_text(event.get("description"))
        or get_event_categories(event)
        or get_event_skills(event)
    )


def semantic_signal_available(
    student: Dict[str, Any],
    event: Dict[str, Any]
) -> bool:
    return (
        get_embedding_model() is not None
        and has_profile_content(student)
        and has_event_content(event)
    )


def _event_capacity(event: Dict[str, Any]) -> float:
    return safe_number(
        event.get("capacity")
        or event.get("max_capacity")
        or event.get("maxCapacity")
    )


def _event_seats_available(event: Dict[str, Any]) -> Optional[float]:
    for key in ("seats_available", "seatsAvailable"):
        if event.get(key) is not None:
            return safe_number(event.get(key))
    return None


def _event_registered_count(event: Dict[str, Any]) -> Optional[float]:
    for key in (
        "registered", "registered_count", "registeredCount", "registrations"
    ):
        if event.get(key) is not None:
            return safe_number(event.get(key))
    return None


def is_availability_known(event: Dict[str, Any]) -> bool:
    """
    Seat availability is only meaningful when the event has a capacity AND
    we know how many seats are taken. Stored events have no registered
    count unless the API adds one, so this is often False.
    """
    if _event_capacity(event) <= 0:
        return False

    return (
        _event_seats_available(event) is not None
        or _event_registered_count(event) is not None
    )


def is_event_full(event: Dict[str, Any]) -> bool:
    capacity = _event_capacity(event)

    if capacity <= 0:
        return False

    seats = _event_seats_available(event)
    if seats is not None:
        return seats <= 0

    registered = _event_registered_count(event)
    if registered is not None:
        return registered >= capacity

    return False


def calculate_adaptive_hybrid_score(
    scores: Dict[str, float],
    available: Dict[str, bool]
) -> Tuple[float, Dict[str, float]]:
    """
    Weighted average over the signals that are actually available.

    Each available signal keeps its base weight relative to the others, and
    the weights are rescaled to sum to 1. A missing signal therefore does
    not drag every score down, and scores stay comparable between
    requests with and without (for example) the semantic model.
    """
    used = {
        name: weight
        for name, weight in BASE_WEIGHTS.items()
        if available.get(name)
    }

    total = sum(used.values())

    if total <= 0:
        return 0.0, {}

    weights = {name: weight / total for name, weight in used.items()}

    value = sum(weights[name] * scores[name] for name in weights)

    return clamp_score(value), weights


def ineligibility_reason(
    event: Dict[str, Any],
    feedback_ids: Dict[str, Set[str]],
    schedule_context: Tuple[List[schedule.BusySlot], int],
    now: Optional[datetime] = None,
) -> Optional[str]:
    """
    Returns why an event must not be recommended, or None if it may be.
    Only reliable data removes an event: unknown times never do.
    """
    event_id = get_id(event)

    if event_id and event_id in feedback_ids["attended"]:
        return "already_attended"

    if event_id and event_id in feedback_ids["registered"]:
        return "already_registered"

    if schedule.is_event_expired(event, now):
        return "expired"

    if is_event_full(event):
        return "full"

    if HIDE_TIMETABLE_CONFLICTS:
        busy_slots, buffer_minutes = schedule_context
        check = schedule.check_event_schedule(
            event, busy_slots, buffer_minutes
        )
        if check.status == schedule.CONFLICT:
            return "timetable_conflict"

    return None


# ============================================================
# EVENT SCORING
# ============================================================

def score_event(
    student: Dict[str, Any],
    event: Dict[str, Any],
    feedback: Optional[Dict[str, Any]] = None,
    timetable: Any = None,
    mlp_model=None,
    schedule_context: Optional[
        Tuple[List[schedule.BusySlot], int]
    ] = None,
) -> Dict[str, Any]:
    """
    Calculate every recommendation signal for one event.

    The result lists which signals were really used (`signals_used`) and
    which were unavailable (`signals_unavailable`). Unavailable signals are
    left out of the weighted score instead of counting as zero.
    """

    if schedule_context is None:
        schedule_context = build_schedule_context(timetable)

    busy_slots, buffer_minutes = schedule_context

    content = calculate_content_score(student, event)
    semantic = calculate_semantic_similarity(student, event)
    lexical = calculate_lexical_score(student, event)
    feedback_value = calculate_feedback_score(event, feedback)

    check = schedule.check_event_schedule(event, busy_slots, buffer_minutes)
    timetable_value = SCHEDULE_SCORES[check.status]

    availability_known = is_availability_known(event)
    availability_value = (
        calculate_availability_score(event)
        if availability_known
        else 50.0
    )

    available = {
        "content": True,
        "semantic": semantic_signal_available(student, event),
        "lexical": lexical_signal_available(student, event),
        "feedback": has_feedback_history(feedback),
        "timetable": (
            TIMETABLE_AFFECTS_SCORE and check.status != schedule.UNKNOWN
        ),
        "availability": availability_known,
    }

    context_parts: List[Tuple[float, float]] = []
    if available["timetable"]:
        context_parts.append((0.60, timetable_value))
    if available["availability"]:
        context_parts.append((0.40, availability_value))

    if context_parts:
        context_value = clamp_score(
            sum(weight * value for weight, value in context_parts)
            / sum(weight for weight, _ in context_parts)
        )
        available["context"] = True
    else:
        context_value = 50.0
        available["context"] = False

    hybrid_value, weights_used = calculate_adaptive_hybrid_score(
        {
            "content": content,
            "semantic": semantic,
            "lexical": lexical,
            "feedback": feedback_value,
            "timetable": timetable_value,
            "availability": availability_value,
            "context": context_value,
        },
        available,
    )

    features = build_feature_vector(
        content,
        semantic,
        feedback_value,
        timetable_value,
        availability_value,
        context_value
    )

    mlp_value = predict_mlp_score(mlp_model, features)

    # An MLP is used only when a trained model is passed in.
    if mlp_value is not None:
        final_score = hybrid_value * 0.80 + mlp_value * 0.20
        scoring_method = "Hybrid + MLP Neural Ranking"
    else:
        final_score = hybrid_value
        scoring_method = "Hybrid Weighted Ranking"

    final_score = clamp_score(final_score)

    result = dict(event)

    result["content_score"] = round(content, 4)
    result["semantic_score"] = round(semantic, 4)
    result["lexical_score"] = round(lexical, 4)
    result["feedback_score"] = round(feedback_value, 4)
    result["timetable_score"] = round(timetable_value, 4)
    result["availability_score"] = round(availability_value, 4)
    result["context_score"] = round(context_value, 4)
    result["hybrid_score"] = round(hybrid_value, 4)
    result["mlp_score"] = (
        round(mlp_value, 4) if mlp_value is not None else None
    )
    result["matchScore"] = round(final_score, 4)
    result["recommendation_score"] = round(final_score, 4)

    result["signals_used"] = [
        name for name in BASE_WEIGHTS if available.get(name)
    ]
    result["signals_unavailable"] = [
        name for name in BASE_WEIGHTS if not available.get(name)
    ]
    result["signal_weights"] = {
        name: round(weight, 4) for name, weight in weights_used.items()
    }
    result["schedule_status"] = check.status
    result["schedule_conflict"] = check.status == schedule.CONFLICT
    result["schedule_detail"] = check.detail

    logger.debug(
        "scored event=%r final=%.2f used=%s",
        event.get("title"),
        final_score,
        result["signals_used"],
    )

    result["recommendation_model"] = scoring_method
    result["feature_vector"] = features

    result["breakdown"] = {
        "content": round(content, 4),
        "semantic": round(semantic, 4),
        "lexical": round(lexical, 4),
        "feedback": round(feedback_value, 4),
        "timetable": round(timetable_value, 4),
        "availability": round(availability_value, 4),
        "context": round(context_value, 4),
        "hybrid": round(hybrid_value, 4),
        "mlp": (
            round(mlp_value, 4) if mlp_value is not None else None
        ),
    }

    return result


# ============================================================
# CONTEXT-AWARE RE-RANKING
# ============================================================

def apply_context_reranking(
    results: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Apply practical context after the main hybrid score.

    Events with timetable conflicts are heavily penalized.
    """

    updated = []

    for item in results:

        base_score = safe_number(
            item.get("matchScore")
            or item.get("recommendation_score")
        )

        timetable_score = safe_number(
            item.get("timetable_score"),
            50
        )

        availability_score = safe_number(
            item.get("availability_score"),
            50
        )

        context_score = safe_number(
            item.get("context_score"),
            50
        )

        # Small context adjustment.
        reranked_score = (
            base_score * 0.80
            + context_score * 0.10
            + timetable_score * 0.05
            + availability_score * 0.05
        )

        item = dict(item)

        item[
            "contextRerankedScore"
        ] = clamp_score(
            reranked_score
        )

        updated.append(item)

    updated.sort(
        key=lambda item: safe_number(
            item.get("contextRerankedScore")
        ),
        reverse=True
    )

    return updated


# ============================================================
# DIVERSITY RE-RANKING
# ============================================================

def event_category(
    event: Dict[str, Any]
) -> str:

    categories = get_event_categories(event)

    if categories:
        return categories[0]

    return "general"


def event_skills_key(
    event: Dict[str, Any]
) -> Tuple[str, ...]:

    return tuple(
        sorted(
            get_event_skills(event)
        )
    )


def apply_diversity_reranking(
    results: List[Dict[str, Any]],
    diversity_weight: float = 0.08
) -> List[Dict[str, Any]]:
    """
    Greedy diversity-aware reranking.

    Prevents the recommendation list from being
    dominated by the same category.
    """

    remaining = [
        dict(item)
        for item in results
    ]

    selected = []

    category_counts: Dict[str, int] = {}

    while remaining:

        best_item = None
        best_score = -float("inf")

        for item in remaining:

            base_score = safe_number(
                item.get(
                    "contextRerankedScore",
                    item.get("matchScore", 0)
                )
            )

            category = event_category(item)

            category_penalty = (
                category_counts.get(
                    category,
                    0
                ) * diversity_weight * 100
            )

            final_score = (
                base_score
                - category_penalty
            )

            if final_score > best_score:

                best_score = final_score
                best_item = item

        if best_item is None:
            break

        category = event_category(
            best_item
        )

        category_counts[
            category
        ] = category_counts.get(
            category,
            0
        ) + 1

        best_item[
            "diversity_score"
        ] = clamp_score(
            best_score
        )

        selected.append(
            best_item
        )

        remaining.remove(
            best_item
        )

    return selected


# ============================================================
# RECOMMENDATION REASONS
# ============================================================

def generate_reasons(
    student: Dict[str, Any],
    event: Dict[str, Any],
    scores: Dict[str, Any]
) -> List[str]:

    reasons = []

    skill_score = safe_number(
        scores.get("content_score")
    )

    semantic_score = safe_number(
        scores.get("semantic_score")
    )

    feedback_value = safe_number(
        scores.get("feedback_score")
    )

    timetable_value = safe_number(
        scores.get("timetable_score")
    )

    availability_value = safe_number(
        scores.get("availability_score")
    )

    if calculate_skill_match(
        student,
        event
    ) >= 50:

        reasons.append(
            "Matches your skills"
        )

    if calculate_interest_match(
        student,
        event
    ) >= 50:

        reasons.append(
            "Matches your interests"
        )

    if calculate_career_match(
        student,
        event
    ) >= 50:

        reasons.append(
            "Relevant to your career goals"
        )

    used = set(scores.get("signals_used") or [])

    if "semantic" in used and semantic_score >= 70:
        reasons.append(
            "Semantically similar to your profile"
        )

    if (
        "lexical" in used
        and safe_number(scores.get("lexical_score")) >= 40
    ):
        reasons.append(
            "Mentions topics from your profile"
        )

    if "feedback" in used and feedback_value >= 40:
        reasons.append(
            "You saved this event"
        )

    if scores.get("schedule_status") == schedule.FREE:
        reasons.append(
            "Fits your timetable"
        )

    if "availability" in used and availability_value >= 70:
        reasons.append(
            "Good seat availability"
        )

    if not reasons:

        reasons.append(
            "Recommended based on your overall profile"
        )

    return reasons[:5]


# ============================================================
# MAIN RECOMMENDATION FUNCTION
# ============================================================

def recommend_events(
    student: Dict[str, Any],
    events: Sequence[Dict[str, Any]],
    feedback: Optional[Dict[str, Any]] = None,
    timetable: Any = None,
    top_k: int = TOP_K_DEFAULT,
    mlp_model=None,
    now: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Main recommendation pipeline.

    Pipeline:

    Student profile
          ↓
    Content-based
          ↓
    Sentence-BERT
          ↓
    Feedback
          ↓
    Timetable
          ↓
    Availability
          ↓
    Context
          ↓
    Hybrid score
          ↓
    MLP
          ↓
    Context re-ranking
          ↓
    Diversity re-ranking
          ↓
    Top-K
    """

    if not student:
        return []

    if not events:
        return []

    # --------------------------------------------------------
    # Remove invalid events
    # --------------------------------------------------------

    clean_events = []

    for event in events:

        if not isinstance(event, dict):
            continue

        clean_events.append(
            dict(event)
        )

    if not clean_events:
        return []

    # --------------------------------------------------------
    # Vector retrieval
    # --------------------------------------------------------

    # --------------------------------------------------------
    # Eligibility: remove events that must not be recommended
    # (already registered/attended, expired, full, hard class clash).
    # Unknown data never removes an event.
    # --------------------------------------------------------

    feedback_ids = collect_feedback_ids(feedback)
    schedule_context = build_schedule_context(timetable)

    eligible_events = []
    removed: Dict[str, int] = {}

    for event in clean_events:
        reason = ineligibility_reason(
            event, feedback_ids, schedule_context, now
        )
        if reason:
            removed[reason] = removed.get(reason, 0) + 1
            continue
        eligible_events.append(event)

    if removed:
        logger.debug("events removed before ranking: %s", removed)

    if not eligible_events:
        return []

    vector_events = vector_retrieval(
        student,
        eligible_events
    )

    # --------------------------------------------------------
    # Score all events
    # --------------------------------------------------------

    scored_events = []

    for event in vector_events:

        scored = score_event(
            student=student,
            event=event,
            feedback=feedback,
            timetable=timetable,
            mlp_model=mlp_model,
            schedule_context=schedule_context,
        )

        scored[
            "reasons"
        ] = generate_reasons(
            student,
            scored,
            scored
        )

        scored_events.append(
            scored
        )

    # --------------------------------------------------------
    # Initial hybrid/MLP ranking
    # --------------------------------------------------------

    scored_events.sort(
        key=lambda item: safe_number(
            item.get("matchScore")
        ),
        reverse=True
    )

    # --------------------------------------------------------
    # Context reranking
    # --------------------------------------------------------

    context_ranked = apply_context_reranking(
        scored_events
    )

    # --------------------------------------------------------
    # Diversity reranking
    # --------------------------------------------------------

    diverse_ranked = apply_diversity_reranking(
        context_ranked
    )

    # --------------------------------------------------------
    # Final ranking
    # --------------------------------------------------------

    diverse_ranked.sort(
        key=lambda item: safe_number(
            item.get("diversity_score")
        ),
        reverse=True
    )

    # --------------------------------------------------------
    # Top-K
    # --------------------------------------------------------

    final_results = diverse_ranked[
        :max(1, int(top_k))
    ]

    # --------------------------------------------------------
    # Add ranks
    # --------------------------------------------------------

    for index, event in enumerate(
        final_results,
        start=1
    ):

        event["rank"] = index

    return final_results


# ============================================================
# TRAINING DATA GENERATION
# ============================================================

def create_training_example(
    student: Dict[str, Any],
    event: Dict[str, Any],
    feedback: Optional[Dict[str, Any]] = None,
    timetable: Optional[Sequence[Dict[str, Any]]] = None,
    label: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Create one training sample for the MLP.

    Label can represent:
    1 = positive interaction
    0 = negative/no interaction

    Or a continuous relevance value.
    """

    content = calculate_content_score(
        student,
        event
    )

    semantic = calculate_semantic_similarity(
        student,
        event
    )

    feedback_value = calculate_feedback_score(
        event,
        feedback
    )

    timetable_value = calculate_timetable_score(
        event,
        timetable
    )

    availability_value = calculate_availability_score(
        event
    )

    context_value = calculate_context_score(
        timetable_value,
        availability_value
    )

    features = build_feature_vector(
        content,
        semantic,
        feedback_value,
        timetable_value,
        availability_value,
        context_value
    )

    if label is None:

        # Automatically derive an implicit label.
        if feedback_value >= 100:
            label = 1.0

        elif feedback_value >= 75:
            label = 0.8

        elif feedback_value >= 45:
            label = 0.6

        else:
            label = 0.0

    return {
        "features": features,
        "label": float(label)
    }


def build_training_data(
    student: Dict[str, Any],
    events: Sequence[Dict[str, Any]],
    feedback: Optional[Dict[str, Any]] = None,
    timetable: Optional[Sequence[Dict[str, Any]]] = None
) -> List[Dict[str, Any]]:
    """
    Build MLP training examples.
    """

    training_data = []

    for event in events:

        training_data.append(
            create_training_example(
                student,
                event,
                feedback,
                timetable
            )
        )

    return training_data


# ============================================================
# EVALUATION METRICS
# ============================================================

def precision_at_k(
    recommended_ids: Sequence[Any],
    relevant_ids: Sequence[Any],
    k: int
) -> float:

    if k <= 0:
        return 0.0

    recommended = [
        str(value)
        for value in recommended_ids[:k]
    ]

    relevant = {
        str(value)
        for value in relevant_ids
    }

    if not recommended:
        return 0.0

    hits = sum(
        1
        for item in recommended
        if item in relevant
    )

    return hits / len(recommended)


def recall_at_k(
    recommended_ids: Sequence[Any],
    relevant_ids: Sequence[Any],
    k: int
) -> float:

    relevant = {
        str(value)
        for value in relevant_ids
    }

    if not relevant:
        return 0.0

    recommended = {
        str(value)
        for value in recommended_ids[:k]
    }

    hits = len(
        recommended.intersection(
            relevant
        )
    )

    return hits / len(relevant)


def dcg_at_k(
    recommended_ids: Sequence[Any],
    relevant_ids: Sequence[Any],
    k: int
) -> float:

    relevant = {
        str(value)
        for value in relevant_ids
    }

    score = 0.0

    for index, item in enumerate(
        recommended_ids[:k]
    ):

        if str(item) in relevant:

            score += (
                1.0
                / math.log2(index + 2)
            )

    return score


def ndcg_at_k(
    recommended_ids: Sequence[Any],
    relevant_ids: Sequence[Any],
    k: int
) -> float:

    actual = dcg_at_k(
        recommended_ids,
        relevant_ids,
        k
    )

    ideal_hits = min(
        len(set(
            str(value)
            for value in relevant_ids
        )),
        k
    )

    ideal = sum(
        1.0 / math.log2(index + 2)
        for index in range(
            ideal_hits
        )
    )

    if ideal == 0:
        return 0.0

    return actual / ideal


def average_precision_at_k(
    recommended_ids: Sequence[Any],
    relevant_ids: Sequence[Any],
    k: int
) -> float:

    relevant = {
        str(value)
        for value in relevant_ids
    }

    if not relevant:
        return 0.0

    hits = 0
    precision_sum = 0.0

    for index, item in enumerate(
        recommended_ids[:k],
        start=1
    ):

        if str(item) in relevant:

            hits += 1

            precision_sum += (
                hits / index
            )

    return precision_sum / len(relevant)


def calculate_diversity(
    recommendations: Sequence[Dict[str, Any]]
) -> float:
    """
    Diversity = unique categories / total items.
    """

    if not recommendations:
        return 0.0

    categories = set()

    for event in recommendations:

        categories.add(
            event_category(event)
        )

    return len(categories) / len(
        recommendations
    )


def calculate_coverage(
    recommendations: Sequence[Dict[str, Any]],
    all_events: Sequence[Dict[str, Any]]
) -> float:
    """
    Catalog coverage.
    """

    if not all_events:
        return 0.0

    recommended_ids = {
        get_id(event)
        for event in recommendations
        if get_id(event)
    }

    all_ids = {
        get_id(event)
        for event in all_events
        if get_id(event)
    }

    if not all_ids:
        return 0.0

    return len(
        recommended_ids.intersection(
            all_ids
        )
    ) / len(all_ids)


def evaluate_recommendations(
    recommendations: Sequence[Dict[str, Any]],
    relevant_ids: Sequence[Any],
    all_events: Optional[
        Sequence[Dict[str, Any]]
    ] = None,
    k: int = TOP_K_DEFAULT
) -> Dict[str, float]:
    """
    Evaluate recommendation quality.
    """

    recommended_ids = [
        get_id(event)
        for event in recommendations
    ]

    metrics = {
        "precision_at_k": precision_at_k(
            recommended_ids,
            relevant_ids,
            k
        ),

        "recall_at_k": recall_at_k(
            recommended_ids,
            relevant_ids,
            k
        ),

        "ndcg_at_k": ndcg_at_k(
            recommended_ids,
            relevant_ids,
            k
        ),

        "map_at_k": average_precision_at_k(
            recommended_ids,
            relevant_ids,
            k
        ),

        "diversity": calculate_diversity(
            recommendations
        ),
    }

    if all_events is not None:

        metrics["coverage"] = (
            calculate_coverage(
                recommendations,
                all_events
            )
        )

    return metrics


# ============================================================
# ALGORITHM INFORMATION
# ============================================================

RECOMMENDATION_ALGORITHM = {
    "name": "Hybrid AI Event Recommendation Engine",

    "methods": [
        "Content-Based Filtering",
        "Sentence-BERT Semantic Similarity",
        "Vector Similarity Retrieval",
        "Implicit Feedback",
        "Timetable-Aware Ranking",
        "Availability-Aware Ranking",
        "Context-Aware Ranking",
        "Diversity Re-ranking",
    ],

    "weights": {
        "content": CONTENT_WEIGHT,
        "semantic": SEMANTIC_WEIGHT,
        "feedback": FEEDBACK_WEIGHT,
        "timetable": TIMETABLE_WEIGHT,
        "availability": AVAILABILITY_WEIGHT,
        "context": CONTEXT_WEIGHT,
    },

    "semantic_model": SEMANTIC_MODEL_NAME,
    "weights_note": (
        "Weights are rescaled over the signals available for each "
        "event; see signals_used / signals_unavailable on each result."
    ),

    "evaluation_metrics": [
        "Precision@K",
        "Recall@K",
        "NDCG@K",
        "MAP@K",
        "Diversity",
        "Coverage",
    ],
}


# ============================================================
# CONVENIENCE FUNCTION
# ============================================================

def get_recommendations(
    student: Dict[str, Any],
    events: Sequence[Dict[str, Any]],
    feedback: Optional[Dict[str, Any]] = None,
    timetable: Any = None,
    top_k: int = TOP_K_DEFAULT,
    mlp_model=None,
    now: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Simple public API for the recommendation engine.
    """

    return recommend_events(
        student=student,
        events=events,
        feedback=feedback,
        timetable=timetable,
        top_k=top_k,
        mlp_model=mlp_model,
        now=now,
    )


# ============================================================
# TEST / DEMO
# ============================================================

if __name__ == "__main__":

    sample_student = {
        "id": "student1",

        "skills": [
            "python",
            "machine learning",
            "react"
        ],

        "interests": [
            "artificial intelligence",
            "hackathon",
            "technology"
        ],

        "career_goal": [
            "AI Engineer"
        ],

        "department": "AIML",

        "year": "4"
    }

    sample_events = [
        {
            "id": "event1",

            "title": "AI Hackathon",

            "description": (
                "Build innovative artificial "
                "intelligence solutions."
            ),

            "category": "Hackathon",

            "skills": [
                "python",
                "machine learning"
            ],

            "capacity": 100,

            "registered": 30,

            "day": "Saturday",

            "start_time": "10:00 AM",

            "end_time": "2:00 PM"
        },

        {
            "id": "event2",

            "title": "Web Development Workshop",

            "description": (
                "Learn modern frontend "
                "web development."
            ),

            "category": "Workshop",

            "skills": [
                "react",
                "javascript"
            ],

            "capacity": 50,

            "registered": 45,

            "day": "Monday",

            "start_time": "10:00 AM",

            "end_time": "12:00 PM"
        },

        {
            "id": "event3",

            "title": "Entrepreneurship Seminar",

            "description": (
                "Learn startup strategy and "
                "entrepreneurship."
            ),

            "category": "Entrepreneurship",

            "skills": [
                "business"
            ],

            "capacity": 200,

            "registered": 50,

            "day": "Friday",

            "start_time": "2:00 PM",

            "end_time": "4:00 PM"
        }
    ]

    sample_timetable = [
        {
            "day": "Monday",
            "start_time": "9:00 AM",
            "end_time": "1:00 PM"
        }
    ]

    sample_feedback = {
        "saved_ids": [],
        "registered_ids": [],
        "attended_ids": []
    }

    recommendations = get_recommendations(
        student=sample_student,
        events=sample_events,
        feedback=sample_feedback,
        timetable=sample_timetable,
        top_k=3
    )

    print("\n==============================")
    print("HYBRID RECOMMENDATIONS")
    print("==============================")

    for event in recommendations:

        print(
            f"\nRank: {event.get('rank')}"
        )

        print(
            f"Event: {event.get('title')}"
        )

        print(
            f"Score: {event.get('matchScore')}"
        )

        print(
            f"Model: {event.get('recommendation_model')}"
        )

        print(
            f"Reasons: {event.get('reasons')}"
        )

        print(
            f"Breakdown: {event.get('breakdown')}"
        )