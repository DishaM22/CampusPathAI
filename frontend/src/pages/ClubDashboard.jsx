import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import Sidebar from "../club/components/Sidebar";
import TopBar from "../club/components/TopBar";
import StatCard from "../club/components/StatCard";
import EventCard from "../club/components/EventCard";

import {
  EmptyState,
  ErrorState,
  EventCardSkeleton,
  StatCardSkeleton,
  TableRowSkeleton,
} from "../club/components/States";

import { fetchClubDashboard } from "../clubService";

import "../club-dashboard.css";


// ============================================================
// SAMPLE DATA
// ============================================================

const SAMPLE_DASHBOARD = {
  club: {
    name: "AI Club",
    initial: "AI",
  },

  kpis: {
    totalEvents: 12,
    upcomingEvents: 4,
    totalRegistrations: 328,
    totalParticipants: 275,
  },

  upcomingEvents: [
    {
      id: "e1",
      title: "AI & Machine Learning Workshop",
      category: "Technical",
      date: "Oct 10, 2026",
      time: "10:00 AM",
      venue: "Seminar Hall 1",
      registered: 42,
      capacity: 100,
      status: "published",
    },

    {
      id: "e2",
      title: "Intro to Generative AI",
      category: "Workshop",
      date: "Oct 18, 2026",
      time: "3:00 PM",
      venue: "Lab 2",
      registered: 30,
      capacity: 60,
      status: "published",
    },

    {
      id: "e3",
      title: "AI Club Recruitment Drive",
      category: "Other",
      date: "Oct 22, 2026",
      time: "11:00 AM",
      venue: "Main Lawn",
      registered: 8,
      capacity: 200,
      status: "draft",
    },
  ],

  recentRegistrations: [
    {
      id: "r1",
      name: "Sumeet Rao",
      email: "sumeet.r@college.edu",
      department: "CSE",
      year: "3rd Year",
      event: "AI & ML Workshop",
      date: "Sep 24, 2026",
      status: "Registered",
    },

    {
      id: "r2",
      name: "Disha Anand",
      email: "disha.a@college.edu",
      department: "ISE",
      year: "2nd Year",
      event: "AI & ML Workshop",
      date: "Sep 24, 2026",
      status: "Registered",
    },

    {
      id: "r3",
      name: "Kabir Mehta",
      email: "kabir.m@college.edu",
      department: "ECE",
      year: "4th Year",
      event: "Intro to Generative AI",
      date: "Sep 23, 2026",
      status: "Waitlisted",
    },
  ],
};


// ============================================================
// NOTIFICATIONS
// ============================================================

const NOTIFICATIONS = [
  {
    id: 1,
    message: "Your event 'AI & ML Workshop' was published successfully.",
    time: "2h ago",
    read: false,
  },

  {
    id: 2,
    message: "42 students registered for AI & ML Workshop.",
    time: "5h ago",
    read: false,
  },

  {
    id: 3,
    message: "Registration deadline for Generative AI is tomorrow.",
    time: "1d ago",
    read: true,
  },
];


// ============================================================
// CLUB DASHBOARD
// ============================================================

export default function ClubDashboard() {

  const navigate = useNavigate();

  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [status, setStatus] = useState("loading");

  const [data, setData] = useState(null);

  const [isSample, setIsSample] = useState(false);

  const [search, setSearch] = useState("");


  // ==========================================================
  // LOAD DASHBOARD DATA
  // ==========================================================

  async function load() {

    setStatus("loading");

    try {

      const result = await fetchClubDashboard();

      setData(result);

      setIsSample(false);

      setStatus(
        result?.upcomingEvents?.length
          ? "ready"
          : "empty"
      );

    } catch (error) {

      console.error(
        "Club dashboard API error:",
        error
      );

      // SAMPLE DATA FALLBACK
      setData(SAMPLE_DASHBOARD);

      setIsSample(true);

      setStatus("ready");
    }
  }


  useEffect(() => {
    load();
  }, []);


  // ==========================================================
  // FILTER EVENTS
  // ==========================================================

  const filteredEvents = useMemo(() => {

    if (!data) {
      return [];
    }

    if (!search.trim()) {
      return data.upcomingEvents || [];
    }

    return (data.upcomingEvents || []).filter(
      (event) =>
        event.title
          ?.toLowerCase()
          .includes(search.toLowerCase())
    );

  }, [data, search]);


  // ==========================================================
  // CLUB INFORMATION
  // ==========================================================

  const club = data?.club || {
    name: "Your Club",
    initial: "?",
  };


  // ==========================================================
  // DETERMINE ACTIVE SIDEBAR ITEM
  // ==========================================================

  const getActiveKey = () => {

    const path = location.pathname;

    if (path === "/club-dashboard") {
      return "dashboard";
    }

    if (path === "/club-dashboard/club") {
      return "club";
    }

    if (
      path === "/club-dashboard/events/new"
    ) {
      return "create-event";
    }

    if (
      path === "/club-dashboard/events"
    ) {
      return "events";
    }

    if (
      path === "/club-dashboard/registrations"
    ) {
      return "registrations";
    }

    if (
      path === "/club-dashboard/calendar"
    ) {
      return "calendar";
    }

    if (
      path === "/club-dashboard/analytics"
    ) {
      return "analytics";
    }

    if (
      path === "/club-dashboard/notifications"
    ) {
      return "notifications";
    }

    if (
      path === "/club-dashboard/profile"
    ) {
      return "profile";
    }

    if (
      path === "/club-dashboard/settings"
    ) {
      return "settings";
    }

    return "dashboard";
  };


  // ==========================================================
  // CHECK WHETHER WE ARE ON DASHBOARD HOME
  // ==========================================================

  const isDashboardHome =
    location.pathname === "/club-dashboard";


  // ==========================================================
  // COMMON NAVIGATION
  // ==========================================================

  const handleNavigate = (path) => {

    console.log(
      "navigate ->",
      path
    );

    navigate(path);

    setMobileOpen(false);
  };


  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = () => {

    console.log("CLUB LOGOUT");

    // Remove authentication tokens
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("jwt");

    // Remove stored user/session information
    localStorage.removeItem("user");
    localStorage.removeItem("userData");
    localStorage.removeItem("club");
    localStorage.removeItem("clubData");

    // Remove any login/setup information
    localStorage.removeItem("role");
    localStorage.removeItem("selectedRole");

    // Clear dashboard state
    setData(null);
    setSearch("");
    setMobileOpen(false);

    // Go directly to WelcomeBack / first screen
    // replace prevents returning to dashboard using browser Back
    navigate("/", {
      replace: true,
    });
  };


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="dashboard-shell">

      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <Sidebar
        role="club"

        orgName={club.name}

        activeKey={getActiveKey()}

        collapsed={collapsed}

        onToggleCollapsed={() =>
          setCollapsed((value) => !value)
        }

        onNavigate={handleNavigate}

        onLogout={handleLogout}

        mobileOpen={mobileOpen}

        onCloseMobile={() =>
          setMobileOpen(false)
        }
      />


      {/* ======================================================
          MAIN AREA
      ====================================================== */}

      <div className="dashboard-main">


        {/* ====================================================
            TOP BAR
        ==================================================== */}

        <TopBar
          orgInitial={club.initial}

          notifications={NOTIFICATIONS}

          onSearch={setSearch}

          onNavigate={handleNavigate}

          onMenuToggle={() =>
            setMobileOpen(true)
          }
        />


        {/* ====================================================
            CONTENT
        ==================================================== */}

        <main className="content">

          {/* ==================================================
              DASHBOARD HOME
          ================================================== */}

          {isDashboardHome && (

            <>

              {/* PAGE HEADER */}

              <div className="page-head">

                <h1>
                  Good morning, {club.name} 👋
                </h1>

                <p>
                  Manage your events, reach students
                  and track participation.
                </p>

              </div>


              {/* SAMPLE DATA MESSAGE */}

              {isSample && (

                <div className="sample-banner">

                  Showing sample data — connect{" "}

                  <code>
                    /api/club/dashboard
                  </code>

                  {" "}to see your club's live stats.

                </div>

              )}


              {/* ERROR */}

              {status === "error" && (

                <ErrorState
                  onRetry={load}
                />

              )}


              {/* LOADING */}

              {status === "loading" && (

                <>

                  <div className="kpi-grid">

                    {Array.from({
                      length: 4,
                    }).map((_, index) => (

                      <StatCardSkeleton
                        key={index}
                      />

                    ))}

                  </div>


                  <div className="event-grid">

                    {Array.from({
                      length: 3,
                    }).map((_, index) => (

                      <EventCardSkeleton
                        key={index}
                      />

                    ))}

                  </div>

                </>

              )}


              {/* =================================================
                  DASHBOARD DATA
              ================================================= */}

              {status !== "loading" &&
                status !== "error" &&
                data && (

                  <>

                    {/* ===========================================
                        KPI CARDS
                    =========================================== */}

                    <div className="kpi-grid">

                      <StatCard
                        icon="📅"
                        label="Total Events"
                        value={
                          data.kpis?.totalEvents ?? 0
                        }
                        isSample={isSample}
                      />

                      <StatCard
                        icon="🗓️"
                        label="Upcoming Events"
                        value={
                          data.kpis?.upcomingEvents ?? 0
                        }
                        isSample={isSample}
                      />

                      <StatCard
                        icon="📋"
                        label="Total Registrations"
                        value={
                          data.kpis?.totalRegistrations ?? 0
                        }
                        isSample={isSample}
                      />

                      <StatCard
                        icon="🧑‍🤝‍🧑"
                        label="Total Participants"
                        value={
                          data.kpis?.totalParticipants ?? 0
                        }
                        isSample={isSample}
                      />

                    </div>


                    {/* ===========================================
                        QUICK ACTIONS
                    =========================================== */}

                    <div className="section-head">

                      <h2>
                        Quick actions
                      </h2>

                    </div>


                    <div className="quick-actions">

                      <button
                        className="btn-primary"
                        onClick={() =>
                          handleNavigate(
                            "/club-dashboard/events/new"
                          )
                        }
                      >
                        + Create Event
                      </button>


                      <button
                        className="btn-ghost"
                        onClick={() =>
                          handleNavigate(
                            "/club-dashboard/events"
                          )
                        }
                      >
                        View My Events
                      </button>


                      <button
                        className="btn-ghost"
                        onClick={() =>
                          handleNavigate(
                            "/club-dashboard/registrations"
                          )
                        }
                      >
                        View Registrations
                      </button>


                      <button
                        className="btn-ghost"
                        onClick={() =>
                          handleNavigate(
                            "/club-dashboard/analytics"
                          )
                        }
                      >
                        View Analytics
                      </button>

                    </div>


                    {/* ===========================================
                        UPCOMING EVENTS
                    =========================================== */}

                    <div className="section-head">

                      <h2>
                        Upcoming events
                      </h2>

                      <button
                        type="button"
                        className="link"
                        onClick={() =>
                          handleNavigate(
                            "/club-dashboard/events"
                          )
                        }
                      >
                        See all
                      </button>

                    </div>


                    {filteredEvents.length === 0 ? (

                      <EmptyState
                        title="No events created yet."
                        message="Publish your first event so students can start discovering it in their recommendations."
                        actionLabel="+ Create Event"
                        onAction={() =>
                          handleNavigate(
                            "/club-dashboard/events/new"
                          )
                        }
                      />

                    ) : (

                      <div className="event-grid">

                        {filteredEvents.map((event) => (

                          <EventCard
                            key={event.id}
                            event={event}

                            onView={(selectedEvent) =>
                              handleNavigate(
                                `/club-dashboard/events/${selectedEvent.id}`
                              )
                            }

                            onEdit={(selectedEvent) =>
                              handleNavigate(
                                `/club-dashboard/events/${selectedEvent.id}/edit`
                              )
                            }

                            onRegistrations={(selectedEvent) =>
                              handleNavigate(
                                `/club-dashboard/registrations?event=${selectedEvent.id}`
                              )
                            }
                          />

                        ))}

                      </div>

                    )}


                    {/* ===========================================
                        RECENT REGISTRATIONS
                    =========================================== */}

                    <div className="section-head">

                      <h2>
                        Recent registrations
                      </h2>

                      <button
                        type="button"
                        className="link"
                        onClick={() =>
                          handleNavigate(
                            "/club-dashboard/registrations"
                          )
                        }
                      >
                        View all
                      </button>

                    </div>


                    {!data.recentRegistrations ||
                    data.recentRegistrations.length === 0 ? (

                      <EmptyState
                        title="No registrations found."
                        message="Once students register for your events, they'll show up here."
                      />

                    ) : (

                      <div className="table-wrap">

                        <table className="data-table">

                          <thead>

                            <tr>

                              <th>Student</th>
                              <th>Email</th>
                              <th>Department</th>
                              <th>Year</th>
                              <th>Event</th>
                              <th>Date</th>
                              <th>Status</th>

                            </tr>

                          </thead>


                          <tbody>

                            {data.recentRegistrations.map(
                              (registration) => (

                                <tr
                                  key={registration.id}
                                >

                                  <td>
                                    {registration.name}
                                  </td>

                                  <td>
                                    {registration.email}
                                  </td>

                                  <td>
                                    {registration.department}
                                  </td>

                                  <td>
                                    {registration.year}
                                  </td>

                                  <td>
                                    {registration.event}
                                  </td>

                                  <td>
                                    {registration.date}
                                  </td>

                                  <td>

                                    <span
                                      className={`status-badge status-${String(
                                        registration.status
                                      ).toLowerCase()}`}
                                    >
                                      {registration.status}
                                    </span>

                                  </td>

                                </tr>

                              )
                            )}

                            {status === "loading" && (

                              <TableRowSkeleton
                                columns={7}
                              />

                            )}

                          </tbody>

                        </table>

                      </div>

                    )}

                  </>

                )}

            </>

          )}


          {/* ==================================================
              SIDEBAR MODULE CONTENT
          ================================================== */}

          {!isDashboardHome && (

            <Outlet />

          )}

        </main>

      </div>

    </div>
  );
}