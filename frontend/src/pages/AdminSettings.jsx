import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../admin/components/Sidebar";

export default function AdminSettings() {
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [adminName, setAdminName] = useState("Administrator");
  const [adminEmail, setAdminEmail] = useState("");

  const [applicationNotifications, setApplicationNotifications] =
    useState(true);

  const [eventNotifications, setEventNotifications] =
    useState(true);

  const [registrationNotifications, setRegistrationNotifications] =
    useState(true);

  const [saved, setSaved] = useState(false);

  // ============================================================
  // LOAD ADMIN INFORMATION
  // ============================================================

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");

      if (storedUser) {
        const user = JSON.parse(storedUser);

        setAdminName(
          user?.name ||
            user?.full_name ||
            user?.fullName ||
            "Administrator"
        );

        setAdminEmail(
          user?.email || ""
        );
      }

      const storedSettings =
        localStorage.getItem(
          "campusPathAdminSettings"
        );

      if (storedSettings) {
        const settings =
          JSON.parse(storedSettings);

        setApplicationNotifications(
          settings.applicationNotifications ?? true
        );

        setEventNotifications(
          settings.eventNotifications ?? true
        );

        setRegistrationNotifications(
          settings.registrationNotifications ?? true
        );
      }
    } catch (error) {
      console.error(
        "Failed to load admin settings:",
        error
      );
    }
  }, []);

  // ============================================================
  // SAVE SETTINGS
  // ============================================================

  const handleSaveSettings = () => {
    const settings = {
      applicationNotifications,
      eventNotifications,
      registrationNotifications,
    };

    localStorage.setItem(
      "campusPathAdminSettings",
      JSON.stringify(settings)
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2500);
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    localStorage.removeItem("student_id");
    localStorage.removeItem("studentId");

    navigate("/");
  };

  // ============================================================
  // NAVIGATION
  // ============================================================

  const handleNavigate = (path) => {
    navigate(path);
  };

  // ============================================================
  // RESET NOTIFICATION SETTINGS
  // ============================================================

  const handleResetNotifications = () => {
    setApplicationNotifications(true);
    setEventNotifications(true);
    setRegistrationNotifications(true);
  };

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080d1c",
        color: "#ffffff",
      }}
    >
      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <Sidebar
        role="admin"
        orgName="Admin"
        activeKey="settings"
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
          MAIN CONTENT
      ====================================================== */}

      <main
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          left: collapsed ? "80px" : "200px",
          overflowY: "auto",
          background: "#080d1c",
          padding: "32px",
          boxSizing: "border-box",
        }}
      >
        {/* ====================================================
            HEADER
        ==================================================== */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "30px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "32px",
                fontWeight: "700",
                color: "#ffffff",
              }}
            >
              Settings
            </h1>

            <p
              style={{
                marginTop: "8px",
                marginBottom: 0,
                color: "#94a3b8",
                fontSize: "14px",
              }}
            >
              Manage your CampusPath AI administrator
              settings.
            </p>
          </div>

          {saved && (
            <div
              style={{
                background: "#123c2b",
                border: "1px solid #166534",
                color: "#86efac",
                padding: "10px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              ✓ Settings saved
            </div>
          )}
        </div>

        {/* ====================================================
            PROFILE
        ==================================================== */}

        <section
          style={{
            background: "#111827",
            border: "1px solid #26344d",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <SectionTitle
            title="Admin Profile"
            description="Your administrator account information."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "20px",
            }}
          >
            <InfoField
              label="Full Name"
              value={adminName}
            />

            <InfoField
              label="Email Address"
              value={adminEmail || "Not available"}
            />

            <InfoField
              label="Role"
              value="Administrator"
            />

            <InfoField
              label="Account Status"
              value="Active"
              status
            />
          </div>
        </section>

        {/* ====================================================
            PLATFORM
        ==================================================== */}

        <section
          style={{
            background: "#111827",
            border: "1px solid #26344d",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <SectionTitle
            title="Platform Information"
            description="Basic information about the CampusPath AI platform."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "20px",
            }}
          >
            <InfoField
              label="Application Name"
              value="CampusPath AI"
            />

            <InfoField
              label="Application Type"
              value="University Event Recommendation Platform"
            />

            <InfoField
              label="Administrator Panel"
              value="Admin Dashboard"
            />

            <InfoField
              label="Authentication"
              value="JWT Authentication"
            />
          </div>
        </section>

        {/* ====================================================
            NOTIFICATION SETTINGS
        ==================================================== */}

        <section
          style={{
            background: "#111827",
            border: "1px solid #26344d",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <SectionTitle
            title="Notification Preferences"
            description="Choose which administrative notifications you want to receive."
          />

          <SettingRow
            title="Application Notifications"
            description="Receive notifications when clubs or intercollege organizations submit applications."
            checked={applicationNotifications}
            onChange={setApplicationNotifications}
          />

          <SettingRow
            title="Event Notifications"
            description="Receive notifications related to newly created or published events."
            checked={eventNotifications}
            onChange={setEventNotifications}
          />

          <SettingRow
            title="Registration Notifications"
            description="Receive notifications when students register for events."
            checked={registrationNotifications}
            onChange={setRegistrationNotifications}
          />

          <div
            style={{
              marginTop: "20px",
            }}
          >
            <button
              onClick={handleResetNotifications}
              style={{
                padding: "9px 15px",
                borderRadius: "7px",
                border: "1px solid #334155",
                background: "#1e293b",
                color: "#cbd5e1",
                cursor: "pointer",
              }}
            >
              Reset Preferences
            </button>
          </div>
        </section>

        {/* ====================================================
            SECURITY
        ==================================================== */}

        <section
          style={{
            background: "#111827",
            border: "1px solid #26344d",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <SectionTitle
            title="Security"
            description="Information about your current administrator session."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "20px",
            }}
          >
            <InfoField
              label="Authentication Method"
              value="JWT"
            />

            <InfoField
              label="Session"
              value="Authenticated"
              status
            />

            <InfoField
              label="Administrator Access"
              value="Enabled"
              status
            />

            <InfoField
              label="Account Role"
              value="admin"
            />
          </div>
        </section>

        {/* ====================================================
            APPEARANCE
        ==================================================== */}

        <section
          style={{
            background: "#111827",
            border: "1px solid #26344d",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <SectionTitle
            title="Appearance"
            description="Current CampusPath AI administrator interface appearance."
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px",
              background: "#0b1220",
              border: "1px solid #26344d",
              borderRadius: "9px",
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: "600",
                  marginBottom: "5px",
                }}
              >
                Dark Mode
              </div>

              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                CampusPath AI currently uses the dark
                administrator interface.
              </div>
            </div>

            <div
              style={{
                padding: "7px 13px",
                borderRadius: "999px",
                background: "#312e81",
                color: "#c4b5fd",
                fontSize: "12px",
                fontWeight: "700",
              }}
            >
              ACTIVE
            </div>
          </div>
        </section>

        {/* ====================================================
            SAVE
        ==================================================== */}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            paddingBottom: "40px",
          }}
        >
          <button
            onClick={() =>
              navigate("/admin/dashboard")
            }
            style={{
              padding: "11px 20px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: "#111827",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSaveSettings}
            style={{
              padding: "11px 22px",
              borderRadius: "8px",
              border: "none",
              background: "#4f46e5",
              color: "#ffffff",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Save Settings
          </button>
        </div>
      </main>
    </div>
  );
}

// ============================================================
// SECTION TITLE
// ============================================================

function SectionTitle({
  title,
  description,
}) {
  return (
    <div
      style={{
        marginBottom: "20px",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: "19px",
          color: "#ffffff",
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin: "6px 0 0",
          color: "#64748b",
          fontSize: "13px",
        }}
      >
        {description}
      </p>
    </div>
  );
}

// ============================================================
// INFO FIELD
// ============================================================

function InfoField({
  label,
  value,
  status = false,
}) {
  return (
    <div
      style={{
        padding: "15px",
        background: "#0b1220",
        border: "1px solid #26344d",
        borderRadius: "9px",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "12px",
          marginBottom: "7px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: status
            ? "#86efac"
            : "#e2e8f0",
          fontSize: "14px",
          fontWeight: "600",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ============================================================
// SETTING ROW
// ============================================================

function SettingRow({
  title,
  description,
  checked,
  onChange,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "20px",
        padding: "18px 0",
        borderBottom: "1px solid #26344d",
      }}
    >
      <div>
        <div
          style={{
            color: "#ffffff",
            fontWeight: "600",
            fontSize: "14px",
            marginBottom: "5px",
          }}
        >
          {title}
        </div>

        <div
          style={{
            color: "#64748b",
            fontSize: "13px",
            lineHeight: "1.5",
          }}
        >
          {description}
        </div>
      </div>

      <button
        onClick={() => onChange(!checked)}
        aria-label={title}
        style={{
          width: "50px",
          height: "28px",
          borderRadius: "999px",
          border: "none",
          background: checked
            ? "#4f46e5"
            : "#374151",
          padding: "3px",
          cursor: "pointer",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: "block",
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            background: "#ffffff",
            transform: checked
              ? "translateX(22px)"
              : "translateX(0)",
            transition: "transform 0.2s",
          }}
        />
      </button>
    </div>
  );
}