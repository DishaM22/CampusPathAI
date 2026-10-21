import React from "react";
import { DAY_LABELS, formatTime } from "../timeUtils";

export default function ConflictDialog({ conflict, onCancel, onEditExisting, onContinueAnyway }) {
  if (!conflict) return null;
  const { day, existing } = conflict;

  return (
    <div className="modal-overlay" role="alertdialog" aria-modal="true" aria-label="Schedule conflict">
      <div className="modal-panel small">
        <div className="conflict-icon" aria-hidden="true">!</div>
        <h2>Schedule conflict</h2>
        <p>
          You already have <strong>{existing.subject}</strong> from {formatTime(existing.startTime)}–{formatTime(existing.endTime)} on {DAY_LABELS[day]}.
        </p>
        <div className="modal-actions-right stacked">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-ghost" onClick={onEditExisting}>Edit existing class</button>
          <button className="btn-primary" onClick={onContinueAnyway}>Continue anyway</button>
        </div>
      </div>
    </div>
  );
}
