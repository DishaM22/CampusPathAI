import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  useNavigate
} from "react-router-dom";

import Sidebar from "../club/components/Sidebar";
import TopBar from "../club/components/TopBar";
import StatCard from "../club/components/StatCard";
import "../club-dashboard.css";
import InterCollegeAttendanceScanner from "./InterCollegeAttendanceScanner";

const API_URL = "http://127.0.0.1:8000";


/* ============================================================
   SAMPLE DASHBOARD DATA
============================================================ */

const SAMPLE_DASHBOARD = {

  organization: {
    name: "Tech Innovators Association",
    initial: "TI",
    college: "Presidency University",
  },

  kpis: {
    totalEvents: 8,
    upcomingEvents: 3,
    participatingColleges: 12,
    totalRegistrations: 640,
  },

  upcomingEvents: [

    {
      id: "sample-1",
      title: "Cross-Campus AI Hackathon 2026",
      category: "Inter-College · Hackathon",
      date: "Oct 15-16, 2026",
      time: "9:00 AM",
      venue: "Presidency University (Host)",
      registered: 320,
      capacity: 500,
      colleges: [
        "Presidency University",
        "BMS College",
        "RV College",
        "+9 more"
      ],
      status: "published",
    },

    {
      id: "sample-2",
      title: "Innotech Fest – Inter-College",
      category: "Inter-College · Tech Fest",
      date: "Nov 3, 2026",
      time: "10:00 AM",
      venue: "NMIT (Host)",
      registered: 18,
      capacity: 250,
      colleges: [
        "NMIT",
        "Presidency University",
        "+2 more"
      ],
      status: "draft",
    },

  ],

  participatingColleges: [

    {
      college: "Presidency University",
      location: "Bengaluru",
      contactPerson: "Dr. Anitha Rao",
      participants: 142,
      events: 6,
      status: "ACTIVE",
    },

    {
      college: "BMS College of Engineering",
      location: "Bengaluru",
      contactPerson: "Prof. Vikram Shah",
      participants: 98,
      events: 4,
      status: "ACTIVE",
    },

    {
      college: "RV College of Engineering",
      location: "Bengaluru",
      contactPerson: "Dr. Meera Iyer",
      participants: 87,
      events: 5,
      status: "ACTIVE",
    },

    {
      college: "NMIT",
      location: "Bengaluru",
      contactPerson: "Prof. Karan Shetty",
      participants: 64,
      events: 3,
      status: "ACTIVE",
    },

  ],

  recentRegistrations: [

    {
      id: "r1",
      participant: "Ananya Rao",
      college: "Presidency University",
      department: "CSE",
      year: "3rd Year",
      team: "Team Nebula",
      event: "Cross-Campus AI Hackathon",
      date: "Sep 24, 2026",
      status: "REGISTERED",
    },

    {
      id: "r2",
      participant: "Kabir Mehta",
      college: "BMS College",
      department: "ECE",
      year: "4th Year",
      team: "Team Nebula",
      event: "Cross-Campus AI Hackathon",
      date: "Sep 24, 2026",
      status: "REGISTERED",
    },

    {
      id: "r3",
      participant: "Ishaan Verma",
      college: "RV College",
      department: "ISE",
      year: "2nd Year",
      team: "Individual",
      event: "Innotech Fest",
      date: "Sep 23, 2026",
      status: "WAITLISTED",
    },

  ],

};


/* Notifications are loaded from live dashboard data only. */

/* ============================================================
   HELPERS
============================================================ */

function getToken() {

  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    ""
  );

}


function formatDate(value) {

  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);

}
function parseEventDate(value) {

  if (!value) return null;

  const text = String(value).trim();

  // YYYY-MM-DD
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) {

    const date = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3])
    );

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  // DD-MM-YYYY
  const dmy = text.match(/^(\d{2})-(\d{2})-(\d{4})/);

  if (dmy) {

    const date = new Date(
      Number(dmy[3]),
      Number(dmy[2]) - 1,
      Number(dmy[1])
    );

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  // Other date formats
  const parsed = new Date(text);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function formatTime(value) {

  if (!value) {
    return "—";
  }

  const parts = String(value).split(":");
  const hour = Number(parts[0]);
  const minute = parts[1] || "00";

  if (Number.isNaN(hour)) {
    return value;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}


function formatTimeRange(event) {

  if (!event) {
    return "Time TBA";
  }

  if (event.timeFrom || event.timeTo) {
    return `${formatTime(event.timeFrom)} - ${formatTime(event.timeTo)}`;
  }

  return event.time || "Time TBA";
}


function toTimeInputValue(value) {
  if (!value) return "";

  const text = String(value).trim();

  // Already in the value format required by <input type="time">.
  const twentyFourHour = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFourHour) {
    return `${String(Number(twentyFourHour[1])).padStart(2, "0")}:${twentyFourHour[2]}`;
  }

  // Convert values such as "11:00 AM" or "1:30 PM" to "11:00" / "13:30".
  const twelveHour = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (!twelveHour) return "";

  let hour = Number(twelveHour[1]);
  const minute = twelveHour[2];
  const suffix = twelveHour[3].toUpperCase();

  if (suffix === "AM" && hour === 12) hour = 0;
  if (suffix === "PM" && hour !== 12) hour += 12;

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function eventToForm(event) {
  if (!event) {
    return {
      title: "",
      category: "",
      date: "",
      timeFrom: "",
      timeTo: "",
      venue: "",
      capacity: "",
      description: "",
      skills: (eventForm.skills || "")
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
    };
  }

  let timeFrom = event.timeFrom || event.timeStart || "";
  let timeTo = event.timeTo || event.timeEnd || "";

  if ((!timeFrom || !timeTo) && event.time) {
    const range = String(event.time).split(/\s+-\s+/);
    if (range.length >= 2) {
      timeFrom = timeFrom || range[0];
      timeTo = timeTo || range[1];
    }
  }

  const rawDate = String(event.date || "");
  const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate)
    ? rawDate.slice(0, 10)
    : "";

  return {
    title: event.title || "",
    category: event.category || "",
    date,
    timeFrom: toTimeInputValue(timeFrom),
    timeTo: toTimeInputValue(timeTo),
    venue: event.venue || event.location || "",
    capacity:
      event.capacity !== undefined && event.capacity !== null
        ? String(event.capacity)
        : "",
    description: event.description || "",
    skills: Array.isArray(event.skills)
      ? event.skills
      : typeof event.skills === "string"
        ? event.skills.split(",").map((skill) => skill.trim()).filter(Boolean)
        : [],
  };
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

/* FastAPI sends validation errors as a LIST of objects. This turns any
   error detail into readable text (instead of "[object Object]"). */
function formatApiDetail(detail) {
  if (!detail) return "";

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = Array.isArray(item?.loc)
          ? item.loc.filter((part) => part !== "body").join(".")
          : "";

        const text = item?.msg || JSON.stringify(item);

        return field ? field + ": " + text : text;
      })
      .join("; ");
  }

  return detail.msg || JSON.stringify(detail);
}

/* The backend stores posters as "/uploads/posters/<name>.png".
   The browser needs the full address (or a local preview address). */
function posterSrc(url) {
  if (!url) return "";

  const text = String(url);

  if (/^(https?:|blob:)/i.test(text)) return text;

  return `${API_URL.replace(/\/$/, "")}/${text.replace(/^\//, "")}`;
}
function formatRegistrationDate(value) {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Light mode is made by inverting the dark UI, so the dashboard
// stylesheet doesn't need a second set of colours. Pictures are
// flipped back so posters keep their real colours.
const LIGHT_THEME_CSS = `
.dashboard-shell.theme-light {
  filter: invert(1) hue-rotate(180deg);
}
.dashboard-shell.theme-light img,
.dashboard-shell.theme-light video,
.dashboard-shell.theme-light canvas,
.dashboard-shell.theme-light iframe {
  filter: invert(1) hue-rotate(180deg);
}
`;

export default function InterCollegeDashboard() {

  const navigate = useNavigate();


  const [collapsed, setCollapsed] =
    useState(false);

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [status, setStatus] =
    useState("loading");

  const [data, setData] =
    useState(null);

  const [isSample, setIsSample] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [activeSection, setActiveSection] =
    useState("dashboard");

  // ------------------------------------------------------------
  // THEME (dark / light), remembered on this device
  // ------------------------------------------------------------
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("intercollegeTheme") === "light"
        ? "light"
        : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("intercollegeTheme", theme);
    } catch {
      /* storage unavailable: the theme just won't be remembered */
    }
  }, [theme]);

  // ------------------------------------------------------------
  // PAGE HISTORY (powers the Back button on every subpage)
  // ------------------------------------------------------------
  const sectionHistoryRef = useRef([]);
  const lastSectionRef = useRef("dashboard");
  const skipHistoryRef = useRef(false);

  useEffect(() => {
    // The change was caused by the Back button: don't record it
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      lastSectionRef.current = activeSection;
      return;
    }

    if (lastSectionRef.current !== activeSection) {
      sectionHistoryRef.current.push(lastSectionRef.current);

      if (sectionHistoryRef.current.length > 30) {
        sectionHistoryRef.current.shift();
      }

      lastSectionRef.current = activeSection;
    }
  }, [activeSection]);

  const [selectedEventId, setSelectedEventId] =
    useState(null);

  const [selectedPoster, setSelectedPoster] = useState(null);

  const [calendarMonth, setCalendarMonth] =
    useState(
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      )
    );

  const emptyEventForm = {
    title: "",
    category: "",
    date: "",
    timeFrom: "",
    timeTo: "",
    venue: "",
    capacity: "",
    description: "",
    skills: "",
  };

  const [eventForm, setEventForm] =
    useState(emptyEventForm);

  /* ---------------- RESOURCE PERSONS ---------------- */

const createEmptyResourcePerson = () => ({
  name: "",
  designation: "",
  organization: "",
  linkedin_url: "",
});

// Turn an event's saved resource_persons into editable form rows
const resourcePersonsFromEvent = (event) =>
  Array.isArray(event?.resource_persons) &&
  event.resource_persons.length > 0
    ? event.resource_persons.map((person) => ({
        name: person.name || "",
        designation: person.designation || "",
        organization: person.organization || "",
        linkedin_url: person.linkedin_url || "",
      }))
    : [createEmptyResourcePerson()];

const [resourcePersons, setResourcePersons] = useState([
  createEmptyResourcePerson(),
]);
  /* ---------------- EVENT POSTER (optional) ---------------- */
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState("");
  const [posterInputKey, setPosterInputKey] = useState(0);

  /* ---------------- RESOURCE PERSON HANDLERS ---------------- */

const handleResourcePersonChange = (index, field, value) => {
  setResourcePersons((previous) =>
    previous.map((person, i) =>
      i === index
        ? { ...person, [field]: value }
        : person
    )
  );
};

const addResourcePerson = () => {
  setResourcePersons((previous) => [
    ...previous,
    createEmptyResourcePerson(),
  ]);
};

const removeResourcePerson = (index) => {
  setResourcePersons((previous) =>
    previous.filter((_, i) => i !== index)
  );
};

  const MAX_POSTER_BYTES = 3 * 1024 * 1024;
  const POSTER_TYPES = ["image/png", "image/jpeg", "image/webp"];

  function clearPoster() {
    if (posterPreview && posterPreview.startsWith("blob:")) {
      URL.revokeObjectURL(posterPreview);
    }

    setPosterFile(null);
    setPosterPreview("");
    setPosterInputKey((key) => key + 1);
  }

  function choosePoster(changeEvent) {
    const file =
      changeEvent.target.files && changeEvent.target.files[0];

    // If the user cancels the file picker, keep the current selection.
    if (!file) return;

    if (!POSTER_TYPES.includes(file.type)) {
      window.alert("Poster must be a PNG, JPG or WEBP image.");
      changeEvent.target.value = "";
      return;
    }

    if (file.size > MAX_POSTER_BYTES) {
      window.alert("Poster is too large (maximum 3 MB).");
      changeEvent.target.value = "";
      return;
    }

    if (posterPreview && posterPreview.startsWith("blob:")) {
      URL.revokeObjectURL(posterPreview);
    }

    setPosterFile(file);
    setPosterPreview(URL.createObjectURL(file));
  }

  /* Uploads the chosen poster and returns its address (or null if none). */
  async function uploadPoster(apiBase, token) {
    if (!posterFile) {
      return null;
    }

    const posterData = new FormData();
    posterData.append("file", posterFile);

    const posterResponse = await fetch(`${apiBase}/api/events/poster`, {
      method: "POST",
      // no Content-Type here: the browser adds the multipart one itself
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: posterData
    });

    const posterResult = await posterResponse.json().catch(() => ({}));

    if (!posterResponse.ok) {
      throw new Error(
        "Poster upload failed: " +
          (formatApiDetail(posterResult.detail) || posterResponse.status)
      );
    }

    const posterUrl = posterResult.poster_url;

if (!posterUrl) {
  throw new Error("Poster upload did not return a URL.");
}

return posterUrl;
  }


  function getStoredCreatedEvents() {
    try {
      const stored = JSON.parse(
        localStorage.getItem("intercollegeCreatedEvents") || "[]"
      );
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  function getStoredNotifications() {
    try {
      const stored = JSON.parse(
        localStorage.getItem("intercollegeNotifications") || "[]"
      );
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  function saveCreatedEvents(events) {
    localStorage.setItem(
      "intercollegeCreatedEvents",
      JSON.stringify(events)
    );
  }

  function saveNotifications(notifications) {
    localStorage.setItem(
      "intercollegeNotifications",
      JSON.stringify(notifications)
    );
  }


  function findEventById(eventId, currentData = data) {
    const allEvents = [
      ...(currentData?.upcomingEvents || []),
      ...getStoredCreatedEvents(),
    ];
    return allEvents.find((item) =>
      String(item.id ?? item._id ?? item.event_id) === String(eventId)
    );
  }


  /* ============================================================
     LOAD DASHBOARD
  ============================================================ */

  async function loadDashboard() {

    setStatus("loading");

    try {

      const token = getToken();

      const response = await fetch(
        `${API_URL}/api/intercollege/dashboard`,
        {
          method: "GET",

          headers: {
            ...(token
              ? {
                  Authorization:
                    `Bearer ${token}`,
                }
              : {}),
          },
        }
      );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result?.detail ||
          "Unable to load inter-college dashboard."
        );

      }


      const storedEvents = getStoredCreatedEvents();
      const storedNotifications = getStoredNotifications();

      const liveEvents = Array.isArray(result?.upcomingEvents)
        ? result.upcomingEvents
        : [];

      const liveNotifications = Array.isArray(result?.notifications)
        ? result.notifications
        : [];

      const mergedEvents = [
        ...liveEvents,
        ...storedEvents.filter(
          (storedEvent) =>
            !liveEvents.some(
              (liveEvent) =>
                String(liveEvent.id) === String(storedEvent.id)
            )
        ),
      ];

      const mergedNotifications = [
        ...liveNotifications,
        ...storedNotifications.filter(
          (storedNotification) =>
            !liveNotifications.some(
              (liveNotification) =>
                String(liveNotification.id) === String(storedNotification.id)
            )
        ),
      ];

      setData({
        ...result,
        upcomingEvents: mergedEvents,
        notifications: mergedNotifications,
      });

      setIsSample(false);

      setStatus("ready");

    } catch (error) {

      console.error(
        "INTER-COLLEGE DASHBOARD ERROR:",
        error
      );

      const storedEvents = getStoredCreatedEvents();
      const storedNotifications = getStoredNotifications();

      setData({
        ...SAMPLE_DASHBOARD,
        upcomingEvents: [
          ...(SAMPLE_DASHBOARD.upcomingEvents || []),
          ...storedEvents.filter(
            (storedEvent) =>
              !(SAMPLE_DASHBOARD.upcomingEvents || []).some(
                (sampleEvent) =>
                  String(sampleEvent.id) === String(storedEvent.id)
              )
          ),
        ],
        notifications: storedNotifications,
      });

      setIsSample(true);

      setStatus("ready");

    }

  }


  useEffect(() => {

    loadDashboard();

  }, []);


  /* ============================================================
     ACTIVE SECTION
     All inter-college modules are rendered inside this page.
     We therefore switch sections locally instead of navigating
     to routes that are not registered in App.jsx.
  ============================================================ */

  /* ============================================================
     FILTER EVENTS
  ============================================================ */

  const filteredEvents =
    useMemo(() => {

      const events =
        data?.upcomingEvents ||
        [];

      const query =
        search
          .trim()
          .toLowerCase();


      if (!query) {

        return events;

      }


      return events.filter(
        (event) =>

          `${event.title}
          
           ${event.category}
           ${event.venue}`
            .toLowerCase()
            .includes(query)

      );

    }, [data, search]);


  /* ============================================================
     ORGANIZATION
  ============================================================ */

  const organization =
    data?.organization || {

      name:
        "Inter-College Coordinator",

      initial:
        "IC",

    };


  /* ============================================================
     NAVIGATION
  ============================================================ */

  // Returns to the page the user came from (dashboard if none)
  function goBack() {
    const previous =
      sectionHistoryRef.current.pop() || "dashboard";

    if (previous === activeSection) return;

    skipHistoryRef.current = true;
    setActiveSection(previous);
  }

  function go(path) {

    if (path === "/logout") {
      handleLogout();
      return;
    }

    if (path === "/intercollege-dashboard") {
      setActiveSection("dashboard");
      return;
    }

    if (path.includes("/intercollege-dashboard/org")) {
      setActiveSection("organization");
      return;
    }

    if (path.includes("/intercollege-dashboard/events/new")) {
      setActiveSection("create");
      return;
    }

    if (path.includes("/intercollege-dashboard/events")) {
      setActiveSection("events");
      return;
    }

    if (path.includes("/intercollege-dashboard/colleges")) {
      setActiveSection("colleges");
      return;
    }

    if (path.includes("/intercollege-dashboard/registrations")) {
      setActiveSection("registrations");
      return;
    }
    if (path.includes("/intercollege-dashboard/attendance")) {
      setActiveSection("attendance");
      return;
    }
    if (path.includes("/intercollege-dashboard/calendar")) {
      setActiveSection("calendar");
      return;
    }

    if (path.includes("/intercollege-dashboard/analytics")) {
      setActiveSection("analytics");
      return;
    }

    if (path.includes("/intercollege-dashboard/notifications")) {
      setActiveSection("notifications");
      return;
    }

    if (path.includes("/intercollege-dashboard/profile")) {
      setActiveSection("profile");
      return;
    }

    if (path.includes("/intercollege-dashboard/settings")) {
      setActiveSection("settings");
      return;
    }

    // Keep any unrelated/external navigation working normally.
    navigate(path);

  }


  /* ============================================================
     LOGOUT
  ============================================================ */

  function handleLogout() {

    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem(
      "userEmail"
    );

    localStorage.removeItem(
      "userRole"
    );

    localStorage.removeItem(
      "user"
    );

    navigate("/");

  }


  /* ============================================================
     DASHBOARD SECTION
  ============================================================ */

  function renderDashboard() {

    return (

      <>

        <div className="page-head">

          <h1>
            Welcome back,
            Inter-College Coordinator 👋
          </h1>

          <p>
            Manage cross-campus events,
            track participating colleges
            and monitor registrations.
          </p>

        </div>


        {isSample && (

          <div className="sample-banner">

            Showing sample data —
            connect
            {" "}
            <code>
              /api/intercollege/dashboard
            </code>
            {" "}
            to see live stats.

          </div>

        )}


        {status === "loading" && (

          <div className="kpi-grid">

            {[1, 2, 3, 4].map(
              (item) => (

                <div
                  className="stat-card"
                  key={item}
                >

                  <div className="stat-value">
                    —
                  </div>

                  <div className="stat-label">
                    Loading...
                  </div>

                </div>

              )
            )}

          </div>

        )}


        {status === "ready" &&
          data && (

          <>

            <div className="kpi-grid">

              <StatCard
                icon="📅"
                label="Total Events"
                value={
                  data.kpis
                    ?.totalEvents ??
                  0
                }
                isSample={isSample}
              />

              <StatCard
                icon="🗓️"
                label="Upcoming Events"
                value={
                  data.kpis
                    ?.upcomingEvents ??
                  0
                }
                isSample={isSample}
              />

              <StatCard
                icon="🌐"
                label="Participating Colleges"
                value={
                  data.kpis
                    ?.participatingColleges ??
                  0
                }
                isSample={isSample}
              />

              <StatCard
                icon="📋"
                label="Total Registrations"
                value={
                  data.kpis
                    ?.totalRegistrations ??
                  0
                }
                isSample={isSample}
              />

            </div>


            <div className="section-head">

              <h2>
                Quick actions
              </h2>

            </div>


            <div className="quick-actions">

              <button
                className="btn-primary"
                onClick={() =>
                  go(
                    "/intercollege-dashboard/events/new"
                  )
                }
              >
                + Create Inter-College Event
              </button>


              <button
                className="btn-ghost"
                onClick={() =>
                  go(
                    "/intercollege-dashboard/events"
                  )
                }
              >
                View My Events
              </button>


              <button
                className="btn-ghost"
                onClick={() =>
                  go(
                    "/intercollege-dashboard/colleges"
                  )
                }
              >
                Participating Colleges
              </button>


              <button
                className="btn-ghost"
                onClick={() =>
                  go(
                    "/intercollege-dashboard/analytics"
                  )
                }
              >
                View Analytics
              </button>

            </div>


            <div className="section-head">

              <h2>
                Upcoming inter-college events
              </h2>

              <button
                className="link"
                onClick={() =>
                  go(
                    "/intercollege-dashboard/events"
                  )
                }
              >
                See all
              </button>

            </div>


            {filteredEvents.length === 0 ? (

              <div className="empty-state">

                <h3>
                  No inter-college events found.
                </h3>

                <p>
                  Create an event to start
                  inviting colleges and
                  accepting registrations.
                </p>

                <button
                  className="btn-primary"
                  onClick={() =>
                    go(
                      "/intercollege-dashboard/events/new"
                    )
                  }
                >
                  + Create Event
                </button>

              </div>

            ) : (

              <div className="event-grid">

                {filteredEvents.map(
                  (event) => {

                    const registered =
                      Number(
                        event.registered ||
                        0
                      );

                    const capacity =
                      Number(
                        event.capacity ||
                        0
                      );

                    const percent =
                      capacity > 0
                        ? Math.min(
                            100,
                            (
                              registered /
                              capacity
                            ) * 100
                          )
                        : 0;


                    return (

                      <div
                        className="event-card"
                        key={event.id}
                      >

                        <div className="event-card-top">

                          <span className="event-category">

                            {event.category ||
                              "INTER-COLLEGE"}

                          </span>


                          <span
                            className={`status-badge status-${String(
                              event.status ||
                                "draft"
                            ).toLowerCase()}`}
                          >

                            {String(
                              event.status ||
                                "DRAFT"
                            ).toUpperCase()}

                          </span>

                        </div>


                        <h3>
                          {event.title}
                        </h3>


                        <p className="event-meta">

                          {formatDate(event.date)}

                          {" · "}

                          {formatTimeRange(event)}

                          {" · "}

                          {event.venue ||
                            "Venue TBA"}

                        </p>


                        <div className="college-tags">

                          {(event.colleges ||
                            [])
                            .slice(0, 4)
                            .map(
                              (
                                college,
                                index
                              ) => (

                                <span
                                  className="college-tag"
                                  key={`${college}-${index}`}
                                >
                                  {college}
                                </span>

                              )
                            )}

                        </div>


                        <div className="event-progress">

                          <div
                            className="progress-fill"
                            style={{
                              width:
                                `${percent}%`,
                            }}
                          />

                        </div>


                        <p className="event-registration-count">

                          {registered}

                          {" / "}

                          {capacity ||
                            "—"}

                          {" registered · "}

                          {
                            (
                              event.colleges ||
                              []
                            ).length
                          }

                          {" colleges"}

                        </p>


                        <div className="event-actions">

                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => {
                              setSelectedEventId(String(event.id ?? event._id ?? event.event_id));
                              setActiveSection("event-view");
                            }}
                          >
                            View
                          </button>


                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => {
                              const eventId = String(event.id ?? event._id ?? event.event_id);
                              setSelectedEventId(eventId);
                              setEventForm(eventToForm(event));
                              setResourcePersons(resourcePersonsFromEvent(event));
                              setPosterFile(null);
                              if (posterPreview && posterPreview.startsWith("blob:")) {
                                URL.revokeObjectURL(posterPreview);
                              }
                              setPosterPreview(posterSrc(event.poster_url));
                              setPosterInputKey((key) => key + 1);
                              setActiveSection("event-edit");
                            }}
                          >
                            Edit
                          </button>


                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() =>
                              go(
                                `/intercollege-dashboard/registrations?event=${event.id}`
                              )
                            }
                          >
                            Registrations
                          </button>

                        </div>

                      </div>

                    );

                  }
                )}

              </div>

            )}


            <div className="section-head">

              <h2>
                Participating colleges
              </h2>

              <button
                className="link"
                onClick={() =>
                  go(
                    "/intercollege-dashboard/colleges"
                  )
                }
              >
                View all
              </button>

            </div>


            <div className="table-wrap">

              <table className="data-table">

                <thead>

                  <tr>

                    <th>
                      College
                    </th>

                    <th>
                      Location
                    </th>

                    <th>
                      Contact Person
                    </th>

                    <th>
                      Participants
                    </th>

                    <th>
                      Events
                    </th>

                    <th>
                      Status
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {(
                    data.participatingColleges ||
                    []
                  ).map(
                    (
                      college,
                      index
                    ) => (

                      <tr
                        key={
                          `${college.college}-${index}`
                        }
                      >

                        <td>
                          {college.college}
                        </td>

                        <td>
                          {college.location ||
                            "—"}
                        </td>

                        <td>
                          {college.contactPerson ||
                            "—"}
                        </td>

                        <td>
                          {college.participants ??
                            0}
                        </td>

                        <td>
                          {college.events ??
                            0}
                        </td>

                        <td>

                          <span className="status-badge status-active">

                            {college.status ||
                              "ACTIVE"}

                          </span>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>


            <div className="section-head">

              <h2>
                Recent registrations
              </h2>

              <button
                className="link"
                onClick={() =>
                  go(
                    "/intercollege-dashboard/registrations"
                  )
                }
              >
                View all
              </button>

            </div>


            <div className="table-wrap">

              <table className="data-table">

                <thead>

                  <tr>

                    <th>
                      Participant
                    </th>

                    <th>
                      College
                    </th>

                    <th>
                      Department
                    </th>

                    <th>
                      Year
                    </th>

                    <th>
                      Team
                    </th>

                    <th>
                      Event
                    </th>

                    <th>
                      Date
                    </th>

                    <th>
                      Status
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {(
                    data.recentRegistrations ||
                    []
                  ).map(
                    (
                      registration,
                      index
                    ) => (

                      <tr
                        key={
                          registration.id ||
                          index
                        }
                      >

                        <td>
                          {registration.participant ||
                            registration.name ||
                            "—"}
                        </td>

                        <td>
                          {registration.college ||
                            "—"}
                        </td>

                        <td>
                          {registration.department ||
                            "—"}
                        </td>

                        <td>
                          {registration.year ||
                            "—"}
                        </td>

                        <td>
                          {registration.team ||
                            "Individual"}
                        </td>

                        <td>
                          {registration.event ||
                            "—"}
                        </td>

                        <td>
                          {formatRegistrationDate(
                            registration.date
                          )}
                        </td>

                        <td>

                          <span
                            className={`status-badge status-${String(
                              registration.status ||
                                "registered"
                            ).toLowerCase()}`}
                          >

                            {registration.status ||
                              "REGISTERED"}

                          </span>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          </>

        )}

      </>

    );

  }


  /* ============================================================
     ORGANIZATION PROFILE
  ============================================================ */

  function renderOrganizationProfile() {

    return (

      <div className="module-page">

        <div className="page-head">

          <h1>
            Organization Profile
          </h1>

          <p>
            Manage your inter-college organization information.
          </p>

        </div>


        <div className="module-card">

          <div className="profile-header">

            <div className="profile-avatar">

              {organization.initial ||
                "IC"}

            </div>


            <div>

              <h2>
                {organization.name}
              </h2>

              <p>
                Inter-College Leader
              </p>

            </div>

          </div>


          <div className="form-grid">

            <div className="form-field">

              <label>
                Organization Name
              </label>

              <input
                value={
                  organization.name ||
                  ""
                }
                readOnly
              />

            </div>


            <div className="form-field">

              <label>
                Institution
              </label>

              <input
                value={
                  organization.college ||
                  "—"
                }
                readOnly
              />

            </div>


            <div className="form-field">

              <label>
                Role
              </label>

              <input
                value="Inter-College Leader"
                readOnly
              />

            </div>


            <div className="form-field">

              <label>
                Status
              </label>

              <input
                value="Active"
                readOnly
              />

            </div>

          </div>

        </div>

      </div>

    );

  }


  /* ============================================================
     CREATE EVENT
  ============================================================ */

  function renderCreateEvent() {

    async function handleCreateEvent(event) {

      event.preventDefault();

      /* --------------------------------------------------------
         IMPORTANT:
         Save the event to MongoDB first.
         Only update the local dashboard after the backend
         confirms that the event was inserted successfully.
      -------------------------------------------------------- */

      const title = eventForm.title.trim();
      const description = eventForm.description.trim();
      const venue = eventForm.venue.trim();

      const time = `${formatTime(eventForm.timeFrom)} - ${formatTime(eventForm.timeTo)}`;

      const organizer =
        data?.organization?.name ||
        "Inter-College Organizer";
      
      
const cleanedResourcePersons = resourcePersons
  .filter(
    (person) =>
      person.name.trim() ||
      person.designation.trim() ||
      person.organization.trim() ||
      person.linkedin_url.trim()
  )
  .map((person) => ({
    name: person.name.trim(),
    designation: person.designation.trim(),
    organization: person.organization.trim(),
    linkedin_url: person.linkedin_url.trim(),
  }));


      const eventPayload = {
        title,
        description,
        category: eventForm.category,
        organizer: event.organizer || data?.organization?.name || "Inter-College Organizer",
        date: eventForm.date,
        time,
        location: venue,
        skills: Array.isArray(eventForm.skills) ? eventForm.skills : [],
        capacity: Number(eventForm.capacity),
        poster_url: null,
        resource_persons: cleanedResourcePersons,
      };

      console.log("CREATING INTER-COLLEGE EVENT:", eventPayload);

      try {

        const token = getToken();

        // upload the poster first (if one was chosen)
        eventPayload.poster_url = await uploadPoster(
          API_URL,
          token
        );

        const response = await fetch(
          `${API_URL}/api/events`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              ...(token
                ? {
                    Authorization:
                      `Bearer ${token}`,
                  }
                : {}),
            },

            body: JSON.stringify(
              eventPayload
            ),
          }
        );

        const result = await response.json();

        console.log(
          "EVENT CREATE STATUS:",
          response.status
        );

        console.log(
          "EVENT CREATE RESPONSE:",
          result
        );

        if (!response.ok) {
          throw new Error(
            formatApiDetail(result?.detail) ||
            result?.message ||
            "Unable to create event."
          );
        }

        if (!result?.event_id) {
          throw new Error(
            "Event was not confirmed by the backend."
          );
        }

        /* ------------------------------------------------------
           MongoDB has successfully created the event.
           Use the real MongoDB event ID in the frontend.
        ------------------------------------------------------ */

        const newEvent = {
          id: String(result.event_id),
          title,
          category: eventForm.category,
          date: eventForm.date,
          timeFrom: eventForm.timeFrom,
          timeTo: eventForm.timeTo,
          time,
          venue,
          location: venue,
          capacity: Number(eventForm.capacity),
          description,
          organizer,
          skills: eventPayload.skills,
          registered: 0,
          colleges: [],
          status: "draft",
          poster_url: eventPayload.poster_url || null,
          resource_persons: eventPayload.resource_persons,
        };

        /* ------------------------------------------------------
           Keep localStorage only as a frontend backup.
           MongoDB is now the actual source of truth.
        ------------------------------------------------------ */

        const createdEvents =
          getStoredCreatedEvents();

        saveCreatedEvents([
          ...createdEvents.filter(
            (item) =>
              String(item.id) !==
              String(newEvent.id)
          ),
          newEvent,
        ]);

        const currentNotifications =
          Array.isArray(data?.notifications)
            ? data.notifications
            : [];

        const createdNotification = {
          id: `event-created-${newEvent.id}`,
          message:
            `Event "${newEvent.title}" was created successfully.`,
          time: "Just now",
          read: false,
        };

        const nextNotifications = [
          createdNotification,
          ...currentNotifications,
        ];

        saveNotifications(
          nextNotifications
        );

        setData((current) => ({
          ...(current || SAMPLE_DASHBOARD),

          upcomingEvents: [
            ...(current?.upcomingEvents || []),
            newEvent,
          ],

          notifications:
            nextNotifications,

          kpis: {
            ...(current?.kpis || {}),

            totalEvents:
              Number(
                current?.kpis?.totalEvents ||
                  0
              ) + 1,

            upcomingEvents:
              Number(
                current?.kpis?.upcomingEvents ||
                  0
              ) + 1,
          },
        }));

        const createdDate =
          parseEventDate(newEvent.date);

        if (createdDate) {
          setCalendarMonth(
            new Date(
              createdDate.getFullYear(),
              createdDate.getMonth(),
              1
            )
          );
        }

        
clearPoster();
setEventForm(emptyEventForm);
setResourcePersons([createEmptyResourcePerson()]);

setSelectedEventId(newEvent.id);

console.log(
  "EVENT SAVED SUCCESSFULLY TO MONGODB:",
  result.event_id
);

// Show success popup
window.alert(
  `Event "${newEvent.title}" created successfully!`
);

// Return to the dashboard instead of the broken event-view section
setActiveSection("dashboard");


      } catch (error) {

        console.error(
          "INTER-COLLEGE EVENT CREATE ERROR:",
          error
        );

        window.alert(
          `Event could not be saved to MongoDB.\n\n${error.message}`
        );
      }
    }


    return (

      <div className="module-page">

        <div className="page-head">

          <h1>
            Create Inter-College Event
          </h1>

          <p>
            Create an event and invite students
            from participating colleges.
          </p>

        </div>


        <div className="module-card">

          <form onSubmit={handleCreateEvent}>

            <div className="form-grid">

              <div className="form-field">
                <label>Event Title</label>

                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) =>
                    setEventForm((current) => ({
                      ...current,
                      title: e.target.value,
                    }))
                  }
                  placeholder="Enter event title"
                  required
                />
              </div>


              <div className="form-field">
                <label>Category</label>

                <select
                  value={eventForm.category}
                  onChange={(e) =>
                    setEventForm((current) => ({
                      ...current,
                      category: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select category</option>
                  <option>Entrepreneurship</option>
                  <option>Cyber Security</option>
                  <option>Hackathon</option>
                  <option>Technical</option>
                  <option>Workshop</option>
                  <option>Tech Fest</option>
                  <option>Cultural</option>
                  <option>Sports</option>
                  <option>Seminar</option>
                </select>
              </div>


              <div className="form-field">
                <label>Date</label>

                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) =>
                    setEventForm((current) => ({
                      ...current,
                      date: e.target.value,
                    }))
                  }
                  required
                />
              </div>


              <div className="form-field">
                <label>Time</label>

                <div className="time-range-fields">

                  <div>
                    <span>From</span>
                    <input
                      type="time"
                      value={eventForm.timeFrom}
                      onChange={(e) =>
                        setEventForm((current) => ({
                          ...current,
                          timeFrom: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div>
                    <span>To</span>
                    <input
                      type="time"
                      value={eventForm.timeTo}
                      onChange={(e) =>
                        setEventForm((current) => ({
                          ...current,
                          timeTo: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                </div>
              </div>


              <div className="form-field">
                <label>Venue</label>

                <input
                  type="text"
                  value={eventForm.venue}
                  onChange={(e) =>
                    setEventForm((current) => ({
                      ...current,
                      venue: e.target.value,
                    }))
                  }
                  placeholder="Enter venue"
                  required
                />
              </div>


              <div className="form-field">
                <label>Maximum Participants</label>

                <input
                  type="number"
                  min="1"
                  value={eventForm.capacity}
                  onChange={(e) =>
                    setEventForm((current) => ({
                      ...current,
                      capacity: e.target.value,
                    }))
                  }
                  placeholder="500"
                  required
                />
              </div>

            </div>


            <div className="form-field">
              <label>Description</label>

              <textarea
                rows="5"
                value={eventForm.description}
                onChange={(e) =>
                  setEventForm((current) => ({
                    ...current,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe your event..."
                required
              />
            </div>

            <div className="form-field">
  <label>Required Skills</label>
  <input
    type="text"
    value={eventForm.skills || ""}
    onChange={(e) =>
      setEventForm((current) => ({
        ...current,
        skills: e.target.value,
      }))
    }
    placeholder="e.g. Python, Machine Learning, Data Science"
  />
  <small>
    Separate multiple skills with commas. Spaces within skill names are allowed.
  </small>

  
{/* RESOURCE PERSONS */}
<div className="resource-persons-section">
  <div className="resource-persons-heading">
    <div>
      <h3>Resource Person(s)</h3>
      <p>
        Add speakers, mentors, judges, or other event experts.
      </p>
    </div>

    <button
      type="button"
      className="add-resource-person-btn"
      onClick={addResourcePerson}
    >
      + Add Resource Person
    </button>
  </div>

  {resourcePersons.map((person, index) => (
    <div className="resource-person-card" key={index}>
      <div className="resource-person-card-heading">
        <h4>Resource Person {index + 1}</h4>

        {resourcePersons.length > 1 && (
          <button
            type="button"
            className="remove-resource-person-btn"
            onClick={() => removeResourcePerson(index)}
          >
            Remove
          </button>
        )}
      </div>

      <div className="resource-person-grid">
        <div className="form-group">
          <label>
            Full Name <span>*</span>
          </label>
          <input
            type="text"
            value={person.name}
            onChange={(e) =>
              handleResourcePersonChange(
                index,
                "name",
                e.target.value
              )
            }
            placeholder="Enter full name"
            required
          />
        </div>

        <div className="form-group">
          <label>
            Designation <span>*</span>
          </label>
          <input
            type="text"
            value={person.designation}
            onChange={(e) =>
              handleResourcePersonChange(
                index,
                "designation",
                e.target.value
              )
            }
            placeholder="e.g. AI Research Engineer"
            required
          />
        </div>

        <div className="form-group">
          <label>Organization / Company</label>
          <input
            type="text"
            value={person.organization}
            onChange={(e) =>
              handleResourcePersonChange(
                index,
                "organization",
                e.target.value
              )
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
              handleResourcePersonChange(
                index,
                "linkedin_url",
                e.target.value
              )
            }
            placeholder="https://www.linkedin.com/in/username"
          />
        </div>
      </div>
    </div>
  ))}
</div>

</div>

            
            
            <div className="form-field">
              <label>Event Poster (optional)</label>
              <input
                key={posterInputKey}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={choosePoster}
              />
              <small style={{ opacity: 0.7 }}>
                PNG, JPG or WEBP, up to 3 MB. A wide image (about 1200 x 630) looks best.
              </small>
              {posterPreview && (
                <div style={{ marginTop: "10px" }}>
                  <img
                    src={posterPreview}
                    alt="Poster preview"
                    style={{
                      width: "100%",
                      maxHeight: "200px",
                      objectFit: "cover",
                      borderRadius: "12px",
                      display: "block",
                      marginBottom: "8px"
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={clearPoster}
                  >
                    Remove poster
                  </button>
                </div>
              )}
            </div>



            <div className="form-actions">

              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  go("/intercollege-dashboard")
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn-primary"
              >
                Create Event
              </button>

            </div>

          </form>

        </div>

      </div>

    );
  }

  /* ============================================================
     EVENT EDIT
  ============================================================ */

  function renderEventEdit() {
    const event = findEventById(selectedEventId);

    if (!event) {
      return (
        <div className="module-page">
          <div className="empty-state">
            <h3>Event not found.</h3>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setActiveSection("events")}
            >
              Back to My Events
            </button>
          </div>
        </div>
      );
    }

    async function handleSaveEvent(e) {
      e.preventDefault();
      const cleanedResourcePersons = resourcePersons
  .filter(
    (person) =>
      person.name.trim() ||
      person.designation.trim() ||
      person.organization.trim() ||
      person.linkedin_url.trim()
  )
  .map((person) => ({
    name: person.name.trim(),
    designation: person.designation.trim(),
    organization: person.organization.trim(),
    linkedin_url: person.linkedin_url.trim(),
  }));

      const token = getToken();
      if (!token) {
        window.alert("Your session has expired. Please log in again.");
        return;
      }

      const title = eventForm.title.trim();
      const description = eventForm.description.trim();
      const venue = eventForm.venue.trim();

      

      if (!title || !description || !venue || !eventForm.date ||
          !eventForm.timeFrom || !eventForm.timeTo ||
          !eventForm.category || Number(eventForm.capacity) <= 0) {
        window.alert("Please complete all event fields with valid values.");
        return;
      }

      const time = `${formatTime(eventForm.timeFrom)} - ${formatTime(eventForm.timeTo)}`;

      try {
        let posterUrl = event.poster_url || null;

if (posterFile) {
  posterUrl = await uploadPoster(API_URL, token);
}

// Backend expects a relative poster path, not a full URL.
if (posterUrl && /^https?:\/\//i.test(posterUrl)) {
  const parsedUrl = new URL(posterUrl);
  posterUrl = parsedUrl.pathname;
}

console.log("POSTER URL BEING SAVED:", posterUrl);
        
const eventPayload = {
  title,
  description,
  category: eventForm.category,
  organizer: event.organizer || data?.organization?.name || "Inter-College Organizer",
  date: eventForm.date,
  time,
  location: venue,
  skills: Array.isArray(eventForm.skills)
    ? eventForm.skills
    : [],
  capacity: Number(eventForm.capacity),
  poster_url: posterUrl,
  resource_persons: cleanedResourcePersons,
};


        const eventId = String(event.id ?? event._id ?? event.event_id);
        const response = await fetch(
          `${API_URL}/api/events/${encodeURIComponent(eventId)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(eventPayload),
          }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            formatApiDetail(result?.detail) ||
            result?.message ||
            "Unable to update event."
          );
        }

        const updatedEvent = {
          ...event,
          ...eventPayload,
          id: eventId,
          venue,
          poster_url: posterUrl,
          timeFrom: eventForm.timeFrom,
          timeTo: eventForm.timeTo,
          registered: event.registered || 0,
          colleges: event.colleges || [],
          status: event.status || "draft",
        };

        setData((current) => ({
          ...(current || {}),
          upcomingEvents: (current?.upcomingEvents || []).map((item) =>
            String(item.id ?? item._id ?? item.event_id) === eventId
              ? { ...item, ...updatedEvent }
              : item
          ),
        }));

        const storedEvents = getStoredCreatedEvents();
        saveCreatedEvents(
          storedEvents.map((item) =>
            String(item.id ?? item._id ?? item.event_id) === eventId
              ? { ...item, ...updatedEvent }
              : item
          )
        );

        setPosterFile(null);
        if (posterPreview && posterPreview.startsWith("blob:")) {
          URL.revokeObjectURL(posterPreview);
        }
        setPosterPreview(posterSrc(posterUrl));
        setPosterInputKey((key) => key + 1);

        setEventForm(eventToForm(updatedEvent));
        setSelectedEventId(eventId);
        setActiveSection("events");

        window.alert(`Event "${title}" updated successfully!`);
      } catch (error) {
        console.error("INTER-COLLEGE EVENT UPDATE ERROR:", error);
        window.alert(`Event could not be updated.\n\n${error.message}`);
      }
    }

    return (
      <div className="module-page">
        <div className="page-head event-detail-head">
          <div>
            <h1>Edit Event</h1>
            <p>{event.title}</p>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setEventForm(eventToForm(event));
              
              setResourcePersons(
                Array.isArray(event.resource_persons) &&
                  event.resource_persons.length > 0
                  ? event.resource_persons.map((person) => ({
                      name: person.name || "",
                      designation: person.designation || "",
                      organization: person.organization || "",
                      linkedin_url: person.linkedin_url || "",
                    }))
                  : [createEmptyResourcePerson()]
              );

              setPosterFile(null);
              if (posterPreview && posterPreview.startsWith("blob:")) {
                URL.revokeObjectURL(posterPreview);
              }
              setPosterPreview(posterSrc(event.poster_url));
              setPosterInputKey((key) => key + 1);
              setActiveSection("event-view");
            }}
          >
            ← Back
          </button>
        </div>

        <div className="module-card">
          <form onSubmit={handleSaveEvent}>
            <div className="form-grid">
              <div className="form-field">
                <label>Event Title</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm((current) => ({
                    ...current,
                    title: e.target.value,
                  }))}
                  required
                />
              </div>

              <div className="form-field">
                <label>Category</label>
                <select
                  value={eventForm.category}
                  onChange={(e) => setEventForm((current) => ({
                    ...current,
                    category: e.target.value,
                  }))}
                  required
                >
                  <option value="">Select category</option>
                  <option>Entrepreneurship</option>
                  <option>Cyber Security</option>
                  <option>Hackathon</option>
                  <option>Technical</option>
                  <option>Workshop</option>
                  <option>Tech Fest</option>
                  <option>Cultural</option>
                  <option>Sports</option>
                  <option>Seminar</option>
                </select>
              </div>

              <div className="form-field">
                <label>Date</label>
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm((current) => ({
                    ...current,
                    date: e.target.value,
                  }))}
                  required
                />
              </div>

              <div className="form-field">
                <label>Time</label>
                <div className="time-range-fields">
                  <div>
                    <span>From</span>
                    <input
                      type="time"
                      value={eventForm.timeFrom}
                      onChange={(e) => setEventForm((current) => ({
                        ...current,
                        timeFrom: e.target.value,
                      }))}
                      required
                    />
                  </div>
                  <div>
                    <span>To</span>
                    <input
                      type="time"
                      value={eventForm.timeTo}
                      onChange={(e) => setEventForm((current) => ({
                        ...current,
                        timeTo: e.target.value,
                      }))}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-field">
                <label>Venue</label>
                <input
                  type="text"
                  value={eventForm.venue}
                  onChange={(e) => setEventForm((current) => ({
                    ...current,
                    venue: e.target.value,
                  }))}
                  required
                />
              </div>

              <div className="form-field">
                <label>Maximum Participants</label>
                <input
                  type="number"
                  min="1"
                  value={eventForm.capacity}
                  onChange={(e) => setEventForm((current) => ({
                    ...current,
                    capacity: e.target.value,
                  }))}
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label>Description</label>
              <textarea
                rows="5"
                value={eventForm.description}
                onChange={(e) => setEventForm((current) => ({
                  ...current,
                  description: e.target.value,
                }))}
                required
              />
            </div>

            <div className="form-field">
              <label>Skills (optional)</label>
              <input
                type="text"
                value={(eventForm.skills || []).join(", ")}
                onChange={(e) => setEventForm((current) => ({
                  ...current,
                  skills: e.target.value
                    .split(",")
                    .map((skill) => skill.trim())
                    .filter(Boolean),
                }))}
                placeholder="Python, Machine Learning, Teamwork, Problem-Solving"
              />
              <small style={{ opacity: 0.7 }}>
                Enter skills separated by commas. These will be saved with the event.
              </small>
            </div>

            <div className="form-field">
              <label>Event Poster (optional)</label>

              {posterPreview && (
                <img
                  src={posterPreview}
                  alt="Current event poster"
                  style={{
                    display: "block",
                    width: "100%",
                    maxWidth: "420px",
                    maxHeight: "220px",
                    objectFit: "contain",
                    borderRadius: "12px",
                    margin: "8px 0 12px",
                  }}
                />
              )}

              <input
                key={posterInputKey}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={choosePoster}
              />
              <small style={{ opacity: 0.7 }}>
                Choose a PNG, JPG or WEBP image up to 3 MB to replace the current poster.
                Leave empty to keep the existing poster.
              </small>

              {posterFile && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ marginTop: "8px" }}
                  onClick={() => {
                    if (posterPreview && posterPreview.startsWith("blob:")) {
                      URL.revokeObjectURL(posterPreview);
                    }
                    setPosterFile(null);
                    setPosterPreview(posterSrc(event.poster_url));
                    setPosterInputKey((key) => key + 1);
                  }}
                >
                  Discard poster replacement
                </button>
              )}
            </div>

            {/* RESOURCE PERSONS */}
            <div className="resource-persons-section">
              <div className="resource-persons-heading">
                <div>
                  <h3>Resource Person(s)</h3>
                  <p>
                    Add speakers, mentors, judges, or other event experts.
                  </p>
                </div>

                <button
                  type="button"
                  className="add-resource-person-btn"
                  onClick={addResourcePerson}
                >
                  + Add Resource Person
                </button>
              </div>

              {resourcePersons.map((person, index) => {
                const hasOtherDetails = Boolean(
                  person.designation.trim() ||
                    person.organization.trim() ||
                    person.linkedin_url.trim()
                );
                const hasNameOrOther = Boolean(
                  person.name.trim() ||
                    person.organization.trim() ||
                    person.linkedin_url.trim()
                );

                return (
                  <div className="resource-person-card" key={index}>
                    <div className="resource-person-card-heading">
                      <h4>Resource Person {index + 1}</h4>

                      {resourcePersons.length > 1 && (
                        <button
                          type="button"
                          className="remove-resource-person-btn"
                          onClick={() => removeResourcePerson(index)}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="resource-person-grid">
                      <div className="form-group">
                        <label>Full Name</label>
                        <input
                          type="text"
                          value={person.name}
                          onChange={(e) =>
                            handleResourcePersonChange(index, "name", e.target.value)
                          }
                          placeholder="Enter full name"
                          required={hasOtherDetails}
                        />
                      </div>

                      <div className="form-group">
                        <label>Designation</label>
                        <input
                          type="text"
                          value={person.designation}
                          onChange={(e) =>
                            handleResourcePersonChange(index, "designation", e.target.value)
                          }
                          placeholder="e.g. AI Research Engineer"
                          required={hasNameOrOther}
                        />
                      </div>

                      <div className="form-group">
                        <label>Organization / Company</label>
                        <input
                          type="text"
                          value={person.organization}
                          onChange={(e) =>
                            handleResourcePersonChange(index, "organization", e.target.value)
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
                            handleResourcePersonChange(index, "linkedin_url", e.target.value)
                          }
                          placeholder="https://www.linkedin.com/in/username"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setEventForm(eventToForm(event));
                  
                  setResourcePersons(
                    Array.isArray(event.resource_persons) &&
                      event.resource_persons.length > 0
                      ? event.resource_persons.map((person) => ({
                          name: person.name || "",
                          designation: person.designation || "",
                          organization: person.organization || "",
                          linkedin_url: person.linkedin_url || "",
                        }))
                      : [createEmptyResourcePerson()]
                  );

                  setPosterFile(null);
                  if (posterPreview && posterPreview.startsWith("blob:")) {
                    URL.revokeObjectURL(posterPreview);
                  }
                  setPosterPreview(posterSrc(event.poster_url));
                  setPosterInputKey((key) => key + 1);
                  setActiveSection("event-view");
                }}
              >
                Cancel
              </button>

              <button type="submit" className="btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }


  /* ============================================================
     MY EVENTS
  ============================================================ */

  function renderMyEvents() {

    const events =
      data?.upcomingEvents ||
      [];


    return (

      <div className="module-page">

        <div className="page-head">

          <div>

            <h1>
              My Events
            </h1>

            <p>
              Manage all your inter-college events.
            </p>

          </div>


          <button
            className="btn-primary"
            onClick={() =>
              go(
                "/intercollege-dashboard/events/new"
              )
            }
          >
            + Create Event
          </button>

        </div>


        <div className="event-grid">

          {events.length === 0 ? (

            <div className="empty-state">

              <h3>
                No events found.
              </h3>

              <p>
                Create your first inter-college event.
              </p>

            </div>

          ) : (

            events.map(
              (event) => (

                <div
                  className="event-card"
                  key={event.id}
                >
                  <div className="event-card-poster-container">
  {event.poster_url ? (
    <img
  src={
    event.poster_url
      ? event.poster_url.startsWith("http")
        ? event.poster_url
        : `${API_URL.replace(/\/$/, "")}/${event.poster_url.replace(/^\//, "")}`
      : ""
  }
  alt={`${event.title} poster`}
  className="event-card-poster"
  onClick={() => {
    if (event.poster_url) {
      const posterUrl = event.poster_url.startsWith("http")
        ? event.poster_url
        : `${API_URL.replace(/\/$/, "")}/${event.poster_url.replace(/^\//, "")}`;

      setSelectedPoster(posterUrl);
    }
  }}
  title="Click to view full poster"
  style={{ cursor: "zoom-in" }}
/>
  ) : null}

  <div
    className="event-card-no-poster"
    style={{ display: event.poster_url ? "none" : "flex" }}
  >
    <span>🖼️</span>
    <span>No poster available</span>
  </div>
</div>

                  <div className="event-card-top">

                    <span className="event-category">
                      {event.category ||
                        "INTER-COLLEGE"}
                    </span>

                    <span
                      className={`status-badge status-${String(
                        event.status ||
                          "draft"
                      ).toLowerCase()}`}
                    >
                      {String(
                        event.status ||
                          "DRAFT"
                      ).toUpperCase()}
                    </span>

                  </div>


                  <h3>
                    {event.title}
                  </h3>


                  <p className="event-meta">

                    {formatDate(event.date)}

                          {" · "}

                          {formatTimeRange(event)}

                    {" · "}

                    {event.venue ||
                      "Venue TBA"}

                  </p>


                  <div className="college-tags">

                    {(event.colleges ||
                      []).map(
                      (
                        college,
                        index
                      ) => (

                        <span
                          className="college-tag"
                          key={
                            `${college}-${index}`
                          }
                        >
                          {college}
                        </span>

                      )
                    )}

                  </div>


                  <div className="event-actions">

                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        const eventId = String(event.id ?? event._id ?? event.event_id);
                        setSelectedEventId(eventId);
                        setActiveSection("event-view");
                      }}
                    >
                      View
                    </button>

                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        const eventId = String(event.id ?? event._id ?? event.event_id);
                        setSelectedEventId(eventId);
                        setEventForm(eventToForm(event));
                        setResourcePersons(resourcePersonsFromEvent(event));
                        setPosterFile(null);
                        if (posterPreview && posterPreview.startsWith("blob:")) {
                          URL.revokeObjectURL(posterPreview);
                        }
                        setPosterPreview(posterSrc(event.poster_url));
                        setPosterInputKey((key) => key + 1);
                        setActiveSection("event-edit");
                      }}
                    >
                      Edit
                    </button>

                  </div>

                </div>

              )
            )

          )}

      
                </div>

        {/* Full-size poster popup */}
        {selectedPoster && (
          <div
            className="poster-lightbox"
            onClick={() => setSelectedPoster(null)}
          >
            <button
              type="button"
              className="poster-lightbox-close"
              onClick={() => setSelectedPoster(null)}
              aria-label="Close poster"
            >
              ✕
            </button>

            <img
              src={selectedPoster}
              alt="Full-size event poster"
              className="poster-lightbox-image"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

      </div>
    );
  }

  /* ============================================================
     PARTICIPATING COLLEGES
  ============================================================ */

  function renderParticipatingColleges() {

    const colleges =
      data?.participatingColleges ||
      [];


    return (

      <div className="module-page">

        <div className="page-head">

          <h1>
            Participating Colleges
          </h1>

          <p>
            View colleges participating
            in your inter-college events.
          </p>

        </div>


        <div className="kpi-grid">

          <StatCard
            icon="🌐"
            label="Total Colleges"
            value={colleges.length}
          />

          <StatCard
            icon="👥"
            label="Total Participants"
            value={
              colleges.reduce(
                (
                  total,
                  college
                ) =>
                  total +
                  Number(
                    college.participants ||
                    0
                  ),
                0
              )
            }
          />

          <StatCard
            icon="📅"
            label="Events Joined"
            value={
              colleges.reduce(
                (
                  total,
                  college
                ) =>
                  total +
                  Number(
                    college.events ||
                    0
                  ),
                0
              )
            }
          />

          <StatCard
            icon="✓"
            label="Active Colleges"
            value={
              colleges.filter(
                (college) =>
                  String(
                    college.status ||
                      ""
                  ).toUpperCase() ===
                  "ACTIVE"
              ).length
            }
          />

        </div>


        <div className="module-card">

          <div className="module-card-header">

            <h2>
              College Directory
            </h2>

            <p>
              Colleges currently participating
              in your activities.
            </p>

          </div>


          {colleges.length === 0 ? (

            <div className="empty-state">

              <h3>
                No participating colleges
              </h3>

              <p>
                Colleges will appear here
                once they participate.
              </p>

            </div>

          ) : (

            <div className="table-wrap">

              <table className="data-table">

                <thead>

                  <tr>

                    <th>
                      College
                    </th>

                    <th>
                      Location
                    </th>

                    <th>
                      Contact Person
                    </th>

                    <th>
                      Participants
                    </th>

                    <th>
                      Events
                    </th>

                    <th>
                      Status
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {colleges.map(
                    (
                      college,
                      index
                    ) => (

                      <tr
                        key={
                          `${college.college}-${index}`
                        }
                      >

                        <td>
                          <strong>
                            {college.college}
                          </strong>
                        </td>

                        <td>
                          {college.location ||
                            "—"}
                        </td>

                        <td>
                          {college.contactPerson ||
                            "—"}
                        </td>

                        <td>
                          {college.participants ??
                            0}
                        </td>

                        <td>
                          {college.events ??
                            0}
                        </td>

                        <td>

                          <span className="status-badge status-active">

                            {college.status ||
                              "ACTIVE"}

                          </span>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    );

  }


  /* ============================================================
     REGISTRATIONS
  ============================================================ */

  function renderRegistrations() {

    const registrations =
      data?.recentRegistrations ||
      [];


    return (

      <div className="module-page">

        <div className="page-head">

          <h1>
            Registrations
          </h1>

          <p>
            Track participants registered
            for your inter-college events.
          </p>

        </div>


        <div className="kpi-grid">

          <StatCard
            icon="📋"
            label="Total Registrations"
            value={
              data?.kpis
                ?.totalRegistrations ||
              0
            }
          />

          <StatCard
            icon="✓"
            label="Registered"
            value={
              registrations.filter(
                (item) =>
                  String(
                    item.status ||
                      ""
                  ).toUpperCase() ===
                  "REGISTERED"
              ).length
            }
          />

          <StatCard
            icon="⏳"
            label="Waitlisted"
            value={
              registrations.filter(
                (item) =>
                  String(
                    item.status ||
                      ""
                  ).toUpperCase() ===
                  "WAITLISTED"
              ).length
            }
          />

          <StatCard
            icon="🎓"
            label="Colleges"
            value={
              new Set(
                registrations
                  .map((item) => item.college)
                  .filter(Boolean)
              ).size
            }
          />

        </div>


        <div className="module-card">

          <div className="module-card-header">

            <h2>
              Recent Registrations
            </h2>

          </div>


          {registrations.length === 0 ? (

            <div className="empty-state">

              <h3>
                No registrations found
              </h3>

              <p>
                New registrations will
                appear here.
              </p>

            </div>

          ) : (

            <div className="table-wrap">

              <table className="data-table">

                <thead>

                  <tr>

                    <th>
                      Participant
                    </th>

                    <th>
                      College
                    </th>

                    <th>
                      Department
                    </th>

                    <th>
                      Year
                    </th>

                    <th>
                      Team
                    </th>

                    <th>
                      Event
                    </th>

                    <th>
                      Date
                    </th>

                    <th>
                      Status
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {registrations.map(
                    (
                      registration,
                      index
                    ) => (

                      <tr
                        key={
                          registration.id ||
                          index
                        }
                      >

                        <td>
                          <strong>
                            {registration.participant ||
                              registration.name ||
                              "—"}
                          </strong>
                        </td>

                        <td>
                          {registration.college ||
                            "—"}
                        </td>

                        <td>
                          {registration.department ||
                            "—"}
                        </td>

                        <td>
                          {registration.year ||
                            "—"}
                        </td>

                        <td>
                          {registration.team ||
                            "Individual"}
                        </td>

                        <td>
                          {registration.event ||
                            "—"}
                        </td>

                        <td>
                          {formatRegistrationDate(
                            registration.date
                          )}
                        </td>

                        <td>

                          <span
                            className={`status-badge status-${String(
                              registration.status ||
                                "registered"
                            ).toLowerCase()}`}
                          >

                            {registration.status ||
                              "REGISTERED"}

                          </span>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    );

  }


  /* ============================================================
     CALENDAR
  ============================================================ */

  function renderCalendar() {

    const events = data?.upcomingEvents || [];

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const monthName = calendarMonth.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const eventDays = {};

    events.forEach((event) => {
      const eventDate = parseEventDate(event.date);
      if (!eventDate) return;

      if (
        eventDate.getFullYear() === year &&
        eventDate.getMonth() === month
      ) {
        const day = eventDate.getDate();
        if (!eventDays[day]) eventDays[day] = [];
        eventDays[day].push(event);
      }
    });

    const cells = [];

    for (let i = 0; i < firstDay; i += 1) {
      cells.push(
        <div
          className="calendar-cell calendar-cell-empty"
          key={`empty-${i}`}
        />
      );
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayEvents = eventDays[day] || [];
      const firstEvent = dayEvents[0];

      cells.push(
        <div
          className={`calendar-cell ${
            dayEvents.length > 0 ? "calendar-cell-event" : ""
          }`}
          key={day}
        >
          <div className="calendar-date-number">{day}</div>

          {firstEvent && (
            <button
              type="button"
              className="calendar-event-marker"
              onClick={() => {
                setSelectedEventId(firstEvent.id);
                setActiveSection("event-view");
              }}
              title={`${firstEvent.title} — ${formatTimeRange(firstEvent)}`}
            >
              <span className="calendar-event-dot" />
              <span className="calendar-event-info">
                <strong>{firstEvent.title}</strong>
                <small>{formatTimeRange(firstEvent)}</small>
              </span>
            </button>
          )}

          {dayEvents.length > 1 && (
            <span className="calendar-more-events">
              +{dayEvents.length - 1} more
            </span>
          )}
        </div>
      );
    }

    function previousMonth() {
      setCalendarMonth((current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() - 1,
          1
        )
      );
    }

    function nextMonth() {
      setCalendarMonth((current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + 1,
          1
        )
      );
    }

    return (
      <div className="module-page">
        <div className="page-head">
          <h1>Calendar</h1>
          <p>Keep track of your upcoming inter-college events.</p>
        </div>

        <div className="module-card calendar-module-card">
          <div className="calendar-header">
            <button
              className="btn-ghost calendar-nav-button"
              type="button"
              onClick={previousMonth}
            >
              ←
            </button>

            <h2>{monthName}</h2>

            <button
              className="btn-ghost calendar-nav-button"
              type="button"
              onClick={nextMonth}
            >
              →
            </button>
          </div>

          <div className="calendar-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (day) => (
                <div className="calendar-day-name" key={day}>
                  {day}
                </div>
              )
            )}
            {cells}
          </div>

          <div className="calendar-legend">
            <span className="calendar-legend-dot" />
            <span>Event scheduled</span>
          </div>
        </div>

        <div className="module-card">
          <div className="module-card-header">
            <h2>Upcoming Events</h2>
          </div>

          {events.length === 0 ? (
            <div className="empty-state">
              <h3>No events scheduled</h3>
              <p>Created events will automatically appear on the calendar.</p>
            </div>
          ) : (
            <div className="calendar-event-list">
              {events.map((event, index) => (
                <button
                  type="button"
                  className="calendar-event-item"
                  key={event.id || `${event.title}-${index}`}
                  onClick={() => {
                    setSelectedEventId(event.id);
                    setActiveSection("event-view");
                  }}
                >
                  <div>
                    <strong>{event.title}</strong>
                    <p>
                      {formatDate(event.date)} · {formatTimeRange(event)}
                    </p>
                  </div>
                  <span className="event-category">
                    {event.category || "INTER-COLLEGE"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }


  /* ============================================================
     ANALYTICS
  ============================================================ */

  function renderAnalytics() {

    const totalEvents =
      Number(
        data?.kpis
          ?.totalEvents ||
        0
      );


    const upcomingEvents =
      Number(
        data?.kpis
          ?.upcomingEvents ||
        0
      );


    const colleges =
      Number(
        data?.kpis
          ?.participatingColleges ||
        0
      );


    const registrations =
      Number(
        data?.kpis
          ?.totalRegistrations ||
        0
      );


    const averageRegistrations =
      totalEvents > 0
        ? Math.round(
            registrations /
              totalEvents
          )
        : 0;


    return (

      <div className="module-page">

        <div className="page-head">

          <h1>
            Analytics
          </h1>

          <p>
            Monitor event participation,
            colleges and registrations.
          </p>

        </div>


        <div className="kpi-grid">

          <StatCard
            icon="📅"
            label="Total Events"
            value={totalEvents}
          />

          <StatCard
            icon="🗓️"
            label="Upcoming Events"
            value={upcomingEvents}
          />

          <StatCard
            icon="🌐"
            label="Participating Colleges"
            value={colleges}
          />

          <StatCard
            icon="📋"
            label="Registrations"
            value={registrations}
          />

        </div>


        <div className="analytics-grid">

          <div className="module-card">

            <div className="module-card-header">

              <h2>
                Registration Overview
              </h2>

              <p>
                Average registrations per event.
              </p>

            </div>


            <div className="analytics-number">

              {averageRegistrations}

            </div>


            <span className="analytics-caption">

              Average registrations / event

            </span>

          </div>


          <div className="module-card">

            <div className="module-card-header">

              <h2>
                Event Participation
              </h2>

              <p>
                Participation overview.
              </p>

            </div>


            <div className="analytics-bars">

              <div className="analytics-bar-row">

                <span>
                  Events
                </span>

                <div className="analytics-bar">

                  <div
                    style={{
                      width:
                        `${Math.min(
                          totalEvents * 10,
                          100
                        )}%`
                    }}
                  />

                </div>

                <strong>
                  {totalEvents}
                </strong>

              </div>


              <div className="analytics-bar-row">

                <span>
                  Colleges
                </span>

                <div className="analytics-bar">

                  <div
                    style={{
                      width:
                        `${Math.min(
                          colleges * 5,
                          100
                        )}%`
                    }}
                  />

                </div>

                <strong>
                  {colleges}
                </strong>

              </div>


              <div className="analytics-bar-row">

                <span>
                  Registrations
                </span>

                <div className="analytics-bar">

                  <div
                    style={{
                      width:
                        `${Math.min(
                          registrations / 10,
                          100
                        )}%`
                    }}
                  />

                </div>

                <strong>
                  {registrations}
                </strong>

              </div>

            </div>

          </div>

        </div>

      </div>

    );

  }


  /* ============================================================
     NOTIFICATIONS
  ============================================================ */

  function renderNotifications() {

    const notifications = Array.isArray(data?.notifications)
      ? data.notifications
      : [];

    return (
      <div className="module-page">
        <div className="page-head">
          <h1>Notifications</h1>
          <p>Stay updated with your event activities.</p>
        </div>

        <div className="module-card notification-card">
          <div className="module-card-header">
            <h2>Recent Notifications</h2>
          </div>

          {notifications.length === 0 ? (
            <div className="empty-state notification-empty-state">
              <div className="notification-empty-icon">🔔</div>
              <h3>No notifications yet</h3>
              <p>New registrations, college participation and event updates will appear here.</p>
            </div>
          ) : (
                        <div
              className="notification-list"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginTop: "16px",
              }}
            >
              {notifications.map((notification, index) => (
                <div
                  className={`notification-item ${
                    notification.read
                      ? "notification-read"
                      : "notification-unread"
                  }`}
                                    key={notification.id || index}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "14px",
                    padding: "14px 16px",
                    position: "relative",
                    borderRadius: "14px",
                    border: "1px solid rgba(148, 163, 184, 0.18)",
                  }}
                >
                  <div
                    className="notification-icon"
                    style={{
                      flex: "0 0 auto",
                      width: "40px",
                      height: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "12px",
                    }}
                  >
                    🔔
                  </div>

                  <div
                    className="notification-content"
                    style={{ flex: "1 1 auto", minWidth: 0 }}
                  >
                    <p style={{ margin: 0 }}>
                      {notification.message || "Notification"}
                    </p>
                    <span
                      style={{
                        display: "block",
                        marginTop: "4px",
                        fontSize: "12px",
                        opacity: 0.7,
                      }}
                    >
                      {notification.time || "Recently"}
                    </span>
                  </div>

                  {!notification.read && (
                    <span
                      className="notification-dot"
                      style={{
                        flex: "0 0 auto",
                        position: "static",
                        width: "8px",
                        height: "8px",
                        marginTop: "6px",
                        borderRadius: "50%",
                        background: "#6366f1",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }


  /* ============================================================
     PROFILE
  ============================================================ */

  function renderProfile() {

    const userEmail =
      localStorage.getItem(
        "userEmail"
      ) || "";


    return (

      <div className="module-page">

        <div className="page-head">

          <h1>
            Profile
          </h1>

          <p>
            Manage your coordinator profile.
          </p>

        </div>


        <div className="module-card">

          <div className="profile-header">

            <div className="profile-avatar">

              {organization.initial ||
                "IC"}

            </div>


            <div>

              <h2>
                Inter-College Coordinator
              </h2>

              <p>
                {userEmail ||
                  "Coordinator account"}
              </p>

            </div>

          </div>


          <div className="form-grid">

            <div className="form-field">

              <label>
                Email
              </label>

              <input
                type="email"
                value={
                  userEmail
                }
                readOnly
              />

            </div>


            <div className="form-field">

              <label>
                Role
              </label>

              <input
                value="Inter-College Coordinator"
                readOnly
              />

            </div>


            <div className="form-field">

              <label>
                Organization
              </label>

              <input
                value={
                  organization.name
                }
                readOnly
              />

            </div>


            <div className="form-field">

              <label>
                Institution
              </label>

              <input
                value={
                  organization.college ||
                  "—"
                }
                readOnly
              />

            </div>

          </div>

        </div>

      </div>

    );

  }


  /* ============================================================
     SETTINGS
  ============================================================ */

  function renderSettings() {

    return (

      <div className="module-page">

        <div className="page-head">

          <h1>
            Settings
          </h1>

          <p>
            Manage your CampusPath AI
            dashboard preferences.
          </p>

        </div>


        <div className="module-card">


          <div className="settings-section">

            <div>

              <h2>
                Email Notifications
              </h2>

              <p>
                Receive notifications about
                registrations and event updates.
              </p>

            </div>


            <label className="toggle">

              <input
                type="checkbox"
                defaultChecked
              />

              <span className="toggle-slider" />

            </label>

          </div>


          <div className="settings-divider" />


          <div className="settings-section">

            <div>

              <h2>
                Registration Alerts
              </h2>

              <p>
                Get notified whenever someone
                registers for your event.
              </p>

            </div>


            <label className="toggle">

              <input
                type="checkbox"
                defaultChecked
              />

              <span className="toggle-slider" />

            </label>

          </div>


          <div className="settings-divider" />


          <div className="settings-section">

            <div>

              <h2>
                College Participation Alerts
              </h2>

              <p>
                Receive updates when colleges
                join your events.
              </p>

            </div>


            <label className="toggle">

              <input
                type="checkbox"
                defaultChecked
              />

              <span className="toggle-slider" />

            </label>

          </div>


          <div className="settings-divider" />


          <div className="settings-section">

            <div>

              <h2>
                Dashboard Theme
              </h2>

                            <p>
                Choose how the dashboard looks.
                Your choice is remembered on this
                device.
              </p>

            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              {["dark", "light"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={
                    theme === mode ? "btn-primary" : "btn-ghost"
                  }
                  onClick={() => setTheme(mode)}
                >
                  {mode === "dark" ? "🌙 Dark" : "☀️ Light"}
                </button>
              ))}
            </div>

          </div>

        </div>

      </div>

    );

  }


/* ============================================================
   ATTENDANCE
============================================================ */

function renderAttendance() {
  return <InterCollegeAttendanceScanner />;
}



function renderEventView() {
  const event = findEventById(selectedEventId);

  if (!event) {
    return (
      <div className="module-page">
        <h2>Event not found</h2>
        <p>The event may have been removed or is no longer available.</p>
        <button onClick={() => setActiveSection("events")}>
          Back to My Events
        </button>
      </div>
    );
  }

  return (
    <div className="module-page">
      <div className="page-head">
        <h1>{event.title || "Event Details"}</h1>
        <p>View your inter-college event information.</p>
      </div>

      <div className="module-card">
        {event.poster_url && (
          <img
            src={posterSrc(event.poster_url)}
            alt={`${event.title} poster`}
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

        <h2>{event.title}</h2>
        <p><strong>Category:</strong> {event.category || "Not specified"}</p>
        <p><strong>Description:</strong> {event.description || "No description available."}</p>
        <p><strong>Date:</strong> {event.date || "Not specified"}</p>
        <p><strong>Time:</strong> {event.time || "Not specified"}</p>
        <p><strong>Venue:</strong> {event.venue || event.location || "Not specified"}</p>
        <p><strong>Organizer:</strong> {event.organizer || "Not specified"}</p>

        {Array.isArray(event.resource_persons) &&
          event.resource_persons.length > 0 && (
            <div style={{ marginTop: "22px" }}>
              <h3 style={{ marginBottom: "12px" }}>Resource Person(s)</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: "12px",
                }}
              >
                {event.resource_persons.map((person, index) => (
                  <div
                    key={index}
                    style={{
                      padding: "14px 16px",
                      border: "1px solid rgba(148, 163, 184, 0.25)",
                      borderRadius: "12px",
                      background: "rgba(148, 163, 184, 0.06)",
                    }}
                  >
                    <strong style={{ display: "block" }}>
                      {person.name}
                    </strong>

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
          )}

        <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
          <button onClick={() => setActiveSection("events")}>
            Back to My Events
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setEventForm(eventToForm(event));
              setResourcePersons(resourcePersonsFromEvent(event));
              setPosterFile(null);
              if (posterPreview && posterPreview.startsWith("blob:")) {
                URL.revokeObjectURL(posterPreview);
              }
              setPosterPreview(posterSrc(event.poster_url));
              setPosterInputKey((key) => key + 1);
              setActiveSection("event-edit");
            }}
          >
            Edit Event
          </button>
        </div>
      </div>
    </div>
  );
}



  /* ============================================================
     ACTIVE SECTION
  ============================================================ */

  function renderActiveSection() {

    switch (activeSection) {

      case "dashboard":
        return renderDashboard();

      case "organization":
        return renderOrganizationProfile();

      case "create":
        return renderCreateEvent();

      case "event-view":
        return renderEventView();

      case "event-edit":
        return renderEventEdit();

      case "events":
        return renderMyEvents();

      case "colleges":
        return renderParticipatingColleges();

      case "registrations":
        return renderRegistrations();

      case "attendance":
        return renderAttendance();

      case "calendar":
        return renderCalendar();

      case "analytics":
        return renderAnalytics();

      case "notifications":
        return renderNotifications();

      case "profile":
        return renderProfile();

      case "settings":
        return renderSettings();

      default:
        return renderDashboard();

    }

  }


  /* ============================================================
     RENDER
  ============================================================ */

  return (

    <div
      className={`dashboard-shell ${
        theme === "light" ? "theme-light" : ""
      }`}
    >
      <style>{LIGHT_THEME_CSS}</style>

      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <Sidebar

        role="intercollege"

        orgName={
          organization.name
        }

        activeKey={
          activeSection ===
          "organization"
            ? "org"
            : activeSection
        }

        collapsed={
          collapsed
        }

        onToggleCollapsed={() =>
          setCollapsed(
            (value) =>
              !value
          )
        }

        onNavigate={
          go
        }

        onLogout={
          handleLogout
        }

        mobileOpen={
          mobileOpen
        }

        onCloseMobile={() =>
          setMobileOpen(
            false
          )
        }

      />


      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}

      <div className="dashboard-main">

        <TopBar

          orgInitial={
            organization.initial ||
            "IC"
          }

          notifications={
            Array.isArray(data?.notifications)
              ? data.notifications
              : []
          }

          onSearch={
            setSearch
          }

          onNavigate={
            go
          }

          onMenuToggle={() =>
            setMobileOpen(
              true
            )
          }

        />


        <main className="content">

          {activeSection !== "dashboard" && (
            <button
              type="button"
              className="btn-ghost page-back-button"
              onClick={goBack}
              style={{ marginBottom: "16px" }}
            >
              ← Back
            </button>
          )}

          {renderActiveSection()}

        </main>

      </div>

    </div>

  );

}