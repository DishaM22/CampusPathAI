// ============================================================
// CLUB SERVICE
// ============================================================

// FastAPI backend
const API_BASE = "http://127.0.0.1:8000";


// ============================================================
// COMMON REQUEST FUNCTION
// ============================================================

async function request(path, options = {}) {

  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",

    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),

    ...(options.headers || {}),
  };

  console.log("========================================");
  console.log("CLUB API REQUEST");
  console.log("URL:", `${API_BASE}${path}`);
  console.log("TOKEN EXISTS:", !!token);
  console.log("========================================");

  const res = await fetch(
    `${API_BASE}${path}`,
    {
      ...options,
      headers,
    }
  );

  console.log(
    "CLUB API RESPONSE:",
    res.status,
    res.statusText
  );

  // ----------------------------------------------------------
  // Read response
  // ----------------------------------------------------------

  let data = null;

  try {

    data = await res.json();

  } catch {

    data = null;

  }

  // ----------------------------------------------------------
  // Handle backend errors
  // ----------------------------------------------------------

  if (!res.ok) {

    console.error(
      "CLUB API ERROR:",
      data
    );

    throw new Error(
      data?.detail ||
      data?.message ||
      `Request failed (${res.status})`
    );

  }

  return data;
}


// ============================================================
// CLUB DASHBOARD
// ============================================================

export function fetchClubDashboard() {

  return request(
    "/api/club/dashboard"
  );

}


// ============================================================
// CLUB EVENTS
// ============================================================

export function fetchClubEvents(
  params = {}
) {

  const qs =
    new URLSearchParams(
      params
    ).toString();

  return request(
    `/api/club/events${
      qs
        ? `?${qs}`
        : ""
    }`
  );

}


// ============================================================
// CREATE EVENT
// ============================================================

export function createEvent(
  eventData
) {

  return request(
    "/api/club/events",
    {
      method: "POST",

      body: JSON.stringify(
        eventData
      ),
    }
  );

}


// ============================================================
// UPDATE EVENT
// ============================================================

export function updateEvent(
  id,
  patch
) {

  return request(
    `/api/club/events/${id}`,
    {
      method: "PATCH",

      body: JSON.stringify(
        patch
      ),
    }
  );

}


// ============================================================
// DELETE EVENT
// ============================================================

export function deleteEvent(
  id
) {

  return request(
    `/api/club/events/${id}`,
    {
      method: "DELETE",
    }
  );

}


// ============================================================
// EVENT REGISTRATIONS
// ============================================================

export function fetchEventRegistrations(
  eventId
) {

  return request(
    `/api/club/events/${eventId}/registrations`
  );

}


// ============================================================
// CLUB PROFILE
// ============================================================

export function fetchClubProfile() {

  return request(
    "/api/club/profile"
  );

}


// ============================================================
// UPDATE CLUB PROFILE
// ============================================================

export function updateClubProfile(
  patch
) {

  return request(
    "/api/club/profile",
    {
      method: "PATCH",

      body: JSON.stringify(
        patch
      ),
    }
  );

}