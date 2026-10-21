import React, { useEffect, useState } from "react";
import { DAYS, DAY_LABELS, CLASS_TYPES, BREAK_TYPES } from "../timeUtils";

const EMPTY_FORM = {
  subject: "",
  courseCode: "",
  blockType: "class", // "class" | "break"
  type: "lecture",
  faculty: "",
  room: "",
  startTime: "10:00",
  endTime: "11:00",
  notes: "",
};

/**
 * One modal, two modes:
 *  - Quick add: no `editing` prop -> student can check multiple days,
 *    the same block gets created on each one (handles repeated classes).
 *  - Edit: `editing = { day, block }` -> day is locked, Delete/Duplicate shown.
 *
 * onSave(days: string[], blockData) is called with the days to write to.
 * The parent (TimetablePage) owns conflict detection so it can show the
 * "Schedule conflict" dialog before committing.
 */
export default function AddClassModal({ isOpen, onClose, onSave, onDelete, onDuplicate, editing, defaultDay }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedDays, setSelectedDays] = useState(defaultDay ? [defaultDay] : []);

  useEffect(() => {
    if (editing) {
      setForm({ ...EMPTY_FORM, ...editing.block, blockType: editing.block.type && BREAK_TYPES.includes(editing.block.type) ? "break" : "class" });
      setSelectedDays([editing.day]);
    } else {
      setForm(EMPTY_FORM);
      setSelectedDays(defaultDay ? [defaultDay] : []);
    }
  }, [editing, defaultDay, isOpen]);

  if (!isOpen) return null;

  const typeOptions = form.blockType === "break" ? BREAK_TYPES : CLASS_TYPES;

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleDay(day) {
    if (editing) return; // day is locked while editing a single instance
    setSelectedDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.subject.trim() || selectedDays.length === 0) return;
    onSave(selectedDays, {
      id: editing?.block.id, // undefined for new blocks; parent assigns an id
      subject: form.subject.trim(),
      courseCode: form.courseCode.trim(),
      type: form.type,
      faculty: form.faculty.trim(),
      room: form.room.trim(),
      startTime: form.startTime,
      endTime: form.endTime,
      notes: form.notes.trim(),
    });
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={editing ? "Edit class" : "Add class"}>
      <form className="modal-panel" onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2>{editing ? "Edit block" : "Add to timetable"}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="segmented" role="tablist" aria-label="Block type">
          <button type="button" role="tab" aria-selected={form.blockType === "class"} className={form.blockType === "class" ? "active" : ""} onClick={() => { update("blockType", "class"); update("type", "lecture"); }}>
            Class
          </button>
          <button type="button" role="tab" aria-selected={form.blockType === "break"} className={form.blockType === "break" ? "active" : ""} onClick={() => { update("blockType", "break"); update("type", "lunch"); }}>
            Break / Personal
          </button>
        </div>

        <label htmlFor="subject">{form.blockType === "break" ? "Label" : "Subject / class name"}</label>
        <input id="subject" className="field" required value={form.subject}
          placeholder={form.blockType === "break" ? "Lunch" : "Machine Learning"}
          onChange={(e) => update("subject", e.target.value)} />

        {form.blockType === "class" && (
          <>
            <label htmlFor="code">Course code (optional)</label>
            <input id="code" className="field" value={form.courseCode} placeholder="AIML401" onChange={(e) => update("courseCode", e.target.value)} />
          </>
        )}

        <label htmlFor="type">Type</label>
        <select id="type" className="field" value={form.type} onChange={(e) => update("type", e.target.value)}>
          {typeOptions.map((t) => <option value={t} key={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
        </select>

        <div className="field-row">
          <div>
            <label htmlFor="start">Start time</label>
            <input id="start" type="time" className="field" required value={form.startTime} onChange={(e) => update("startTime", e.target.value)} />
          </div>
          <div>
            <label htmlFor="end">End time</label>
            <input id="end" type="time" className="field" required value={form.endTime} onChange={(e) => update("endTime", e.target.value)} />
          </div>
        </div>

        {form.blockType === "class" && (
          <div className="field-row">
            <div>
              <label htmlFor="faculty">Faculty (optional)</label>
              <input id="faculty" className="field" value={form.faculty} onChange={(e) => update("faculty", e.target.value)} />
            </div>
            <div>
              <label htmlFor="room">Room (optional)</label>
              <input id="room" className="field" value={form.room} placeholder="Lab 3" onChange={(e) => update("room", e.target.value)} />
            </div>
          </div>
        )}

        <label>{editing ? "Day" : "Repeat on"}</label>
        <div className="day-check-row">
          {DAYS.map((day) => (
            <button type="button" key={day}
              className={`day-check ${selectedDays.includes(day) ? "active" : ""} ${editing ? "locked" : ""}`}
              aria-pressed={selectedDays.includes(day)}
              onClick={() => toggleDay(day)}>
              {DAY_LABELS[day].slice(0, 3)}
            </button>
          ))}
        </div>

        <label htmlFor="notes">Notes (optional)</label>
        <textarea id="notes" className="field" rows="2" value={form.notes} onChange={(e) => update("notes", e.target.value)} />

        <div className="modal-actions">
          {editing ? (
            <div className="modal-actions-left">
              <button type="button" className="btn-ghost danger" onClick={() => onDelete(editing.day, editing.block.id)}>Delete</button>
              <button type="button" className="btn-ghost" onClick={() => onDuplicate(editing.day, editing.block)}>Duplicate</button>
            </div>
          ) : <div />}
          <div className="modal-actions-right">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={selectedDays.length === 0}>Save</button>
          </div>
        </div>
      </form>
    </div>
  );
}
