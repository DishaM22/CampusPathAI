import React from "react";
import StatusBadge from "./StatusBadge";

export default function ApplicationsTable({ applications, onView, onApprove, onReject }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Applicant</th>
            <th>Organization</th>
            <th>Type</th>
            <th>College / University</th>
            <th>Position</th>
            <th>Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr key={app.id}>
              <td>{app.applicantName}</td>
              <td>{app.organizationName}</td>
              <td>{app.organizationType === "intercollege" ? "Inter-College" : "Club"}</td>
              <td>{app.college}</td>
              <td>{app.position}</td>
              <td>{app.date}</td>
              <td><StatusBadge status={app.status} /></td>
              <td>
                <div className="row-actions">
                  <button className="btn-ghost small" onClick={() => onView(app)}>View</button>
                  {app.status === "pending" && (
                    <>
                      <button className="btn-primary small" onClick={() => onApprove(app)}>Approve</button>
                      <button className="btn-danger small" onClick={() => onReject(app)}>Reject</button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
