"""
check_timetable.py - READ-ONLY check of what timetable is stored for one student.

Run from the backend folder with the virtual environment active:

    python check_timetable.py your.email@example.com

It prints:
  * your student id
  * whether a timetable document exists for that id
  * how many classes are stored for each weekday
  * every timetable document's student id and class count, so a mismatch
    (saved under a different id / account) is easy to spot

It never changes the database and never prints passwords.
"""

import sys

DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"]


def count_blocks(document):
    timetable = (document or {}).get("timetable") or {}
    counts = {}
    for day in DAYS:
        blocks = timetable.get(day) if isinstance(timetable, dict) else None
        counts[day] = len(blocks) if isinstance(blocks, list) else 0
    return counts


def summarize(db, email):
    """Returns a list of text lines. `db` is the pymongo database."""
    lines = []

    student = db.students.find_one({"email": email.strip().lower()})
    if not student:
        student = db.students.find_one({"email": email.strip()})

    if not student:
        lines.append(f"No student found with email {email!r}.")
        return lines

    student_id = str(student["_id"])
    lines.append(f"Student id for this account: {student_id}")
    lines.append(f"Role: {student.get('role', '(none)')}")

    # student_id should be stored as a string; also try the raw ObjectId
    candidates = [{"student_id": student_id}, {"student_id": student["_id"]}]
    document = None
    for query in candidates:
        document = db.timetables.find_one(query)
        if document:
            break

    lines.append("")

    if not document:
        lines.append("RESULT: no timetable document exists for this account.")
        lines.append("  -> Re-enter and save the timetable while logged in as THIS account.")
    else:
        counts = count_blocks(document)
        total = sum(counts.values())
        lines.append("Timetable document found. Classes stored per day:")
        for day in DAYS:
            lines.append(f"  {day:<10} {counts[day]}")

        lines.append(f"  config:      {document.get('config') or '(empty)'}")
        lines.append(f"  updated_at:  {document.get('updated_at')}")

        if total == 0:
            lines.append("")
            lines.append("RESULT: a document exists but it has ZERO classes.")
            lines.append("  -> Re-enter your classes and press Save on the timetable page.")
        else:
            lines.append("")
            lines.append("Every stored class (exactly as saved):")
            for day in DAYS:
                for block in document["timetable"].get(day) or []:
                    lines.append(
                        f"  {day:<10} {str(block.get('subject'))!r:<22} "
                        f"type={block.get('type')!s:<9} "
                        f"{block.get('startTime')} - {block.get('endTime')}"
                    )
            lines.append("")
            lines.append(f"RESULT: {total} classes are stored. The database is fine;")
            lines.append("  the problem is in how the dashboard displays them.")

    lines.append("")
    lines.append("All timetable documents (ids and class counts only):")
    for other in db.timetables.find({}):
        mark = "  <-- this account" if str(other.get("student_id")) == student_id else ""
        lines.append(
            f"  {other.get('student_id')}  classes={sum(count_blocks(other).values())}{mark}"
        )

    return lines


def main():
    if len(sys.argv) < 2:
        print("Usage: python check_timetable.py your.email@example.com")
        return

    from database import db

    print("\n".join(summarize(db, sys.argv[1])))


if __name__ == "__main__":
    main()