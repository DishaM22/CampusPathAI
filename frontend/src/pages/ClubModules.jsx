import React, { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useParams
} from "react-router-dom";
import "../club-modules.css";
import { ScanAttendance } from "./ClubAttendanceScanner";
const API_BASE = "http://127.0.0.1:8000";


// ============================================================
// HELPERS
// ============================================================

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("jwt") ||
    ""
  );
}

async function apiFetch(url, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      message: text,
    };
  }

if (!response.ok) {
  let errorMessage = `Request failed with status ${response.status}`;

  if (Array.isArray(data?.detail)) {
    errorMessage = data.detail
      .map((item) => {
        const field = Array.isArray(item?.loc)
          ? item.loc.filter((x) => x !== "body").join(".")
          : "";

        const message = item?.msg || "Invalid value";

        return field
          ? `${field}: ${message}`
          : message;
      })
      .join(", ");
  } else if (data?.detail) {
    errorMessage = data.detail;
  } else if (data?.message) {
    errorMessage = data.message;
  }

  throw new Error(errorMessage);
}
  return data;
}


// ============================================================
// POSTER + RESOURCE PERSON HELPERS (shared by create / edit / view)
// ============================================================

const MAX_POSTER_BYTES = 3 * 1024 * 1024;
const POSTER_TYPES = ["image/png", "image/jpeg", "image/webp"];

// The backend stores posters as "/uploads/posters/<name>.png".
// The browser needs the full address (or a local blob: preview).
function posterSrc(url) {
  if (!url) return "";

  const text = String(url);

  if (/^(https?:|blob:)/i.test(text)) return text;

  return `${API_BASE.replace(/\/$/, "")}/${text.replace(/^\//, "")}`;
}

// Uploads a poster and returns its stored address.
// (apiFetch can't be used: it forces a JSON Content-Type.)
async function uploadPosterFile(file) {
  const body = new FormData();
  body.append("file", file);

  const token = getToken();

  const response = await fetch(`${API_BASE}/api/events/poster`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      typeof result?.detail === "string"
        ? result.detail
        : response.status;

    throw new Error(`Poster upload failed: ${detail}`);
  }

  if (!result.poster_url) {
    throw new Error("Poster upload did not return a URL.");
  }

  return result.poster_url;
}

function usePoster() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [inputKey, setInputKey] = useState(0);

  // Free the temporary blob: address when the preview changes / unmounts
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // Returns true when a valid file was picked
  function choose(changeEvent) {
    const picked =
      changeEvent.target.files && changeEvent.target.files[0];

    // File picker cancelled: keep the current selection
    if (!picked) return false;

    if (!POSTER_TYPES.includes(picked.type)) {
      window.alert("Poster must be a PNG, JPG or WEBP image.");
      changeEvent.target.value = "";
      return false;
    }

    if (picked.size > MAX_POSTER_BYTES) {
      window.alert("Poster is too large (maximum 3 MB).");
      changeEvent.target.value = "";
      return false;
    }

    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    return true;
  }

  // Drop any chosen file and show `fallbackUrl` (the saved poster) instead
  function clear(fallbackUrl = "") {
    setFile(null);
    setPreview(posterSrc(fallbackUrl));
    setInputKey((key) => key + 1);
  }

  return { file, preview, inputKey, choose, clear };
}

function PosterField({ poster, onPick, children }) {
  return (
    <div className="form-group">
      <label>Event Poster (optional)</label>

      <input
        key={poster.inputKey}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          if (poster.choose(e) && onPick) onPick();
        }}
      />

      <small className="form-help">
        PNG, JPG or WEBP, up to 3 MB. A wide image (about 1200 x 630)
        looks best.
      </small>

      {poster.preview && (
        <div style={{ marginTop: "10px" }}>
          <img
            src={poster.preview}
            alt="Event poster preview"
            style={{
              display: "block",
              width: "100%",
              maxWidth: "420px",
              maxHeight: "260px",
              objectFit: "contain",
              borderRadius: "12px",
            }}
          />
        </div>
      )}

      {children}
    </div>
  );
}


const MAX_REPORT_BYTES = 10 * 1024 * 1024; // 10 MB

async function uploadEventReport(file) {
  if (!file) return null;

  if (
    file.type !== "application/pdf" ||
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Event report must be a PDF file.");
  }

  if (file.size > MAX_REPORT_BYTES) {
    throw new Error("Event report must be 10 MB or smaller.");
  }

  const body = new FormData();
  body.append("file", file);

  const token = getToken();

  const response = await fetch(`${API_BASE}/api/events/report`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result?.detail || "Failed to upload event report."
    );
  }

  if (!result.report_pdf_url) {
    throw new Error("Report upload did not return a file URL.");
  }

  return result.report_pdf_url;
}

const emptyResourcePerson = () => ({
  name: "",
  designation: "",
  organization: "",
  linkedin_url: "",
});

// Saved event -> editable rows
function resourcePersonsFromEvent(event) {
  return Array.isArray(event?.resource_persons) &&
    event.resource_persons.length > 0
    ? event.resource_persons.map((person) => ({
        name: person.name || "",
        designation: person.designation || "",
        organization: person.organization || "",
        linkedin_url: person.linkedin_url || "",
      }))
    : [emptyResourcePerson()];
}

// Editable rows -> payload (empty rows dropped)
function cleanResourcePersons(persons) {
  return persons
    .map((person) => ({
      name: person.name.trim(),
      designation: person.designation.trim(),
      organization: person.organization.trim(),
      linkedin_url: person.linkedin_url.trim(),
    }))
    .filter(
      (person) =>
        person.name ||
        person.designation ||
        person.organization ||
        person.linkedin_url
    );
}

function ResourcePersonsField({ persons, setPersons }) {
  function change(index, field, value) {
    setPersons((previous) =>
      previous.map((person, i) =>
        i === index ? { ...person, [field]: value } : person
      )
    );
  }

  const boxStyle = {
    marginTop: "6px",
    padding: "16px",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    borderRadius: "12px",
  };

  return (
    <div className="form-group">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <label style={{ marginBottom: "2px" }}>
            Resource Person(s)
          </label>
          <small className="form-help">
            Add speakers, mentors, judges, or other event experts.
          </small>
        </div>

        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            setPersons((previous) => [
              ...previous,
              emptyResourcePerson(),
            ])
          }
        >
          + Add Resource Person
        </button>
      </div>

      {persons.map((person, index) => {
        const otherFilled = Boolean(
          person.organization.trim() || person.linkedin_url.trim()
        );
        const nameRequired = Boolean(
          person.designation.trim() || otherFilled
        );
        const designationRequired = Boolean(
          person.name.trim() || otherFilled
        );

        return (
          <div key={index} style={boxStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <strong>Resource Person {index + 1}</strong>

              {persons.length > 1 && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    setPersons((previous) =>
                      previous.filter((_, i) => i !== index)
                    )
                  }
                >
                  Remove
                </button>
              )}
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={person.name}
                  onChange={(e) =>
                    change(index, "name", e.target.value)
                  }
                  placeholder="Enter full name"
                  required={nameRequired}
                />
              </div>

              <div className="form-group">
                <label>Designation</label>
                <input
                  type="text"
                  value={person.designation}
                  onChange={(e) =>
                    change(index, "designation", e.target.value)
                  }
                  placeholder="e.g. AI Research Engineer"
                  required={designationRequired}
                />
              </div>

              <div className="form-group">
                <label>Organization / Company</label>
                <input
                  type="text"
                  value={person.organization}
                  onChange={(e) =>
                    change(index, "organization", e.target.value)
                  }
                  placeholder="Enter organization"
                />
              </div>

              <div className="form-group">
                <label>LinkedIn Profile URL</label>
                <input
                  type="url"
                  value={person.linkedin_url}
                  onChange={(e) =>
                    change(index, "linkedin_url", e.target.value)
                  }
                  placeholder="https://www.linkedin.com/in/username"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResourcePersonsView({ persons }) {
  if (!Array.isArray(persons) || persons.length === 0) return null;

  return (
    <div className="event-skills">
      <h3>Resource Person(s)</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "12px",
          marginTop: "10px",
        }}
      >
        {persons.map((person, index) => (
          <div
            key={index}
            style={{
              padding: "14px 16px",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              borderRadius: "12px",
              background: "rgba(148, 163, 184, 0.06)",
            }}
          >
            <strong style={{ display: "block" }}>{person.name}</strong>

            {person.designation && (
              <div style={{ fontSize: "14px", opacity: 0.85 }}>
                {person.designation}
              </div>
            )}

            {person.organization && (
              <div style={{ fontSize: "13px", opacity: 0.7 }}>
                {person.organization}
              </div>
            )}

            {/^https?:\/\//i.test(person.linkedin_url || "") && (
              <a
                href={person.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  marginTop: "8px",
                  fontSize: "13px",
                }}
              >
                LinkedIn profile ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}



// ============================================================
// COMMON PAGE WRAPPER
// ============================================================

function Page({ title, subtitle, children }) {
  return (
    <div className="club-module-page">
      <div className="club-module-header">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      {children}
    </div>
  );
}


// ============================================================
// COMMON CARD
// ============================================================

function Card({ children, className = "" }) {
  return (
    <div className={`club-card ${className}`}>
      {children}
    </div>
  );
}


// ============================================================
// LOADING
// ============================================================

function Loading() {
  return (
    <div className="club-loading">
      Loading...
    </div>
  );
}


// ============================================================
// ERROR
// ============================================================

function ErrorBox({ message }) {
  if (!message) return null;

  return (
    <div className="club-error">
      {message}
    </div>
  );
}


// ============================================================
// MY CLUB
// ============================================================

export function MyClub() {
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadClub();
  }, []);

  async function loadClub() {
    try {
      setLoading(true);
      setError("");

      const data = await apiFetch("/api/club/dashboard");

      setClub(data.club || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Page
        title="My Club"
        subtitle="View and manage your club information."
      >
        <Loading />
      </Page>
    );
  }

  return (
    <Page
      title="My Club"
      subtitle="View and manage your club information."
    >
      <ErrorBox message={error} />

      <div className="club-profile-grid">

        <Card>
          <div className="club-big-avatar">
            {(club?.name || "C").charAt(0).toUpperCase()}
          </div>

          <h2>{club?.name || "Beta Club"}</h2>

          <p className="muted">
            Club Leader
          </p>
        </Card>


        <Card>
          <h3>Club Information</h3>

          <div className="info-row">
            <span>Club Name</span>
            <strong>{club?.name || "—"}</strong>
          </div>

          <div className="info-row">
            <span>Category</span>
            <strong>{club?.category || "—"}</strong>
          </div>

          <div className="info-row">
            <span>College</span>
            <strong>{club?.college || "—"}</strong>
          </div>

          <div className="info-row">
            <span>Status</span>
            <strong className="status-active">
              {club?.status || "Active"}
            </strong>
          </div>
        </Card>

      </div>
    </Page>
  );
}


// ============================================================
// CREATE EVENT
// ============================================================

// ============================================================
// CREATE EVENT
// ============================================================

export function CreateEvent() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    date: "",
    startTime: "",
    endTime: "",
    venue: "",
    capacity: "",
    skills: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const poster = usePoster();
  const [resourcePersons, setResourcePersons] = useState([
    emptyResourcePerson(),
  ]);
  const [reportFile, setReportFile] = useState(null);
  function updateField(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function submitEvent(e) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      // Backend expects "location", not "venue".
      // The backend identifies the logged-in club through JWT.

      // Upload the poster first (if one was chosen)
      const posterUrl = poster.file
        ? await uploadPosterFile(poster.file)
        : null;
      
      const newReportPdfUrl = reportFile
  ? await uploadEventReport(reportFile)
  : null;

      const payload = {
  title: form.title.trim(),
  description: form.description.trim(),
  category: form.category,

  // Required by the backend
  organizer: "Beta club",

  date: form.date,
  time: `${form.startTime} - ${form.endTime}`,
  location: form.venue.trim(),

  capacity: Number(form.capacity),

  skills: form.skills
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),

  // Always sent, so removing every person clears the list
resource_persons: cleanResourcePersons(resourcePersons),

// Replace the report only when a new PDF is uploaded.
// Otherwise, preserve the existing report.
...(newReportPdfUrl
  ? { report_pdf_url: newReportPdfUrl }
  : {}),

  ...(posterUrl ? { poster_url: posterUrl } : {}),
};

      console.log("CREATE EVENT PAYLOAD:", payload);

      const result = await apiFetch("/api/events", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      console.log("CREATE EVENT RESPONSE:", result);

      setMessage("Event created successfully!");

      poster.clear("");
      setResourcePersons([emptyResourcePerson()]);
      setReportFile(null);

      setForm({
        title: "",
        description: "",
        category: "",
        date: "",
        startTime: "",
        endTime: "",
        venue: "",
        capacity: "",
        skills: "",
      });

    } catch (err) {
      console.error("CREATE EVENT ERROR:", err);

      let errorMessage = "Failed to create event.";

      if (Array.isArray(err)) {
        errorMessage = err
          .map((item) => {
            if (typeof item === "string") {
              return item;
            }

            return item?.msg || item?.message || JSON.stringify(item);
          })
          .join(", ");
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page
      title="Create Event"
      subtitle="Create and publish an event for students."
    >

      <Card>

        <ErrorBox message={error} />

        {message && (
          <div className="club-success">
            {message}
          </div>
        )}

        <form
          className="club-event-form"
          onSubmit={submitEvent}
        >

          {/* EVENT TITLE */}
          <div className="form-group">
            <label>Event Title</label>

            <input
              name="title"
              value={form.title}
              onChange={updateField}
              placeholder="Enter event title"
              required
            />
          </div>


          {/* DESCRIPTION */}
          <div className="form-group">
            <label>Description</label>

            <textarea
              name="description"
              value={form.description}
              onChange={updateField}
              placeholder="Describe your event"
              rows="5"
              required
            />
          </div>


          {/* CATEGORY + CAPACITY */}
          <div className="form-grid">

            <div className="form-group">
              <label>Category</label>

              <select
                name="category"
                value={form.category}
                onChange={updateField}
                required
              >
                <option value="">
                  Select category
                </option>

                <option value="Technical">
                  Technical
                </option>

                <option value="Cultural">
                  Cultural
                </option>

                <option value="Sports">
                  Sports
                </option>

                <option value="Workshop">
                  Workshop
                </option>

                <option value="Competition">
                  Competition
                </option>
              </select>
            </div>


            <div className="form-group">
              <label>Capacity</label>

              <input
                type="number"
                name="capacity"
                value={form.capacity}
                onChange={updateField}
                placeholder="Maximum participants"
                min="1"
                required
              />
            </div>

          </div>


          {/* DATE */}
          <div className="form-group">
            <label>Date</label>

            <input
              type="date"
              name="date"
              value={form.date}
              onChange={updateField}
              required
            />
          </div>


          {/* START + FINISH TIME */}
          <div className="form-grid">

            <div className="form-group">
              <label>Start Time</label>

              <input
                type="text"
                name="startTime"
                value={form.startTime}
                onChange={updateField}
                placeholder="10:00 AM"
                pattern="^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$"
                title="Enter time like 10:00 AM"
                required
              />
            </div>

            <div className="form-group">
              <label>Finish Time</label>

              <input
                type="text"
                name="endTime"
                value={form.endTime}
                onChange={updateField}
                placeholder="12:00 PM"
                pattern="^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$"
                title="Enter time like 12:00 PM"
                required
              />
            </div>

          </div>


          {/* VENUE */}
          <div className="form-group">
            <label>Venue</label>

            <input
              name="venue"
              value={form.venue}
              onChange={updateField}
              placeholder="Enter venue"
              required
            />
          </div>


          {/* SKILLS */}
          <div className="form-group">
            <label>Skills / Tags</label>

            <input
              name="skills"
              value={form.skills}
              onChange={updateField}
              placeholder="Cybersecurity, Networking, Linux"
            />

            <small className="form-help">
              Separate skills using commas.
            </small>
          </div>


          {/* POSTER */}
          <PosterField poster={poster} />


          {/* RESOURCE PERSONS */}
          <ResourcePersonsField
            persons={resourcePersons}
            setPersons={setResourcePersons}
          />

          
{/* EVENT REPORT PDF */}
<div className="form-group">
  <label htmlFor="event-report-pdf">
    Event Report (PDF)
  </label>

  <small className="form-help">
    Upload the event report or documentation. PDF only, maximum 10 MB.
  </small>

  <input
    id="event-report-pdf"
    type="file"
    accept=".pdf,application/pdf"
    onChange={(e) =>
      setReportFile(e.target.files?.[0] || null)
    }
  />

  {reportFile && (
    <small className="form-help">
      Selected: {reportFile.name}
      {" · "}
      {(reportFile.size / (1024 * 1024)).toFixed(2)} MB
    </small>
  )}
</div>


          {/* SUBMIT */}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading
              ? "Creating Event..."
              : "+ Create Event"}
          </button>

        </form>

      </Card>

    </Page>
  );
}

// ============================================================
// MY EVENTS
// ============================================================

// ============================================================
// MY EVENTS
// ============================================================

export function MyEvents() {
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      setLoading(true);
      setError("");

      const data = await apiFetch("/api/club/dashboard");

      setEvents(data.upcomingEvents || []);
    } catch (err) {
      setError(err.message || "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }

  function handleView(event) {
    navigate(`/club-dashboard/events/${event.id}`);
  }

  function handleEdit(event) {
    navigate(`/club-dashboard/events/${event.id}/edit`);
  }

  function handleRegistrations(event) {
    navigate(
      `/club-dashboard/registrations?event=${encodeURIComponent(event.id)}`
    );
  }

  return (
    <Page
      title="My Events"
      subtitle="View and manage all events created by your club."
    >
      <ErrorBox message={error} />

      {loading ? (
        <Loading />
      ) : events.length === 0 ? (
        <Card className="empty-card">
          <div className="empty-icon">📭</div>

          <h3>No events found</h3>

          <p>
            Create your first event to get started.
          </p>

          <button
            className="btn-primary"
            onClick={() => navigate("/club-dashboard/events/new")}
          >
            + Create Event
          </button>
        </Card>
      ) : (
        <div className="event-grid">
          {events.map((event) => (
            <Card
              key={event.id}
              className="club-event-card"
            >
              {/* EVENT HEADER */}
              <div className="event-card-header">
                <span className="event-category">
                  {(event.category || "Event").toUpperCase()}
                </span>

                <span className="event-status">
                  {(event.status || "Published").toUpperCase()}
                </span>
              </div>

              {/* EVENT TITLE */}
              <h3 className="event-title">
                {event.title}
              </h3>

              {/* DATE */}
              <div className="event-detail">
                📅 {event.date || "Date not available"}
              </div>

              {/* TIME */}
              <div className="event-detail">
                🕐 {event.time || "Time not available"}
              </div>

              {/* VENUE */}
              <div className="event-detail">
                📍{" "}
                {event.venue ||
                  event.location ||
                  "Venue not available"}
              </div>

              {/* REGISTRATION PROGRESS */}
              <div className="event-registration">
                <span>
                  {event.registered || 0} /{" "}
                  {event.capacity || 0} registered
                </span>
              </div>

              {/* PROGRESS BAR */}
              <div className="registration-progress">
                <div
                  className="registration-progress-fill"
                  style={{
                    width: `${
                      event.capacity
                        ? Math.min(
                            ((event.registered || 0) /
                              event.capacity) *
                              100,
                            100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>

              {/* ACTION BUTTONS */}
              <div className="event-actions">

                <button
                  type="button"
                  className="event-action-btn"
                  onClick={() => handleView(event)}
                >
                  View
                </button>

                <button
                  type="button"
                  className="event-action-btn"
                  onClick={() => handleEdit(event)}
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="event-action-btn"
                  onClick={() =>
                    handleRegistrations(event)
                  }
                >
                  Registrations
                </button>

              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

// ============================================================
// REGISTRATIONS
// ============================================================

export function Registrations() {

  const [registrations, setRegistrations] = useState([]);
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attendance, setAttendance] = useState({});
  useEffect(() => {
    loadData();
  }, []);

  async function loadAttendance(eventId) {
  try {
    const response = await apiFetch(
      `/api/events/${eventId}/attendance`
    );

    setAttendance((prev) => ({
      ...prev,
      [eventId]: response
    }));

  } catch (error) {
    console.error(
      "Attendance loading error:",
      error
    );
  }
}

  async function loadData() {

    try {

      setLoading(true);

      /*
       * Club dashboard already returns:
       *
       * recentRegistrations
       * upcomingEvents
       *
       * We use those existing backend values.
       */

      const data =
        await apiFetch(
          "/api/club/dashboard"
        );

      setRegistrations(
        data.recentRegistrations || []
      );

      setEvents(
        data.upcomingEvents || []
      );

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }
  }


  const filtered =
    registrations.filter((item) => {

      const text =
        JSON.stringify(item)
          .toLowerCase();

      return text.includes(
        search.toLowerCase()
      );

    });


  return (
    <Page
      title="Registrations"
      subtitle="Students registered for your club events."
    >

      <ErrorBox message={error} />


      <Card>

        <div className="table-toolbar">

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search registrations..."
          />

          <span>
            {registrations.length} registrations
          </span>

        </div>


        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (

          <div className="empty-table">
            No registrations found.
          </div>

        ) : (

          <div className="club-table-wrapper">

            <table className="club-table">

              <thead>

                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>

              </thead>


              <tbody>

                {filtered.map(
                  (registration, index) => (

                    <tr
                      key={
                        registration.id ||
                        index
                      }
                    >

                      <td>
                        {registration.name ||
                          registration.student_name ||
                          registration.studentName ||
                          "—"}
                      </td>

                      <td>
                        {registration.email ||
                          "—"}
                      </td>

                      <td>
                        {registration.event_title ||
                          registration.eventTitle ||
                          registration.event ||
                          "—"}
                      </td>

                      <td>
                        {registration.date ||
                          registration.registered_at ||
                          registration.created_at ||
                          "—"}
                      </td>

                      <td>
                        <span className="status-badge">
                          {registration.status ||
                            "Registered"}
                        </span>
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </Card>

    </Page>
  );
}


// ============================================================
// CALENDAR
// ============================================================

export function CalendarPage() {

  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] =
    useState("");

  useEffect(() => {

    apiFetch("/api/club/dashboard")
      .then((data) => {
        setEvents(
          data.upcomingEvents || []
        );
      })
      .catch(console.error);

  }, []);


  const dates = useMemo(() => {

    return events.reduce(
      (acc, event) => {

        const date =
          event.date || "";

        if (!acc[date]) {
          acc[date] = [];
        }

        acc[date].push(event);

        return acc;

      },
      {}
    );

  }, [events]);


  return (
    <Page
      title="Calendar"
      subtitle="View your club's upcoming events."
    >

      <Card>

        <div className="calendar-top">

          <input
            type="date"
            value={selectedDate}
            onChange={(e) =>
              setSelectedDate(
                e.target.value
              )
            }
          />

          <span>
            {events.length} events
          </span>

        </div>


        {selectedDate ? (

          <div>

            <h3>
              Events on {selectedDate}
            </h3>

            {(dates[selectedDate] || [])
              .map((event) => (

                <div
                  className="calendar-event"
                  key={event.id}
                >

                  <strong>
                    {event.title}
                  </strong>

                  <span>
                    {event.time}
                  </span>

                  <span>
                    {event.venue}
                  </span>

                </div>

              ))}

            {(!dates[selectedDate] ||
              dates[selectedDate].length === 0) && (

              <p className="muted">
                No events on this date.
              </p>

            )}

          </div>

        ) : (

          <div className="calendar-list">

            {events.map((event) => (

              <div
                className="calendar-event"
                key={event.id}
              >

                <div>
                  <strong>
                    {event.title}
                  </strong>

                  <span>
                    {event.date}
                  </span>
                </div>

                <span>
                  {event.time}
                </span>

              </div>

            ))}

          </div>

        )}

      </Card>

    </Page>
  );
}


// ============================================================
// ANALYTICS
// ============================================================

// ============================================================
// ANALYTICS
// ============================================================

export function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attendanceTotal, setAttendanceTotal] = useState(0);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      setLoading(true);
      setError("");

      // --------------------------------------------------------
      // LOAD CLUB ANALYTICS
      // --------------------------------------------------------
      let analyticsData = null;

      try {
        analyticsData = await apiFetch("/api/club/analytics");
        setData(analyticsData);
      } catch (err) {
        console.warn(
          "Club analytics API unavailable:",
          err.message
        );

        // Keep analytics page working even if this endpoint
        // is not available.
        setData({});
      }

      // --------------------------------------------------------
      // LOAD CLUB EVENTS
      // --------------------------------------------------------
      let events = [];

      try {
        const eventsResponse = await apiFetch("/api/events");

        if (Array.isArray(eventsResponse)) {
          events = eventsResponse;
        } else if (Array.isArray(eventsResponse?.events)) {
          events = eventsResponse.events;
        } else if (Array.isArray(eventsResponse?.data)) {
          events = eventsResponse.data;
        }
      } catch (err) {
        console.warn(
          "Unable to load events:",
          err.message
        );
      }

      // --------------------------------------------------------
      // GET ATTENDANCE FOR CLUB EVENTS
      // --------------------------------------------------------
      let allAttendance = [];

      for (const event of events) {
        const eventId =
          event?._id ||
          event?.id ||
          event?.event_id;

        if (!eventId) continue;

        try {
          const attendanceResponse =
            await apiFetch(
              `/api/events/${eventId}/attendance`
            );

          const attendance =
            Array.isArray(attendanceResponse?.attendance)
              ? attendanceResponse.attendance
              : [];

          allAttendance = [
            ...allAttendance,
            ...attendance.map((item) => ({
              ...item,
              event_id: eventId,
              event_title:
                event?.title ||
                event?.name ||
                "Event",
            })),
          ];
        } catch (err) {
          console.warn(
            `Unable to load attendance for event ${eventId}:`,
            err.message
          );
        }
      }

      // --------------------------------------------------------
      // UPDATE ATTENDANCE STATE
      // --------------------------------------------------------
      setAttendanceRecords(allAttendance);
      setAttendanceTotal(allAttendance.length);

    } catch (err) {
      console.error(
        "ANALYTICS ERROR:",
        err
      );

      setError(
        err.message ||
        "Unable to load analytics."
      );
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // CALCULATIONS
  // ----------------------------------------------------------

  const totalEvents =
    data?.total_events ??
    data?.events_count ??
    data?.event_count ??
    0;

  const totalRegistrations =
    data?.total_registrations ??
    data?.registrations_count ??
    data?.registration_count ??
    0;

  const totalStudents =
    data?.total_students ??
    data?.students_count ??
    0;

  const calculatedEvents =
    data?.events?.length ??
    0;

  const calculatedRegistrations =
    data?.registrations?.length ??
    0;

  const displayEvents =
    Number(totalEvents) > 0
      ? totalEvents
      : calculatedEvents;

  const displayRegistrations =
    Number(totalRegistrations) > 0
      ? totalRegistrations
      : calculatedRegistrations;

  // ----------------------------------------------------------
  // ATTENDANCE BY EVENT
  // ----------------------------------------------------------

  const attendanceByEvent = useMemo(() => {
    const grouped = {};

    attendanceRecords.forEach((record) => {
      const eventId =
        record?.event_id || "unknown";

      if (!grouped[eventId]) {
        grouped[eventId] = {
          event_id: eventId,
          event_title:
            record?.event_title || "Event",
          count: 0,
        };
      }

      grouped[eventId].count += 1;
    });

    return Object.values(grouped);
  }, [attendanceRecords]);

  // ----------------------------------------------------------
  // LOADING
  // ----------------------------------------------------------

  if (loading) {
    return (
      <Page
        title="Analytics"
        subtitle="View event, registration and attendance analytics."
      >
        <Loading />
      </Page>
    );
  }

  // ----------------------------------------------------------
  // PAGE
  // ----------------------------------------------------------

  return (
    <Page
      title="Analytics"
      subtitle="View event, registration and attendance analytics."
    >
      <ErrorBox message={error} />

      {/* ======================================================
          SUMMARY CARDS
      ====================================================== */}

      <div className="club-profile-grid">

        <Card>
          <h3>Total Events</h3>

          <div
            style={{
              fontSize: "36px",
              fontWeight: "700",
              marginTop: "10px",
            }}
          >
            {displayEvents}
          </div>

          <p className="muted">
            Events organized by the club
          </p>
        </Card>

        <Card>
          <h3>Total Registrations</h3>

          <div
            style={{
              fontSize: "36px",
              fontWeight: "700",
              marginTop: "10px",
            }}
          >
            {displayRegistrations}
          </div>

          <p className="muted">
            Student registrations
          </p>
        </Card>

        <Card>
          <h3>Total Attendance</h3>

          <div
            style={{
              fontSize: "36px",
              fontWeight: "700",
              marginTop: "10px",
            }}
          >
            {attendanceTotal}
          </div>

          <p className="muted">
            Students marked present
          </p>
        </Card>

        <Card>
          <h3>Total Students</h3>

          <div
            style={{
              fontSize: "36px",
              fontWeight: "700",
              marginTop: "10px",
            }}
          >
            {totalStudents}
          </div>

          <p className="muted">
            Students participating
          </p>
        </Card>

      </div>

      {/* ======================================================
          ATTENDANCE DETAILS
      ====================================================== */}

      <div style={{ marginTop: "25px" }}>

        <Card>

          <h2>
            Attendance Overview
          </h2>

          <p className="muted">
            Attendance recorded through QR scanning.
          </p>

          {attendanceRecords.length === 0 ? (
            <div
              style={{
                padding: "30px 10px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "40px",
                  marginBottom: "10px",
                }}
              >
                📷
              </div>

              <h3>
                No attendance recorded yet
              </h3>

              <p className="muted">
                Attendance will appear here after
                students scan the event QR code.
              </p>
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
                marginTop: "20px",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                      }}
                    >
                      Event
                    </th>

                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                      }}
                    >
                      Attendance
                    </th>

                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {attendanceByEvent.map(
                    (event) => (
                      <tr
                        key={event.event_id}
                      >
                        <td
                          style={{
                            padding: "12px",
                          }}
                        >
                          {event.event_title}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            fontWeight: "600",
                          }}
                        >
                          {event.count}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                          }}
                        >
                          <span
                            style={{
                              padding:
                                "5px 10px",
                              borderRadius:
                                "15px",
                            }}
                          >
                            Present
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

        </Card>

      </div>

      {/* ======================================================
          QR ATTENDANCE INFO
      ====================================================== */}

      <div style={{ marginTop: "25px" }}>

        <Card>

          <h2>
            📷 QR Attendance
          </h2>

          <p className="muted">
            Use the Scan Attendance section from
            the sidebar to mark student attendance.
          </p>

          <div
            style={{
              marginTop: "15px",
              padding: "15px",
              borderRadius: "10px",
            }}
          >
            <strong>
              {attendanceTotal}
            </strong>{" "}
            attendance record
            {attendanceTotal === 1
              ? ""
              : "s"} recorded.
          </div>

        </Card>

      </div>

    </Page>
  );
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");

      const data = await apiFetch("/api/club/dashboard");

      // Event edit / report notifications (non-fatal if this fails)
      let editNotifications = [];

      try {
        const editData = await apiFetch("/api/club/notifications");

        editNotifications = (editData.notifications || []).map((n) => ({
          id: `event-update-${n.id}`,
          title: n.title || "Event Updated",
          message: n.message,
          time: n.created_at
            ? new Date(n.created_at).toLocaleString()
            : "",
          read: n.is_read,
        }));
      } catch (notifErr) {
        console.error("Event update notifications error:", notifErr);
      }

      const registrations =
        data.recentRegistrations || [];

      const generatedNotifications =
        registrations.map((registration, index) => ({
          id:
            registration.id ||
            registration._id ||
            `registration-${index}`,

          title: "New Event Registration",

          message:
            `${registration.name || "A student"} registered for ` +
            `"${registration.event_title || registration.event || "your event"}".`,

          time:
            registration.registered_at ||
            registration.date ||
            "",

          read: false,
        }));

      setNotifications([
        ...editNotifications,
        ...generatedNotifications,
      ]);

    } catch (err) {
      console.error(
        "Notification loading error:",
        err
      );

      setError(
        err.message ||
        "Failed to load notifications."
      );

      setNotifications([]);

    } finally {
      setLoading(false);
    }
  }

  return (
    <Page
      title="Notifications"
      subtitle="Stay updated with your club activity."
    >

      <Card>

        {loading ? (

          <div className="empty-card">
            <div className="empty-icon">
              🔄
            </div>

            <h3>
              Loading notifications...
            </h3>
          </div>

        ) : error ? (

          <div className="empty-card">

            <div className="empty-icon">
              ⚠️
            </div>

            <h3>
              Unable to load notifications
            </h3>

            <p>
              {error}
            </p>

          </div>

        ) : notifications.length === 0 ? (

          <div className="empty-card">

            <div className="empty-icon">
              🔔
            </div>

            <h3>
              No notifications
            </h3>

            <p>
              New registrations and updates
              will appear here.
            </p>

          </div>

        ) : (

          <div className="notifications-list">

            {notifications.map(
              (notification) => (

                <div
                  className="notification-item"
                  key={notification.id}
                >

                  <div className="notification-icon">
                    👤
                  </div>

                  <div className="notification-content">

                    <strong>
                      {notification.title}
                    </strong>

                    <p>
                      {notification.message}
                    </p>

                    {notification.time && (
                      <small>
                        {notification.time}
                      </small>
                    )}

                  </div>

                </div>

              )
            )}

          </div>

        )}

      </Card>

    </Page>
  );
}

// ============================================================
// PROFILE
// ============================================================

export function Profile() {

  const [profile, setProfile] =
    useState(null);

  useEffect(() => {

    apiFetch("/api/club/dashboard")
      .then((data) => {
        setProfile(data.club || {});
      })
      .catch(console.error);

  }, []);


  return (
    <Page
      title="Profile"
      subtitle="Manage your club leader profile."
    >

      <Card>

        <div className="profile-header">

          <div className="club-big-avatar">
            {(profile?.name || "C")
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>

            <h2>
              {profile?.name ||
                "Beta Club"}
            </h2>

            <p className="muted">
              Club Leader
            </p>

          </div>

        </div>


        <div className="profile-fields">

          <div>
            <label>
              Club Name
            </label>

            <input
              value={
                profile?.name || ""
              }
              readOnly
            />
          </div>


          <div>
            <label>
              Role
            </label>

            <input
              value="Club Leader"
              readOnly
            />
          </div>

        </div>

      </Card>

    </Page>
  );
}


// ============================================================
// SETTINGS
// ============================================================

export function Settings() {

  const [emailNotifications, setEmailNotifications] =
    useState(true);

  const [eventNotifications, setEventNotifications] =
    useState(true);


  return (
    <Page
      title="Settings"
      subtitle="Manage your club account preferences."
    >

      <Card>

        <h3>
          Notification Settings
        </h3>


        <div className="setting-row">

          <div>

            <strong>
              Email Notifications
            </strong>

            <p>
              Receive important updates through email.
            </p>

          </div>

          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) =>
              setEmailNotifications(
                e.target.checked
              )
            }
          />

        </div>


        <div className="setting-row">

          <div>

            <strong>
              Event Notifications
            </strong>

            <p>
              Receive notifications about registrations.
            </p>

          </div>

          <input
            type="checkbox"
            checked={eventNotifications}
            onChange={(e) =>
              setEventNotifications(
                e.target.checked
              )
            }
          />

        </div>

      </Card>


      <Card>

        <h3>
          Account
        </h3>

        <button
          className="danger-btn"
          onClick={() => {

            localStorage.removeItem("token");
            localStorage.removeItem("access_token");
            localStorage.removeItem("jwt");

            window.location.href =
              "/login";

          }}
        >
          Logout
        </button>

      </Card>

    </Page>
  );
}

// ============================================================
// VIEW EVENT
// ============================================================

export function ClubEventView() {
  const { id } = useParams();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadEvent();
  }, [id]);

  async function loadEvent() {
    try {
      setLoading(true);
      setError("");

      const data = await apiFetch(`/api/events/${id}`);

      setEvent(data);
    } catch (err) {
      console.error("VIEW EVENT ERROR:", err);
      setError(err.message || "Failed to load event.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Page
        title="Event Details"
        subtitle="Loading event information..."
      >
        <Loading />
      </Page>
    );
  }

  if (error) {
    return (
      <Page
        title="Event Details"
        subtitle="Unable to load event."
      >
        <ErrorBox message={error} />
      </Page>
    );
  }

  if (!event) {
    return (
      <Page
        title="Event Details"
        subtitle="Event not found."
      />
    );
  }

  return (
    <Page
      title={event.title || "Event Details"}
      subtitle="View event information."
    >
      <Card>

        {event.poster_url && (
          <img
            src={posterSrc(event.poster_url)}
            alt={`${event.title || "Event"} poster`}
            style={{
              display: "block",
              width: "100%",
              maxWidth: "500px",
              maxHeight: "320px",
              objectFit: "contain",
              borderRadius: "16px",
              marginBottom: "20px",
            }}
          />
        )}

        <div className="event-view-header">

          <div>
            <span className="event-category">
              {(event.category || "Event").toUpperCase()}
            </span>

            <h2>
              {event.title}
            </h2>
          </div>

          <span className="event-status">
            {(event.status || "PUBLISHED").toUpperCase()}
          </span>

        </div>


        <div className="event-view-details">

         <div className="event-view-item">
  <span>📝 Description</span>
  <strong>
    {" "}
    {event.description || "No description available."}
  </strong>
</div>


          <div className="event-view-item">
            <span>📅 Date</span>
            <strong>
              {event.date || "Not specified"}
            </strong>
          </div>


          <div className="event-view-item">
            <span>🕐 Time</span>
            <strong>
              {event.time || "Not specified"}
            </strong>
          </div>


          <div className="event-view-item">
            <span>📍 Venue</span>
            <strong>
              {event.location ||
                event.venue ||
                "Not specified"}
            </strong>
          </div>


          <div className="event-view-item">
            <span>👥 Registrations</span>
            <strong>
              {event.registered || 0}
              {event.capacity
                ? ` / ${event.capacity}`
                : ""}
            </strong>
          </div>


          <div className="event-view-item">
            <span>🏷️ Organizer</span>
            <strong>
              {event.organizer || "Beta club"}
            </strong>
          </div>

        </div>


        {event.skills &&
          event.skills.length > 0 && (
            <div className="event-skills">

              <h3>Skills / Tags</h3>

              <p className="skill-list">
                {event.skills
                  .map((skill) => String(skill).trim())
                  .filter(Boolean)
                  .join(", ")}
              </p>

            </div>
          )}

        <ResourcePersonsView persons={event.resource_persons} />

        {/* EVENT REPORT */}
        <div className="event-skills">
          <h3>Event Report</h3>

          {event.report_pdf_url ? (
            <p>
              <a
                href={posterSrc(event.report_pdf_url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                📄 View / Download Event Report (PDF)
              </a>
            </p>
          ) : (
            <p>No report has been uploaded yet.</p>
          )}
        </div>

      </Card>
    </Page>
  );
}


// ============================================================
// EDIT EVENT
// ============================================================

export function EditEvent() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const poster = usePoster();
  const [existingPoster, setExistingPoster] = useState("");
  const [removePoster, setRemovePoster] = useState(false);
  const [resourcePersons, setResourcePersons] = useState([
    emptyResourcePerson(),
  ]);
  const [existingReportPdf, setExistingReportPdf] = useState("");
  const [reportFile, setReportFile] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    date: "",
    startTime: "",
    endTime: "",
    venue: "",
    capacity: "",
    skills: "",
  });


  useEffect(() => {
    loadEvent();
  }, [id]);


  async function loadEvent() {
    try {
      setLoading(true);
      setError("");

      const data = await apiFetch(
        `/api/events/${id}`
      );

      let startTime = "";
      let endTime = "";

      if (data.time) {
        const parts = data.time
          .split("-")
          .map((item) => item.trim());

        startTime = parts[0] || "";
        endTime = parts[1] || "";
      }

      setForm({
        title: data.title || "",
        description: data.description || "",
        category: data.category || "",
        date: data.date || "",
        startTime,
        endTime,
        venue:
          data.location ||
          data.venue ||
          "",
        capacity: data.capacity || "",
        skills: Array.isArray(data.skills)
          ? data.skills.join(", ")
          : data.skills || "",
      });

      setResourcePersons(resourcePersonsFromEvent(data));
      setExistingPoster(data.poster_url || "");
      setRemovePoster(false);
      poster.clear(data.poster_url || "");
      setExistingReportPdf(data.report_pdf_url || "");
      setReportFile(null);

    } catch (err) {
      console.error("LOAD EVENT ERROR:", err);
      setError(
        err.message ||
        "Failed to load event."
      );
    } finally {
      setLoading(false);
    }
  }


  function updateField(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }


  async function updateEvent(e) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {

      // Upload a replacement poster first (if one was chosen)
      const newPosterUrl = poster.file
        ? await uploadPosterFile(poster.file)
        : null;
      const newReportPdfUrl = reportFile
  ? await uploadEventReport(reportFile)
  : null;
      const payload = {
  title: form.title.trim(),
  description: form.description.trim(),
  category: form.category,

  organizer: "Beta club",

  date: form.date,
  time: `${form.startTime} - ${form.endTime}`,
  location: form.venue.trim(),

  // IMPORTANT
  capacity: Number(form.capacity),

  skills: form.skills
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),

  // Always sent, so removing every person clears the list
  resource_persons: cleanResourcePersons(resourcePersons),
  // Replace the report only when a new PDF is uploaded.
// If no new PDF is selected, keep the existing report.
...(newReportPdfUrl
  ? { report_pdf_url: newReportPdfUrl }
  : {}),

  // new file -> replace; "" -> remove; omitted -> keep current poster
  ...(newPosterUrl
    ? { poster_url: newPosterUrl }
    : removePoster
      ? { poster_url: "" }
      : {}),
};


      console.log(
        "UPDATE EVENT PAYLOAD:",
        payload
      );


      const result = await apiFetch(
        `/api/events/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );


      console.log(
        "UPDATE EVENT RESPONSE:",
        result
      );


      setMessage(
        "Event updated successfully."
      );

      setTimeout(() => {
        navigate(
          `/club-dashboard/events/${id}`
        );
      }, 700);

    } catch (err) {

      console.error(
        "UPDATE EVENT ERROR:",
        err
      );

      setError(
        err.message ||
        "Failed to update event."
      );

    } finally {
      setSaving(false);
    }
  }


  if (loading) {
    return (
      <Page
        title="Edit Event"
        subtitle="Loading event..."
      >
        <Loading />
      </Page>
    );
  }


  return (
    <Page
      title="Edit Event"
      subtitle="Update your event details."
    >

      <Card>

        <ErrorBox message={error} />

        {message && (
          <div className="club-success">
            {message}
          </div>
        )}


        <form
          className="club-event-form"
          onSubmit={updateEvent}
        >

          <div className="form-group">
            <label>Event Title</label>

            <input
              name="title"
              value={form.title}
              onChange={updateField}
              required
            />
          </div>


          <div className="form-group">
            <label>Description</label>

            <textarea
              name="description"
              value={form.description}
              onChange={updateField}
              rows="5"
              required
            />
          </div>


          <div className="form-grid">

            <div className="form-group">
              <label>Category</label>

              <select
                name="category"
                value={form.category}
                onChange={updateField}
                required
              >
                <option value="">
                  Select category
                </option>

                <option value="Technical">
                  Technical
                </option>

                <option value="Cultural">
                  Cultural
                </option>

                <option value="Sports">
                  Sports
                </option>

                <option value="Workshop">
                  Workshop
                </option>

                <option value="Competition">
                  Competition
                </option>
              </select>
            </div>


            <div className="form-group">
              <label>Capacity</label>

              <input
                type="number"
                name="capacity"
                value={form.capacity}
                onChange={updateField}
                min="1"
              />
            </div>

          </div>


          <div className="form-grid">

            <div className="form-group">
              <label>Start Time</label>

              <input
                type="text"
                name="startTime"
                value={form.startTime}
                onChange={updateField}
                placeholder="10:00 AM"
                required
              />
            </div>


            <div className="form-group">
              <label>Finish Time</label>

              <input
                type="text"
                name="endTime"
                value={form.endTime}
                onChange={updateField}
                placeholder="12:00 PM"
                required
              />
            </div>

          </div>


          <div className="form-group">
            <label>Date</label>

            <input
              type="date"
              name="date"
              value={form.date}
              onChange={updateField}
              required
            />
          </div>


          <div className="form-group">
            <label>Venue</label>

            <input
              name="venue"
              value={form.venue}
              onChange={updateField}
              required
            />
          </div>


          <div className="form-group">
            <label>Skills / Tags</label>

            <input
              name="skills"
              value={form.skills}
              onChange={updateField}
              placeholder="Cybersecurity, Networking, Linux"
            />
          </div>


          <PosterField
            poster={poster}
            onPick={() => setRemovePoster(false)}
          >
            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "10px",
                flexWrap: "wrap",
              }}
            >
              {poster.file && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    poster.clear(removePoster ? "" : existingPoster)
                  }
                >
                  Discard new poster
                </button>
              )}

              {!poster.file && existingPoster && !removePoster && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    poster.clear("");
                    setRemovePoster(true);
                  }}
                >
                  Remove poster
                </button>
              )}

              {!poster.file && removePoster && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setRemovePoster(false);
                    poster.clear(existingPoster);
                  }}
                >
                  Undo remove
                </button>
              )}
            </div>
          </PosterField>


          <ResourcePersonsField
            persons={resourcePersons}
            setPersons={setResourcePersons}
          />

          
{/* EVENT REPORT PDF */}
<div className="form-group">
  <label>Event Report (PDF)</label>

  {existingReportPdf && (
    <p>
      <a
        href={posterSrc(existingReportPdf)}
        target="_blank"
        rel="noopener noreferrer"
      >
        View / Download Existing Report
      </a>
    </p>
  )}

  <input
    type="file"
    accept=".pdf,application/pdf"
    onChange={(e) => {
      const file = e.target.files?.[0] || null;

      if (!file) {
        setReportFile(null);
        return;
      }

      if (
        file.type !== "application/pdf" ||
        !file.name.toLowerCase().endsWith(".pdf")
      ) {
        setError("Please select a PDF file.");
        e.target.value = "";
        setReportFile(null);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("PDF must be 10 MB or smaller.");
        e.target.value = "";
        setReportFile(null);
        return;
      }

      setError("");
      setReportFile(file);
    }}
  />

  <small className="form-help">
    Select a new PDF to replace the existing report. Leave empty to keep it.
  </small>

  {reportFile && (
    <p className="form-help">
      Selected: {reportFile.name}
    </p>
  )}
</div>



          <div className="event-actions">

            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>


            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                navigate(
                  `/club-dashboard/events/${id}`
                )
              }
            >
              Cancel
            </button>

          </div>

        </form>

      </Card>

    </Page>
  );
}
// ============================================================
// CLUB MODULE ROUTER
// ============================================================
//
// Use this if you don't want to create 10 separate files.
// The existing sidebar can navigate to these URLs.
//
// ============================================================

export default function ClubModules() {

  const path =
    window.location.pathname;


  if (
    path === "/club/my-club"
  ) {
    return <MyClub />;
  }


  if (
    path === "/club/create-event"
  ) {
    return <CreateEvent />;
  }


  if (
    path === "/club/my-events"
  ) {
    return <MyEvents />;
  }


  if (
    path === "/club/registrations"
  ) {
    return <Registrations />;
  }


  if (
    path === "/club/calendar"
  ) {
    return <CalendarPage />;
  }


  if (
    path === "/club/analytics"
  ) {
    return <Analytics />;
  }


  if (
    path === "/club/notifications"
  ) {
    return <Notifications />;
  }


  if (
    path === "/club/profile"
  ) {
    return <Profile />;
  }


  if (
    path === "/club/settings"
  ) {
    return <Settings />;
  }
  if (
    path === "/club/attendance"
  ) {
    return <ScanAttendance />;
  }

  return null;
}
export { ScanAttendance };