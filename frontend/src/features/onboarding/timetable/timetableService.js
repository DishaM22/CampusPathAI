// timetableService.js
//
// The single isolated boundary between the timetable page
// and the backend.
//
// Backend:
// http://127.0.0.1:8000
//
// Frontend:
// http://localhost:5173
//

const API_BASE = "http://127.0.0.1:8000";

/**
 * Persists the student's weekly timetable
 * and scheduling preferences.
 */
export async function saveTimetable(payload) {
  // Get the JWT created during login
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error(
      "Authentication token not found. Please login again."
    );
  }

  console.log(
    "Saving timetable to:",
    `${API_BASE}/api/student/timetable`
  );

  const res = await fetch(
    `${API_BASE}/api/student/timetable`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },

      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const message = await res.text().catch(() => "");

    throw new Error(
      message ||
        `Failed to save timetable (${res.status})`
    );
  }

  return res.json();
}

/**
 * Fetches a previously saved timetable.
 */
export async function fetchTimetable() {
  const token = localStorage.getItem("token");

  if (!token) {
    return null;
  }

  const res = await fetch(
    `${API_BASE}/api/student/timetable`,
    {
      method: "GET",

      headers: {
        "Authorization": `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    return null;
  }

  return res.json();
}

/**
 * Placeholder for the future OCR/document-parsing endpoint.
 */
export async function extractTimetableFromFile(
  _file
) {
  throw new Error(
    "Timetable import is not available yet."
  );
}