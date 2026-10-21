import React, { useState } from "react";
import {
  DAYS,
  DAY_LABELS,
  generateTimeSlots,
  computeFreeRanges,
  toMinutes,
  formatTime,
  formatDuration,
} from "../timeUtils";

const PX_PER_MIN = 1.1;

function ScheduleBlock({ block, onClick }) {
  const top = 0; // positioned by parent wrapper
  const isBreak = ["lunch", "break", "personal", "travel"].includes(block.type);
  return (
    <button
      type="button"
      className={`schedule-block type-${block.type}`}
      onClick={onClick}
      aria-label={`${block.subject}, ${formatTime(block.startTime)} to ${formatTime(block.endTime)}`}
    >
      <span className="block-subject">{block.subject}</span>
      {!isBreak && block.room && <span className="block-meta">{block.room}</span>}
      <span className="block-time">{formatTime(block.startTime)}–{formatTime(block.endTime)}</span>
    </button>
  );
}

function FreeIndicator({ range, onClick }) {
  return (
    <button type="button" className="free-block" onClick={onClick}>
      <span>FREE • {formatDuration(range.minutes)}</span>
    </button>
  );
}

export default function TimetableGrid({ config, timetable, onBlockClick, onFreeClick, onCopyDay, onClearDay }) {
  const [mobileDay, setMobileDay] = useState("monday");
  const slots = generateTimeSlots(config.collegeStartTime, config.collegeEndTime, config.slotDuration);
  const dayStartMin = toMinutes(config.collegeStartTime);
  const dayEndMin = toMinutes(config.collegeEndTime);
  const columnHeight = (dayEndMin - dayStartMin) * PX_PER_MIN;

  function renderColumnContent(day) {
    const blocks = timetable[day] || [];
    const free = computeFreeRanges(blocks, config.collegeStartTime, config.collegeEndTime);
    const items = [
      ...blocks.map((b) => ({ kind: "block", start: b.startTime, end: b.endTime, data: b })),
      ...free.map((r) => ({ kind: "free", start: r.start, end: r.end, data: r })),
    ].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

    return items.map((item, i) => {
      const top = (toMinutes(item.start) - dayStartMin) * PX_PER_MIN;
      const height = (toMinutes(item.end) - toMinutes(item.start)) * PX_PER_MIN;
      return (
        <div className="block-wrapper" style={{ top, height }} key={i}>
          {item.kind === "block" ? (
            <ScheduleBlock block={item.data} onClick={() => onBlockClick(day, item.data)} />
          ) : (
            <FreeIndicator range={item.data} onClick={() => onFreeClick(day, item.data)} />
          )}
        </div>
      );
    });
  }

  return (
    <>
      {/* Desktop / tablet: full week grid */}
      <div className="timetable-grid desktop-only" role="grid" aria-label="Weekly timetable">
        <div className="time-axis">
          <div className="axis-header" />
          {slots.map((s) => (
            <div className="axis-slot" style={{ height: config.slotDuration * PX_PER_MIN }} key={s.start}>
              {s.label.split(" – ")[0]}
            </div>
          ))}
        </div>
        {DAYS.map((day) => (
          <div className="day-column" key={day}>
            <div className="day-header">
              <span>{DAY_LABELS[day]}</span>
              <span className="day-header-actions">
                <button type="button" title={`Copy ${DAY_LABELS[day]} to other days`} onClick={() => onCopyDay(day)}>⧉</button>
                <button type="button" title={`Clear ${DAY_LABELS[day]}`} onClick={() => onClearDay(day)}>🗑</button>
              </span>
            </div>
            <div className="day-body" style={{ height: columnHeight }} onClick={(e) => e.currentTarget === e.target && onBlockClick(day, null)}>
              {slots.map((s) => (
                <div className="grid-line" style={{ height: config.slotDuration * PX_PER_MIN }} key={s.start} />
              ))}
              <div className="blocks-layer">{renderColumnContent(day)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: day selector + vertical agenda */}
      <div className="mobile-only">
        <div className="day-tabs" role="tablist">
          {DAYS.map((day) => (
            <button
              key={day}
              role="tab"
              aria-selected={mobileDay === day}
              className={`day-tab ${mobileDay === day ? "active" : ""}`}
              onClick={() => setMobileDay(day)}
            >
              {DAY_LABELS[day].slice(0, 3)}
            </button>
          ))}
        </div>
        <div className="agenda-list">
          {(() => {
            const blocks = timetable[mobileDay] || [];
            const free = computeFreeRanges(blocks, config.collegeStartTime, config.collegeEndTime);
            const items = [
              ...blocks.map((b) => ({ kind: "block", start: b.startTime, end: b.endTime, data: b })),
              ...free.map((r) => ({ kind: "free", start: r.start, end: r.end, data: r })),
            ].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

            if (items.length === 0) {
              return <p className="agenda-empty">Nothing added for {DAY_LABELS[mobileDay]} yet.</p>;
            }

            return items.map((item, i) =>
              item.kind === "block" ? (
                <button key={i} className={`agenda-row type-${item.data.type}`} onClick={() => onBlockClick(mobileDay, item.data)}>
                  <span className="agenda-time">{formatTime(item.start)}–{formatTime(item.end)}</span>
                  <span className="agenda-subject">{item.data.subject}</span>
                </button>
              ) : (
                <button key={i} className="agenda-row free" onClick={() => onFreeClick(mobileDay, item.data)}>
                  <span className="agenda-time">{formatTime(item.start)}–{formatTime(item.end)}</span>
                  <span className="agenda-subject">FREE • {formatDuration(item.data.minutes)}</span>
                </button>
              )
            );
          })()}
        </div>
        <button className="btn-ghost full-width" onClick={() => onBlockClick(mobileDay, null)}>+ Add to {DAY_LABELS[mobileDay]}</button>
      </div>
    </>
  );
}
