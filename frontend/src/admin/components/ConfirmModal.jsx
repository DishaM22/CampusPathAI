import React from "react";

/**
 * Reused for every "are you sure" moment in the admin UI:
 * approve organization, deactivate organization/user, cancel/delete event.
 * `tone`: "primary" (approve, confirm) | "danger" (deactivate, delete, cancel).
 */
export default function ConfirmModal({ open, tone = "primary", title, message, confirmLabel = "Confirm", onCancel, onConfirm, isSubmitting }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="modal-panel small">
        <h2>{title}</h2>
        <p className="modal-message">{message}</p>
        <div className="modal-actions-right">
          <button className="btn-ghost" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
          <button className={tone === "danger" ? "btn-danger" : "btn-primary"} onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
