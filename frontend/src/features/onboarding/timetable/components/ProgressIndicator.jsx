import React from "react";

const STEPS = ["Academic", "Interests", "Skills", "Goals", "Domains", "Timetable"];

/**
 * activeIndex is 0-based. Every step before it renders as done (checkmark),
 * the step at activeIndex renders as active, everything after is upcoming.
 */
export default function ProgressIndicator({ activeIndex = 5 }) {
  return (
    <div className="progress-track" role="list" aria-label="Onboarding progress">
      {STEPS.map((label, i) => {
        const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "";
        return (
          <div className={`step-node ${state}`} role="listitem" key={label} aria-current={i === activeIndex ? "step" : undefined}>
            {i > 0 && <div className="step-line" aria-hidden="true" />}
            <div className="step-circle">{i < activeIndex ? "✓" : String(i + 1).padStart(2, "0")}</div>
            <div className="step-label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
