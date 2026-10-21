import React from "react";
import StatusBadge from "./StatusBadge";

export function VerificationItem({ label, status, value }) {
  return (
    <div className="verify-row">
      <div>
        <div className="verify-label">{label}</div>
        {value && <div className="verify-value">{value}</div>}
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

/**
 * `documents`: [{ id, name, type: "pdf"|"image", url }]
 * Admin can open/download — nothing here auto-approves anything.
 */
export function DocumentList({ documents = [] }) {
  if (documents.length === 0) {
    return <p className="verify-empty">No documents submitted.</p>;
  }
  return (
    <div className="document-list">
      {documents.map((doc) => (
        <div className="document-row" key={doc.id}>
          <span className="doc-icon" aria-hidden="true">{doc.type === "pdf" ? "📄" : "🖼️"}</span>
          <span className="doc-name">{doc.name}</span>
          <div className="doc-actions">
            <a className="btn-ghost small" href={doc.url} target="_blank" rel="noreferrer">Preview</a>
            <a className="btn-ghost small" href={doc.url} download>Download</a>
          </div>
        </div>
      ))}
    </div>
  );
}
