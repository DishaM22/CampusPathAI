import React from "react";

const CONFIG = {
  // event statuses
  draft: { label: "Draft", className: "status-draft" },
  published: { label: "Published", className: "status-published" },
  closed: { label: "Closed", className: "status-closed" },
  completed: { label: "Completed", className: "status-completed" },
  cancelled: { label: "Cancelled", className: "status-cancelled" },
  // application / organization / user statuses
  pending: { label: "Pending", className: "status-pending" },
  active: { label: "Active", className: "status-published" },
  rejected: { label: "Rejected", className: "status-cancelled" },
  deactivated: { label: "Deactivated", className: "status-draft" },
  // verification item statuses
  submitted: { label: "Submitted", className: "status-pending" },
  not_submitted: { label: "Not Submitted", className: "status-draft" },
  verified: { label: "Verified", className: "status-published" },
  needs_review: { label: "Needs Review", className: "status-closed" },
};

/** Text label always renders alongside color — never color-only, per a11y requirement. */
export default function StatusBadge({ status }) {
  const cfg = CONFIG[status] || { label: status, className: "status-draft" };
  return <span className={`status-badge ${cfg.className}`}>{cfg.label}</span>;
}
