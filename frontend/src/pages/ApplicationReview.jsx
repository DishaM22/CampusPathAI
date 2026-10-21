import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "react-router-dom";

import Sidebar from "../admin/components/Sidebar";
import TopBar from "../admin/components/TopBar";
import StatusBadge from "../admin/components/StatusBadge";
import ConfirmModal from "../admin/components/ConfirmModal";
import RejectModal from "../admin/components/RejectModal";

import {
  fetchApplication,
  approveApplication,
  rejectApplication,
} from "../adminService";

import "../admin-dashboard.css";


// ============================================================
// SMALL DETAIL ROW
// ============================================================

function DetailRow({
  label,
  value,
}) {
  return (
    <div className="detail-row">

      <div className="detail-label">
        {label}
      </div>

      <div className="detail-value">
        {value || "Not provided"}
      </div>

    </div>
  );
}


// ============================================================
// APPLICATION REVIEW
// ============================================================

export default function ApplicationReview({
  applicationId,
  navigate = (path) =>
    console.log("navigate ->", path),
}) {

  const { id: routeApplicationId } = useParams();

  const currentApplicationId = applicationId || routeApplicationId;

  const [
    collapsed,
    setCollapsed,
  ] = useState(false);

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    app,
    setApp,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    showApprove,
    setShowApprove,
  ] = useState(false);

  const [
    showReject,
    setShowReject,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);


  // ==========================================================
  // LOAD APPLICATION
  // ==========================================================

  async function loadApplication() {

    setLoading(true);
    setError("");

    try {

      const result =
        await fetchApplication(
          currentApplicationId
        );

      /*
       * Backend returns:
       *
       * {
       *   status: "success",
       *   id: "...",
       *   applicationStatus: "pending",
       *   submittedAt: "...",
       *   applicant: {...},
       *   organization: {...}
       * }
       */

      setApp(result);

    } catch (err) {

      console.error(
        "APPLICATION LOAD ERROR:",
        err
      );

      setError(
        err.message ||
        "Unable to load this application."
      );

    } finally {

      setLoading(false);
    }
  }


  // ==========================================================
  // LOAD WHEN ID CHANGES
  // ==========================================================

  useEffect(() => {

    if (currentApplicationId) {
      loadApplication();
    }

  }, [currentApplicationId]);


  // ==========================================================
  // APPROVE
  // ==========================================================

  async function handleApprove() {

    setIsSubmitting(true);

    try {

      await approveApplication(
        currentApplicationId
      );

      setApp(
        (current) => ({
          ...current,

          applicationStatus:
            "active",
        })
      );

      setShowApprove(false);

    } catch (err) {

      setError(
        err.message ||
        "Unable to approve application."
      );

    } finally {

      setIsSubmitting(false);
    }
  }


  // ==========================================================
  // REJECT
  // ==========================================================

  async function handleReject({
    reason,
    note,
  }) {

    setIsSubmitting(true);

    try {

      await rejectApplication(
        currentApplicationId,
        {
          reason,
          note,
        }
      );

      setApp(
        (current) => ({
          ...current,

          applicationStatus:
            "rejected",

          rejectionReason:
            reason,

          adminNote:
            note,
        })
      );

      setShowReject(false);

    } catch (err) {

      setError(
        err.message ||
        "Unable to reject application."
      );

    } finally {

      setIsSubmitting(false);
    }
  }


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (
      <div className="dashboard-shell">

        <Sidebar
          orgName="Admin"
          activeKey="applications"
          collapsed={collapsed}
          onToggleCollapsed={() =>
            setCollapsed(
              (value) => !value
            )
          }
          onNavigate={navigate}
          onLogout={() =>
            navigate("/logout")
          }
          mobileOpen={mobileOpen}
          onCloseMobile={() =>
            setMobileOpen(false)
          }
        />

        <div className="dashboard-main">

          <TopBar
            orgInitial="A"
            onNavigate={navigate}
            onMenuToggle={() =>
              setMobileOpen(true)
            }
            basePath="/admin"
          />

          <main className="content">

            <h1>
              Loading application...
            </h1>

          </main>

        </div>

      </div>
    );
  }


  // ==========================================================
  // ERROR
  // ==========================================================

  if (error || !app) {

    return (
      <div className="dashboard-shell">

        <Sidebar
          orgName="Admin"
          activeKey="applications"
          collapsed={collapsed}
          onToggleCollapsed={() =>
            setCollapsed(
              (value) => !value
            )
          }
          onNavigate={navigate}
          onLogout={() =>
            navigate("/logout")
          }
          mobileOpen={mobileOpen}
          onCloseMobile={() =>
            setMobileOpen(false)
          }
        />

        <div className="dashboard-main">

          <TopBar
            orgInitial="A"
            onNavigate={navigate}
            onMenuToggle={() =>
              setMobileOpen(true)
            }
            basePath="/admin"
          />

          <main className="content">

            <button
              className="link back-link"
              onClick={() =>
                navigate(
                  "/admin/applications"
                )
              }
            >
              ← Back to Applications
            </button>

            <div className="sample-banner error-banner">
              {error ||
                "Application not found."}
            </div>

            <button
              className="btn-primary"
              onClick={loadApplication}
            >
              Try Again
            </button>

          </main>

        </div>

      </div>
    );
  }


  // ==========================================================
  // MAIN REVIEW PAGE
  // ==========================================================

  return (
    <div className="dashboard-shell">

      {/* ====================================================
          SIDEBAR
      ==================================================== */}

      <Sidebar
        orgName="Admin"
        activeKey="applications"
        collapsed={collapsed}
        onToggleCollapsed={() =>
          setCollapsed(
            (value) => !value
          )
        }
        onNavigate={navigate}
        onLogout={() =>
          navigate("/logout")
        }
        mobileOpen={mobileOpen}
        onCloseMobile={() =>
          setMobileOpen(false)
        }
      />


      <div className="dashboard-main">

        {/* ==================================================
            TOP BAR
        ================================================== */}

        <TopBar
          orgInitial="A"
          onNavigate={navigate}
          onMenuToggle={() =>
            setMobileOpen(true)
          }
          basePath="/admin"
        />


        <main className="content">

          {/* =================================================
              BACK
          ================================================= */}

          <button
            className="link back-link"
            onClick={() =>
              navigate(
                "/admin/applications"
              )
            }
          >
            ← Back to Applications
          </button>


          {/* =================================================
              HEADER
          ================================================= */}

          <div className="review-head">

            <div>

              <h1>
                {app.organization?.name ||
                  "Organization Application"}
              </h1>

              <p className="review-sub">

                {app.organization?.type ===
                "intercollege"
                  ? "Inter-College"
                  : "Club"}

                {" application · Submitted "}

                {app.submittedAt ||
                  "Date not available"}

              </p>

            </div>


            <StatusBadge
              status={
                app.applicationStatus ||
                "pending"
              }
            />

          </div>


          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <div className="sample-banner error-banner">
              {error}
            </div>
          )}


          {/* =================================================
              APPLICATION DETAILS
          ================================================= */}

          <div className="review-grid">


            {/* =================================================
                APPLICANT INFORMATION
            ================================================= */}

            <section className="review-card">

              <h2>
                Applicant Information
              </h2>

              <div className="detail-list">

                <DetailRow
                  label="Full Name"
                  value={
                    app.applicant?.fullName
                  }
                />

                <DetailRow
                  label="Email"
                  value={
                    app.applicant?.email
                  }
                />

                <DetailRow
                  label="Department"
                  value={
                    app.applicant?.department
                  }
                />

                <DetailRow
                  label="Student ID"
                  value={
                    app.applicant?.studentId
                  }
                />

                <DetailRow
                  label="College / University"
                  value={
                    app.applicant?.college
                  }
                />

              </div>

            </section>


            {/* =================================================
                CLUB INFORMATION
            ================================================= */}

            <section className="review-card">

              <h2>
                Club Information
              </h2>

              <div className="detail-list">

                <DetailRow
                  label="Club Name"
                  value={
                    app.organization?.name
                  }
                />

                <DetailRow
                  label="Club Category"
                  value={
                    app.organization?.category
                  }
                />

                <DetailRow
                  label="Position"
                  value={
                    app.organization?.position
                  }
                />

                <DetailRow
                  label="College / University"
                  value={
                    app.applicant?.college
                  }
                />

              </div>

            </section>


            {/* =================================================
                COORDINATOR INFORMATION
            ================================================= */}

            <section className="review-card">

              <h2>
                Coordinator Information
              </h2>

              <div className="detail-list">

                <DetailRow
                  label="Coordinator Name"
                  value={
                    app.organization
                      ?.coordinatorName
                  }
                />

                <DetailRow
                  label="Coordinator Email"
                  value={
                    app.organization
                      ?.coordinatorEmail
                  }
                />

              </div>

            </section>


            {/* =================================================
                VERIFICATION INFORMATION
            ================================================= */}

            <section className="review-card">

              <h2>
                Verification Information
              </h2>

              <div className="detail-list">

                <DetailRow
                  label="Institutional Email"
                  value={
                    app.applicant?.email
                  }
                />

                <DetailRow
                  label="Student ID"
                  value={
                    app.applicant?.studentId
                  }
                />

                <DetailRow
                  label="Registration Status"
                  value={
                    app.applicationStatus
                  }
                />

                <DetailRow
                  label="Submitted On"
                  value={
                    app.submittedAt
                  }
                />

              </div>

            </section>

          </div>


          {/* =================================================
              REJECTION INFORMATION
          ================================================= */}

          {app.applicationStatus ===
            "rejected" && (

            <div className="rejection-note-card">

              <strong>
                Rejection reason:
              </strong>

              {" "}

              {app.rejectionReason ||
                "No reason provided."}

              {app.adminNote && (
                <p>
                  {app.adminNote}
                </p>
              )}

            </div>

          )}


          {/* =================================================
              ADMIN ACTIONS
          ================================================= */}

          {app.applicationStatus ===
            "pending" && (

            <div className="review-actions">

              <button
                className="btn-danger"
                onClick={() =>
                  setShowReject(true)
                }
              >
                Reject
              </button>

              <button
                className="btn-primary"
                onClick={() =>
                  setShowApprove(true)
                }
              >
                Approve Application
              </button>

            </div>

          )}

        </main>

      </div>


      {/* ====================================================
          APPROVE MODAL
      ==================================================== */}

      <ConfirmModal
        open={showApprove}
        title="Approve Organization?"
        message="Approving this application will activate the organization account and allow the representative to access the organizer dashboard and create events."
        confirmLabel="Approve"
        isSubmitting={isSubmitting}
        onCancel={() =>
          setShowApprove(false)
        }
        onConfirm={handleApprove}
      />


      {/* ====================================================
          REJECT MODAL
      ==================================================== */}

      <RejectModal
        open={showReject}
        isSubmitting={isSubmitting}
        onCancel={() =>
          setShowReject(false)
        }
        onReject={handleReject}
      />

    </div>
  );
}