import React from "react";

/**
 * `trend` is optional: { direction: "up"|"down", label: "+12% this month" }.
 * `isSample` renders a small "Sample data" tag — used until the real
 * analytics endpoint is wired up, so nobody mistakes placeholders for facts.
 */
export default function StatCard({ icon, label, value, trend, isSample }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-icon" aria-hidden="true">{icon}</span>
        {isSample && <span className="sample-tag">Sample data</span>}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {trend && (
        <div className={`stat-trend ${trend.direction}`}>
          {trend.direction === "up" ? "▲" : "▼"} {trend.label}
        </div>
      )}
    </div>
  );
}
