r"""
apply_timetable_edit_patch.py

Run from the project root (the CampusPathAI folder):

    python apply_timetable_edit_patch.py

What it changes (a .bak backup of every file is written first):

 1. StudentDashboardUI.jsx
      * Profile timetable shows the WHOLE college day (from your saved college
        start/end time), with "Free" wherever there is no class.
      * Breaks (lunch / break / personal / travel) are shown in their own colour.
      * "Edit Timetable" opens the same editor you used during onboarding.
 2. StudentDashboard.jsx
      * Shows that editor, and reloads the dashboard after you save.
 3. TimetablePage.jsx
      * Can open with your saved timetable and a "Save changes" button
        (normal onboarding behaviour is unchanged).
 4. TimetableEditPage.jsx  (new file)
      * Loads your saved timetable, then shows the editor.

Safe to run once. If a file does not look like the version I checked, NOTHING is
changed and the script tells you which file to send me.
"""

import re
import shutil
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")

UI = ROOT / "frontend/src/features/studentDashboard/components/StudentDashboardUI.jsx"
DASH = ROOT / "frontend/src/pages/StudentDashboard.jsx"
TTP = ROOT / "frontend/src/features/onboarding/timetable/TimetablePage.jsx"
EDIT = ROOT / "frontend/src/features/onboarding/timetable/TimetableEditPage.jsx"

MARKER_UI = "CAMPUSPATH_EDIT_TIMETABLE"


# ----------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------

def read(path):
    with open(path, encoding="utf-8", newline="") as handle:
        return handle.read()


def write(path, text):
    with open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)


class Patcher:
    def __init__(self, name, text):
        self.name = name
        self.text = text
        self.eol = "\r\n" if "\r\n" in text else "\n"
        self.errors = []

    def _fix_eol(self, snippet):
        return snippet.replace("\r\n", "\n").replace("\n", self.eol)

    def sub(self, pattern, replacement, what, flags=re.DOTALL):
        new_text, count = re.subn(
            pattern,
            lambda m: self._fix_eol(m.expand(replacement)),
            self.text,
            count=1,
            flags=flags,
        )
        if count != 1:
            self.errors.append(f"{self.name}: could not find: {what}")
        else:
            self.text = new_text


# ----------------------------------------------------------------------
# 1. StudentDashboardUI.jsx
#    (the first part of the file is ONE big template string, so the code
#     below avoids backticks, ${...} and backslash escapes like \d)
# ----------------------------------------------------------------------

def patch_ui(text):
    p = Patcher("StudentDashboardUI.jsx", text)

    # a) remember the saved college hours
    p.sub(r"let TT_SLOTS=\[\];",
          "let TT_SLOTS=[];\nlet TT_CONFIG=null;",
          "let TT_SLOTS=[];")

    p.sub(r"saved=data\?\.timetable \|\| \{\};",
          "saved=data?.timetable || {};\n      TT_CONFIG=data?.config || null;",
          "saved=data?.timetable || {};")

    # b) keep the block type (class / lunch / break ...)
    p.sub(r"TTBLOCKS\[d\]\.push\(\{\s*s: start,\s*e: end,\s*label\s*\}\);",
          'const kind = String(block?.type ?? "").trim().toLowerCase();\n'
          '  const isBreak = ["lunch","break","personal","travel"].indexOf(kind) >= 0;\n'
          '  TTBLOCKS[d].push({\n'
          '    s: start,\n'
          '    e: end,\n'
          '    t: kind,\n'
          '    label: (isBreak && label === "Class") ? (kind.charAt(0).toUpperCase() + kind.slice(1)) : label\n'
          '  });',
          "TTBLOCKS[d].push({ s, e, label })")

    # c) build the rows from the whole college day, not only from the classes
    p.sub(r"const allBlocks=Object\.values\(TTBLOCKS\)\.flat\(\);.*?"
          r"TT_SLOTS=\[\{s:firstStart,e:firstStart\+duration/60\}\];",
          'const allBlocks=Object.values(TTBLOCKS).flat();\n'
          '  const hhmm=(v)=>{const m=String(v||"").trim().match(/^([0-9]{1,2}):([0-9]{2})$/);return m?Number(m[1])+Number(m[2])/60:null;};\n'
          '  const cfgStart=hhmm(TT_CONFIG&&TT_CONFIG.collegeStartTime);\n'
          '  const cfgEnd=hhmm(TT_CONFIG&&TT_CONFIG.collegeEndTime);\n'
          '  const durations=allBlocks.map(x=>Math.round((x.e-x.s)*60)).filter(x=>x>0);\n'
          '  const cfgDur=(TT_CONFIG&&Number(TT_CONFIG.slotDuration)>0)?Number(TT_CONFIG.slotDuration):55;\n'
          '  const duration=durations.length?durations.sort((a,b)=>a-b)[Math.floor(durations.length/2)]:cfgDur;\n'
          '  let dayStart=cfgStart!==null?cfgStart:8+50/60;\n'
          '  let dayEnd=cfgEnd!==null?cfgEnd:dayStart+duration/60*8;\n'
          '  if(allBlocks.length){dayStart=Math.min(dayStart,...allBlocks.map(x=>x.s));dayEnd=Math.max(dayEnd,...allBlocks.map(x=>x.e));}\n'
          '  TT_SLOTS=[];\n'
          '  for(let t=dayStart;t<dayEnd-1/6;t+=duration/60){TT_SLOTS.push({s:t,e:Math.min(t+duration/60,dayEnd)});}\n'
          '  if(!TT_SLOTS.length)TT_SLOTS=[{s:dayStart,e:dayStart+duration/60}];',
          "the block that builds TT_SLOTS (allBlocks ... TT_SLOTS=[{s:firstStart ...")

    # d) cell colour for breaks (the \${ is kept exactly as in the file)
    p.sub(r'\\\$\{block\?"b":""\}',
          r'\\${block?(block.t&&["lunch","break","personal","travel"].indexOf(block.t)>=0?"b br":"b"):""}',
          'the timetable cell class (${block?"b":""})')

    p.sub(r"\.tt \.b\{background:#35408a\}",
          ".tt .b{background:#35408a}.tt .br{background:#2f5d50;color:#c9f7e6}",
          ".tt .b{background:#35408a}")

    # d2) rows are built with decimal hours, so 12.5 can become 12.4999999:
    #     add a small tolerance so a class that ENDS at 12:30 is not drawn in
    #     the row that STARTS at 12:30
    p.sub(r"b\.s<slot\.e&&b\.e>slot\.s",
          "b.s<slot.e-0.001&&b.e>slot.s+0.001",
          "the overlap test b.s<slot.e&&b.e>slot.s")

    # d3) a break (lunch / break / personal / travel) is not a class:
    #     do not count it as a busy hour
    p.sub(r"(blocks\.forEach\(\(block\) => \{\s*const start = parseTime\(block\?\.startTime\);\s*"
          r"const end = parseTime\(block\?\.endTime\);\s*if \(start === null \|\| end === null\) return;)",
          r'\1\n      const breakKind = String(block?.type ?? "").trim().toLowerCase();\n'
          r'      if (["lunch","break","personal","travel"].indexOf(breakKind) >= 0) return;',
          "the loop that fills the busy-hours map (normalizeSaved)")

    # e) "Edit Timetable" asks the React page to open the editor
    p.sub(r"editTT:\(\)=>\{S\.editTT=!S\.editTT;if\(!S\.editTT\)toast\(\"Timetable updated\"\);render\(\)\},",
          'editTT:()=>{window.parent.postMessage({type:"CAMPUSPATH_EDIT_TIMETABLE"},"*")},',
          "the editTT click handler")

    # f) React wrapper: listen for that message
    p.sub(r"function StudentDashboardUI\(\{ student, events, recommendations, registrations, savedEventIds, timetable \}\) \{",
          "function StudentDashboardUI({ student, events, recommendations, registrations, savedEventIds, timetable, onEditTimetable }) {",
          "the StudentDashboardUI function signature")

    p.sub(r"const frameRef = useRef\(null\);",
          "const frameRef = useRef(null);\n\n"
          "  useEffect(() => {\n"
          "    const handleMessage = (event) => {\n"
          "      if (event.source !== frameRef.current?.contentWindow) return;\n"
          '      if (event.data?.type === "CAMPUSPATH_EDIT_TIMETABLE") {\n'
          "        onEditTimetable?.();\n"
          "      }\n"
          "    };\n"
          '    window.addEventListener("message", handleMessage);\n'
          '    return () => window.removeEventListener("message", handleMessage);\n'
          "  }, [onEditTimetable]);",
          "const frameRef = useRef(null);")

    return p


# ----------------------------------------------------------------------
# 2. StudentDashboard.jsx
# ----------------------------------------------------------------------

def patch_dash(text):
    p = Patcher("StudentDashboard.jsx", text)

    p.sub(r'(import StudentDashboardUI from "\.\./features/studentDashboard/components/StudentDashboardUI";)',
          r'\1\nimport TimetableEditPage from "../features/onboarding/timetable/TimetableEditPage";',
          "the StudentDashboardUI import")

    p.sub(r"(const \[loading, setLoading\] = useState\(true\);)",
          r"\1\n  const [editingTimetable, setEditingTimetable] = useState(false);\n"
          r"  const [reloadKey, setReloadKey] = useState(0);",
          "const [loading, setLoading] = useState(true);")

    p.sub(r"\}, \[navigate\]\);",
          "}, [navigate, reloadKey]);",
          "}, [navigate]);")

    p.sub(r"(\r?\n  if \(loading\) \{)",
          "\n  if (editingTimetable) {\n"
          "    return (\n"
          "      <TimetableEditPage\n"
          "        onCancel={() => setEditingTimetable(false)}\n"
          "        onSaved={() => {\n"
          "          setEditingTimetable(false);\n"
          "          setLoading(true);\n"
          "          setReloadKey((key) => key + 1);\n"
          "        }}\n"
          "      />\n"
          "    );\n"
          "  }\n"
          r"\1",
          "if (loading) {")

    p.sub(r"timetable=\{timetable\}(\s*)/>",
          r"timetable={timetable}\n      onEditTimetable={() => setEditingTimetable(true)}\1/>",
          "timetable={timetable} />")

    return p


# ----------------------------------------------------------------------
# 3. TimetablePage.jsx
# ----------------------------------------------------------------------

def patch_ttp(text):
    p = Patcher("TimetablePage.jsx", text)

    p.sub(r"export default function TimetablePage\(\{\s*onBack,\s*onContinue,\s*\}\) \{",
          "export default function TimetablePage({\n"
          "  onBack,\n"
          "  onContinue,\n"
          "  initialData = null,\n"
          '  mode = "onboarding",\n'
          "}) {\n"
          '  const isEdit = mode === "edit";',
          "the TimetablePage function signature")

    p.sub(r"useState\(DEFAULT_CONFIG\)",
          "useState(initialData?.config || DEFAULT_CONFIG)",
          "useState(DEFAULT_CONFIG)")
    p.sub(r"useState\(EMPTY_TIMETABLE\)",
          "useState(initialData?.timetable || EMPTY_TIMETABLE)",
          "useState(EMPTY_TIMETABLE)")
    p.sub(r"useState\(DEFAULT_PREFERENCES\)",
          "useState(initialData?.preferences || DEFAULT_PREFERENCES)",
          "useState(DEFAULT_PREFERENCES)")

    p.sub(r"<ProgressIndicator\s*activeIndex=\{5\}\s*/>",
          "{!isEdit && <ProgressIndicator activeIndex={5} />}",
          "<ProgressIndicator activeIndex={5} />")

    p.sub(r'(<div className="eyebrow">\s*)STEP 6 OF 6(\s*</div>)',
          r'\1{isEdit ? "EDIT TIMETABLE" : "STEP 6 OF 6"}\2',
          "STEP 6 OF 6")

    p.sub(r"(<h1>\s*)Let's map your weekly schedule(\s*</h1>)",
          r'''\1{isEdit ? "Update your weekly schedule" : "Let's map your weekly schedule"}\2''',
          "the page heading")

    p.sub(r"(disabled=\{isSaving\}\s*>\s*)Back(\s*</button>)",
          r'\1{isEdit ? "Cancel" : "Back"}\2',
          "the Back button")

    p.sub(r': "Save & Continue →"\}',
          ': isEdit\n              ? "Save changes"\n              : "Save & Continue →"}',
          'the "Save & Continue" label')

    return p


# ----------------------------------------------------------------------
# 4. new file
# ----------------------------------------------------------------------

EDIT_PAGE = '''import { useEffect, useState } from "react";
import TimetablePage from "./TimetablePage";
import { fetchTimetable } from "./timetableService";

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

/* Make sure every weekday exists and every block has an id (needed for edit/delete). */
function withIds(timetable) {
  const result = {};

  DAY_KEYS.forEach((day) => {
    const blocks = Array.isArray(timetable?.[day]) ? timetable[day] : [];

    result[day] = blocks.map((block, index) => ({
      ...block,
      id: block.id || "blk_" + day + "_" + index + "_" + Date.now(),
    }));
  });

  return result;
}

const centered = {
  minHeight: "100vh",
  background: "#0B1120",
  color: "#EEF0F6",
  display: "grid",
  placeItems: "center",
  fontFamily: "Inter, system-ui, sans-serif",
  textAlign: "center",
  padding: "24px",
};

/**
 * Opens the onboarding timetable editor with the student's SAVED timetable.
 *
 * If the saved timetable cannot be loaded, the editor is NOT shown: saving an
 * empty editor would overwrite the real timetable.
 */
export default function TimetableEditPage({ onCancel, onSaved }) {
  const [initialData, setInitialData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchTimetable()
      .then((data) => {
        if (cancelled) return;

        if (!data) {
          setFailed(true);
          return;
        }

        setInitialData({
          timetable: withIds(data.timetable),
          config: data.config || undefined,
          preferences: data.preferences || undefined,
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <div style={centered}>
        <div>
          <p>Could not load your saved timetable. Please try again.</p>
          <button type="button" onClick={onCancel}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!initialData) {
    return <div style={centered}>Loading your timetable...</div>;
  }

  return (
    <TimetablePage
      mode="edit"
      initialData={initialData}
      onBack={onCancel}
      onContinue={onSaved}
    />
  );
}
'''


def main():
    missing = [str(p) for p in (UI, DASH, TTP) if not p.exists()]
    if missing:
        print("These files were not found (run this from the CampusPathAI folder):")
        print("\n".join("  " + m for m in missing))
        return

    ui_text = read(UI)
    if MARKER_UI in ui_text:
        print("Already applied: nothing to change.")
        return

    if r"/^(\d{1,2}):(\d{2})$/" in ui_text:
        print("Run fix_dashboard_regex.py first (the time-pattern fix), then run this script again.")
        return

    patchers = [patch_ui(ui_text), patch_dash(read(DASH)), patch_ttp(read(TTP))]

    errors = [e for p in patchers for e in p.errors]
    if errors:
        print("A file differs from the version I checked, so I changed NOTHING:")
        print("\n".join("  " + e for e in errors))
        print("Please send me that file and I will adjust the patch.")
        return

    targets = [UI, DASH, TTP]
    for path, patcher in zip(targets, patchers):
        shutil.copyfile(path, str(path) + ".bak")
        write(path, patcher.text)
        print(f"Updated {path}   (backup: {path.name}.bak)")

    write(EDIT, EDIT_PAGE)
    print(f"Created {EDIT}")
    print("\nDone. Restart `npm run dev` if it is running, then reload with Ctrl+Shift+R.")


if __name__ == "__main__":
    main()