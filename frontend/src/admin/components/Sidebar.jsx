import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Sidebar.css";

const ADMIN_NAV = [
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
];

const CLUB_NAV = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "🏠",
    path: "/club-dashboard",
  },

  {
    key: "events",
    label: "Events",
    icon: "📅",
    path: "/event-management",
  },


];

const INTERCOLLEGE_NAV = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "🏠",
    path: "/intercollege-dashboard",
  },

  {
    key: "events",
    label: "Events",
    icon: "📅",
    path: "/event-management",
  },

];

export default function Sidebar({
  role = "admin",
  collapsed = false,
  onToggleCollapsed,
  onLogout,
  mobileOpen = false,
  onCloseMobile,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  let items = ADMIN_NAV;

  if (role === "club") {
    items = CLUB_NAV;
  } else if (role === "intercollege") {
    items = INTERCOLLEGE_NAV;
  }

  const handleNavigation = (path) => {
    navigate(path);

    if (typeof onCloseMobile === "function") {
      onCloseMobile();
    }
  };

  const isActive = (item) => {
    if (item.path === "/admin/dashboard") {
      return (
        location.pathname === "/admin" ||
        location.pathname === "/admin/dashboard"
      );
    }

    return location.pathname.startsWith(item.path);
  };

  const handleLogout = () => {
    if (typeof onLogout === "function") {
      onLogout();
      return;
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    localStorage.removeItem("student_id");

    navigate("/");
  };

  return (
    <aside
      className={`sidebar ${collapsed ? "collapsed" : ""} ${
        mobileOpen ? "mobile-open" : ""
      }`}
    >
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-brand-title">
            CampusPath AI
          </div>

          <div className="sidebar-brand-role">
            {role === "admin"
              ? "ADMIN"
              : role === "club"
              ? "CLUB"
              : "INTERCOLLEGE"}
          </div>
        </div>

        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggleCollapsed}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-nav-item ${
              isActive(item) ? "active" : ""
            }`}
            onClick={() => handleNavigation(item.path)}
          >
            <span className="sidebar-nav-icon">
              {item.icon}
            </span>

            {!collapsed && (
              <span className="sidebar-nav-label">
                {item.label}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-nav-item logout-item"
          onClick={handleLogout}
        >
          <span className="sidebar-nav-icon">
            🚪
          </span>

          {!collapsed && (
            <span className="sidebar-nav-label">
              Logout
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}