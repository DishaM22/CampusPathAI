import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { Html5Qrcode } from "html5-qrcode";

import * as XLSX from "xlsx";

const API_BASE =
  "http://127.0.0.1:8000";

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

async function apiFetch(
  url,
  options = {}
) {
  const token = getToken();

  const response = await fetch(
    `${API_BASE}${url}`,
    {
      ...options,

      headers: {
        "Content-Type":
          "application/json",

        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),

        ...(options.headers || {}),
      },
    }
  );

  const text =
    await response.text();

  let data = {};

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    data = {
      message: text,
    };
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

// ============================================================
// INTER-COLLEGE ATTENDANCE SCANNER
// ============================================================

export default function
InterCollegeAttendanceScanner() {

  // ==========================================================
  // EVENTS
  // ==========================================================

  const [events, setEvents] =
    useState([]);

  const [
    selectedEventId,
    setSelectedEventId,
  ] = useState("");

  const [
    loadingEvents,
    setLoadingEvents,
  ] = useState(true);

  // ==========================================================
  // SCANNER
  // ==========================================================

  const [
    scannerRunning,
    setScannerRunning,
  ] = useState(false);

  const scannerRef =
    useRef(null);

  const scannerProcessingRef =
    useRef(false);

  const scannerElementId =
    "intercollege-qr-reader";

  // ==========================================================
  // MESSAGE
  // ==========================================================

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("");

  const [error, setError] =
    useState("");

  // ==========================================================
  // ATTENDANCE
  // ==========================================================

  const [
    attendance,
    setAttendance,
  ] = useState([]);

  const [
    loadingAttendance,
    setLoadingAttendance,
  ] = useState(false);

  // ==========================================================
  // INITIAL LOAD
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
  // LOAD INTER-COLLEGE EVENTS
  // ==========================================================

  async function loadEvents() {

    try {

      setLoadingEvents(true);
      setError("");

      const data =
        await apiFetch(
          "/api/intercollege/dashboard"
        );

      console.log(
        "INTER-COLLEGE DASHBOARD RESPONSE:",
        data
      );

      const loadedEvents =
        Array.isArray(
          data?.upcomingEvents
        )
          ? data.upcomingEvents
          : [];

      setEvents(loadedEvents);

      if (
        loadedEvents.length > 0
      ) {

        const firstEventId =
          getEventId(
            loadedEvents[0]
          );

        if (firstEventId) {

          const firstId =
            String(firstEventId);

          setSelectedEventId(
            firstId
          );

          loadAttendance(
            firstId
          );
        }
      }

    } catch (err) {

      console.error(
        "INTER-COLLEGE EVENTS ERROR:",
        err
      );

      setError(
        err?.message ||
          "Unable to load inter-college events."
      );

    } finally {

      setLoadingEvents(false);

    }
  }

  // ==========================================================
  // LOAD ATTENDANCE
  // ==========================================================

  async function loadAttendance(
    eventId = selectedEventId
  ) {

    if (!eventId) {

      setAttendance([]);

      return;
    }

    try {

      setLoadingAttendance(
        true
      );

      const response =
        await apiFetch(
          `/api/events/${eventId}/attendance`
        );

      console.log(
        "INTER-COLLEGE ATTENDANCE:",
        response
      );

      setAttendance(
        Array.isArray(
          response?.attendance
        )
          ? response.attendance
          : []
      );

    } catch (err) {

      console.error(
        "ATTENDANCE LOAD ERROR:",
        err
      );

      setAttendance([]);

      // Do not overwrite the whole
      // scanner page with an error
      // if attendance is simply empty.
      console.warn(
        "Unable to load attendance:",
        err.message
      );

    } finally {

      setLoadingAttendance(
        false
      );
    }
  }

  // ==========================================================
  // START SCANNER
  // ==========================================================

  async function startScanner() {

    if (!selectedEventId) {

      setError(
        "Please select an event first."
      );

      return;
    }

    if (scannerRunning) {
      return;
    }

    setMessage("");
    setMessageType("");
    setError("");

    scannerProcessingRef.current =
      false;

    try {

      if (scannerRef.current) {
        await stopScanner();
      }

      const scanner =
        new Html5Qrcode(
          scannerElementId
        );

      scannerRef.current =
        scanner;

      await scanner.start(

        {
          facingMode:
            "environment",
        },

        {
          fps: 10,

          qrbox: {
            width: 250,
            height: 250,
          },

          aspectRatio: 1,
        },

        async (decodedText) => {

          await handleQrScan(
            decodedText
          );

        },

        () => {
          // Ignore normal
          // QR frame failures.
        }

      );

      setScannerRunning(
        true
      );

      console.log(
        "INTER-COLLEGE QR SCANNER STARTED"
      );

    } catch (err) {

      console.error(
        "SCANNER START ERROR:",
        err
      );

      scannerRef.current =
        null;

      setScannerRunning(
        false
      );

      setError(
        err?.message ||
          "Unable to start camera. Please allow camera permission."
      );
    }
  }

  // ==========================================================
  // STOP SCANNER
  // ==========================================================

  async function stopScanner() {

    const scanner =
      scannerRef.current;

    if (!scanner) {

      setScannerRunning(
        false
      );

      return;
    }

    try {

      await scanner.stop();

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

    scannerRef.current =
      null;

    setScannerRunning(
      false
    );

    scannerProcessingRef.current =
      false;
  }

  // ==========================================================
  // HANDLE QR SCAN
  // ==========================================================

  async function handleQrScan(
    qrData
  ) {

    if (!selectedEventId) {
      return;
    }

    if (
      scannerProcessingRef.current
    ) {
      return;
    }

    const scannedData =
      String(
        qrData || ""
      ).trim();

    if (!scannedData) {
      return;
    }

    scannerProcessingRef.current =
      true;

    console.log(
      "================================="
    );

    console.log(
      "INTER-COLLEGE QR SCAN"
    );

    console.log(
      "QR DATA:",
      scannedData
    );

    console.log(
      "EVENT ID:",
      selectedEventId
    );

    console.log(
      "ATTENDANCE URL:",
      `${API_BASE}/api/events/${selectedEventId}/attendance/scan`
    );

    console.log(
      "================================="
    );

    await stopScanner();

    setMessage("");
    setMessageType("");
    setError("");

    try {

      const result =
        await apiFetch(
          `/api/events/${selectedEventId}/attendance/scan`,
          {
            method: "POST",

            body: JSON.stringify({
              qr_data:
                scannedData,
            }),
          }
        );

      console.log(
        "INTER-COLLEGE ATTENDANCE RESPONSE:",
        result
      );

      // ------------------------------------------------------
      // ALREADY MARKED
      // ------------------------------------------------------

      if (
        result?.status ===
        "already_marked"
      ) {

        setMessage(
          "Attendance was already marked for this student."
        );

        setMessageType(
          "already_marked"
        );

      }

      // ------------------------------------------------------
      // SUCCESS
      // ------------------------------------------------------

      else {

        setMessage(
          result?.message ||
            "Attendance marked successfully."
        );

        setMessageType(
          "success"
        );
      }

      // ------------------------------------------------------
      // REFRESH ATTENDANCE REGISTER
      // ------------------------------------------------------

      await loadAttendance(
        selectedEventId
      );

    } catch (err) {

      console.error(
        "ATTENDANCE SCAN ERROR:",
        err
      );

      setMessage("");

      setMessageType("");

      setError(
        err?.message ||
          "Unable to mark attendance."
      );

    } finally {

      scannerProcessingRef.current =
        false;
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
        ) ===
        String(
          selectedEventId
        )
    );

  // ==========================================================
  // EXPORT EXCEL
  // ==========================================================

  function exportAttendanceToExcel() {

    if (
      !attendance.length
    ) {

      alert(
        "There is no attendance to export."
      );

      return;
    }

    const exportData =
      attendance.map(
        (record, index) => ({

          "Sl No":
            index + 1,

          "Student Name":
            record.name ||
            "—",

          "Student ID":
            record.student_id ||
            record.studentId ||
            "—",

          "Email":
            record.email ||
            "—",

          "Department":
            record.department ||
            "—",

          "Event":
            record.event_name ||
            selectedEvent?.title ||
            "—",

          "Attendance":
            record.status ||
            "Present",

          "Marked At":
            record.marked_at ||
            "—",

        })
      );

    const worksheet =
      XLSX.utils.json_to_sheet(
        exportData
      );

    worksheet["!cols"] = [

      {
        wch: 8,
      },

      {
        wch: 25,
      },

      {
        wch: 18,
      },

      {
        wch: 30,
      },

      {
        wch: 20,
      },

      {
        wch: 35,
      },

      {
        wch: 15,
      },

      {
        wch: 25,
      },

    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Attendance"
    );

    const eventName =
      (
        selectedEvent?.title ||
        "InterCollege_Event"
      )
        .replace(
          /[^a-z0-9]/gi,
          "_"
        );

    XLSX.writeFile(
      workbook,
      `${eventName}_Attendance.xlsx`
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="module-page">

      {/* ====================================================
          PAGE HEADER
      ==================================================== */}

      <div className="page-head">

        <h1>
          Scan Attendance
        </h1>

        <p>
          Scan a registered student's
          QR code to mark attendance
          for your inter-college event.
        </p>

      </div>

      {/* ====================================================
          SCANNER CARD
      ==================================================== */}

      <div className="module-card">

        <div className="module-card-header">

          <h2>
            Attendance Scanner
          </h2>

          <p>
            Select an event and scan
            the student's QR code.
          </p>

        </div>

        {/* ==================================================
            EVENT SELECT
        ================================================== */}

        <div
          style={{
            marginTop: 24,
            marginBottom: 24,
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
            value={
              selectedEventId
            }
            onChange={(e) => {

              const newEventId =
                e.target.value;

              setSelectedEventId(
                newEventId
              );

              setMessage("");
              setMessageType("");
              setError("");

              if (
                scannerRunning
              ) {

                stopScanner();

              }

              loadAttendance(
                newEventId
              );

            }}
            disabled={
              loadingEvents ||
              scannerRunning
            }
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 10,
              border:
                "1px solid #334155",
              background: "#111827",
              color: "#fff",
              fontSize: 15,
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

              events.map(
                (event) => {

                  const id =
                    getEventId(
                      event
                    );

                  return (

                    <option
                      key={id}
                      value={id}
                    >

                      {event.title ||
                        "Untitled Event"}

                      {event.date
                        ? ` — ${event.date}`
                        : ""}

                    </option>

                  );

                }
              )

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
              marginBottom: 20,
              borderRadius: 10,
              background:
                "#111827",
              border:
                "1px solid #334155",
            }}
          >

            <strong>
              {selectedEvent.title ||
                "Selected Event"}
            </strong>

            <div
              style={{
                marginTop: 5,
                color: "#94a3b8",
              }}
            >

              {selectedEvent.date ||
                "Date TBA"}

              {" · "}

              {selectedEvent.time ||
                "Time TBA"}

              {" · "}

              {selectedEvent.venue ||
                selectedEvent.location ||
                "Venue TBA"}

            </div>

          </div>

        )}

        {/* ==================================================
            QR SCANNER
        ================================================== */}

        <div
          id={
            scannerElementId
          }
          style={{
            width: "100%",
            maxWidth: 500,
            minHeight: 50,
            margin:
              "0 auto 20px",
            borderRadius: 12,
            overflow: "hidden",
          }}
        />

        {/* ==================================================
            BUTTONS
        ================================================== */}

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent:
              "center",
            flexWrap: "wrap",
          }}
        >

          <button
            type="button"
            onClick={
              startScanner
            }
            disabled={
              scannerRunning ||
              !selectedEventId ||
              loadingEvents
            }
            className="btn-primary"
          >

            {scannerRunning
              ? "📷 Scanner Running..."
              : "📷 Start Scanner"}

          </button>

          <button
            type="button"
            onClick={
              stopScanner
            }
            disabled={
              !scannerRunning
            }
            className="btn-ghost"
          >
            ⏹ Stop Scanner
          </button>

        </div>

        {/* ==================================================
            INSTRUCTION
        ================================================== */}

        <p
          style={{
            textAlign: "center",
            marginTop: 20,
            color: "#94a3b8",
          }}
        >
          Ask the student to display
          their event QR code in front
          of the camera.
        </p>

        {/* ==================================================
            SUCCESS / ALREADY MARKED
        ================================================== */}

        {message && (

          <div
            style={{
              marginTop: 20,
              padding: 14,
              borderRadius: 10,

              background:
                messageType ===
                "already_marked"
                  ? "rgba(245,158,11,0.12)"
                  : "rgba(34,197,94,0.12)",

              border:
                messageType ===
                "already_marked"
                  ? "1px solid rgba(245,158,11,0.4)"
                  : "1px solid rgba(34,197,94,0.4)",

              color:
                messageType ===
                "already_marked"
                  ? "#fbbf24"
                  : "#86efac",
            }}
          >

            {messageType ===
            "already_marked"
              ? "⚠️ "
              : "✅ "}

            {message}

          </div>

        )}

        {/* ==================================================
            ERROR
        ================================================== */}

        {error && (

          <div
            style={{
              marginTop: 20,
              padding: 14,
              borderRadius: 10,
              background:
                "rgba(239,68,68,0.12)",
              border:
                "1px solid rgba(239,68,68,0.4)",
              color: "#fca5a5",
            }}
          >

            ❌ {error}

          </div>

        )}

      </div>

      {/* ====================================================
          ATTENDANCE REGISTER
      ==================================================== */}

      <div
        className="module-card"
        style={{
          marginTop: 30,
          overflow: "hidden",
        }}
      >

        {/* ==================================================
            REGISTER HEADER
        ================================================== */}

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

            <button
              className="btn-ghost"
              onClick={() =>
                loadAttendance(
                  selectedEventId
                )
              }
              disabled={
                loadingAttendance ||
                !selectedEventId
              }
            >
              🔄 Refresh
            </button>

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

        {/* ==================================================
            TOTAL PRESENT
        ================================================== */}

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

        {/* ==================================================
            LOADING
        ================================================== */}

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
              Attendance will appear
              here after students
              scan their QR codes.
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
                      textAlign:
                        "left",
                    }}
                  >
                    #
                  </th>

                  <th
                    style={{
                      padding: 12,
                      textAlign:
                        "left",
                    }}
                  >
                    Student Name
                  </th>

                  <th
                    style={{
                      padding: 12,
                      textAlign:
                        "left",
                    }}
                  >
                    Student ID
                  </th>

                  <th
                    style={{
                      padding: 12,
                      textAlign:
                        "left",
                    }}
                  >
                    Email
                  </th>

                  <th
                    style={{
                      padding: 12,
                      textAlign:
                        "left",
                    }}
                  >
                    Department
                  </th>

                  <th
                    style={{
                      padding: 12,
                      textAlign:
                        "left",
                    }}
                  >
                    Status
                  </th>

                  <th
                    style={{
                      padding: 12,
                      textAlign:
                        "left",
                    }}
                  >
                    Marked At
                  </th>

                </tr>

              </thead>

              <tbody>

                {attendance.map(
                  (
                    record,
                    index
                  ) => (

                    <tr
                      key={
                        record.id ||
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
                          "Student"}
                      </td>

                      <td
                        style={{
                          padding: 12,
                        }}
                      >
                        {record.student_id ||
                          record.studentId ||
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
                            borderRadius:
                              20,
                            background:
                              "rgba(34,197,94,0.15)",
                            color:
                              "#86efac",
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