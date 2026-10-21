r"""
fix_dashboard_regex.py - repairs the timetable time patterns in StudentDashboardUI.jsx

WHY
  The dashboard page lives inside one big JavaScript template string. Inside a
  template string, "\d" silently becomes the letter "d", so patterns such as
  /^(\d{1,2}):(\d{2})$/ turn into /^(d{1,2}):(d{2})$/ and never match "08:50".
  Result: every saved class is dropped and the Profile timetable shows only "Free".

WHAT IT DOES
  Replaces the 5 affected patterns with versions that use [0-9] and plain spaces,
  which contain no backslashes and therefore survive the template string.
  A backup copy (StudentDashboardUI.jsx.bak) is written first.

USAGE (from the folder that contains the file, or give the path):
  python fix_dashboard_regex.py
  python fix_dashboard_regex.py "D:\\path\\to\\StudentDashboardUI.jsx"
"""

import shutil
import sys
from pathlib import Path

DEFAULT_PATH = Path("frontend/src/features/studentDashboard/components/StudentDashboardUI.jsx")

# (old text, new text, expected number of occurrences)
REPLACEMENTS = [
    (r"/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(AM|PM)?$/",
     r"/^([0-9]{1,2})(?::([0-9]{2}))?(?::[0-9]{2})? *(AM|PM)?$/", 1),
    (r"/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i",
     r"/^([0-9]{1,2})(?::([0-9]{2}))? *(AM|PM)?$/i", 1),
    (r"/\d{1,2}(?::\d{2})?\s*(?:AM|PM)?/gi",
     r"/[0-9]{1,2}(?::[0-9]{2})? *(?:AM|PM)?/gi", 1),
    (r"/^(\d{1,2}):(\d{2})$/",
     r"/^([0-9]{1,2}):([0-9]{2})$/", 2),
]


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PATH

    if not path.exists():
        print(f"File not found: {path}")
        print("Run this from the project root, or pass the full path to StudentDashboardUI.jsx")
        return

    with open(path, encoding="utf-8", newline="") as handle:  # keep line endings
        text = handle.read()

    already_fixed = all(old not in text for old, _, _ in REPLACEMENTS)
    if already_fixed:
        print("Nothing to change: none of the broken patterns were found (already fixed?).")
        return

    problems = []
    for old, _, expected in REPLACEMENTS:
        found = text.count(old)
        if found != expected:
            problems.append(f"  expected {expected} x {old}  but found {found}")

    if problems:
        print("The file differs from the version I checked, so I changed NOTHING:")
        print("\n".join(problems))
        print("Please send me the file and I will adjust the fix.")
        return

    backup = path.with_suffix(path.suffix + ".bak")
    shutil.copyfile(path, backup)

    for old, new, _ in REPLACEMENTS:
        text = text.replace(old, new)

    with open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)

    print(f"Fixed {path}")
    print(f"Backup saved as {backup}")
    print("Now reload the dashboard with Ctrl+Shift+R.")


if __name__ == "__main__":
    main()