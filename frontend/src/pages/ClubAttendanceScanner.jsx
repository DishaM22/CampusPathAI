import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import * as XLSX from "xlsx";

const API_BASE = "http://127.0.0.1:8000";

// ============================================================
// TOKEN
// ============================================================

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("jwt") ||
    ""
  );
}

// ============================================================
// API FETCH
// ============================================================

async function apiFetch(url, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE}${url}`, {
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

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      message: text,
    };
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;

    if (Array.isArray(data?.detail)) {
      errorMessage = data.detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          return (
            item?.msg ||
            item?.message ||
            JSON.stringify(item)
          );
        })
        .join(", ");
    } else if (data?.detail) {
      errorMessage =
        typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail);
    } else if (data?.message) {
      errorMessage = data.message;
    }

    throw new Error(errorMessage);
  }

  return data;
}

// ============================================================
// SCAN ATTENDANCE
// ============================================================

export function ScanAttendance() {
  const scannerRef = useRef(null);
  const scanningRef = useRef(false);
  const scanProcessingRef = useRef(false);

  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");

  const [attendance, setAttendance] = useState([]);
  const [loadingAttendance, setLoadingAttendance] =
    useState(false);

  const [loadingEvents, setLoadingEvents] =
    useState(true);

  const [starting, setStarting] =
    useState(false);

  const [result, setResult] =
    useState(null);

  const [error, setError] =
    useState("");

  // ==========================================================
  // LOAD EVENTS ON PAGE OPEN
  // ==========================================================

  useEffect(() => {
    loadEvents();

    return () => {
      stopScanner();
    };
  }, []);

  // ==========================================================
  // GET EVENT ID
  // ==========================================================

  function getEventId(event) {
    return (
      event?.id ||
      event?._id ||
      event?.event_id ||
      ""
    );
  }

  // ==========================================================
  // LOAD ATTENDANCE
  // ==========================================================

  async function loadAttendance(selectedEventId = eventId) {
    if (!selectedEventId) {
      setAttendance([]);
      return;
    }

    try {
      setLoadingAttendance(true);

      const response = await apiFetch(
        `/api/events/${selectedEventId}/attendance`
      );

      console.log(
        "ATTENDANCE RECORDS:",
        response
      );

      setAttendance(
        Array.isArray(response?.attendance)
          ? response.attendance
          : []
      );
    } catch (err) {
      console.error(
        "ATTENDANCE LOAD ERROR:",
        err
      );

      setAttendance([]);
    } finally {
      setLoadingAttendance(false);
    }
  }

  // ==========================================================
  // EXPORT ATTENDANCE TO EXCEL
  // ==========================================================

  function exportAttendanceToExcel() {
    if (!attendance.length) {
      alert(
        "There is no attendance to export."
      );
      return;
    }

    const exportData = attendance.map(
      (record, index) => ({
        "Sl No": index + 1,

        "Student Name":
          record.name || "—",

        "Student ID":
          record.student_id || "—",

        Email:
          record.email || "—",

        Department:
          record.department || "—",

        Event:
          record.event_name ||
          selectedEvent?.title ||
          "—",

        Attendance:
          record.status || "Present",

        "Marked At":
          record.marked_at || "—",
      })
    );

    const worksheet =
      XLSX.utils.json_to_sheet(
        exportData
      );

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 18 },
      { wch: 30 },
      { wch: 20 },
      { wch: 35 },
      { wch: 15 },
      { wch: 25 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Attendance"
    );

    const eventName = (
      selectedEvent?.title ||
      "Event"
    ).replace(
      /[^a-z0-9]/gi,
      "_"
    );

    XLSX.writeFile(
      workbook,
      `${eventName}_Attendance.xlsx`
    );
  }

  // ==========================================================
  // LOAD CLUB EVENTS
  // ==========================================================

  async function loadEvents() {
    try {
      setLoadingEvents(true);
      setError("");

      const data = await apiFetch(
        "/api/club/dashboard"
      );

      console.log(
        "CLUB DASHBOARD RESPONSE:",
        data
      );

      let list = [];

      if (
        Array.isArray(
          data?.upcomingEvents
        )
      ) {
        list = data.upcomingEvents;
      } else if (
        Array.isArray(data?.events)
      ) {
        list = data.events;
      } else if (
        Array.isArray(
          data?.upcoming_events
        )
      ) {
        list = data.upcoming_events;
      }

      setEvents(list);

      if (list.length > 0) {
        const firstEventId =
          getEventId(list[0]);

        if (firstEventId) {
          const firstId =
            String(firstEventId);

          setEventId(firstId);

          await loadAttendance(firstId);
        }
      }
    } catch (err) {
      console.error(
        "LOAD CLUB EVENTS ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to load club events."
      );
    } finally {
      setLoadingEvents(false);
    }
  }

  // ==========================================================
  // START SCANNER
  // ==========================================================

  async function startScanner() {
    if (!eventId) {
      setError(
        "Please select an event first."
      );
      return;
    }

    if (scanningRef.current) {
      return;
    }

    setError("");
    setResult(null);

    scanProcessingRef.current = false;

    try {
      setStarting(true);

      await stopScanner();

      const scanner =
        new Html5Qrcode(
          "club-attendance-reader"
        );

      scannerRef.current = scanner;

      await scanner.start(
        {
          facingMode: "environment",
        },
        {
          fps: 10,
          qrbox: {
            width: 260,
            height: 260,
          },
          aspectRatio: 1,
        },
        handleScan,
        () => {
          // Ignore normal QR scan failures.
        }
      );

      scanningRef.current = true;

      console.log(
        "QR SCANNER STARTED"
      );
    } catch (err) {
      console.error(
        "QR SCANNER START ERROR:",
        err
      );

      scannerRef.current = null;
      scanningRef.current = false;

      setError(
        "Camera could not be started. " +
          "Allow camera permission and use localhost or HTTPS."
      );
    } finally {
      setStarting(false);
    }
  }

  // ==========================================================
  // STOP SCANNER
  // ==========================================================

  async function stopScanner() {
    const scanner =
      scannerRef.current;

    if (!scanner) {
      scanningRef.current = false;
      return;
    }

    try {
      if (scanningRef.current) {
        await scanner.stop();
      }
    } catch (err) {
      console.warn(
        "Scanner stop warning:",
        err
      );
    }

    try {
      await scanner.clear();
    } catch (err) {
      console.warn(
        "Scanner clear warning:",
        err
      );
    }

    scannerRef.current = null;
    scanningRef.current = false;
  }

  // ==========================================================
  // QR SCAN HANDLER
  // ==========================================================

  async function handleScan(decodedText) {
    if (!decodedText) {
      return;
    }

    if (scanProcessingRef.current) {
      return;
    }

    scanProcessingRef.current = true;

    console.log(
      "================================="
    );

    console.log(
      "QR CODE DETECTED:"
    );

    console.log(
      "QR DATA:",
      decodedText
    );

    console.log(
      "EVENT ID:",
      eventId
    );

    console.log(
      "ATTENDANCE URL:",
      `${API_BASE}/api/events/${eventId}/attendance/scan`
    );

    console.log(
      "================================="
    );

    await stopScanner();

    try {
      setError("");
      setResult(null);

      // ======================================================
      // CORRECT BACKEND ENDPOINT
      // ======================================================

      const response = await apiFetch(
        `/api/events/${eventId}/attendance/scan`,
        {
          method: "POST",

          body: JSON.stringify({
            qr_data: decodedText,
          }),
        }
      );

      console.log(
        "ATTENDANCE RESPONSE:",
        response
      );

      // ======================================================
      // CHECK ALREADY MARKED
      // ======================================================

      const alreadyMarked =
        response?.status ===
        "already_marked";

      setResult({
        type: alreadyMarked
          ? "already_marked"
          : "success",

        message:
          response?.message ||
          (alreadyMarked
            ? "Attendance has already been marked."
            : "Attendance marked successfully."),

        student:
          response?.student ||
          null,

        event:
          response?.event ||
          null,
      });

      // ======================================================
      // REFRESH ATTENDANCE REGISTER
      // ======================================================

      await loadAttendance(
        eventId
      );
    } catch (err) {
      console.error(
        "ATTENDANCE SCAN ERROR:",
        err
      );

      setResult({
        type: "error",

        message:
          err?.message ||
          "Unable to mark attendance.",
      });
    } finally {
      scanProcessingRef.current = false;
    }
  }

  // ==========================================================
  // SELECTED EVENT
  // ==========================================================

  const selectedEvent =
    events.find(
      (event) =>
        String(
          getEventId(event)
        ) === String(eventId)
    );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="club-module-page">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="club-module-header">
        <div>
          <h1>
            Scan Attendance
          </h1>

          <p>
            Scan a registered student's QR
            code to mark attendance.
          </p>
        </div>
      </div>


      {/* ====================================================
          SCANNER CARD
      ==================================================== */}

      <div
        className="club-card"
        style={{
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >

        {/* ==================================================
            EVENT SELECT
        ================================================== */}

        <div
          style={{
            marginBottom: 20,
          }}
        >
          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Select Event
          </label>

          <select
            value={eventId}
            onChange={(e) => {
              const newEventId =
                e.target.value;

              setEventId(newEventId);
              setResult(null);
              setError("");

              loadAttendance(
                newEventId
              );
            }}
            disabled={
              loadingEvents ||
              scanningRef.current
            }
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              background: "#111827",
              color: "#fff",
              border:
                "1px solid #334155",
            }}
          >

            {loadingEvents ? (
              <option value="">
                Loading events...
              </option>
            ) : events.length === 0 ? (
              <option value="">
                No events available
              </option>
            ) : (
              events.map((event) => {
                const id =
                  getEventId(event);

                return (
                  <option
                    key={id}
                    value={id}
                  >
                    {event?.title ||
                      event?.name ||
                      "Untitled Event"}
                    {" — "}
                    {event?.date ||
                      "No date"}
                  </option>
                );
              })
            )}

          </select>
        </div>


        {/* ==================================================
            SELECTED EVENT
        ================================================== */}

        {selectedEvent && (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              marginBottom: 18,
              background:
                "rgba(59,130,246,0.10)",
              border:
                "1px solid rgba(59,130,246,0.30)",
            }}
          >
            <strong>
              {selectedEvent?.title ||
                selectedEvent?.name ||
                "Selected Event"}
            </strong>

            <div
              style={{
                marginTop: 5,
                opacity: 0.8,
              }}
            >
              {selectedEvent?.date ||
                "Date unavailable"}

              {selectedEvent?.time
                ? ` • ${selectedEvent.time}`
                : ""}

              {selectedEvent?.venue
                ? ` • ${selectedEvent.venue}`
                : selectedEvent?.location
                ? ` • ${selectedEvent.location}`
                : ""}
            </div>
          </div>
        )}


        {/* ==================================================
            QR READER
        ================================================== */}

        <div
          id="club-attendance-reader"
          style={{
            width: "100%",
            maxWidth: 520,
            minHeight: 50,
            margin: "0 auto 20px",
            overflow: "hidden",
            borderRadius: 14,
          }}
        />


        {/* ==================================================
            BUTTONS
        ================================================== */}

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent:
              "center",
            flexWrap: "wrap",
          }}
        >

          <button
            className="btn-primary"
            onClick={startScanner}
            disabled={
              starting ||
              loadingEvents ||
              !eventId ||
              scanningRef.current
            }
          >
            {starting
              ? "Starting camera..."
              : "📷 Start Scanner"}
          </button>


          <button
            className="btn-ghost"
            onClick={stopScanner}
            disabled={
              !scanningRef.current
            }
          >
            Stop Scanner
          </button>

        </div>


        {/* ==================================================
            INSTRUCTION
        ================================================== */}

        <p
          style={{
            textAlign: "center",
            marginTop: 16,
            opacity: 0.75,
          }}
        >
          Ask the student to display their
          event QR code in front of the camera.
        </p>


        {/* ==================================================
            ERROR
        ================================================== */}

        {error && (
          <div
            style={{
              marginTop: 18,
              padding: 14,
              borderRadius: 10,
              background:
                "rgba(239,68,68,0.12)",
              border:
                "1px solid rgba(239,68,68,0.35)",
              color: "#fecaca",
            }}
          >
            ❌ {error}
          </div>
        )}


        {/* ==================================================
            SCAN RESULT
        ================================================== */}

        {result && (
          <div
            style={{
              marginTop: 18,
              padding: 18,
              borderRadius: 12,

              background:
                result.type === "success"
                  ? "rgba(34,197,94,0.12)"
                  : result.type ===
                    "already_marked"
                  ? "rgba(245,158,11,0.12)"
                  : "rgba(239,68,68,0.12)",

              border:
                result.type === "success"
                  ? "1px solid rgba(34,197,94,0.35)"
                  : result.type ===
                    "already_marked"
                  ? "1px solid rgba(245,158,11,0.35)"
                  : "1px solid rgba(239,68,68,0.35)",
            }}
          >

            <h3
              style={{
                marginTop: 0,
              }}
            >
              {result.type === "success"
                ? "✅ Attendance Marked"
                : result.type ===
                  "already_marked"
                ? "⚠️ Attendance Already Marked"
                : "❌ Attendance Not Marked"}
            </h3>

            <p>
              {result.message}
            </p>


            {/* STUDENT DETAILS */}

            {result.student && (
              <div
                style={{
                  marginTop: 12,
                }}
              >

                {result.student.name && (
                  <strong>
                    {result.student.name}
                  </strong>
                )}

                {result.student.email && (
                  <div>
                    {result.student.email}
                  </div>
                )}

                {result.student.department && (
                  <div>
                    {result.student.department}
                  </div>
                )}

                {result.student.roll_number && (
                  <div>
                    Roll No:{" "}
                    {result.student.roll_number}
                  </div>
                )}

              </div>
            )}


            {/* EVENT DETAILS */}

            {result.event && (
              <div
                style={{
                  marginTop: 10,
                }}
              >
                Event:{" "}
                <strong>
                  {result.event.title ||
                    result.event.name ||
                    "Selected Event"}
                </strong>
              </div>
            )}

          </div>
        )}


        {/* ==================================================
            SCAN AGAIN
        ================================================== */}

        {result && (
          <div
            style={{
              display: "flex",
              justifyContent:
                "center",
              marginTop: 18,
            }}
          >
            <button
              className="btn-primary"
              onClick={() => {
                setResult(null);
                setError("");
                startScanner();
              }}
              disabled={
                starting ||
                !eventId
              }
            >
              📷 Scan Another Student
            </button>
          </div>
        )}

      </div>


      {/* ========================================================
          ATTENDANCE REGISTER
          ALWAYS VISIBLE
      ======================================================== */}

      <div
        className="club-card"
        style={{
          maxWidth: 1100,
          margin: "30px auto 0",
          overflow: "hidden",
        }}
      >

        {/* ====================================================
            REGISTER HEADER
        ==================================================== */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 15,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >

          <div>

            <h2
              style={{
                margin: 0,
              }}
            >
              📋 Attendance Register
            </h2>

            <p
              style={{
                marginTop: 6,
                opacity: 0.7,
              }}
            >
              {selectedEvent?.title ||
                "Select an event"}
            </p>

          </div>


          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >

            {/* REFRESH */}

            <button
              className="btn-ghost"
              onClick={() =>
                loadAttendance(eventId)
              }
              disabled={
                loadingAttendance ||
                !eventId
              }
            >
              🔄 Refresh
            </button>


            {/* EXPORT */}

            <button
              className="btn-primary"
              onClick={
                exportAttendanceToExcel
              }
              disabled={
                loadingAttendance ||
                attendance.length === 0
              }
            >
              📥 Export Excel
            </button>

          </div>

        </div>


        {/* ====================================================
            TOTAL STUDENTS
        ==================================================== */}

        <div
          style={{
            padding: 16,
            marginBottom: 20,
            borderRadius: 10,
            background:
              "rgba(34,197,94,0.10)",
            border:
              "1px solid rgba(34,197,94,0.25)",
          }}
        >

          <strong
            style={{
              fontSize: 28,
            }}
          >
            {attendance.length}
          </strong>

          <div
            style={{
              opacity: 0.75,
            }}
          >
            Students Present
          </div>

        </div>


        {/* ====================================================
            LOADING
        ==================================================== */}

        {loadingAttendance ? (

          <div
            style={{
              textAlign: "center",
              padding: 30,
            }}
          >
            Loading attendance...
          </div>

        ) : attendance.length === 0 ? (

          /* ==================================================
             EMPTY
          ================================================== */

          <div
            style={{
              textAlign: "center",
              padding: 35,
              opacity: 0.7,
            }}
          >

            <div
              style={{
                fontSize: 40,
                marginBottom: 10,
              }}
            >
              📋
            </div>

            <h3>
              No attendance records
            </h3>

            <p>
              Attendance will appear here
              after students scan their QR
              codes.
            </p>

          </div>

        ) : (

          /* ==================================================
             TABLE
          ================================================== */

          <div
            style={{
              overflowX: "auto",
            }}
          >

            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
                minWidth: 900,
              }}
            >

              <thead>

                <tr>

                  <th
                    style={{
                      padding: 12,
                      textAlign: "left",
                    }}
                  >
                    #
                  </th>

                  <th
                    style={{
                      padding: 12,
                      textAlign: "left",
                    }}
                  >
                    Student Name
                  </th>

                  <th
                    style={{
                      padding: 12,
                      textAlign: "left",
                    }}
                  >
                    Student ID
                  </th>

                  <th
                    style={{
                      padding: 12,
                      textAlign: "left",
                    }}
                  >
                    Email
                  </th>

                  <th
                    style={{
                      padding: 12,
                      textAlign: "left",
                    }}
                  >
                    Department
                  </th>

                  <th
                    style={{
                      padding: 12,
                      textAlign: "left",
                    }}
                  >
                    Status
                  </th>

                  <th
                    style={{
                      padding: 12,
                      textAlign: "left",
                    }}
                  >
                    Marked At
                  </th>

                </tr>

              </thead>


              <tbody>

                {attendance.map(
                  (record, index) => (
                    <tr
                      key={
                        record.attendance_id ||
                        `${record.student_id}-${index}`
                      }
                    >

                      <td
                        style={{
                          padding: 12,
                        }}
                      >
                        {index + 1}
                      </td>


                      <td
                        style={{
                          padding: 12,
                          fontWeight: 600,
                        }}
                      >
                        {record.name ||
                          "Unknown Student"}
                      </td>


                      <td
                        style={{
                          padding: 12,
                        }}
                      >
                        {record.student_id ||
                          "—"}
                      </td>


                      <td
                        style={{
                          padding: 12,
                        }}
                      >
                        {record.email ||
                          "—"}
                      </td>


                      <td
                        style={{
                          padding: 12,
                        }}
                      >
                        {record.department ||
                          "—"}
                      </td>


                      <td
                        style={{
                          padding: 12,
                        }}
                      >

                        <span
                          style={{
                            padding:
                              "5px 10px",
                            borderRadius: 20,
                            background:
                              "rgba(34,197,94,0.15)",
                          }}
                        >
                          ✅ Present
                        </span>

                      </td>


                      <td
                        style={{
                          padding: 12,
                        }}
                      >
                        {record.marked_at ||
                          "—"}
                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </div>
  );
}