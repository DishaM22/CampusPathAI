import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import Sidebar from "../admin/components/Sidebar";
import TopBar from "../admin/components/TopBar";
import StatusBadge from "../admin/components/StatusBadge";

import {
  fetchApplications,
  approveApplication,
  rejectApplication,
} from "../adminService";

import ConfirmModal from "../admin/components/ConfirmModal";
import RejectModal from "../admin/components/RejectModal";

import "../admin-dashboard.css";


// ============================================================
// PAGE SIZE
// ============================================================

const PAGE_SIZE = 10;


// ============================================================
// HELPER
// ============================================================

function safeText(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not provided";
  }

  return String(value);
}


// ============================================================
// DATE FORMAT
// ============================================================

function formatDate(value) {

  if (!value) {
    return "Not available";
  }

  try {

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );

  } catch {

    return String(value);
  }
}


// ============================================================
// CONVERT BACKEND APPLICATION
// INTO TABLE FORMAT
// ============================================================

function normalizeApplication(application) {

  return {

    // MongoDB ID
    id:
      application.id ||
      application._id,

    // Applicant
    applicantName:
      application.name ||
      application.full_name ||
      "Not provided",

    // Organization
    organizationName:
      application.club_name ||
      application.organization_name ||
      application.organizationName ||
      "Not provided",

    // Role
    organizationType:
      application.role === "intercollege"
        ? "intercollege"
        : "club",

    // College / University
    college:
      application.college_name ||
      application.college ||
      application.university ||
      application.university_name ||
      "Not provided",

    // Position
    position:
      application.position ||
      application.club_position ||
      application.coordinator_position ||
      "Not provided",

    // Date
    date:
      application.submitted_at ||
      application.created_at ||
      application.registered_at ||
      "",

    // Status
    status:
      application.status ||
      "pending",

    // Keep complete original object
    // so View can use it later if needed.
    original:
      application,
  };
}


// ============================================================
// COMPONENT
// ============================================================

export default function PendingApplications() {

  const navigate = useNavigate();


  // ==========================================================
  // STATE
  // ==========================================================

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
    applications,
    setApplications,
  ] = useState([]);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    typeFilter,
    setTypeFilter,
  ] = useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("pending");

  const [
    sort,
    setSort,
  ] = useState("newest");

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    confirmApp,
    setConfirmApp,
  ] = useState(null);

  const [
    rejectApp,
    setRejectApp,
  ] = useState(null);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    actionError,
    setActionError,
  ] = useState("");



  // ==========================================================
  // LOAD APPLICATIONS
  // ==========================================================

  async function loadApplications() {

    try {

      setLoading(true);
      setError("");

      const result =
        await fetchApplications();

      console.log(
        "REAL APPLICATIONS FROM DATABASE:",
        result
      );


      const rawApplications =
        Array.isArray(
          result?.applications
        )
          ? result.applications
          : [];


      const normalized =
        rawApplications.map(
          normalizeApplication
        );


      setApplications(
        normalized
      );


    } catch (err) {

      console.error(
        "APPLICATION LOAD ERROR:",
        err
      );

      setError(
        err.message ||
        "Unable to load applications."
      );

    } finally {

      setLoading(false);
    }
  }


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {

    loadApplications();

  }, []);


  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredApplications =
    useMemo(() => {

      let list = [
        ...applications,
      ];


      // ------------------------------------------------------
      // SEARCH
      // ------------------------------------------------------

      if (
        search.trim()
      ) {

        const query =
          search
            .trim()
            .toLowerCase();


        list =
          list.filter(
            (application) => {

              return (

                safeText(
                  application.applicantName
                )
                  .toLowerCase()
                  .includes(query)

                ||

                safeText(
                  application.organizationName
                )
                  .toLowerCase()
                  .includes(query)

                ||

                safeText(
                  application.college
                )
                  .toLowerCase()
                  .includes(query)

                ||

                safeText(
                  application.position
                )
                  .toLowerCase()
                  .includes(query)
              );
            }
          );
      }


      // ------------------------------------------------------
      // TYPE
      // ------------------------------------------------------

      if (
        typeFilter !== "all"
      ) {

        list =
          list.filter(
            (application) =>
              application.organizationType ===
              typeFilter
          );
      }


      // ------------------------------------------------------
      // STATUS
      // ------------------------------------------------------

      if (
        statusFilter !== "all"
      ) {

        list =
          list.filter(
            (application) =>
              application.status ===
              statusFilter
          );
      }


      // ------------------------------------------------------
      // SORT
      // ------------------------------------------------------

      list.sort(
        (a, b) => {

          if (
            sort === "organization"
          ) {

            return safeText(
              a.organizationName
            ).localeCompare(
              safeText(
                b.organizationName
              )
            );
          }


          const dateA =
            new Date(
              a.date || 0
            ).getTime();

          const dateB =
            new Date(
              b.date || 0
            ).getTime();


          if (
            sort === "oldest"
          ) {
            return dateA - dateB;
          }


          return dateB - dateA;
        }
      );


      return list;

    }, [
      applications,
      search,
      typeFilter,
      statusFilter,
      sort,
    ]);


  // ==========================================================
  // PAGINATION
  // ==========================================================

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredApplications.length /
        PAGE_SIZE
      )
    );


  const pageItems =
    filteredApplications.slice(
      (page - 1) * PAGE_SIZE,
      page * PAGE_SIZE
    );


  // ==========================================================
  // APPROVE
  // ==========================================================

  async function handleApprove() {

    if (!confirmApp) {
      return;
    }


    try {

      setIsSubmitting(true);
      setActionError("");


      await approveApplication(
        confirmApp.id
      );


      setApplications(
        (current) =>
          current.filter(
            (application) =>
              application.id !==
              confirmApp.id
          )
      );


      setConfirmApp(null);


    } catch (err) {

      console.error(
        "APPROVE ERROR:",
        err
      );

      setActionError(
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

    if (!rejectApp) {
      return;
    }


    try {

      setIsSubmitting(true);
      setActionError("");


      await rejectApplication(
        rejectApp.id,
        {
          reason,
          note,
        }
      );


      setApplications(
        (current) =>
          current.filter(
            (application) =>
              application.id !==
              rejectApp.id
          )
      );


      setRejectApp(null);


    } catch (err) {

      console.error(
        "REJECT ERROR:",
        err
      );

      setActionError(
        err.message ||
        "Unable to reject application."
      );

    } finally {

      setIsSubmitting(false);
    }
  }


  // ==========================================================
  // LOGOUT
  // ==========================================================

  function handleLogout() {

    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    localStorage.removeItem(
      "userEmail"
    );

    localStorage.removeItem(
      "userRole"
    );

    navigate("/");
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
          onLogout={handleLogout}
          mobileOpen={mobileOpen}
          onCloseMobile={() =>
            setMobileOpen(false)
          }
        />


        <main className="dashboard-main">

          <TopBar
            orgInitial="A"
            notifications={[]}
            onSearch={() => {}}
            onNavigate={navigate}
            onMenuToggle={() =>
              setMobileOpen(true)
            }
            basePath="/admin"
          />


          <section className="content">

            <div className="page-head">

              <h1>
                Organization Applications
              </h1>

              <p>
                Loading real applications
                from the database...
              </p>

            </div>

          </section>

        </main>

      </div>
    );
  }


  // ==========================================================
  // ERROR
  // ==========================================================

  if (error) {

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
          onLogout={handleLogout}
          mobileOpen={mobileOpen}
          onCloseMobile={() =>
            setMobileOpen(false)
          }
        />


        <main className="dashboard-main">

          <TopBar
            orgInitial="A"
            notifications={[]}
            onSearch={() => {}}
            onNavigate={navigate}
            onMenuToggle={() =>
              setMobileOpen(true)
            }
            basePath="/admin"
          />


          <section className="content">

            <div className="empty-state error">

              <div className="empty-icon">
                ⚠️
              </div>

              <h3>
                Unable to load applications
              </h3>

              <p>
                {error}
              </p>

              <button
                className="btn-primary"
                onClick={
                  loadApplications
                }
              >
                Try Again
              </button>

            </div>

          </section>

        </main>

      </div>
    );
  }


  // ==========================================================
  // MAIN PAGE
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
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() =>
          setMobileOpen(false)
        }
      />


      {/* ====================================================
          MAIN
      ==================================================== */}

      <main className="dashboard-main">

        <TopBar
          orgInitial="A"
          notifications={[]}
          onSearch={() => {}}
          onNavigate={navigate}
          onMenuToggle={() =>
            setMobileOpen(true)
          }
          basePath="/admin"
        />


        <section className="content">


          {/* ==================================================
              HEADER
          ================================================== */}

          <div className="page-head">

            <div>

              <h1>
                Pending Organization Applications
              </h1>

              <p>
                Review Club and Inter-College
                registrations before activation.
              </p>

            </div>

          </div>


          {/* ==================================================
              ACTION ERROR
          ================================================== */}

          {actionError && (

            <div
              className="sample-banner error-banner"
              style={{
                marginBottom: "20px",
              }}
            >
              {actionError}
            </div>

          )}


          {/* ==================================================
              FILTERS
          ================================================== */}

          <div className="filter-bar">

            <input
              className="field"
              placeholder="Search applicant, organization, college..."
              value={search}
              onChange={(event) => {

                setSearch(
                  event.target.value
                );

                setPage(1);
              }}
            />


            <select
              className="field small"
              value={typeFilter}
              onChange={(event) => {

                setTypeFilter(
                  event.target.value
                );

                setPage(1);
              }}
            >

              <option value="all">
                All types
              </option>

              <option value="club">
                Club
              </option>

              <option value="intercollege">
                Inter-College
              </option>

            </select>


            <select
              className="field small"
              value={statusFilter}
              onChange={(event) => {

                setStatusFilter(
                  event.target.value
                );

                setPage(1);
              }}
            >

              <option value="all">
                All statuses
              </option>

              <option value="pending">
                Pending
              </option>

              <option value="active">
                Approved
              </option>

              <option value="rejected">
                Rejected
              </option>

            </select>


            <select
              className="field small"
              value={sort}
              onChange={(event) => {

                setSort(
                  event.target.value
                );

                setPage(1);
              }}
            >

              <option value="newest">
                Newest
              </option>

              <option value="oldest">
                Oldest
              </option>

              <option value="organization">
                Organization
              </option>

            </select>

          </div>


          {/* ==================================================
              APPLICATION COUNT
          ================================================== */}

          <div
            style={{
              marginBottom: "15px",
              color: "#8b97b5",
              fontSize: "14px",
            }}
          >
            Showing{" "}
            <strong>
              {filteredApplications.length}
            </strong>{" "}
            application
            {filteredApplications.length !== 1
              ? "s"
              : ""}
          </div>


          {/* ==================================================
              EMPTY
          ================================================== */}

          {pageItems.length === 0 ? (

            <div className="empty-state">

              <div className="empty-icon">
                📭
              </div>

              <h3>
                No applications found
              </h3>

              <p>
                There are no applications matching
                the selected filters.
              </p>

            </div>

          ) : (

            /* =================================================
               TABLE
            ================================================= */

            <div className="table-wrap">

              <table className="data-table">

                <thead>

                  <tr>

                    <th>
                      APPLICANT
                    </th>

                    <th>
                      ORGANIZATION
                    </th>

                    <th>
                      TYPE
                    </th>

                    <th>
                      COLLEGE / UNIVERSITY
                    </th>

                    <th>
                      POSITION
                    </th>

                    <th>
                      DATE
                    </th>

                    <th>
                      STATUS
                    </th>

                    <th>
                      ACTIONS
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {pageItems.map(
                    (application) => (

                      <tr
                        key={
                          application.id
                        }
                      >

                        <td>
                          {safeText(
                            application.applicantName
                          )}
                        </td>


                        <td>
                          {safeText(
                            application.organizationName
                          )}
                        </td>


                        <td>

                          {application.organizationType ===
                          "intercollege"
                            ? "Inter-College"
                            : "Club"}

                        </td>


                        <td>
                          {safeText(
                            application.college
                          )}
                        </td>


                        <td>
                          {safeText(
                            application.position
                          )}
                        </td>


                        <td>
                          {formatDate(
                            application.date
                          )}
                        </td>


                        <td>

                          <StatusBadge
                            status={
                              application.status
                            }
                          />

                        </td>


                        <td>

                          <div className="row-actions">

                            {/* VIEW */}

                            <button
                              className="btn-ghost small"
                              onClick={() => {

                                console.log(
                                  "VIEW APPLICATION:",
                                  application.id
                                );

                                navigate(
                                  `/admin/applications/${application.id}`
                                );
                              }}
                            >
                              View
                            </button>


                            {/* APPROVE */}

                            {application.status ===
                              "pending" && (

                              <button
                                className="btn-primary small"
                                onClick={() =>
                                  setConfirmApp(
                                    application
                                  )
                                }
                              >
                                Approve
                              </button>

                            )}


                            {/* REJECT */}

                            {application.status ===
                              "pending" && (

                              <button
                                className="btn-danger small"
                                onClick={() =>
                                  setRejectApp(
                                    application
                                  )
                                }
                              >
                                Reject
                              </button>

                            )}

                          </div>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}


          {/* ==================================================
              PAGINATION
          ================================================== */}

          {filteredApplications.length > 0 && (

            <div
              className="pagination"
              style={{
                marginTop: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >

              <button
                className="btn-ghost small"
                disabled={page <= 1}
                onClick={() =>
                  setPage(
                    (value) =>
                      Math.max(
                        1,
                        value - 1
                      )
                  )
                }
              >
                Previous
              </button>


              <span>
                Page {page} of {totalPages}
              </span>


              <button
                className="btn-ghost small"
                disabled={
                  page >= totalPages
                }
                onClick={() =>
                  setPage(
                    (value) =>
                      Math.min(
                        totalPages,
                        value + 1
                      )
                  )
                }
              >
                Next
              </button>

            </div>

          )}

        </section>

      </main>


      {/* ======================================================
          APPROVE MODAL
      ====================================================== */}

      <ConfirmModal
        open={
          !!confirmApp
        }
        title="Approve Organization?"
        message={
          confirmApp
            ? `Approve "${confirmApp.organizationName}"? This will activate the organization account.`
            : ""
        }
        confirmLabel="Approve"
        isSubmitting={
          isSubmitting
        }
        onCancel={() =>
          setConfirmApp(null)
        }
        onConfirm={
          handleApprove
        }
      />


      {/* ======================================================
          REJECT MODAL
      ====================================================== */}

      <RejectModal
        open={
          !!rejectApp
        }
        isSubmitting={
          isSubmitting
        }
        onCancel={() =>
          setRejectApp(null)
        }
        onReject={
          handleReject
        }
      />

    </div>
  );
}