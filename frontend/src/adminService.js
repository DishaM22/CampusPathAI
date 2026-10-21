// ============================================================
// ADMIN SERVICE
// ============================================================

const API_BASE = "http://127.0.0.1:8000";

// ============================================================
// COMMON REQUEST FUNCTION
// ============================================================

async function request(path, options = {}) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_BASE}${path}`, {
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

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      `Request failed (${response.status})`;

    throw new Error(message);
  }

  return data;
}


// ============================================================
// ADMIN DASHBOARD
// GET /api/admin/dashboard
// ============================================================

export async function fetchAdminDashboard() {
  const data = await request("/api/admin/dashboard");

  console.log("ADMIN DASHBOARD RESPONSE:", data);

  if (!data || !data.kpis) {
    console.error(
      "Admin dashboard response does not contain kpis:",
      data
    );

    throw new Error(
      "Admin dashboard response does not contain kpis."
    );
  }

  return data;
}


// ============================================================
// ADMIN USERS
// GET /api/admin/users
// ============================================================

export async function fetchAdminUsers() {
  const data = await request("/api/admin/users");

  console.log("ADMIN USERS RESPONSE:", data);

  return data;
}


// ============================================================
// ADMIN APPLICATIONS
// GET /api/admin/pending-applications
// ============================================================

export async function fetchApplications(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      searchParams.append(key, value);
    }
  });

  const query = searchParams.toString();

  const path = query
    ? `/api/admin/pending-applications?${query}`
    : "/api/admin/pending-applications";

  const data = await request(path);

  console.log("ADMIN APPLICATIONS RESPONSE:", data);

  return data;
}


// ============================================================
// SINGLE APPLICATION
// GET /api/admin/applications/:id
// ============================================================

export async function fetchApplication(id) {
  if (!id) {
    throw new Error("Application ID is required.");
  }

  const data = await request(
    `/api/admin/applications/${id}`
  );

  console.log("ADMIN APPLICATION DETAIL:", data);

  return data;
}


// ============================================================
// APPROVE APPLICATION
// POST /api/admin/applications/:id/approve
// ============================================================

export async function approveApplication(id) {
  if (!id) {
    throw new Error("Application ID is required.");
  }

  const data = await request(
    `/api/admin/applications/${id}/approve`,
    {
      method: "POST",
    }
  );

  console.log("APPLICATION APPROVED:", data);

  return data;
}


// ============================================================
// REJECT APPLICATION
// POST /api/admin/applications/:id/reject
// ============================================================

export async function rejectApplication(
  id,
  { reason, note = "" }
) {
  if (!id) {
    throw new Error("Application ID is required.");
  }

  if (!reason) {
    throw new Error("Rejection reason is required.");
  }

  const data = await request(
    `/api/admin/applications/${id}/reject`,
    {
      method: "POST",

      body: JSON.stringify({
        reason,
        note,
      }),
    }
  );

  console.log("APPLICATION REJECTED:", data);

  return data;
}


// ============================================================
// ADMIN EVENTS
// GET /api/admin/events
// ============================================================

export async function fetchAdminEvents() {
  const data = await request("/api/admin/events");

  console.log("ADMIN EVENTS RESPONSE:", data);

  return data;
}


// ============================================================
// ADMIN REGISTRATIONS
// GET /api/admin/registrations
// ============================================================

export async function fetchAdminRegistrations() {
  const data = await request(
    "/api/admin/registrations"
  );

  console.log(
    "ADMIN REGISTRATIONS RESPONSE:",
    data
  );

  return data;
}


// ============================================================
// ADMIN NOTIFICATIONS
// GET /api/admin/notifications
// ============================================================

export async function fetchAdminNotifications() {
  const data = await request(
    "/api/admin/notifications"
  );

  console.log(
    "ADMIN NOTIFICATIONS RESPONSE:",
    data
  );

  return data;
}


// ============================================================
// MARK NOTIFICATION AS READ
// POST /api/admin/notifications/:id/read
// ============================================================

export async function markNotificationRead(id) {
  if (!id) {
    throw new Error("Notification ID is required.");
  }

  return request(
    `/api/admin/notifications/${id}/read`,
    {
      method: "POST",
    }
  );
}


// ============================================================
// MARK ALL NOTIFICATIONS AS READ
// POST /api/admin/notifications/read-all
// ============================================================

export async function markAllNotificationsRead() {
  return request(
    "/api/admin/notifications/read-all",
    {
      method: "POST",
    }
  );
}


// ============================================================
// DELETE NOTIFICATION
// DELETE /api/admin/notifications/:id
// ============================================================

export async function deleteNotification(id) {
  if (!id) {
    throw new Error("Notification ID is required.");
  }

  return request(
    `/api/admin/notifications/${id}`,
    {
      method: "DELETE",
    }
  );
}


// ============================================================
// ACTIVITY LOGS
// GET /api/admin/activity-logs
// ============================================================

export async function fetchAdminActivityLogs() {
  const data = await request(
    "/api/admin/activity-logs"
  );

  console.log(
    "ACTIVITY LOG RESPONSE:",
    data
  );

  return data;
}