import React from "react";
import { DAY_LABELS, formatDuration } from "../timeUtils";

export default function WeeklySummary({ summary }) {
  const { classes, labs, freePeriods, freeMinutes, busiestDay, mostAvailableDay } = summary;

  const stats = [
    { label: "Classes", value: classes },
    { label: "Labs", value: labs },
    { label: "Free periods", value: freePeriods },
    { label: "Free hours", value: formatDuration(freeMinutes) },
    { label: "Busiest day", value: DAY_LABELS[busiestDay] },
    { label: "Most available", value: DAY_LABELS[mostAvailableDay] },
  ];

  return (
    <div className="summary-card">
      <h3>Your week</h3>
      <div className="summary-grid">
        {stats.map((s) => (
          <div className="summary-stat" key={s.label}>
            <div className="summary-value">{s.value}</div>
            <div className="summary-label">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
