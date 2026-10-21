import React from "react";

const CONFIG = {
  draft: { label: "Draft", className: "status-draft" },
  published: { label: "Published", className: "status-published" },
  closed: { label: "Closed", className: "status-closed" },
  completed: { label: "Completed", className: "status-completed" },
  cancelled: { label: "Cancelled", className: "status-cancelled" },
};

export default function StatusBadge({ status }) {
  const cfg = CONFIG[status] || CONFIG.draft;
  return <span className={`status-badge ${cfg.className}`}>{cfg.label}</span>;
}
