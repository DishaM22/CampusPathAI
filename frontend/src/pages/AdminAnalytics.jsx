import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../admin/components/Sidebar";

const API_BASE = "http://127.0.0.1:8000";

export default function AdminAnalytics() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedClub, setSelectedClub] = useState(null);
  const [clubSearch, setClubSearch] = useState("");
  // ============================================================
  // LOAD ALL ANALYTICS DATA
  // ============================================================

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      const headers = {
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      };

      const [usersResponse, eventsResponse, registrationsResponse] =
        await Promise.all([
          fetch(`${API_BASE}/api/admin/users`, {
            headers,
          }),

          fetch(`${API_BASE}/api/events`, {
            headers,
          }),

          fetch(`${API_BASE}/api/admin/registrations`, {
            headers,
          }),
        ]);

      // ----------------------------------------------------------
      // USERS
      // ----------------------------------------------------------

      if (!usersResponse.ok) {
        throw new Error(
          `Failed to load users (${usersResponse.status})`
        );
      }

      const usersData = await usersResponse.json();

      let usersArray = [];

      if (Array.isArray(usersData)) {
        usersArray = usersData;
      } else if (Array.isArray(usersData.users)) {
        usersArray = usersData.users;
      }

      // ----------------------------------------------------------
      // EVENTS
      // ----------------------------------------------------------

      if (!eventsResponse.ok) {
        throw new Error(
          `Failed to load events (${eventsResponse.status})`
        );
      }

      const eventsData = await eventsResponse.json();

      let eventsArray = [];

      if (Array.isArray(eventsData)) {
        eventsArray = eventsData;
      } else if (Array.isArray(eventsData.events)) {
        eventsArray = eventsData.events;
      }

      // ----------------------------------------------------------
      // REGISTRATIONS
      // ----------------------------------------------------------

      if (!registrationsResponse.ok) {
        throw new Error(
          `Failed to load registrations (${registrationsResponse.status})`
        );
      }

      const registrationsData =
        await registrationsResponse.json();

      let registrationsArray = [];

      if (Array.isArray(registrationsData)) {
        registrationsArray = registrationsData;
      } else if (
        Array.isArray(registrationsData.registrations)
      ) {
        registrationsArray =
          registrationsData.registrations;
      }

      console.log(
        "ANALYTICS USERS:",
        usersArray
      );

      console.log(
        "ANALYTICS EVENTS:",
        eventsArray
      );

      console.log(
        "ANALYTICS REGISTRATIONS:",
        registrationsArray
      );

      setUsers(usersArray);
      setEvents(eventsArray);
      setRegistrations(registrationsArray);

    } catch (err) {
      console.error(
        "ANALYTICS LOAD ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to load analytics."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  // ============================================================
  // USER ANALYTICS
  // ============================================================

  const userAnalytics = useMemo(() => {
    const total = users.length;

    const students = users.filter(
      (user) =>
        String(
          user.role || ""
        ).toLowerCase() === "student"
    ).length;

    const clubs = users.filter(
      (user) =>
        String(
          user.role || ""
        ).toLowerCase() === "club"
    ).length;

    const intercollege = users.filter(
      (user) =>
        String(
          user.role || ""
        ).toLowerCase() === "intercollege"
    ).length;

    const admins = users.filter(
      (user) =>
        String(
          user.role || ""
        ).toLowerCase() === "admin"
    ).length;

    const active = users.filter(
      (user) =>
        String(
          user.status || "active"
        ).toLowerCase() === "active"
    ).length;

    const pending = users.filter(
      (user) =>
        String(
          user.status || ""
        ).toLowerCase() === "pending"
    ).length;

    const rejected = users.filter(
      (user) =>
        String(
          user.status || ""
        ).toLowerCase() === "rejected"
    ).length;

    return {
      total,
      students,
      clubs,
      intercollege,
      admins,
      organizations: clubs + intercollege,
      active,
      pending,
      rejected,
    };
  }, [users]);

  // ============================================================
  // EVENT ANALYTICS
  // ============================================================

  const eventAnalytics = useMemo(() => {
    const total = events.length;

    const published = events.filter(
      (event) =>
        String(
          event.status || ""
        ).toLowerCase() === "published"
    ).length;

    const categories = {};

    events.forEach((event) => {
      const category =
        event.category ||
        "Other";

      categories[category] =
        (categories[category] || 0) + 1;
    });

    const categoryArray = Object.entries(
      categories
    )
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort(
        (a, b) =>
          b.count - a.count
      );

    return {
      total,
      published,
      categories: categoryArray,
    };
  }, [events]);

  // ============================================================
  // REGISTRATION ANALYTICS
  // ============================================================

  const registrationAnalytics = useMemo(() => {
    const total =
      registrations.length;

    const confirmed =
      registrations.filter(
        (registration) =>
          String(
            registration.status ||
              "confirmed"
          ).toLowerCase() ===
          "confirmed"
      ).length;

    const pending =
      registrations.filter(
        (registration) =>
          String(
            registration.status || ""
          ).toLowerCase() ===
          "pending"
      ).length;

    const cancelled =
      registrations.filter(
        (registration) =>
          String(
            registration.status || ""
          ).toLowerCase() ===
          "cancelled"
      ).length;

    return {
      total,
      confirmed,
      pending,
      cancelled,
    };
  }, [registrations]);

  // ============================================================
  // REGISTRATION DISTRIBUTION
  // ============================================================

  const registrationPercentages =
    useMemo(() => {
      const total =
        registrationAnalytics.total;

      if (total === 0) {
        return {
          confirmed: 0,
          pending: 0,
          cancelled: 0,
        };
      }

      return {
        confirmed: Math.round(
          (registrationAnalytics.confirmed /
            total) *
            100
        ),

        pending: Math.round(
          (registrationAnalytics.pending /
            total) *
            100
        ),

        cancelled: Math.round(
          (registrationAnalytics.cancelled /
            total) *
            100
        ),
      };
    }, [registrationAnalytics]);

    const clubEvents = selectedClub
  ? events.filter(
      (event) =>
        String(event.created_by || "") ===
        String(
          selectedClub._id ||
          selectedClub.id ||
          selectedClub.student_id ||
          ""
        )
    )
  : [];

const clubEventIds = clubEvents.map((event) =>
  String(event._id || event.id || "")
);

const clubRegistrations = registrations.filter((registration) =>
  clubEventIds.includes(
    String(registration.event_id || registration.eventId || "")
  )
);
  // ============================================================
  // SIMPLE BAR WIDTH
  // ============================================================

  const getBarWidth = (
    value,
    maximum
  ) => {
    if (!maximum || maximum === 0) {
      return 0;
    }

    return Math.max(
      8,
      Math.round(
        (value / maximum) * 100
      )
    );
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");

    navigate("/");
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div style={styles.app}>
        <Sidebar
          role="admin"
          orgName="CampusPath AI"
          activeKey="analytics"
          onNavigate={navigate}
          onLogout={handleLogout}
        />

        <main style={styles.main}>
          <div style={styles.loadingBox}>
            Loading analytics...
          </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (error) {
    return (
      <div style={styles.app}>
        <Sidebar
          role="admin"
          orgName="CampusPath AI"
          activeKey="analytics"
          onNavigate={navigate}
          onLogout={handleLogout}
        />

        <main style={styles.main}>
          <div style={styles.headerRow}>
            <div>
              <h1 style={styles.title}>
                Analytics
              </h1>

              <p style={styles.subtitle}>
                View platform activity and performance.
              </p>
            </div>

            <button
              style={styles.refreshButton}
              onClick={loadAnalytics}
            >
              ↻ Refresh
            </button>
          </div>

          <div style={styles.errorBox}>
            <div style={styles.errorIcon}>
              ⚠️
            </div>

            <h2>
              Unable to load analytics
            </h2>

            <p>
              {error}
            </p>

            <button
              style={styles.retryButton}
              onClick={loadAnalytics}
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <div style={styles.app}>

      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <Sidebar
        role="admin"
        orgName="CampusPath AI"
        activeKey="analytics"
        onNavigate={navigate}
        onLogout={handleLogout}
      />

      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}

      <main style={styles.main}>

        {/* HEADER */}

        <div style={styles.headerRow}>

          <div>
            <h1 style={styles.title}>
              Analytics
            </h1>

            <p style={styles.subtitle}>
              Monitor CampusPath AI users,
              events and registrations.
            </p>
          </div>

          <button
            style={styles.refreshButton}
            onClick={loadAnalytics}
          >
            ↻ Refresh
          </button>

        </div>

        {/* ==================================================
            OVERVIEW CARDS
        ================================================== */}

        <section style={styles.cardGrid}>

          <MetricCard
            icon="👥"
            label="Total Users"
            value={
              userAnalytics.total
            }
          />

          <MetricCard
            icon="🎓"
            label="Students"
            value={
              userAnalytics.students
            }
          />

          <MetricCard
            icon="🏛️"
            label="Organizations"
            value={
              userAnalytics.organizations
            }
          />

          <MetricCard
            icon="📅"
            label="Total Events"
            value={
              eventAnalytics.total
            }
          />

          <MetricCard
            icon="📋"
            label="Registrations"
            value={
              registrationAnalytics.total
            }
          />

          <MetricCard
            icon="✅"
            label="Active Users"
            value={
              userAnalytics.active
            }
          />

        </section>

        {/* ==================================================
            USER ANALYTICS
        ================================================== */}

        <section style={styles.section}>

          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                User Analytics
              </h2>

              <p style={styles.sectionSubtitle}>
                Distribution of registered
                CampusPath AI accounts.
              </p>
            </div>
          </div>

          <div style={styles.analyticsGrid}>

            <div style={styles.panel}>

              <h3 style={styles.panelTitle}>
                Users by Role
              </h3>

              <RoleBar
                label="Students"
                value={
                  userAnalytics.students
                }
                maximum={
                  userAnalytics.total
                }
              />

              <RoleBar
                label="Clubs"
                value={
                  userAnalytics.clubs
                }
                maximum={
                  userAnalytics.total
                }
              />

              <RoleBar
                label="Intercollege"
                value={
                  userAnalytics.intercollege
                }
                maximum={
                  userAnalytics.total
                }
              />

              <RoleBar
                label="Admins"
                value={
                  userAnalytics.admins
                }
                maximum={
                  userAnalytics.total
                }
              />

            </div>

            <div style={styles.panel}>

              <h3 style={styles.panelTitle}>
                Account Status
              </h3>

              <StatusRow
                label="Active"
                value={
                  userAnalytics.active
                }
                percentage={
                  userAnalytics.total
                    ? Math.round(
                        (userAnalytics.active /
                          userAnalytics.total) *
                          100
                      )
                    : 0
                }
              />

              <StatusRow
                label="Pending"
                value={
                  userAnalytics.pending
                }
                percentage={
                  userAnalytics.total
                    ? Math.round(
                        (userAnalytics.pending /
                          userAnalytics.total) *
                          100
                      )
                    : 0
                }
              />

              <StatusRow
                label="Rejected"
                value={
                  userAnalytics.rejected
                }
                percentage={
                  userAnalytics.total
                    ? Math.round(
                        (userAnalytics.rejected /
                          userAnalytics.total) *
                          100
                      )
                    : 0
                }
              />

            </div>

          </div>

        </section>

        {/* ==================================================
            EVENT ANALYTICS
        ================================================== */}

        <section style={styles.section}>

          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                Event Analytics
              </h2>

              <p style={styles.sectionSubtitle}>
                Events currently stored in
                the CampusPath AI database.
              </p>
            </div>

            <button
              style={styles.secondaryButton}
              onClick={() =>
                navigate("/admin/events")
              }
            >
              View Events
            </button>
          </div>

          <div style={styles.analyticsGrid}>

            <div style={styles.panel}>

              <h3 style={styles.panelTitle}>
                Events by Category
              </h3>

              {eventAnalytics.categories.length ===
              0 ? (
                <EmptySmall
                  message="No events available yet."
                />
              ) : (
                eventAnalytics.categories.map(
                  (category) => (
                    <RoleBar
                      key={category.name}
                      label={category.name}
                      value={category.count}
                      maximum={
                        eventAnalytics.categories[0]
                          ?.count || 1
                      }
                    />
                  )
                )
              )}

            </div>

            <div style={styles.panel}>

              <h3 style={styles.panelTitle}>
                Event Summary
              </h3>

              <div style={styles.summaryRow}>
                <span>
                  Total events
                </span>

                <strong>
                  {eventAnalytics.total}
                </strong>
              </div>

              <div style={styles.summaryRow}>
                <span>
                  Published events
                </span>

                <strong>
                  {eventAnalytics.published}
                </strong>
              </div>

              <div style={styles.summaryRow}>
                <span>
                  Other events
                </span>

                <strong>
                  {Math.max(
                    0,
                    eventAnalytics.total -
                      eventAnalytics.published
                  )}
                </strong>
              </div>

            </div>

          </div>

        </section>

        {/* ==================================================
            REGISTRATION ANALYTICS
        ================================================== */}

        <section style={styles.section}>

          <div style={styles.sectionHeader}>

            <div>
              <h2 style={styles.sectionTitle}>
                Registration Analytics
              </h2>

              <p style={styles.sectionSubtitle}>
                Student participation across
                CampusPath AI events.
              </p>
            </div>

            <button
              style={styles.secondaryButton}
              onClick={() =>
                navigate(
                  "/admin/registrations"
                )
              }
            >
              View Registrations
            </button>

          </div>

          {registrationAnalytics.total ===
          0 ? (
            <div style={styles.emptyPanel}>

              <div style={styles.emptyIcon}>
                📋
              </div>

              <h3>
                No registrations yet
              </h3>

              <p>
                Students have not registered
                for any events yet.
              </p>

            </div>
          ) : (
            <div style={styles.registrationPanel}>

              <div style={styles.registrationNumbers}>

                <RegistrationStat
                  label="Total"
                  value={
                    registrationAnalytics.total
                  }
                />

                <RegistrationStat
                  label="Confirmed"
                  value={
                    registrationAnalytics.confirmed
                  }
                />

                <RegistrationStat
                  label="Pending"
                  value={
                    registrationAnalytics.pending
                  }
                />

                <RegistrationStat
                  label="Cancelled"
                  value={
                    registrationAnalytics.cancelled
                  }
                />

              </div>

              <div style={styles.distribution}>

                <DistributionBar
                  label="Confirmed"
                  percentage={
                    registrationPercentages.confirmed
                  }
                />

                <DistributionBar
                  label="Pending"
                  percentage={
                    registrationPercentages.pending
                  }
                />

                <DistributionBar
                  label="Cancelled"
                  percentage={
                    registrationPercentages.cancelled
                  }
                />

              </div>

            </div>
          )}

        </section>
{/* CLUB-WISE ANALYTICS */}
<section style={styles.section}>
  {selectedClub ? (
    <>
      <button
        style={styles.secondaryButton}
        onClick={() => setSelectedClub(null)}
      >
        ← Back to Overall Analytics
      </button>

      <h2 style={styles.sectionTitle}>
        {selectedClub.club_name || selectedClub.name || selectedClub.email}
      </h2>

      <div style={styles.cardGrid}>
  <MetricCard
    icon="📅"
    label="Total Events"
    value={clubEvents.length}
  />
  <MetricCard
    icon="🚀"
    label="Published"
    value={clubEvents.filter(
      (e) => String(e.status || "").toLowerCase() === "published"
    ).length}
  />
  <MetricCard
    icon="📝"
    label="Upcoming Events"
    value={clubEvents.filter(
      (e) => e.date && new Date(e.date) >= new Date()
    ).length}
  />
  <MetricCard
    icon="📋"
    label="Total Registrations"
    value={clubRegistrations.length}
  />
  <MetricCard
    icon="✅"
    label="Confirmed"
    value={clubRegistrations.filter(
      (r) => ["confirmed", "registered"].includes(
        String(r.status || "").toLowerCase()
      )
    ).length}
  />
  <MetricCard
    icon="❌"
    label="Cancelled"
    value={clubRegistrations.filter(
      (r) => String(r.status || "").toLowerCase() === "cancelled"
    ).length}

  
  />

<section style={styles.section}>
  <h3 style={styles.sectionTitle}>Event Performance</h3>
  <p style={styles.sectionSubtitle}>
    Registration totals for each event organized by this club.
  </p>

  {clubEvents.length === 0 ? (
    <div style={styles.emptyPanel}>
      No events found for this club.
    </div>
  ) : (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "18px",
        width: "100%",
      }}
    >
      {clubEvents.map((event) => {
        const eventId = String(event._id || event.id || "");

        const eventRegistrations = clubRegistrations.filter(
          (registration) =>
            String(
              registration.event_id || registration.eventId || ""
            ) === eventId
        );

        return (
          <div
            key={eventId}
            style={{
              background: "#111c2e",
              border: "1px solid #2b3d56",
              borderRadius: "14px",
              padding: "22px",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                <h4
                  style={{
                    color: "#f1f5f9",
                    fontSize: "18px",
                    fontWeight: 700,
                    lineHeight: 1.4,
                    margin: "0 0 10px",
                    overflowWrap: "anywhere",
                  }}
                >
                  {event.title || event.event_name || "Untitled Event"}
                </h4>

                <p
                  style={{
                    color: "#94a3b8",
                    fontSize: "14px",
                    margin: "0 0 8px",
                  }}
                >
                  {event.category || "Uncategorized"}
                </p>

                <span
                  style={{
                    display: "inline-block",
                    padding: "5px 10px",
                    borderRadius: "20px",
                    background: "#1e293b",
                    color: "#cbd5e1",
                    fontSize: "12px",
                    textTransform: "capitalize",
                  }}
                >
                  {event.status || "Status unavailable"}
                </span>
              </div>

              <div
                style={{
                  flex: "0 0 auto",
                  minWidth: "95px",
                  padding: "12px",
                  borderRadius: "10px",
                  background: "#1b2b43",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "27px", fontWeight: 800, color: "#ffffff" }}>
                  {eventRegistrations.length}
                </div>
                <div style={{ fontSize: "12px", color: "#93c5fd" }}>
                  Registrations
                </div>
              </div>
            </div>

            <div
              style={{
                height: "1px",
                background: "#2b3d56",
                margin: "20px 0 14px",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                color: "#94a3b8",
                fontSize: "13px",
                flexWrap: "wrap",
              }}
            >
              <span>Event category</span>
              <strong style={{ color: "#e2e8f0" }}>
                {event.category || "Not specified"}
              </strong>
            </div>
          </div>
        );
      })}
    </div>
  )}
</section>

</div>
    </>
  ) : (
    <>
      
<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "20px",
  }}
>
  <div>
    <h2 style={styles.sectionTitle}>Club Analytics</h2>
    <p style={styles.sectionSubtitle}>
      Search for a club to view its individual analytics.
    </p>
  </div>

  <input
    type="text"
    placeholder="🔍 Search clubs..."
    value={clubSearch}
    onChange={(e) => setClubSearch(e.target.value)}
    style={{
      width: "280px",
      maxWidth: "100%",
      padding: "12px 16px",
      borderRadius: "10px",
      border: "1px solid #334155",
      background: "#111c2e",
      color: "#f1f5f9",
      fontSize: "14px",
      boxSizing: "border-box",
    }}
  />
</div>

<div style={styles.panel}>
  {users
    .filter(
      (user) =>
        String(user.role || "").toLowerCase() === "club"
    )
    .filter((club) => {
      const name = String(
        club.club_name || club.name || club.email || ""
      ).toLowerCase();

      return name.includes(clubSearch.trim().toLowerCase());
    })
    .map((club) => (
      <div
        key={club._id || club.id || club.email}
        style={{
          ...styles.summaryRow,
          cursor: "pointer",
          padding: "14px",
          borderBottom: "1px solid #263449",
        }}
        onClick={() => setSelectedClub(club)}
      >
        <span>
          {club.club_name || club.name || club.email}
        </span>
        <strong>View Analytics →</strong>
      </div>
    ))}

  {users.filter(
    (user) =>
      String(user.role || "").toLowerCase() === "club"
  ).filter((club) =>
    String(club.club_name || club.name || club.email || "")
      .toLowerCase()
      .includes(clubSearch.trim().toLowerCase())
  ).length === 0 && (
    <p style={{ padding: "16px", color: "#94a3b8" }}>
      No clubs found matching "{clubSearch}".
    </p>
  )}
</div>

    </>
  )}
</section>
      </main>
    </div>
  );
}

// ============================================================
// METRIC CARD
// ============================================================

function MetricCard({
  icon,
  label,
  value,
}) {
  return (
    <div style={styles.metricCard}>

      <div style={styles.metricIcon}>
        {icon}
      </div>

      <div>
        <div style={styles.metricLabel}>
          {label}
        </div>

        <div style={styles.metricValue}>
          {value.toLocaleString()}
        </div>
      </div>

    </div>
  );
}

// ============================================================
// ROLE BAR
// ============================================================

function RoleBar({
  label,
  value,
  maximum,
}) {
  const width =
    maximum > 0
      ? Math.max(
          value > 0 ? 8 : 0,
          Math.round(
            (value / maximum) * 100
          )
        )
      : 0;

  return (
    <div style={styles.barContainer}>

      <div style={styles.barHeader}>
        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>
      </div>

      <div style={styles.barBackground}>
        <div
          style={{
            ...styles.barFill,
            width: `${width}%`,
          }}
        />
      </div>

    </div>
  );
}

// ============================================================
// STATUS ROW
// ============================================================

function StatusRow({
  label,
  value,
  percentage,
}) {
  return (
    <div style={styles.statusRow}>

      <div>
        <div style={styles.statusLabel}>
          {label}
        </div>

        <div style={styles.statusCount}>
          {value} users
        </div>
      </div>

      <strong>
        {percentage}%
      </strong>

    </div>
  );
}

// ============================================================
// REGISTRATION STAT
// ============================================================

function RegistrationStat({
  label,
  value,
}) {
  return (
    <div style={styles.registrationStat}>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}

// ============================================================
// DISTRIBUTION BAR
// ============================================================

function DistributionBar({
  label,
  percentage,
}) {
  return (
    <div style={styles.distributionRow}>

      <div style={styles.distributionHeader}>
        <span>
          {label}
        </span>

        <strong>
          {percentage}%
        </strong>
      </div>

      <div style={styles.barBackground}>
        <div
          style={{
            ...styles.barFill,
            width: `${percentage}%`,
          }}
        />
      </div>

    </div>
  );
}

// ============================================================
// EMPTY SMALL
// ============================================================

function EmptySmall({
  message,
}) {
  return (
    <div style={styles.emptySmall}>
      {message}
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = {
  app: {
    minHeight: "100vh",
    background: "#0b1220",
    color: "#f8fafc",
    display: "flex",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },

  main: {
    flex: 1,
    minWidth: 0,
    padding: "32px",
    marginLeft: "0",
    overflowY: "auto",
  },

  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "28px",
  },

  title: {
    margin: 0,
    fontSize: "30px",
    fontWeight: 700,
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#8fa3c2",
    fontSize: "14px",
  },

  refreshButton: {
    background: "#111a2b",
    color: "#f8fafc",
    border: "1px solid #30405c",
    borderRadius: "8px",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 600,
  },

  cardGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
    marginBottom: "28px",
  },

  metricCard: {
    background: "#111a2b",
    border: "1px solid #293954",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  metricIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "10px",
    background: "#1b2740",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "21px",
  },

  metricLabel: {
    color: "#8fa3c2",
    fontSize: "13px",
    marginBottom: "5px",
  },

  metricValue: {
    fontSize: "25px",
    fontWeight: 700,
  },

  section: {
    marginBottom: "28px",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "14px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "20px",
  },

  sectionSubtitle: {
    margin: "5px 0 0",
    color: "#7185a5",
    fontSize: "13px",
  },

  secondaryButton: {
    background: "#111a2b",
    color: "#aabaff",
    border: "1px solid #39496b",
    borderRadius: "8px",
    padding: "9px 14px",
    cursor: "pointer",
  },

  analyticsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "16px",
  },

  panel: {
    background: "#111a2b",
    border: "1px solid #293954",
    borderRadius: "12px",
    padding: "22px",
  },

  panelTitle: {
    margin: "0 0 22px",
    fontSize: "16px",
  },

  barContainer: {
    marginBottom: "19px",
  },

  barHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    fontSize: "13px",
    color: "#b8c5d9",
  },

  barBackground: {
    height: "8px",
    borderRadius: "20px",
    background: "#202c42",
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
    borderRadius: "20px",
    background:
      "linear-gradient(90deg, #7657ff, #9b7cff)",
    transition: "width 0.3s ease",
  },

  statusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 0",
    borderBottom: "1px solid #202d43",
  },

  statusLabel: {
    fontWeight: 600,
    fontSize: "14px",
  },

  statusCount: {
    color: "#7185a5",
    fontSize: "12px",
    marginTop: "4px",
  },

  summaryRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 0",
    borderBottom: "1px solid #202d43",
    color: "#9aabc4",
  },

  registrationPanel: {
    background: "#111a2b",
    border: "1px solid #293954",
    borderRadius: "12px",
    padding: "24px",
  },

  registrationNumbers: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(130px, 1fr))",
    gap: "12px",
    marginBottom: "28px",
  },

  registrationStat: {
    background: "#0d1626",
    border: "1px solid #263650",
    borderRadius: "10px",
    padding: "16px",
  },

  distribution: {
    borderTop: "1px solid #263650",
    paddingTop: "22px",
  },

  distributionRow: {
    marginBottom: "17px",
  },

  distributionHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "7px",
    fontSize: "13px",
    color: "#aebdd2",
  },

  emptyPanel: {
    minHeight: "250px",
    background: "#111a2b",
    border: "1px solid #293954",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    color: "#7185a5",
  },

  emptyIcon: {
    width: "58px",
    height: "58px",
    borderRadius: "50%",
    background: "#1b2940",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    marginBottom: "12px",
  },

  emptySmall: {
    color: "#7185a5",
    fontSize: "14px",
    padding: "20px 0",
  },

  loadingBox: {
    minHeight: "400px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#8fa3c2",
    fontSize: "16px",
  },

  errorBox: {
    marginTop: "60px",
    background: "#111a2b",
    border: "1px solid #63333a",
    borderRadius: "12px",
    padding: "40px",
    textAlign: "center",
  },

  errorIcon: {
    fontSize: "32px",
    marginBottom: "12px",
  },

  retryButton: {
    marginTop: "15px",
    background: "#7657ff",
    border: "none",
    color: "white",
    borderRadius: "8px",
    padding: "10px 18px",
    cursor: "pointer",
  },
};