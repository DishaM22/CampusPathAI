import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";

export default function AdminRegistrations() {
  const navigate = useNavigate();

  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =========================================================
  // LOAD REGISTRATIONS
  // =========================================================

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_BASE}/api/admin/registrations`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      console.log(
        "REGISTRATIONS FROM DATABASE:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            `Failed to load registrations (${response.status})`
        );
      }

      setRegistrations(
        Array.isArray(data.registrations)
          ? data.registrations
          : []
      );
    } catch (err) {
      console.error(
        "REGISTRATION LOAD ERROR:",
        err
      );

      setError(
        err.message ||
          "Failed to load registrations."
      );

      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegistrations();
  }, []);

  // =========================================================
  // COUNTS
  // =========================================================

  const confirmedCount = registrations.filter(
    (item) =>
      String(item.status || "").toLowerCase() ===
      "confirmed"
  ).length;

  const pendingCount = registrations.filter(
    (item) =>
      String(item.status || "").toLowerCase() ===
      "pending"
  ).length;

  const cancelledCount = registrations.filter(
    (item) =>
      String(item.status || "").toLowerCase() ===
      "cancelled"
  ).length;

  // =========================================================
  // LOGOUT
  // =========================================================

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");

    navigate("/");
  };

  // =========================================================
  // NAVIGATION
  // =========================================================

  const go = (path) => {
    navigate(path);
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#0b1220",
        color: "#ffffff",
        display: "flex",
        fontFamily:
          "Inter, Arial, Helvetica, sans-serif",
      }}
    >
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        style={{
          width: "208px",
          minWidth: "208px",
          minHeight: "100vh",
          background: "#111827",
          borderRight: "1px solid #263247",
          boxSizing: "border-box",
          padding: "28px 10px",
        }}
      >
        {/* BRAND */}

        <div
          style={{
            padding: "0 12px",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            CampusPath AI
          </div>

          <div
            style={{
              marginTop: "2px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            ADMIN
          </div>
        </div>

        {/* NAVIGATION */}

        <NavItem
          icon="🏠"
          label="Dashboard"
          onClick={() =>
            go("/admin/dashboard")
          }
        />

        <NavItem
          icon="📥"
          label="Applications"
          onClick={() =>
            go("/admin/applications")
          }
        />

        <NavItem
          icon="👥"
          label="Users"
          onClick={() =>
            go("/admin/users")
          }
        />

        <NavItem
          icon="📅"
          label="Events"
          onClick={() =>
            go("/admin/events")
          }
        />

        <NavItem
          icon="📋"
          label="Registrations"
          active
          onClick={() =>
            go("/admin/registrations")
          }
        />

        <NavItem
          icon="📊"
          label="Analytics"
          onClick={() =>
            go("/admin/analytics")
          }
        />

        <NavItem
          icon="🔔"
          label="Notifications"
          onClick={() =>
            go("/admin/notifications")
          }
        />

        <NavItem
          icon="🧾"
          label="Activity Logs"
          onClick={() =>
            go("/admin/logs")
          }
        />

        <NavItem
          icon="⚙️"
          label="Settings"
          onClick={() =>
            go("/admin/settings")
          }
        />

        {/* LOGOUT */}

        <div
          style={{
            marginTop: "40px",
            borderTop:
              "1px solid #263247",
            paddingTop: "18px",
          }}
        >
          <button
            onClick={logout}
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              color: "#cbd5e1",
              padding: "11px 12px",
              textAlign: "left",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: "100vh",
          padding: "32px",
          boxSizing: "border-box",
          background: "#0b1220",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "28px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              Registrations
            </h1>

            <p
              style={{
                margin:
                  "7px 0 0",
                color: "#94a3b8",
                fontSize: "14px",
              }}
            >
              Manage and review event
              registrations.
            </p>
          </div>

          <button
            onClick={loadRegistrations}
            style={{
              padding:
                "10px 16px",
              borderRadius: "8px",
              border:
                "1px solid #334155",
              background:
                "#111827",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* ===================================================
            STAT CARDS
        =================================================== */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <StatCard
            title="Total Registrations"
            value={registrations.length}
          />

          <StatCard
            title="Confirmed"
            value={confirmedCount}
          />

          <StatCard
            title="Pending"
            value={pendingCount}
          />

          <StatCard
            title="Cancelled"
            value={cancelledCount}
          />
        </div>

        {/* ===================================================
            REGISTRATION PANEL
        =================================================== */}

        <div
          style={{
            background: "#111827",
            border:
              "1px solid #263247",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {/* SEARCH */}

          <div
            style={{
              padding: "16px",
              borderBottom:
                "1px solid #263247",
            }}
          >
            <input
              type="text"
              placeholder="Search student, email, event, organizer..."
              style={{
                width: "100%",
                height: "44px",
                boxSizing:
                  "border-box",
                padding:
                  "0 14px",
                borderRadius:
                  "8px",
                border:
                  "1px solid #334155",
                background:
                  "#0f172a",
                color:
                  "#ffffff",
                outline: "none",
                fontSize:
                  "13px",
              }}
            />
          </div>

          {/* =================================================
              LOADING
          ================================================= */}

          {loading && (
            <div
              style={{
                minHeight:
                  "350px",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                flexDirection:
                  "column",
              }}
            >
              <div
                style={{
                  fontSize:
                    "30px",
                  marginBottom:
                    "12px",
                }}
              >
                ⏳
              </div>

              <div
                style={{
                  color:
                    "#94a3b8",
                  fontSize:
                    "14px",
                }}
              >
                Loading registrations...
              </div>
            </div>
          )}

          {/* =================================================
              ERROR
          ================================================= */}

          {!loading &&
            error && (
              <div
                style={{
                  minHeight:
                    "350px",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  flexDirection:
                    "column",
                  padding:
                    "40px",
                  textAlign:
                    "center",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "38px",
                    marginBottom:
                      "12px",
                  }}
                >
                  ⚠️
                </div>

                <h2
                  style={{
                    margin: 0,
                    color:
                      "#f87171",
                    fontSize:
                      "18px",
                  }}
                >
                  Failed to load
                  registrations
                </h2>

                <p
                  style={{
                    color:
                      "#94a3b8",
                    marginTop:
                      "8px",
                  }}
                >
                  {error}
                </p>
              </div>
            )}

          {/* =================================================
              NO REGISTRATIONS
          ================================================= */}

          {!loading &&
            !error &&
            registrations.length ===
              0 && (
              <div
                style={{
                  minHeight:
                    "350px",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  flexDirection:
                    "column",
                  textAlign:
                    "center",
                  padding:
                    "40px",
                }}
              >
                <div
                  style={{
                    width:
                      "70px",
                    height:
                      "70px",
                    borderRadius:
                      "50%",
                    background:
                      "#1e293b",
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    fontSize:
                      "32px",
                    marginBottom:
                      "18px",
                  }}
                >
                  📋
                </div>

                <h2
                  style={{
                    margin: 0,
                    color:
                      "#e2e8f0",
                    fontSize:
                      "21px",
                    fontWeight:
                      600,
                  }}
                >
                  No registrations yet
                </h2>

                <p
                  style={{
                    margin:
                      "9px 0 0",
                    color:
                      "#64748b",
                    fontSize:
                      "14px",
                  }}
                >
                  Students have not
                  registered for any
                  events yet.
                </p>
              </div>
            )}

          {/* =================================================
              REGISTRATION TABLE
          ================================================= */}

          {!loading &&
            !error &&
            registrations.length >
              0 && (
              <div
                style={{
                  overflowX:
                    "auto",
                }}
              >
                <table
                  style={{
                    width:
                      "100%",
                    borderCollapse:
                      "collapse",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={thStyle}>
                        STUDENT
                      </th>

                      <th style={thStyle}>
                        EVENT
                      </th>

                      <th style={thStyle}>
                        ORGANIZER
                      </th>

                      <th style={thStyle}>
                        STATUS
                      </th>

                      <th style={thStyle}>
                        REGISTERED
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
                            registration._id ||
                            index
                          }
                        >
                          <td style={tdStyle}>
                            <div
                              style={{
                                fontWeight:
                                  600,
                              }}
                            >
                              {registration.student_name ||
                                registration.studentName ||
                                registration.name ||
                                "Unknown Student"}
                            </div>

                            <div
                              style={{
                                marginTop:
                                  "4px",
                                color:
                                  "#64748b",
                                fontSize:
                                  "12px",
                              }}
                            >
                              {registration.student_email ||
                                registration.email ||
                                "—"}
                            </div>
                          </td>

                          <td style={tdStyle}>
                            {registration.event_name ||
                              registration.eventName ||
                              registration.event ||
                              registration.title ||
                              "Unknown Event"}
                          </td>

                          <td style={tdStyle}>
                            {registration.organizer ||
                              registration.organizer_name ||
                              "—"}
                          </td>

                          <td style={tdStyle}>
                            <StatusBadge
                              status={
                                registration.status
                              }
                            />
                          </td>

                          <td style={tdStyle}>
                            {formatDate(
                              registration.registered_at ||
                                registration.registration_date ||
                                registration.created_at ||
                                registration.date
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}

// =============================================================
// SIDEBAR ITEM
// =============================================================

function NavItem({
  icon,
  label,
  active,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "11px 12px",
        marginBottom: "4px",
        border: "none",
        borderRadius: "7px",
        background: active
          ? "#261c55"
          : "transparent",
        color: active
          ? "#a78bfa"
          : "#cbd5e1",
        cursor: "pointer",
        textAlign: "left",
        fontSize: "14px",
        fontWeight: active
          ? 600
          : 500,
      }}
    >
      <span
        style={{
          width: "18px",
          textAlign: "center",
        }}
      >
        {icon}
      </span>

      <span>{label}</span>
    </button>
  );
}

// =============================================================
// STAT CARD
// =============================================================

function StatCard({
  title,
  value,
}) {
  return (
    <div
      style={{
        background: "#111827",
        border:
          "1px solid #263247",
        borderRadius: "10px",
        padding: "20px",
        minHeight: "100px",
        boxSizing:
          "border-box",
      }}
    >
      <div
        style={{
          color:
            "#94a3b8",
          fontSize: "13px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop:
            "10px",
          fontSize: "28px",
          fontWeight: 700,
          color:
            "#ffffff",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// =============================================================
// STATUS BADGE
// =============================================================

function StatusBadge({
  status,
}) {
  const value = String(
    status || "confirmed"
  ).toLowerCase();

  let background =
    "#063b25";

  let color =
    "#22c55e";

  if (
    value === "pending"
  ) {
    background =
      "#422006";
    color =
      "#f59e0b";
  }

  if (
    value === "cancelled"
  ) {
    background =
      "#450a0a";
    color =
      "#f87171";
  }

  return (
    <span
      style={{
        display:
          "inline-block",
        padding:
          "5px 10px",
        borderRadius:
          "20px",
        background,
        color,
        fontSize:
          "10px",
        fontWeight: 700,
        textTransform:
          "uppercase",
      }}
    >
      {value}
    </span>
  );
}

// =============================================================
// DATE
// =============================================================

function formatDate(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(
      value
    );
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

// =============================================================
// TABLE STYLES
// =============================================================

const thStyle = {
  textAlign: "left",
  padding:
    "14px 16px",
  background:
    "#0f172a",
  color:
    "#94a3b8",
  fontSize: "11px",
  borderBottom:
    "1px solid #263247",
};

const tdStyle = {
  padding:
    "16px",
  color:
    "#e2e8f0",
  fontSize: "13px",
  borderBottom:
    "1px solid #202b3d",
};