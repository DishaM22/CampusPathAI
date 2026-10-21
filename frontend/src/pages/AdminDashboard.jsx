import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../admin/components/Sidebar";
import TopBar from "../admin/components/TopBar";
import StatCard from "../admin/components/StatCard";
import ApplicationsTable from "../admin/components/ApplicationsTable";
import ConfirmModal from "../admin/components/ConfirmModal";
import RejectModal from "../admin/components/RejectModal";

import {
  EmptyState,
  ErrorState,
  StatCardSkeleton,
  TableRowSkeleton,
} from "../admin/components/States";

import {
  fetchAdminDashboard,
  approveApplication,
  rejectApplication,
} from "../adminService";

import "../admin-dashboard.css";

const SAMPLE_DASHBOARD = {
  kpis: {
    pendingApplications: 0,
    approvedOrganizations: 0,
    rejectedApplications: 0,
    totalUsers: 0,
    publishedEvents: 0,
    totalRegistrations: 0,
  },
  pendingPreview: [],
};

const NOTIFICATIONS = [
  {
    id: 1,
    message: "Admin dashboard notifications will appear here.",
    time: "Now",
    read: true,
  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);

  const [isSample, setIsSample] = useState(false);

  const [confirmApp, setConfirmApp] = useState(null);
  const [rejectApp, setRejectApp] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  async function loadDashboard() {
    setStatus("loading");
    setActionError("");

    try {
      const result = await fetchAdminDashboard();

      console.log("ADMIN DASHBOARD RESPONSE:", result);

      /*
       * Handle possible API response shapes:
       *
       * {
       *   kpis: {...},
       *   pendingPreview: [...]
       * }
       *
       * or
       *
       * {
       *   data: {
       *      kpis: {...}
       *   }
       * }
       */

      const dashboardData =
        result?.data ||
        result;

      if (!dashboardData?.kpis) {
        console.warn(
          "Admin dashboard response does not contain kpis:",
          result
        );

        setData(SAMPLE_DASHBOARD);
        setIsSample(true);
      } else {
        setData({
          kpis: dashboardData.kpis,
          pendingPreview:
            Array.isArray(dashboardData.pendingPreview)
              ? dashboardData.pendingPreview
              : [],
        });

        setIsSample(false);
      }

      setStatus("ready");
    } catch (error) {
      console.error(
        "ADMIN DASHBOARD LOAD ERROR:",
        error
      );

      /*
       * Keep dashboard visible even if backend
       * temporarily fails.
       */
      setData(SAMPLE_DASHBOARD);
      setIsSample(true);
      setStatus("ready");

      setActionError(
        "Unable to load live dashboard data. Showing empty dashboard values."
      );
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  function removeFromPreview(id) {
    setData((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        pendingPreview:
          current.pendingPreview.filter(
            (application) =>
              application.id !== id
          ),
      };
    });
  }

  async function handleApprove() {
    if (!confirmApp) {
      return;
    }

    setIsSubmitting(true);
    setActionError("");

    try {
      await approveApplication(confirmApp.id);

      removeFromPreview(confirmApp.id);

      setConfirmApp(null);

      await loadDashboard();
    } catch (error) {
      console.error(
        "APPROVE APPLICATION ERROR:",
        error
      );

      setActionError(
        error.message ||
          "Unable to approve this application."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject({ reason, note }) {
    if (!rejectApp) {
      return;
    }

    setIsSubmitting(true);
    setActionError("");

    try {
      await rejectApplication(
        rejectApp.id,
        {
          reason,
          note,
        }
      );

      removeFromPreview(rejectApp.id);

      setRejectApp(null);

      await loadDashboard();
    } catch (error) {
      console.error(
        "REJECT APPLICATION ERROR:",
        error
      );

      setActionError(
        error.message ||
          "Unable to reject this application."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const kpis = data?.kpis;

  return (
    <div className="dashboard-shell">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <Sidebar
        role="admin"
        activeKey="dashboard"
        collapsed={collapsed}
        onToggleCollapsed={() =>
          setCollapsed((current) => !current)
        }
        onLogout={() => {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("userEmail");
          localStorage.removeItem("userRole");
          localStorage.removeItem("student_id");

          navigate("/");
        }}
        mobileOpen={mobileOpen}
        onCloseMobile={() =>
          setMobileOpen(false)
        }
      />

      {/* =====================================================
          MAIN
      ===================================================== */}

      <div className="dashboard-main">

        <TopBar
          orgInitial="A"
          notifications={NOTIFICATIONS}
          onNavigate={navigate}
          onMenuToggle={() =>
            setMobileOpen(true)
          }
          basePath="/admin"
        />

        <main className="content">

          {/* =================================================
              PAGE HEADER
          ================================================= */}

          <div className="page-head">

            <h1>
              Welcome back, Admin.
            </h1>

            <p>
              CampusPath AI Admin Dashboard —
              verify organizations and keep the
              platform trustworthy.
            </p>

          </div>

          {/* =================================================
              ERROR / INFORMATION
          ================================================= */}

          {actionError && (
            <div className="sample-banner error-banner">
              {actionError}
            </div>
          )}

          {/* =================================================
              LOADING
          ================================================= */}

          {status === "loading" && (
            <div className="kpi-grid kpi-grid-6">

              {Array.from({
                length: 6,
              }).map((_, index) => (
                <StatCardSkeleton
                  key={index}
                />
              ))}

            </div>
          )}

          {/* =================================================
              DASHBOARD CONTENT
          ================================================= */}

          {status === "ready" && kpis && (
            <>

              {/* =================================================
                  KPI CARDS
              ================================================= */}

              <div className="kpi-grid kpi-grid-6">

                <StatCard
                  icon="📥"
                  label="Pending Applications"
                  value={
                    kpis.pendingApplications ?? 0
                  }
                  isSample={isSample}
                  trend={{
                    direction: "up",
                    label: "Requires review",
                  }}
                />

                <StatCard
                  icon="🏛️"
                  label="Approved Organizations"
                  value={
                    kpis.approvedOrganizations ?? 0
                  }
                  isSample={isSample}
                  trend={{
                    direction: "up",
                    label: "Active",
                  }}
                />

                <StatCard
                  icon="🚫"
                  label="Rejected Applications"
                  value={
                    kpis.rejectedApplications ?? 0
                  }
                  isSample={isSample}
                  trend={{
                    direction: "down",
                    label: "This period",
                  }}
                />

                <StatCard
                  icon="👥"
                  label="Total Users"
                  value={(
                    kpis.totalUsers ?? 0
                  ).toLocaleString()}
                  isSample={isSample}
                />

                <StatCard
                  icon="📅"
                  label="Published Events"
                  value={
                    kpis.publishedEvents ?? 0
                  }
                  isSample={isSample}
                />

                <StatCard
                  icon="📋"
                  label="Total Registrations"
                  value={(
                    kpis.totalRegistrations ?? 0
                  ).toLocaleString()}
                  isSample={isSample}
                />

              </div>

              {/* =================================================
                  PENDING APPLICATIONS
              ================================================= */}

              <div className="section-head">

                <h2>
                  ⚠️ Pending organization applications
                </h2>

                <button
                  type="button"
                  className="link"
                  onClick={() =>
                    navigate(
                      "/admin/applications"
                    )
                  }
                >
                  View all
                </button>

              </div>

              {data.pendingPreview.length === 0 ? (

                <EmptyState
                  title="No Pending Applications"
                  message="All organization applications have been reviewed."
                />

              ) : (

                <ApplicationsTable
                  applications={
                    data.pendingPreview
                  }
                  onView={(application) =>
                    navigate(
                      `/admin/applications/${application.id}`
                    )
                  }
                  onApprove={setConfirmApp}
                  onReject={setRejectApp}
                />

              )}

            </>
          )}

        </main>
      </div>

      {/* =====================================================
          APPROVE MODAL
      ===================================================== */}

      <ConfirmModal
        open={!!confirmApp}
        title="Approve Organization?"
        message={
          confirmApp
            ? `Approving "${confirmApp.organizationName}" will activate the organization account.`
            : ""
        }
        confirmLabel="Approve"
        isSubmitting={isSubmitting}
        onCancel={() =>
          setConfirmApp(null)
        }
        onConfirm={handleApprove}
      />

      {/* =====================================================
          REJECT MODAL
      ===================================================== */}

      <RejectModal
        open={!!rejectApp}
        isSubmitting={isSubmitting}
        onCancel={() =>
          setRejectApp(null)
        }
        onReject={handleReject}
      />

    </div>
  );
}