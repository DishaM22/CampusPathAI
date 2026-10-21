import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentDashboardUI from "../features/studentDashboard/components/StudentDashboardUI";
import TimetableEditPage from "../features/onboarding/timetable/TimetableEditPage";
import {
  prepareDashboardData,
} from "../features/studentDashboard/services/recommendationEngine";
import CampusAIBot from "../features/studentDashboard/components/CampusAIBot";

// Route where the styled LandingLogin page is mounted
const LANDING_PATH = "/";

// Backend origin. Uploaded files (event report PDFs) are stored as
// "/uploads/reports/<name>.pdf", so the browser needs the full address.
const API_ORIGIN = "http://127.0.0.1:8000";

function absoluteFileUrl(url) {
  if (!url) return "";

  const text = String(url);

  if (/^(https?:|blob:)/i.test(text)) return text;

  return `${API_ORIGIN}/${text.replace(/^\//, "")}`;
}

// Makes sure an event always carries its resource persons and report link.
function withEventExtras(event) {
  if (!event || typeof event !== "object") return event;

  return {
    ...event,
    resource_persons: Array.isArray(event.resource_persons)
      ? event.resource_persons
      : [],
    report_pdf_url: absoluteFileUrl(event.report_pdf_url),
  };
}

function StudentDashboard() {
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);

  const [dashboard, setDashboard] = useState({
    events: [],
    recommendations: [],
    upcoming: [],
  });

  const [registrations, setRegistrations] = useState({});
  const [savedEventIds, setSavedEventIds] = useState([]);
  const [timetable, setTimetable] = useState([]);

  const [loading, setLoading] = useState(true);
  const [editingTimetable, setEditingTimetable] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const studentData = localStorage.getItem("student");
    const userData = localStorage.getItem("user");

    if (!token || !studentData) {
      navigate(LANDING_PATH);
      return;
    }

    let parsedStudent;

try {
  const savedStudent = studentData
    ? JSON.parse(studentData)
    : {};

  const savedUser = userData
    ? JSON.parse(userData)
    : {};

  /*
   * Use the actual registered/login user data.
   * savedUser has priority because it comes directly
   * from the latest backend login response.
   */
  parsedStudent = {
    ...savedStudent,

    student_id:
      savedUser.student_id ||
      savedStudent.student_id ||
      "",

    name:
      savedUser.name ||
      savedStudent.name ||
      "",

    email:
      savedUser.email ||
      savedStudent.email ||
      "",

    department:
      savedUser.department ||
      savedStudent.department ||
      "",

    role:
      savedUser.role ||
      savedStudent.role ||
      "student",
  };

  console.log(
    "FINAL STUDENT DATA:",
    parsedStudent
  );

  /*
   * Keep localStorage synchronized with
   * the actual registered student.
   */
  localStorage.setItem(
    "student",
    JSON.stringify(parsedStudent)
  );

  setStudent(parsedStudent);

} catch (error) {

  console.error(
    "Invalid student/user data:",
    error
  );

  localStorage.removeItem("student");

  navigate(LANDING_PATH);

  return;
}
    const loadDashboard = async () => {
      try {
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };

        /* =====================================================
           LOAD DASHBOARD + EVENTS + PROFILE
           + REGISTRATIONS + SAVED EVENTS
        ===================================================== */

        const [
  dashboardResponse,
  eventsResponse,
  profileResponse,
  registrationsResponse,
  savedEventsResponse,
  timetableResponse,
] = await Promise.all([
  fetch(
    "http://127.0.0.1:8000/api/dashboard/events",
    {
      method: "GET",
      headers,
    }
  ),

  fetch(
    "http://127.0.0.1:8000/api/events",
    {
      method: "GET",
      headers,
    }
  ),

  fetch(
    "http://127.0.0.1:8000/api/profile",
    {
      method: "GET",
      headers,
    }
  ),

  fetch(
    "http://127.0.0.1:8000/api/events/registrations",
    {
      method: "GET",
      headers,
    }
  ),

  fetch(
    "http://127.0.0.1:8000/api/events/saved",
    {
      method: "GET",
      headers,
    }
  ),

  fetch(
    "http://127.0.0.1:8000/api/student/timetable",
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  ),
]);

        /* =====================================================
           JWT CHECK
        ===================================================== */

        if (
          dashboardResponse.status === 401 ||
          eventsResponse.status === 401 ||
          profileResponse.status === 401 ||
          registrationsResponse.status === 401 ||
          savedEventsResponse.status === 401
        ) {
          localStorage.removeItem("token");
          localStorage.removeItem("student");

          navigate(LANDING_PATH);
          return;
        }

        /* =====================================================
           DASHBOARD RESPONSE
        ===================================================== */

        if (!dashboardResponse.ok) {
          throw new Error(
            `Dashboard request failed (${dashboardResponse.status})`
          );
        }

        const dashboardData =
          await dashboardResponse.json();

        /* =====================================================
           PROFILE RESPONSE
        ===================================================== */

        const profileData =
          profileResponse.ok
            ? await profileResponse.json()
            : {};
        const timetableData =
  timetableResponse.ok
    ? await timetableResponse.json()
    : {};

console.log(
  "TIMETABLE RESPONSE:",
  timetableData
);
        /* =====================================================
           ALL EVENTS
        ===================================================== */

        let allEvents = [];

        if (eventsResponse.ok) {
          allEvents = await eventsResponse.json();
        } else {
          // Don't blank the whole dashboard (events AND registrations)
          // when this one request fails: use the dashboard's own list.
          console.error(
            "EVENTS REQUEST FAILED:",
            eventsResponse.status
          );

          allEvents = Array.isArray(dashboardData.upcoming)
            ? dashboardData.upcoming
            : [];
        }

        const eventList = Array.isArray(allEvents)
          ? allEvents
          : allEvents.events || [];

        /* =====================================================
           NORMALIZE EVENTS BEFORE RECOMMENDATION PROCESSING
           This is done here so the recommendation engine receives
           the correct category for every event.
        ===================================================== */

        const normalizeEventCategory = (event) => {
          const rawCategory = String(
            event.cat ||
            event.category ||
            event.event_category ||
            event.eventCategory ||
            event.type ||
            event.event_type ||
            event.eventType ||
            event.title ||
            ""
          )
            .trim()
            .toLowerCase();

          let normalizedCategory = "Other";

          if (
            rawCategory.includes("hackathon") ||
            rawCategory.includes("hack")
          ) {
            normalizedCategory = "Hackathons";
          } else if (
            rawCategory.includes("workshop") ||
            rawCategory.includes("bootcamp") ||
            rawCategory.includes("training")
          ) {
            normalizedCategory = "Technical Workshops";
          } else if (
            rawCategory.includes("career") ||
            rawCategory.includes("placement") ||
            rawCategory.includes("internship")
          ) {
            normalizedCategory = "Career";
          } else if (rawCategory.includes("cultural")) {
            normalizedCategory = "Cultural";
          } else if (rawCategory.includes("sport")) {
            normalizedCategory = "Sports";
          } else if (rawCategory.includes("academic")) {
            normalizedCategory = "Academic";
          } else if (
            rawCategory.includes("competition") ||
            rawCategory.includes("contest")
          ) {
            normalizedCategory = "Competitions";
          } else if (
            rawCategory.includes("seminar") ||
            rawCategory.includes("webinar")
          ) {
            normalizedCategory = "Seminars";
          }

          return {
            ...withEventExtras(event),
            cat: normalizedCategory,
          };
        };

        const normalizedEventList = Array.isArray(eventList)
          ? eventList.map(normalizeEventCategory)
          : [];

        /* =====================================================
           STUDENT PROFILE FOR RECOMMENDATION ENGINE
        ===================================================== */

        const recommendationStudent = {
          ...parsedStudent,

          interests:
            profileData.interests || [],

          skills:
            profileData.skills || [],

          career_goal:
            profileData.career_goal || "",

          preferred_domains:
            profileData.preferred_domains || [],

          year:
            profileData.year ||
            parsedStudent.year ||
            "",
        };
        setStudent(recommendationStudent);

        setTimetable(
  timetableData?.timetable ||
  timetableData ||
  []
);
        /* =====================================================
           PREPARE DASHBOARD DATA
        ===================================================== */

const prepared = prepareDashboardData(
  recommendationStudent,
  dashboardData,
  normalizedEventList
);

console.log(
  "ALL EVENTS FROM BACKEND:",
  normalizedEventList
);

console.log(
  "RECOMMENDED EVENTS:",
  prepared.recommendations
);

/*
 * IMPORTANT:
 * Keep ALL events separate from recommendations.
 *
 * Recent Events should show newly created events even
 * when they don't match the student's profile yet.
 */

/*
 * Use the backend's hybrid (semantic) recommendations when the engine
 * ran successfully. The local recommendationEngine is only a fallback,
 * so the dashboard no longer shows its older scores.
 */
const backendRecommendations =
  dashboardData.engine_status === "ok" &&
  Array.isArray(dashboardData.recommended)
    ? dashboardData.recommended
    : null;

/*
 * The recommendation engine may return only some of an event's fields.
 * Copy resource persons, report PDF and capacity over from the full
 * event so recommended cards show the same details as the event list.
 */
const eventById = new Map(
  normalizedEventList.map((item) => [
    String(item._id || item.id || ""),
    item,
  ])
);

const enrichOne = (item) => {
  const full = eventById.get(
    String(item._id || item.id || item.event_id || "")
  );

  if (!full) return withEventExtras(item);

  const own = withEventExtras(item);

  return {
    ...own,
    resource_persons:
      own.resource_persons.length > 0
        ? own.resource_persons
        : full.resource_persons,
    report_pdf_url:
      own.report_pdf_url || full.report_pdf_url,
    capacity: own.capacity ?? full.capacity,
  };
};

const enrichRecommendation = (item) => {
  if (!item || typeof item !== "object") return item;

  // Some engines wrap the event: { event: {...}, score }
  if (item.event && typeof item.event === "object") {
    return { ...item, event: enrichOne(item.event) };
  }

  return enrichOne(item);
};

setDashboard({
  events: normalizedEventList,
  recommendations: (
    backendRecommendations ||
    prepared.recommendations ||
    []
  ).map(enrichRecommendation),
  upcoming:
    prepared.upcoming || normalizedEventList,
});

        /* =====================================================
           REGISTRATIONS
        ===================================================== */

if (registrationsResponse.ok) {
  const registrationData =
    await registrationsResponse.json();

  const registrationMap = {};

  /*
    Backend currently returns:

    {
      "event_id_1": "registered",
      "event_id_2": "registered"
    }

    So convert the backend map directly
    into the format expected by StudentDashboardUI.
  */

  if (
    registrationData &&
    typeof registrationData === "object" &&
    !Array.isArray(registrationData)
  ) {
    Object.entries(registrationData).forEach(
      ([eventId, status]) => {
        if (
          eventId &&
          String(status).toLowerCase() !== "cancelled"
        ) {
          registrationMap[String(eventId)] =
            "Registered";
        }
      }
    );
  }

  /*
    Also support array responses in case
    the backend format is changed later.
  */

  if (Array.isArray(registrationData)) {
    registrationData.forEach((registration) => {
      if (
        registration.event_id &&
        String(registration.status).toLowerCase() !==
          "cancelled"
      ) {
        registrationMap[
          String(registration.event_id)
        ] = "Registered";
      }
    });
  }

  console.log(
    "Loaded registrations:",
    registrationMap
  );

  setRegistrations(registrationMap);
} else {
  setRegistrations({});
}
        /* =====================================================
           SAVED EVENTS
        ===================================================== */

        if (savedEventsResponse.ok) {
          const savedData =
            await savedEventsResponse.json();

          /*
            Expected backend response:

            [
              {
                event_id: "..."
              }
            ]

            Convert into:

            [
              "event_id_1",
              "event_id_2"
            ]
          */

          const savedList =
            Array.isArray(savedData)
              ? savedData
              : savedData.saved_events || [];

          const savedIds = savedList
            .map((item) =>
              String(
                item.event_id ||
                item._id ||
                item.id ||
                ""
              )
            )
            .filter(Boolean);

          setSavedEventIds(savedIds);
        } else {
          setSavedEventIds([]);
        }

      } catch (error) {
        console.error(
          "Dashboard error:",
          error
        );

        setDashboard({
          events: [],
          recommendations: [],
          upcoming: [],
        });

        setRegistrations({});
        setSavedEventIds([]);

      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [navigate, reloadKey]);

  /* ==========================================================
     LOADING
  ========================================================== */

  if (!student) {
    return <p>Loading...</p>;
  }

  if (editingTimetable) {
    return (
      <TimetableEditPage
        onCancel={() => setEditingTimetable(false)}
        onSaved={() => {
          setEditingTimetable(false);
          setLoading(true);
          setReloadKey((key) => key + 1);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0b1020",
          color: "#e8ecff",
          display: "grid",
          placeItems: "center",
          fontFamily:
            "Inter, system-ui, sans-serif",
        }}
      >
        Loading CampusPath AI...
      </div>
    );
  }

  /* ==========================================================
     STUDENT DASHBOARD UI
  ========================================================== */
  
const handleLogout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("student");
  localStorage.removeItem("user");
  localStorage.removeItem("student_id");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userRole");
  sessionStorage.clear();

  navigate(LANDING_PATH, { replace: true });
};

  return (
  <>
    <StudentDashboardUI
      student={student}
      events={dashboard.events}
      recommendations={dashboard.recommendations}
      registrations={registrations}
      savedEventIds={savedEventIds}
      timetable={timetable}
      onEditTimetable={() => setEditingTimetable(true)}
      onLogout={handleLogout}
    />

    <CampusAIBot />
  </>
);
}

export default StudentDashboard;