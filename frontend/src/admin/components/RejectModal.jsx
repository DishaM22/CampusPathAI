import React, { useState } from "react";

const REASONS = [
  "Invalid student/institution information",
  "Cannot verify club affiliation",
  "Invalid documents",
  "Organization could not be verified",
  "Duplicate organization",
  "Insufficient information",
  "Other",
];

export default function RejectModal({ open, onCancel, onReject, isSubmitting }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  if (!open) return null;

  function handleReject() {
    if (!reason) return; // a reason is mandatory — no silent rejection
    onReject({ reason, note: note.trim() });
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Reject application">
      <div className="modal-panel">
        <h2>Reject Application</h2>
        <p className="modal-message">Select a reason. This will be shown to the applicant.</p>

        <label>Reason</label>
        <select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="" disabled>Select a reason…</option>
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <label>Additional explanation (optional)</label>
        <textarea
          className="field"
          rows="3"
          placeholder="e.g. Please provide confirmation from the department/club coordinator."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="modal-actions-right">
          <button className="btn-ghost" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
          <button className="btn-danger" onClick={handleReject} disabled={!reason || isSubmitting}>
            {isSubmitting ? "Rejecting…" : "Reject Application"}
          </button>
        </div>
      </div>
    </div>
  );
}
