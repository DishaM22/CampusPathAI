import React, { useState } from "react";

export default function TopBar({ orgInitial, notifications = [], onSearch, onNavigate, onMenuToggle, basePath = "/admin", profilePath }) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="topbar">
      <button className="hamburger-btn" onClick={onMenuToggle} aria-label="Open menu">☰</button>
      <div className="search">
        <span aria-hidden="true">🔍</span>
        <input type="text" placeholder="Search applicants, organizations, events…" onChange={(e) => onSearch?.(e.target.value)} aria-label="Search" />
      </div>

      <div className="top-actions">
        <div className="dropdown-wrap">
          <button className="icon-btn" onClick={() => setShowNotifs((s) => !s)} aria-label="Notifications">
            🔔
            {unreadCount > 0 && <span className="dot" />}
          </button>
          {showNotifs && (
            <div className="dropdown-panel">
              <div className="dropdown-title">Notifications</div>
              {notifications.length === 0 ? (
                <p className="dropdown-empty">You're all caught up.</p>
              ) : (
                notifications.slice(0, 5).map((n) => (
                  <div className={`notif-row ${n.read ? "" : "unread"}`} key={n.id}>
                    <p>{n.message}</p>
                    <span>{n.time}</span>
                  </div>
                ))
              )}
              <button className="dropdown-footer" onClick={() => onNavigate(`${basePath}/notifications`)}>View all notifications</button>
            </div>
          )}
        </div>

        <div className="dropdown-wrap">
          <button className="avatar" onClick={() => {
            if (profilePath) {
              onNavigate(profilePath);
              return;
            }
            setShowMenu((s) => !s);
          }} aria-label="Account profile">{orgInitial}</button>
          {showMenu && (
            <div className="dropdown-panel narrow">
              <button onClick={() => onNavigate(`${basePath}/settings`)}>Settings</button>
              <button onClick={() => onNavigate("/logout")}>Logout</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
