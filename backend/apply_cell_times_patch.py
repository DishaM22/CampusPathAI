r"""
apply_cell_times_patch.py

Run from the project root (or pass the project folder as the first argument):

    python apply_cell_times_patch.py
    python backend\apply_cell_times_patch.py .

Shows each class's REAL start-end time inside its Profile timetable cell, e.g.

    Agentic AI
    2:20 PM - 4:10 PM

The grid rows are only a ruler (equal steps from your college start time). The
class times themselves come from what you entered, so they are always exact.
A backup (StudentDashboardUI.jsx.bak2) is written first.
"""

import re
import shutil
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
UI = ROOT / "frontend/src/features/studentDashboard/components/StudentDashboardUI.jsx"

OLD_CELL = r'\${block?block.label:"Free"}'
NEW_CELL = (r'\${block?(String(block.label).replace(/[<>&]/g,"")'
            r'+"<br><small>"+fmt(block.s)+" - "+fmt(block.e)+"</small>"):"Free"}')

OLD_CSS = ".tt .br{background:#2f5d50;color:#c9f7e6}"
NEW_CSS = OLD_CSS + ".tt small{opacity:.8;font-size:10px}"


def main():
    if not UI.exists():
        print(f"File not found: {UI}\nRun this from the CampusPathAI folder, or pass its path.")
        return

    with open(UI, encoding="utf-8", newline="") as handle:
        text = handle.read()

    if "<br><small>" in text:
        print("Already applied: nothing to change.")
        return

    if text.count(OLD_CELL) != 1 or text.count(OLD_CSS) != 1:
        print("The file differs from the version I checked, so I changed NOTHING.")
        print("Make sure apply_timetable_edit_patch.py was run first, or send me the file.")
        return

    shutil.copyfile(UI, str(UI) + ".bak2")
    text = text.replace(OLD_CELL, NEW_CELL).replace(OLD_CSS, NEW_CSS)

    with open(UI, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)

    print(f"Updated {UI}   (backup: {UI.name}.bak2)")
    print("Reload the dashboard with Ctrl+Shift+R.")


if __name__ == "__main__":
    main()