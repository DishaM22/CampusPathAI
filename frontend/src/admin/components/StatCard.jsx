import React from "react";

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
        <div className={`stat-trend ${trend.direction}`}>{trend.direction === "up" ? "▲" : "▼"} {trend.label}</div>
      )}
    </div>
  );
}
