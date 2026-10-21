import React from "react";

const DURATION_OPTIONS = ["30–60 minutes", "1–2 hours", "2–3 hours", "Half day", "Full day"];
const BUFFER_OPTIONS = [
  { value: 0, label: "No buffer" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
];
const TIME_OPTIONS = ["Morning", "Afternoon", "Evening", "Weekend"];
const NOTIFICATION_OPTIONS = [
  "New recommendations",
  "Registration deadlines",
  "Event reminders",
  "Schedule conflicts",
  "Seat availability",
];

function toggleInArray(arr, value) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function AvailabilityPreferences({ preferences, onChange, onImportClick }) {
  const update = (patch) => onChange({ ...preferences, ...patch });

  return (
    <div className="prefs-card">
      <div>
        <label className="prefs-label">What event duration works best for you?</label>
        <div className="pill-row">
          {DURATION_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt}
              className={`pill-opt ${preferences.preferredEventDuration.includes(opt) ? "active" : ""}`}
              onClick={() => update({ preferredEventDuration: toggleInArray(preferences.preferredEventDuration, opt) })}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="prefs-label">How much buffer time do you need between classes and events?</label>
        <select className="field" value={preferences.bufferTime} onChange={(e) => update({ bufferTime: Number(e.target.value) })}>
          {BUFFER_OPTIONS.map((o) => <option value={o.value} key={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <label className="prefs-label">Preferred event times</label>
        <div className="chip-grid">
          {TIME_OPTIONS.map((opt) => {
            const key = opt.toLowerCase();
            return (
              <button
                type="button"
                key={opt}
                className={`chip ${preferences.preferredEventTimes.includes(key) ? "active" : ""}`}
                onClick={() => update({ preferredEventTimes: toggleInArray(preferences.preferredEventTimes, key) })}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="prefs-label">Notify me about</label>
        <div className="chip-grid">
          {NOTIFICATION_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt}
              className={`chip ${preferences.notificationPrefs.includes(opt) ? "active" : ""}`}
              onClick={() => update({ notificationPrefs: toggleInArray(preferences.notificationPrefs, opt) })}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="import-row">
        <div>
          <div className="prefs-label" style={{ marginBottom: 2 }}>Already have a timetable?</div>
          <p className="import-hint">AI timetable extraction (PDF, image, Excel) is coming soon.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={onImportClick}>Upload timetable</button>
      </div>
    </div>
  );
}
