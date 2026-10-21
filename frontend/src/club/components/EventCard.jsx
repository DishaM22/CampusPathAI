import React from "react";
import StatusBadge from "./StatusBadge";

export default function EventCard({ event, onView, onEdit, onRegistrations }) {
  const { title, category, date, time, venue, registered, capacity, status } = event;
  const pct = capacity ? Math.min(100, Math.round((registered / capacity) * 100)) : 0;

  return (
    <div className="event-card">
      <div className="event-card-top">
        <span className="tag">{category}</span>
        <StatusBadge status={status} />
      </div>
      <h3>{title}</h3>
      <div className="event-meta">{date} · {time} · {venue}</div>

      <div className="capacity-row">
        <div className="capacity-bar"><div className="capacity-fill" style={{ width: `${pct}%` }} /></div>
        <span className="capacity-text">{registered} / {capacity} registered</span>
      </div>

      <div className="event-card-actions">
        <button className="btn-ghost small" onClick={() => onView(event)}>View</button>
        <button className="btn-ghost small" onClick={() => onEdit(event)}>Edit</button>
        <button className="btn-ghost small" onClick={() => onRegistrations(event)}>Registrations</button>
      </div>
    </div>
  );
}
