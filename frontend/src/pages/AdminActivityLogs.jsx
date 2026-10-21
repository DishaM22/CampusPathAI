import React, { useEffect, useMemo, useState } from "react";
import { fetchAdminActivityLogs } from "../adminService";
import Sidebar from "../admin/components/Sidebar";

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetchAdminActivityLogs();

      console.log("ACTIVITY LOG RESPONSE:", response);

      /*
       * Support the backend response shapes without changing
       * the backend again.
       */
      const receivedLogs =
        response?.logs ||
        response?.activityLogs ||
        response?.data ||
        [];

      if (Array.isArray(receivedLogs)) {
        setLogs(receivedLogs);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error("ACTIVITY LOG ERROR:", err);
      setError(err?.message || "Unable to load activity logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const totalLogs = logs.length;

  const successfulLogs = useMemo(
    () =>
      logs.filter(
        (log) =>
          String(log.status || "success").toLowerCase() === "success"
      ).length,
    [logs]
  );

  const failedLogs = useMemo(
    () =>
      logs.filter(
        (log) =>
          String(log.status || "").toLowerCase() === "failed" ||
          String(log.status || "").toLowerCase() === "error"
      ).length,
    [logs]
  );

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080d1d",
        color: "#ffffff",
        display: "flex",
      }}
    >
      <Sidebar
        role="admin"
        orgName="Admin"
        activeKey="logs"
        collapsed={false}
        onToggleCollapsed={() => {}}
        onNavigate={() => {}}
        onLogout={() => {}}
        mobileOpen={false}
        onCloseMobile={() => {}}
      />

      <main
        style={{
          flex: 1,
          padding: "32px",
          overflowY: "auto",
          minWidth: 0,
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "28px",
              gap: "20px",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "30px",
                  fontWeight: 800,
                }}
              >
                Activity Logs
              </h1>

              <p
                style={{
                  marginTop: "8px",
                  color: "#9aa7c2",
                  fontSize: "14px",
                }}
              >
                View recent administrative activity across CampusPath AI.
              </p>
            </div>

            <button
              onClick={loadLogs}
              disabled={loading}
              style={{
                border: "1px solid #33405d",
                background: "#121a2d",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "10px 16px",
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <Stat
              label="Total Logs"
              value={totalLogs}
            />

            <Stat
              label="Successful"
              value={successfulLogs}
            />

            <Stat
              label="Failed"
              value={failedLogs}
            />
          </div>

          {error && (
            <div
              style={{
                background: "#3a1518",
                border: "1px solid #7f2930",
                color: "#ffb4b8",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "20px",
              }}
            >
              <strong>Unable to load activity logs</strong>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "14px",
                }}
              >
                {error}
              </div>

              <button
                onClick={loadLogs}
                style={{
                  marginTop: "12px",
                  padding: "8px 14px",
                  borderRadius: "7px",
                  border: "none",
                  background: "#ffffff",
                  color: "#111827",
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {loading ? (
            <div
              style={{
                background: "#101728",
                border: "1px solid #25304a",
                borderRadius: "14px",
                padding: "40px",
                textAlign: "center",
                color: "#9aa7c2",
              }}
            >
              Loading activity logs...
            </div>
          ) : !error && logs.length === 0 ? (
            <div
              style={{
                background: "#101728",
                border: "1px solid #25304a",
                borderRadius: "14px",
                padding: "70px 30px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "42px",
                  marginBottom: "12px",
                }}
              >
                🧾
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                }}
              >
                No Activity Logs
              </h2>

              <p
                style={{
                  color: "#9aa7c2",
                  marginTop: "8px",
                }}
              >
                No administrative activity has been recorded yet.
              </p>
            </div>
          ) : (
            <div
              style={{
                background: "#101728",
                border: "1px solid #25304a",
                borderRadius: "14px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  overflowX: "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: "850px",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#151e32",
                        textAlign: "left",
                      }}
                    >
                      <Th>User</Th>
                      <Th>Action</Th>
                      <Th>Module</Th>
                      <Th>Description</Th>
                      <Th>Status</Th>
                      <Th>Date</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {logs.map((log, index) => (
                      <tr
                        key={log.id || log._id || index}
                        style={{
                          borderTop: "1px solid #25304a",
                        }}
                      >
                        <Td>
                          <div
                            style={{
                              fontWeight: 700,
                            }}
                          >
                            {log.user_name ||
                              log.userName ||
                              "Unknown User"}
                          </div>

                          <div
                            style={{
                              color: "#7f8ba5",
                              fontSize: "12px",
                              marginTop: "3px",
                            }}
                          >
                            {log.user_email ||
                              log.userEmail ||
                              ""}
                          </div>
                        </Td>

                        <Td>
                          {log.action || "—"}
                        </Td>

                        <Td>
                          {log.module || "—"}
                        </Td>

                        <Td>
                          {log.description || "—"}
                        </Td>

                        <Td>
                          <Status
                            value={log.status || "success"}
                          />
                        </Td>

                        <Td>
                          {formatDate(
                            log.created_at ||
                              log.createdAt
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div
      style={{
        background: "#101728",
        border: "1px solid #25304a",
        borderRadius: "12px",
        padding: "20px",
      }}
    >
      <div
        style={{
          color: "#8f9bb5",
          fontSize: "13px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: 800,
          marginTop: "8px",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        padding: "14px 16px",
        color: "#9aa7c2",
        fontSize: "12px",
        fontWeight: 700,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }) {
  return (
    <td
      style={{
        padding: "16px",
        color: "#dce3f3",
        fontSize: "13px",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}

function Status({ value }) {
  const status = String(value).toLowerCase();

  const successful = status === "success";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 9px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        background: successful ? "#123523" : "#3a1518",
        color: successful ? "#4ade80" : "#ff8b8b",
      }}
    >
      {value}
    </span>
  );
}