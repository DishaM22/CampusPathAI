// Shows an event's Resource Person(s) and its Event Report (PDF).
// Drop <EventExtras event={event} /> into the event details view
// inside StudentDashboardUI.
//
// Expects StudentDashboard.jsx to have normalised the event:
//   event.resource_persons -> array
//   event.report_pdf_url   -> full http(s) address, or ""

export default function EventExtras({ event }) {
  const persons = Array.isArray(event?.resource_persons)
    ? event.resource_persons.filter((p) => p && p.name)
    : [];

  const reportUrl = event?.report_pdf_url || "";

  if (persons.length === 0 && !reportUrl) return null;

  return (
    <div style={{ marginTop: "20px" }}>
      {persons.length > 0 && (
        <section>
          <h3 style={{ margin: "0 0 10px" }}>Resource Person(s)</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            {persons.map((person, index) => (
              <div
                key={index}
                style={{
                  padding: "14px 16px",
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                  borderRadius: "12px",
                  background: "rgba(148, 163, 184, 0.08)",
                }}
              >
                <strong style={{ display: "block" }}>{person.name}</strong>

                {person.designation && (
                  <div style={{ fontSize: "14px", opacity: 0.85 }}>
                    {person.designation}
                  </div>
                )}

                {person.organization && (
                  <div style={{ fontSize: "13px", opacity: 0.7 }}>
                    {person.organization}
                  </div>
                )}

                {/^https?:\/\//i.test(person.linkedin_url || "") && (
                  <a
                    href={person.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: "8px",
                      fontSize: "13px",
                    }}
                  >
                    LinkedIn profile ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {reportUrl && (
        <section style={{ marginTop: persons.length > 0 ? "20px" : 0 }}>
          <h3 style={{ margin: "0 0 10px" }}>Event Report</h3>

          <a
            href={reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(148, 163, 184, 0.35)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            📄 View / Download Report (PDF)
          </a>
        </section>
      )}
    </div>
  );
}