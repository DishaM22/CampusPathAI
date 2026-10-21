import React from "react";

export function EmptyState({ icon = "📭", title, message, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      <p>{message}</p>
      {actionLabel && <button className="btn-primary" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

export function ErrorState({ message = "Unable to load this page. Please try again.", onRetry }) {
  return (
    <div className="empty-state error">
      <div className="empty-icon" aria-hidden="true">⚠️</div>
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {onRetry && <button className="btn-ghost" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="stat-card skeleton">
      <div className="sk-line w-30" />
      <div className="sk-line w-50 h-lg" />
      <div className="sk-line w-40" />
    </div>
  );
}

export function TableRowSkeleton({ columns = 6 }) {
  return (
    <tr className="skeleton">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i}><div className="sk-line w-80" /></td>
      ))}
    </tr>
  );
}
