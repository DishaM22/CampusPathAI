import React, { useEffect, useMemo, useState } from "react";

import ProgressIndicator from "./components/ProgressIndicator";
import TimetableGrid from "./components/TimetableGrid";
import AddClassModal from "./components/AddClassModal";
import ConflictDialog from "./components/ConflictDialog";
import WeeklySummary from "./components/WeeklySummary";
import AIInsightCard from "./components/AIInsightCard";
import AvailabilityPreferences from "./components/AvailabilityPreferences";

import {
  DAYS,
  DAY_LABELS,
  findConflict,
  computeWeekSummary,
  generateAIInsight,
} from "./timeUtils";

import {
  saveTimetable,
  extractTimetableFromFile,
} from "./timetableService";

import "./timetable.css";


const EMPTY_TIMETABLE = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
};


const DEFAULT_CONFIG = {
  collegeStartTime: "08:00",
  collegeEndTime: "17:00",
  slotDuration: 60,
};


const DEFAULT_PREFERENCES = {
  preferredEventDuration: ["1–2 hours"],
  bufferTime: 30,
  preferredEventTimes: ["afternoon"],
  notificationPrefs: [
    "New recommendations",
    "Registration deadlines",
  ],
};


function makeId() {
  return typeof crypto !== "undefined" &&
    crypto.randomUUID
    ? crypto.randomUUID()
    : `blk_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}`;
}


export default function TimetablePage({
  onBack,
  onContinue,
  initialData = null,
  mode = "onboarding",
}) {
  const isEdit = mode === "edit";
  const [config, setConfig] = useState(initialData?.config || DEFAULT_CONFIG);

  const [timetable, setTimetable] =
    useState(initialData?.timetable || EMPTY_TIMETABLE);

  const [preferences, setPreferences] =
    useState(initialData?.preferences || DEFAULT_PREFERENCES);

  const [modalState, setModalState] =
    useState(null);

  const [conflict, setConflict] =
    useState(null);

  const [isSaving, setIsSaving] =
    useState(false);

  const [saveError, setSaveError] =
    useState(null);

  const [showImportNotice, setShowImportNotice] =
    useState(false);


  // --------------------------------------------------
  // WEEKLY SUMMARY
  // --------------------------------------------------

  const summary = useMemo(
    () =>
      computeWeekSummary(
        timetable,
        config
      ),
    [timetable, config]
  );


  // --------------------------------------------------
  // AI INSIGHT
  // --------------------------------------------------

  const insight = useMemo(
    () =>
      generateAIInsight(summary),
    [summary]
  );


  // --------------------------------------------------
  // OPEN ADD / EDIT MODAL
  // --------------------------------------------------

  function openAddModal(day, block) {
    if (block) {
      setModalState({
        editing: {
          day,
          block,
        },
      });
    } else {
      setModalState({
        defaultDay: day,
      });
    }
  }


  // --------------------------------------------------
  // OPEN MODAL FROM FREE PERIOD
  // --------------------------------------------------

  function openFreeModal(day, range) {
    setModalState({
      defaultDay: day,
      defaultTimes: range,
    });
  }


  // --------------------------------------------------
  // CLOSE MODAL
  // --------------------------------------------------

  function closeModal() {
    setModalState(null);
  }


  // --------------------------------------------------
  // ADD / UPDATE BLOCK
  // --------------------------------------------------

  function commitBlock(day, block) {
    setTimetable((prev) => {
      const withoutOld =
        (prev[day] || []).filter(
          (b) => b.id !== block.id
        );

      return {
        ...prev,
        [day]: [
          ...withoutOld,
          {
            ...block,
            id: block.id || makeId(),
          },
        ],
      };
    });
  }


  // --------------------------------------------------
  // SAVE MODAL BLOCK
  // --------------------------------------------------

  function handleModalSave(
    days,
    blockData
  ) {
    // Check every selected day for conflicts
    for (const day of days) {
      const existing =
        findConflict(
          timetable,
          day,
          blockData.startTime,
          blockData.endTime,
          blockData.id
        );

      if (existing) {
        setConflict({
          day,
          existing,
          pendingDays: days,
          pendingBlock: blockData,
        });

        return;
      }
    }

    // No conflicts
    days.forEach((day) => {
      commitBlock(day, {
        ...blockData,
        id:
          blockData.id ||
          makeId(),
      });
    });

    closeModal();
  }


  // --------------------------------------------------
  // DELETE BLOCK
  // --------------------------------------------------

  function handleDelete(
    day,
    blockId
  ) {
    setTimetable((prev) => ({
      ...prev,
      [day]: prev[day].filter(
        (b) => b.id !== blockId
      ),
    }));

    closeModal();
  }


  // --------------------------------------------------
  // DUPLICATE BLOCK
  // --------------------------------------------------

  function handleDuplicate(
    day,
    block
  ) {
    setModalState({
      defaultDay: day,
    });

    setTimeout(() => {
      setModalState({
        editing: {
          day,
          block: {
            ...block,
            id: undefined,
            subject: `${block.subject} (copy)`,
          },
        },
      });
    }, 0);
  }


  // --------------------------------------------------
  // COPY DAY
  // --------------------------------------------------

  function handleCopyDay(
    fromDay
  ) {
    const target = window.prompt(
      `Copy ${
        DAY_LABELS[fromDay]
      }'s schedule to which day? (${DAYS.filter(
        (d) => d !== fromDay
      )
        .map(
          (d) => DAY_LABELS[d]
        )
        .join(", ")})`
    );

    if (!target) return;

    const toDay = DAYS.find(
      (d) =>
        DAY_LABELS[d]
          .toLowerCase() ===
        target
          .trim()
          .toLowerCase()
    );

    if (!toDay) {
      window.alert(
        "Please enter a valid weekday."
      );

      return;
    }

    setTimetable((prev) => ({
      ...prev,

      [toDay]: prev[fromDay].map(
        (b) => ({
          ...b,
          id: makeId(),
        })
      ),
    }));
  }


  // --------------------------------------------------
  // CLEAR DAY
  // --------------------------------------------------

  function handleClearDay(
    day
  ) {
    if (
      !window.confirm(
        `Clear everything on ${DAY_LABELS[day]}?`
      )
    ) {
      return;
    }

    setTimetable((prev) => ({
      ...prev,
      [day]: [],
    }));
  }


  // --------------------------------------------------
  // CLEAR ENTIRE TIMETABLE
  // --------------------------------------------------

  function handleClearAll() {
    if (
      !window.confirm(
        "Clear your entire timetable? This can't be undone."
      )
    ) {
      return;
    }

    setTimetable({
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
    });
  }


  // --------------------------------------------------
  // RESOLVE CONFLICT
  // --------------------------------------------------

  function resolveConflict(
    action
  ) {
    if (!conflict) return;

    const {
      pendingDays,
      pendingBlock,
      day,
      existing,
    } = conflict;


    // Cancel
    if (action === "cancel") {
      setConflict(null);
      return;
    }


    // Edit existing block
    if (
      action === "editExisting"
    ) {
      setConflict(null);

      setModalState({
        editing: {
          day,
          block: existing,
        },
      });

      return;
    }


    // Continue anyway
    if (
      action === "continue"
    ) {
      pendingDays.forEach(
        (d) => {
          commitBlock(d, {
            ...pendingBlock,
            id:
              pendingBlock.id ||
              makeId(),
          });
        }
      );

      setConflict(null);
      closeModal();
    }
  }


  // --------------------------------------------------
  // SAVE AND CONTINUE
  // --------------------------------------------------

  async function handleSaveAndContinue() {
    setIsSaving(true);
    setSaveError(null);

    const timetableData = {
      timetable,
      config,
      preferences,
    };

    try {
      await saveTimetable(
        timetableData
      );

      // Send the timetable data back
      // to StudentOnboarding
      onContinue?.(
        timetableData
      );

    } catch (err) {
      console.error(
        "Timetable save error:",
        err
      );

      setSaveError(
        err.message ||
          "Something went wrong saving your schedule. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }


  // --------------------------------------------------
  // IMPORT TIMETABLE FILE
  // --------------------------------------------------

  async function handleImportFile(
    file
  ) {
    setShowImportNotice(true);

    try {
      await extractTimetableFromFile(
        file
      );
    } catch (error) {
      // Timetable extraction is not implemented yet.
      console.log(
        "Timetable import:",
        error
      );
    }
  }


  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <div className="page">

      {/* ============================================
          HEADER
      ============================================ */}

      <header className="page-top">
        <div className="brand">
          <span className="brand-mark">
            CP
          </span>

          CampusPath{" "}

          <span className="brand-ai">
            AI
          </span>
        </div>
      </header>


      {/* ============================================
          PROGRESS
      ============================================ */}

      {!isEdit && <ProgressIndicator activeIndex={5} />}


      {/* ============================================
          MAIN
      ============================================ */}

      <main className="stage">

        {/* PAGE HEADING */}

        <div className="stage-head">

          <div className="eyebrow">
            {isEdit ? "EDIT TIMETABLE" : "STEP 6 OF 6"}
          </div>

          <h1>
            {isEdit ? "Update your weekly schedule" : "Let's map your weekly schedule"}
          </h1>

          <p>
            Tell CampusPath AI when you're
            busy and when you're free. We'll
            use your timetable to recommend
            opportunities that actually fit
            your schedule.
          </p>

        </div>


        {/* ========================================
            WHY WE ASK
        ======================================== */}

        <div className="why-card">

          <strong>
            Why we ask.
          </strong>{" "}

          Your timetable helps CampusPath AI
          avoid recommending events that
          conflict with classes, labs or other
          fixed commitments.

        </div>


        {/* ========================================
            CONFIGURATION
        ======================================== */}

        <div className="config-bar">

          {/* DAY START */}

          <label>

            Day starts

            <input
              type="time"
              className="field small"
              value={
                config.collegeStartTime
              }
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  collegeStartTime:
                    e.target.value,
                }))
              }
            />

          </label>


          {/* DAY END */}

          <label>

            Day ends

            <input
              type="time"
              className="field small"
              value={
                config.collegeEndTime
              }
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  collegeEndTime:
                    e.target.value,
                }))
              }
            />

          </label>


          {/* SLOT SIZE */}

          <label>

            Slot size

            <select
              className="field small"
              value={
                config.slotDuration
              }
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  slotDuration:
                    Number(
                      e.target.value
                    ),
                }))
              }
            >

              <option value={30}>
                10 min
              </option>

              <option value={60}>
                55 min
              </option>

              <option value={90}>
                50 min
              </option>

            </select>

          </label>


          {/* ACTIONS */}

          <div className="config-bar-actions">

            <button
              type="button"
              className="btn-ghost small"
              onClick={() =>
                openAddModal(
                  DAYS[0]
                )
              }
            >
              + Add class
            </button>


            <button
              type="button"
              className="btn-ghost small danger"
              onClick={
                handleClearAll
              }
            >
              Clear timetable
            </button>

          </div>

        </div>


        {/* ========================================
            TIMETABLE GRID
        ======================================== */}

        <TimetableGrid
          config={config}
          timetable={timetable}
          onBlockClick={
            openAddModal
          }
          onFreeClick={
            openFreeModal
          }
          onCopyDay={
            handleCopyDay
          }
          onClearDay={
            handleClearDay
          }
        />


        {/* ========================================
            WEEKLY SUMMARY
        ======================================== */}

        <WeeklySummary
          summary={summary}
        />


        {/* ========================================
            AI INSIGHT
        ======================================== */}

        <AIInsightCard
          text={insight}
        />


        {/* ========================================
            RECOMMENDATION EXAMPLE
        ======================================== */}

        <div className="example-card">

          <div className="example-title">
            How this becomes a recommendation
          </div>

          <p>
            Say Friday 2:00–5:00 PM is free,
            and an{" "}

            <strong>
              AI Hackathon Preparation Workshop
            </strong>{" "}

            runs 3:00–4:30 PM.

            CampusPath AI later checks
            interest, skill and career match,
            then confirms the timing:
          </p>


          <ul className="example-checks">

            <li>
              ✓ Available time
            </li>

            <li>
              ✓ Event duration fits
            </li>

            <li>
              ✓ No timetable conflict
            </li>

          </ul>


          <p className="example-result">
            → "Recommended for you"
          </p>

        </div>


        {/* ========================================
            AVAILABILITY PREFERENCES
        ======================================== */}

        <AvailabilityPreferences
          preferences={
            preferences
          }
          onChange={
            setPreferences
          }
          onImportClick={() =>
            document
              .getElementById(
                "timetable-upload-input"
              )
              .click()
          }
        />


        {/* ========================================
            FILE UPLOAD
        ======================================== */}

        <input
          id="timetable-upload-input"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.xlsx"
          style={{
            display: "none",
          }}
          onChange={(e) => {
            const file =
              e.target.files?.[0];

            if (file) {
              handleImportFile(
                file
              );
            }
          }}
        />


        {/* ========================================
            IMPORT MESSAGE
        ======================================== */}

        {showImportNotice && (
          <p
            className="import-hint"
            role="status"
          >
            AI timetable extraction is
            coming soon — for now, add
            your classes above.
          </p>
        )}


        {/* ========================================
            SAVE ERROR
        ======================================== */}

        {saveError && (
          <p
            className="save-error"
            role="alert"
          >
            {saveError}
          </p>
        )}


        {/* ========================================
            NAVIGATION
        ======================================== */}

        <div className="nav-btns">

          <button
            type="button"
            className="btn-back"
            onClick={onBack}
            disabled={isSaving}
          >
            {isEdit ? "Cancel" : "Back"}
          </button>


          <button
            type="button"
            className="btn-primary"
            onClick={
              handleSaveAndContinue
            }
            disabled={isSaving}
          >
            {isSaving
              ? "Saving…"
              : isEdit
              ? "Save changes"
              : "Save & Continue →"}
          </button>

        </div>

      </main>


      {/* ============================================
          ADD / EDIT CLASS MODAL
      ============================================ */}

      <AddClassModal
        isOpen={!!modalState}
        editing={
          modalState?.editing
        }
        defaultDay={
          modalState?.defaultDay
        }
        defaultTimes={
          modalState?.defaultTimes
        }
        onClose={
          closeModal
        }
        onSave={
          handleModalSave
        }
        onDelete={
          handleDelete
        }
        onDuplicate={
          handleDuplicate
        }
      />


      {/* ============================================
          CONFLICT DIALOG
      ============================================ */}

      <ConflictDialog
        conflict={conflict}
        onCancel={() =>
          resolveConflict(
            "cancel"
          )
        }
        onEditExisting={() =>
          resolveConflict(
            "editExisting"
          )
        }
        onContinueAnyway={() =>
          resolveConflict(
            "continue"
          )
        }
      />

    </div>
  );
}