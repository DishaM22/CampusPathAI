import React from "react";

export default function AIInsightCard({ text }) {
  return (
    <div className="ai-insight-card">
      <div className="ai-insight-icon" aria-hidden="true">AI</div>
      <div>
        <div className="ai-insight-title">CampusPath AI Insight</div>
        <p className="ai-insight-text">{text}</p>
      </div>
    </div>
  );
}
