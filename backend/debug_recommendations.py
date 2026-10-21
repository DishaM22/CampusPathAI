"""
debug_recommendations.py  -  explains WHY each event is (or is not) recommended.

Run from the backend folder (next to main.py, database.py,
recommendation_engine.py and recommender_schedule.py):

    python debug_recommendations.py student@email.com

It reads the same data as /api/dashboard/events, runs the real engine, and
prints (1) which events were removed before ranking and why, and (2) every
signal for every ranked event. Nothing is written to the database.
"""

import sys
from datetime import datetime

from database import db

import recommendation_engine as R


def short(text, n):
    text = str(text or "")
    return text if len(text) <= n else text[: n - 1] + "…"


def main():
    if len(sys.argv) < 2:
        print("Usage: python debug_recommendations.py student@email.com")
        return

    email = sys.argv[1].strip().lower()
    student_doc = db.students.find_one({"email": email})

    if not student_doc:
        print(f"No account found for {email}")
        return

    student_id = str(student_doc["_id"])
    profile = db.profiles.find_one({"student_id": student_id}) or {}

    events = list(db.events.find({}))
    for event in events:
        event["_id"] = str(event["_id"])

    registered_ids = [
        str(r["event_id"])
        for r in db.event_registrations.find({"student_id": student_id})
        if r.get("status", "registered") == "registered"
        and r.get("event_id") is not None
    ]
    saved_ids = [
        str(r["event_id"])
        for r in db.saved_events.find({"student_id": student_id})
        if r.get("event_id") is not None
    ]
    attended_ids = [
        str(r["event_id"])
        for r in db.attendance.find({"student_id": student_id})
        if r.get("event_id") is not None
    ]

    timetable_document = db.timetables.find_one({"student_id": student_id}) or {}

    counts = {}
    try:
        for row in db.event_registrations.aggregate([
            {"$match": {"status": {"$ne": "cancelled"}}},
            {"$group": {"_id": "$event_id", "count": {"$sum": 1}}},
        ]):
            if row.get("_id") is not None:
                counts[str(row["_id"])] = int(row.get("count", 0))
    except Exception as exc:
        print("(could not count registrations:", exc, ")")
        counts = None

    for event in events:
        if counts is not None:
            event["registered_count"] = counts.get(event["_id"], 0)

    student = {
        "student_id": student_id,
        "department": student_doc.get("department", ""),
        "year": profile.get("year", ""),
        "interests": profile.get("interests", []),
        "skills": profile.get("skills", []),
        "career_goal": profile.get("career_goal", ""),
        "preferred_domains": profile.get("preferred_domains", []),
    }
    feedback = {
        "registered_ids": registered_ids,
        "saved_ids": saved_ids,
        "attended_ids": attended_ids,
    }

    now = datetime.now()

    print("=" * 78)
    print("STUDENT PROFILE USED BY THE ENGINE")
    for key in ("department", "year", "interests", "skills",
                "career_goal", "preferred_domains"):
        print(f"  {key:18}: {student[key]!r}")
    print(f"  registered={len(registered_ids)} saved={len(saved_ids)} "
          f"attended={len(attended_ids)}")
    print(f"  semantic model loaded: {R.get_embedding_model() is not None}")
    print(f"  HIDE_TIMETABLE_CONFLICTS={R.HIDE_TIMETABLE_CONFLICTS} "
          f"TIMETABLE_AFFECTS_SCORE={R.TIMETABLE_AFFECTS_SCORE}")

    slots, buffer_minutes = R.build_schedule_context(timetable_document)
    print(f"  timetable: {len(slots)} usable blocks, buffer {buffer_minutes} min")
    if not slots:
        print("  !! no usable timetable blocks -> every event is 'unknown'")

    # ---- 1. removed before ranking ----------------------------------
    ids = R.collect_feedback_ids(feedback)
    print("=" * 78)
    print("REMOVED BEFORE RANKING (never reach the dashboard)")
    removed = 0
    for event in events:
        reason = R.ineligibility_reason(event, ids, (slots, buffer_minutes), now)
        if reason:
            removed += 1
            print(f"  {short(event.get('title'), 38):38} -> {reason}  "
                  f"(date={event.get('date')!r}, time={event.get('time')!r})")
    if not removed:
        print("  none")

    # ---- 2. full ranking --------------------------------------------
    ranked = R.get_recommendations(
        student=student,
        events=events,
        feedback=feedback,
        timetable=timetable_document,
        top_k=max(len(events), 1),
        now=now,
    )

    print("=" * 78)
    print("FINAL RANKING  (the backend sends the first 10; the UI may show fewer)")
    header = (f"{'#':>2} {'title':30} {'match':>5} {'skill':>5} {'intr':>5} "
              f"{'career':>6} {'cat':>4} {'lex':>5} {'sem':>5} {'ctx':>5} "
              f"{'final':>5}  schedule")
    print(header)
    print("-" * len(header))

    for event in ranked:
        print(
            f"{event['rank']:>2} {short(event.get('title'), 30):30} "
            f"{event['matchScore']:>5.1f} "
            f"{R.calculate_skill_match(student, event):>5.0f} "
            f"{R.calculate_interest_match(student, event):>5.0f} "
            f"{R.calculate_career_match(student, event):>6.0f} "
            f"{R.calculate_category_match(student, event):>4.0f} "
            f"{event['lexical_score']:>5.0f} "
            f"{event['semantic_score']:>5.0f} "
            f"{event['contextRerankedScore']:>5.1f} "
            f"{event['diversity_score']:>5.1f}  "
            f"{event['schedule_status']} ({event['schedule_detail']})"
        )

    print()
    print("Columns: skill/intr/career/cat = content-score parts (tag matching),")
    print("lex = keyword match on title+description, sem = semantic model,")
    print("ctx = after context re-rank, final = after the diversity penalty.")
    print("Tip: a category repeated in the list loses 8 points per earlier event.")


if __name__ == "__main__":
    main()