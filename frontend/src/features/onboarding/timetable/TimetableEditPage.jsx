import { useEffect, useState } from "react";
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
