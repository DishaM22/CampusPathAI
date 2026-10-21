import { BrowserRouter, Routes, Route } from "react-router-dom";

// ============================================================
// LANDING / AUTH
// ============================================================

import LandingLogin from "./pages/LandingLogin";
import Login from "./pages/Login";
import Register from "./pages/Register";

// ============================================================
// STUDENT
// ============================================================

import StudentDashboard from "./pages/StudentDashboard";
import StudentProfile from "./pages/StudentProfile";
import StudentOnboarding from "./pages/StudentOnboarding";

// ============================================================
// EVENTS
// ============================================================

import Events from "./pages/Events";
import EventDetails from "./pages/EventDetails";
import EventManagement from "./pages/EventManagement";

// ============================================================
// CLUB DASHBOARD
// ============================================================

import ClubDashboard from "./pages/ClubDashboard";

import {
  MyClub,
  CreateEvent,
  MyEvents,
  Registrations,
  CalendarPage,
  Analytics,
  Notifications,
  Profile,
  Settings,
  ClubEventView,
  EditEvent,
  ScanAttendance
} from "./pages/ClubModules";

// ============================================================
// ADMIN
// ============================================================

import AdminDashboard from "./pages/AdminDashboard";
import PendingApplications from "./pages/PendingApplications";
import ApplicationReview from "./pages/ApplicationReview";
import AdminUsers from "./pages/AdminUsers";
import AdminEvents from "./pages/AdminEvents";
import AdminRegistrations from "./pages/AdminRegistrations";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminNotifications from "./pages/AdminNotifications";
import AdminActivityLogs from "./pages/AdminActivityLogs";
import AdminSettings from "./pages/AdminSettings";


import InterCollegeDashboard from "./pages/InterCollegeDashboard";
function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* =====================================================
            LANDING / AUTH
        ===================================================== */}

        <Route
          path="/"
          element={<LandingLogin />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />


        {/* =====================================================
            STUDENT DASHBOARD
        ===================================================== */}

        <Route
          path="/dashboard"
          element={<StudentDashboard />}
        />

        <Route
          path="/profile"
          element={<StudentProfile />}
        />

        <Route
          path="/student/onboarding"
          element={<StudentOnboarding />}
        />


        {/* =====================================================
            STUDENT EVENTS
        ===================================================== */}

        <Route
          path="/events"
          element={<Events />}
        />

        <Route
          path="/events/:id"
          element={<EventDetails />}
        />

        <Route
          path="/events/manage"
          element={<EventManagement />}
        />


        {/* =====================================================
            CLUB DASHBOARD
        ===================================================== */}

{/* =====================================================
    CLUB DASHBOARD + SIDEBAR MODULES
===================================================== */}

<Route
  path="/club-dashboard"
  element={<ClubDashboard />}
>

  <Route
    path="club"
    element={<MyClub />}
  />

  <Route
    path="events/new"
    element={<CreateEvent />}
  />

  <Route
    path="events"
    element={<MyEvents />}
  />

  <Route
    path="registrations"
    element={<Registrations />}
  />

  <Route
    path="attendance"
    element={<ScanAttendance />}
  />
  
  <Route
    path="calendar"
    element={<CalendarPage />}
  />

  <Route
    path="analytics"
    element={<Analytics />}
  />

  <Route
    path="notifications"
    element={<Notifications />}
  />

  <Route
    path="profile"
    element={<Profile />}
  />

  <Route
    path="settings"
    element={<Settings />}
  />

  <Route
  path="/club-dashboard/events/:id"
  element={<ClubEventView />}
/>

<Route
  path="/club-dashboard/events/:id/edit"
  element={<EditEvent />}
/>
</Route>
        {/* =====================================================
            ADMIN DASHBOARD
        ===================================================== */}

        <Route
          path="/admin"
          element={<AdminDashboard />}
        />

        <Route
          path="/admin/dashboard"
          element={<AdminDashboard />}
        />


        {/* =====================================================
            ADMIN APPLICATIONS
        ===================================================== */}

        <Route
          path="/admin/applications"
          element={<PendingApplications />}
        />

        <Route
          path="/admin/applications/:id"
          element={<ApplicationReview />}
        />


        {/* =====================================================
            ADMIN USERS
        ===================================================== */}

        <Route
          path="/admin/users"
          element={<AdminUsers />}
        />


        {/* =====================================================
            ADMIN EVENTS
        ===================================================== */}

        <Route
          path="/admin/events"
          element={<AdminEvents />}
        />


        {/* =====================================================
            ADMIN REGISTRATIONS
        ===================================================== */}

        <Route
          path="/admin/registrations"
          element={<AdminRegistrations />}
        />


        {/* =====================================================
            ADMIN ANALYTICS
        ===================================================== */}

        <Route
          path="/admin/analytics"
          element={<AdminAnalytics />}
        />


        {/* =====================================================
            ADMIN NOTIFICATIONS
        ===================================================== */}

        <Route
          path="/admin/notifications"
          element={<AdminNotifications />}
        />


        {/* =====================================================
            ADMIN ACTIVITY LOGS
        ===================================================== */}

        <Route
          path="/admin/logs"
          element={<AdminActivityLogs />}
        />


        {/* =====================================================
            ADMIN SETTINGS
        ===================================================== */}

        <Route
          path="/admin/settings"
          element={<AdminSettings />}
        />

{/* =====================================================
    INTER-COLLEGE DASHBOARD
===================================================== */}

        <Route
          path="/intercollege-dashboard"
          element={<InterCollegeDashboard />}
        />
      </Routes>

    </BrowserRouter>
  );
}

export default App;