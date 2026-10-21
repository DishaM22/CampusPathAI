import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

const NAV_BY_ROLE = {
  admin: [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: "🏠",
      path: "/admin/dashboard",
    },
    {
      key: "applications",
      label: "Applications",
      icon: "📥",
      path: "/admin/applications",
    },
    
    {
      key: "users",
      label: "Users",
      icon: "👥",
      path: "/admin/users",
    },
    {
      key: "events",
      label: "Events",
      icon: "📅",
      path: "/admin/events",
    },
    {
      key: "registrations",
      label: "Registrations",
      icon: "📋",
      path: "/admin/registrations",
    },
    
    {
      key: "analytics",
      label: "Analytics",
      icon: "📊",
      path: "/admin/analytics",
    },
    {
      key: "notifications",
      label: "Notifications",
      icon: "🔔",
      path: "/admin/notifications",
    },
    {
      key: "logs",
      label: "Activity Logs",
      icon: "🧾",
      path: "/admin/logs",
    },
    {
      key: "settings",
      label: "Settings",
      icon: "⚙️",
      path: "/admin/settings",
    },
  ],

  club: [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: "🏠",
      path: "/club-dashboard",
    },
    {
      key: "myclub",
      label: "My Club",
      icon: "🏫",
      path: "/club-dashboard/club",
    },
    {
      key: "create",
      label: "Create Event",
      icon: "➕",
      path: "/club-dashboard/events/new",
    },
    {
      key: "events",
      label: "My Events",
      icon: "📅",
      path: "/club-dashboard/events",
    },
    {
      key: "registrations",
      label: "Registrations",
      icon: "📋",
      path: "/club-dashboard/registrations",
    },
    {
      key: "attendance",
      label: "Scan Attendance",
      icon: "📷",
      path: "/club-dashboard/attendance",
    },
    {
      key: "calendar",
      label: "Calendar",
      icon: "🗓️",
      path: "/club-dashboard/calendar",
    },
    {
      key: "analytics",
      label: "Analytics",
      icon: "📊",
      path: "/club-dashboard/analytics",
    },
    {
      key: "notifications",
      label: "Notifications",
      icon: "🔔",
      path: "/club-dashboard/notifications",
    },
    {
      key: "profile",
      label: "Profile",
      icon: "👤",
      path: "/club-dashboard/profile",
    },
    {
      key: "settings",
      label: "Settings",
      icon: "⚙️",
      path: "/club-dashboard/settings",
    },
  ],

  intercollege: [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: "🏠",
      path: "/intercollege-dashboard",
    },
    {
      key: "org",
      label: "Organization Profile",
      icon: "🏛️",
      path: "/intercollege-dashboard/org",
    },
    {
      key: "create",
      label: "Create Event",
      icon: "➕",
      path: "/intercollege-dashboard/events/new",
    },
    {
      key: "events",
      label: "My Events",
      icon: "📅",
      path: "/intercollege-dashboard/events",
    },
    {
      key: "colleges",
      label: "Participating Colleges",
      icon: "🌐",
      path: "/intercollege-dashboard/colleges",
    },
    {
      key: "registrations",
      label: "Registrations",
      icon: "📋",
      path: "/intercollege-dashboard/registrations",
    },
    {
    key: "attendance",
    label: "Scan Attendance",
    icon: "📷",
    path: "/intercollege-dashboard/attendance",
    },
    {
      key: "calendar",
      label: "Calendar",
      icon: "🗓️",
      path: "/intercollege-dashboard/calendar",
    },
    {
      key: "analytics",
      label: "Analytics",
      icon: "📊",
      path: "/intercollege-dashboard/analytics",
    },
    {
      key: "notifications",
      label: "Notifications",
      icon: "🔔",
      path: "/intercollege-dashboard/notifications",
    },
    {
      key: "profile",
      label: "Profile",
      icon: "👤",
      path: "/intercollege-dashboard/profile",
    },
    {
      key: "settings",
      label: "Settings",
      icon: "⚙️",
      path: "/intercollege-dashboard/settings",
    },
  ],
};

export default function Sidebar({
  role,
  orgName,
  activeKey,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  /*
   * Use the requested role.
   *
   * Admin was previously missing from NAV_BY_ROLE,
   * which caused the sidebar to fall back to the club menu.
   */
  const currentRole = NAV_BY_ROLE[role] ? role : "admin";

  const items = NAV_BY_ROLE[currentRole];

  const roleLabel =
    currentRole === "admin"
      ? "ADMIN"
      : currentRole === "intercollege"
        ? "Inter-College Leader"
        : "Club Leader";

  const displayName =
    orgName ||
    (currentRole === "admin" ? "Admin" : currentRole === "intercollege"
      ? "Inter-College Organization"
      : "Club");

  /*
   * Navigation handler.
   *
   * If the parent supplies onNavigate, use it.
   * Otherwise use React Router directly.
   *
   * This makes the Applications button work even if
   * the parent forgot to pass onNavigate.
   */
  const handleNavigation = (path) => {
    if (typeof onNavigate === "function") {
      onNavigate(path);
    } else {
      navigate(path);
    }

    if (typeof onCloseMobile === "function") {
      onCloseMobile();
    }
  };

  /*
   * Automatically determine the active item from the URL
   * when activeKey was not supplied.
   */
  const getActiveKey = () => {
    if (activeKey) {
      return activeKey;
    }

    const matchedItem = items.find((item) => {
      if (item.path === "/admin/dashboard") {
        return location.pathname === "/admin/dashboard";
      }

      if (item.path === "/admin/applications") {
        return (
          location.pathname === "/admin/applications" ||
          location.pathname.startsWith("/admin/applications/")
        );
      }

      return (
        location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`)
      );
    });

    return matchedItem?.key || "";
  };

  const currentActiveKey = getActiveKey();

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`sidebar ${
          collapsed ? "collapsed" : ""
        } ${mobileOpen ? "mobile-open" : ""}`}
      >
        {/* =========================================
            SIDEBAR HEADER
        ========================================= */}
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-mark">CP</span>

            {!collapsed && (
              <span>
                CampusPath{" "}
                <span className="brand-ai">AI</span>
              </span>
            )}
          </div>

          <button
            type="button"
            className="collapse-btn"
            onClick={onToggleCollapsed}
            aria-label="Toggle sidebar"
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        {/* =========================================
            ROLE INFORMATION
        ========================================= */}
        {!collapsed && (
          <div className="sidebar-role">
            <div className="org-name">
              {displayName}
            </div>

            <div className="role-tag">
              {roleLabel}
            </div>
          </div>
        )}

        {/* =========================================
            NAVIGATION
        ========================================= */}
        <nav className="nav">
          {items.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`nav-item ${
                currentActiveKey === item.key
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleNavigation(item.path)
              }
              title={
                collapsed
                  ? item.label
                  : undefined
              }
            >
              <span
                className="nav-icon"
                aria-hidden="true"
              >
                {item.icon}
              </span>

              {!collapsed && (
                <span>{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* =========================================
            LOGOUT
        ========================================= */}
        <button
          type="button"
          className="nav-item logout"
          onClick={onLogout}
          title={
            collapsed
              ? "Logout"
              : undefined
          }
        >
          <span
            className="nav-icon"
            aria-hidden="true"
          >
            ↩
          </span>

          {!collapsed && (
            <span>Logout</span>
          )}
        </button>
      </aside>
    </>
  );
}