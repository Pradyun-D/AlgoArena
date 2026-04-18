import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import SidebarAdminDashboard from "./SidebarAdminDashboard";
import ErrorPage from "../Pages/Auth_and_Profile/ErrorPage";
import LoadingPage from "../Pages/Auth_and_Profile/LoadingPage";
import "../Styles/admin_dashboard.css";
import ThemeToggle from "./ThemeToggle";
import { API_BASE_URL } from "../Utils/api";
import { getAdminSettings } from "../Utils/admin_settings";
import { parseContestTime } from "../Utils/is_live_contest";

const PAGE_SIZE = 10;

const topMetrics = [
  { label: "Global Users", value: "128,402", accent: "blue" },
  { label: "Active Now", value: "4,912", accent: "green" },
];

const insightCards = [
  {
    eyebrow: "Growth Index",
    value: "+12.4%",
    caption: "vs previous month",
    accent: "trend",
    icon: "trending_up",
  },
  {
    eyebrow: "Validation Rate",
    value: "99.8%",
    caption: "Automated system score",
    accent: "check",
    icon: "verified",
  },
  {
    eyebrow: "Next Major Event",
    value: "World Finals 2024",
    caption: "Starting in 4d 12h 08m",
    accent: "event",
    icon: "campaign",
  },
];

const statusClassMap = {
  Live: "status-live",
  Draft: "status-draft",
  Completed: "status-completed",
};

const formatAdminDate = (value) => {
  if (!value) {
    return "TBA";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const getContestStatus = (startTime, endTime, visibility) => {
  if (visibility === "private") {
    return "Draft";
  }

  const now = Date.now();
  const start = parseContestTime(startTime);
  const end = parseContestTime(endTime);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "Draft";
  }

  if (now < start) {
    return "Draft";
  }

  if (now >= end) {
    return "Completed";
  }

  return "Live";
};

function AdminContestListTemplate({
  activeTab = "dashboard",
  title,
  description,
  fetchUrl,
  loadingTitle = "Loading admin dashboard",
  loadingSubtitle = "Pulling contest metrics, registration counts, and operational controls into the control panel.",
  errorTitle,
  errorFallback = "Unable to load admin dashboard data.",
  emptyMessage,
  entryLabel = "entries",
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contests, setContests] = useState([]);
  const [actionMessage, setActionMessage] = useState("");
  const [deletingContestId, setDeletingContestId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [adminSettings, setAdminSettings] = useState(() => getAdminSettings());

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setStartDateInput("");
    setEndDateInput("");
  };

  const fetchContests = useCallback(async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      setError("");
      const response = await axios.get(fetchUrl, { withCredentials: true });
      setContests(Array.isArray(response.data) ? response.data : []);
      setCurrentPage(1);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          errorFallback
      );
    } finally {
      setLoading(false);
    }
  }, [errorFallback, fetchUrl]);

  useEffect(() => {
    fetchContests();
  }, [fetchContests]);

  useEffect(() => {
    const syncSettings = () => setAdminSettings(getAdminSettings());
    window.addEventListener("storage", syncSettings);
    window.addEventListener("focus", syncSettings);
    return () => {
      window.removeEventListener("storage", syncSettings);
      window.removeEventListener("focus", syncSettings);
    };
  }, []);

  useEffect(() => {
    const refreshVisibleDashboard = () => {
      if (document.visibilityState === "visible") {
        fetchContests({ showLoader: false });
      }
    };

    window.addEventListener("focus", refreshVisibleDashboard);
    document.addEventListener("visibilitychange", refreshVisibleDashboard);

    return () => {
      window.removeEventListener("focus", refreshVisibleDashboard);
      document.removeEventListener("visibilitychange", refreshVisibleDashboard);
    };
  }, [fetchContests]);


  const handleDeleteContest = async (contestId, contestTitle) => {
  if (adminSettings.deleteConfirm) {
    const confirmed = window.confirm(`Delete "${contestTitle}"?\n\nThis action cannot be undone.`);
    if (!confirmed) return;
  }

  try {
    setDeletingContestId(contestId);
    setActionMessage("");

    const response = await axios.delete(
      `${API_BASE_URL}/contests/${contestId}/delete/`,
      { withCredentials: true }
    );

    // Remove from local state
    setContests((current) =>
      current.filter((c) => (c.contest_id || c.id) !== contestId)
    );

    setActionMessage("✅ Contest deleted permanently.");
    
  } catch (err) {
    console.error("Delete failed:", err.response?.data || err.message);
    setActionMessage(
      err.response?.data?.error || 
      err.response?.data?.message || 
      "Failed to delete contest. Check console."
    );
  } finally {
    setDeletingContestId("");
  }
};

  const normalizedContests = contests.map((contest) => {
    const registrantsValue =
      contest.registrants ??
      contest.registrations ??
      contest.participants ??
      contest.total_registrants ??
      0;

    return {
      id: contest.contest_id || contest.id || "N/A",
      title: contest.title || "Untitled Contest",
      start: formatAdminDate(contest.start_time),
      end: formatAdminDate(contest.end_time),
      rawStartTime: parseContestTime(contest.start_time),
      registrants:
        typeof registrantsValue === "number"
          ? registrantsValue.toLocaleString("en-IN")
          : String(registrantsValue),
      status: getContestStatus(
        contest.start_time,
        contest.end_time,
        contest.visibility
      ),
    };
  });

  const filteredContests = normalizedContests.filter((contest) => {
    const matchesSearch =
      contest.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(contest.id).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || contest.status === statusFilter;

    let matchesDate = true;

    if (startDateInput) {
      const filterStart = new Date(`${startDateInput}T00:00:00`).getTime();
      matchesDate = matchesDate && contest.rawStartTime >= filterStart;
    }

    if (endDateInput) {
      const filterEnd = new Date(`${endDateInput}T23:59:59`).getTime();
      matchesDate = matchesDate && contest.rawStartTime <= filterEnd;
    }
    return matchesSearch && matchesStatus && matchesDate;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, startDateInput, endDateInput]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredContests.length / PAGE_SIZE)
  );
  const paginatedContests = filteredContests.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (loading) {
    return <LoadingPage title={loadingTitle} subtitle={loadingSubtitle} />;
  }

  if (error) {
    return (
      <ErrorPage
        kicker="Admin Data Error"
        code="500"
        title={errorTitle}
        copy={error}
        primaryAction={{ label: "Retry", onClick: fetchContests }}
        secondaryAction={{ label: "View Contests", to: "/contests" }}
      />
    );
  }

  return (
    <div className={`admin-dashboard-page ${adminSettings.compactTables ? "admin-compact-tables" : ""}`}>
      <SidebarAdminDashboard />

      <main className="admin-dashboard-main">
        <header className="admin-topbar">
          <div className="admin-topbar-tabs">
            <Link
              className={`admin-topbar-link ${
                activeTab === "dashboard" ? "active" : ""
              }`}
              to="/admin/dashboard"
            >
              Dashboard
            </Link>
            <Link className="admin-topbar-link" to="/contests">
              Contests
            </Link>
            <Link
              className={`admin-topbar-link ${
                activeTab === "permissions" ? "active" : ""
              }`}
              to="/admin/permissions"
            >
              Permissions
            </Link>
          </div>

          <div className="admin-topbar-actions">
            <ThemeToggle />
            <button
              className="admin-icon-button"
              type="button"
              aria-label="Settings"
              onClick={() => navigate("/admin/settings")}
            >
              <span className="material-symbols-outlined">settings</span>
            </button>
            <button
              className="admin-avatar-button"
              type="button"
              aria-label="Admin profile"
              onClick={() => navigate("/admin/profile")}
            >
              <span className="material-symbols-outlined">account_circle</span>
            </button>
          </div>
        </header>

        <section className="admin-dashboard-content" id="dashboard">
          <div className="admin-page-header">
            <div>
              <p className="admin-section-kicker">Admin Console</p>
              <h1>{title}</h1>
              <p className="admin-page-description">{description}</p>
            </div>

            <div className="admin-header-metrics">
              {topMetrics.map((metric) => (
                <article
                  key={metric.label}
                  className={`admin-mini-stat ${metric.accent}`}
                >
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </article>
              ))}
            </div>
          </div>

          <section className="admin-panel" id="contests">
            <div className="admin-panel-toolbar">
              <label className="admin-searchbar" htmlFor="contest-search">
                <span className="material-symbols-outlined">search</span>
                <input
                  id="contest-search"
                  type="text"
                  placeholder="Search Contests By Title Or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </label>

              <div className="admin-toolbar-filters">
                <select
                  className="admin-filter-button"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">Status: All</option>
                  <option value="Live">Live</option>
                  <option value="Completed">Completed</option>
                  <option value="Draft">Draft</option>
                </select>

                <label
                  className="admin-filter-button admin-date-filter-button"
                  htmlFor="admin-contest-start-date"
                >
                  <span className="material-symbols-outlined">
                    calendar_month
                  </span>
                  <input
                    id="admin-contest-start-date"
                    type="date"
                    value={startDateInput}
                    onChange={(e) => setStartDateInput(e.target.value)}
                    aria-label="Filter by start date from"
                  />
                </label>

                <label
                  className="admin-filter-button admin-date-filter-button"
                  htmlFor="admin-contest-end-date"
                >
                  <span className="material-symbols-outlined">event_busy</span>
                  <input
                    id="admin-contest-end-date"
                    type="date"
                    value={endDateInput}
                    onChange={(e) => setEndDateInput(e.target.value)}
                    aria-label="Filter by start date until"
                  />
                </label>

                <button
                  type="button"
                  className="admin-filter-button admin-clear-filters"
                  onClick={clearFilters}
                  style={{
                    display:
                      searchQuery ||
                      startDateInput ||
                      endDateInput ||
                      statusFilter !== "All"
                        ? "flex"
                        : "none",
                  }}
                >
                  <span className="material-symbols-outlined">close</span>
                  Clear Filters
                </button>
              </div>
            </div>

            {actionMessage ? (
              <div className="admin-inline-banner admin-inline-banner--compact">
                <p className="admin-inline-feedback">{actionMessage}</p>
              </div>
            ) : null}

            <div className="admin-table-wrap">
              <table className="admin-contest-table">
                <thead>
                  <tr>
                    <th>Contest Details</th>
                    <th>Timeline (UTC)</th>
                    <th>Registrants</th>
                    <th>Status</th>
                    <th>Operations</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedContests.length > 0 ? (
                    paginatedContests.map((contest) => (
                      <tr key={contest.id}>
                        <td>
                          <div className="contest-primary-cell">
                            <a
                              href={`/contest/${contest.id}/`}
                              className="contest-link"
                            >
                              {contest.title}
                            </a>
                          </div>
                        </td>
                        <td>
                          <div className="contest-time-cell">
                            <div>
                              <span className="material-symbols-outlined">
                                schedule
                              </span>
                              <span>{contest.start}</span>
                            </div>
                            <span>Ends: {contest.end}</span>
                          </div>
                        </td>
                        <td>
                          <span className="contest-registrants">
                            {contest.registrants}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`contest-status-pill ${
                              statusClassMap[contest.status] || ""
                            }`}
                          >
                            {contest.status}
                          </span>
                        </td>
                        <td>
                          <div className="contest-actions">
                            <button
                              type="button"
                              aria-label={`Edit details for ${contest.title}`}
                              onClick={() =>
                                navigate(`/create?contest=${contest.id}`)
                              }
                              title="Edit contest details"
                            >
                              <span className="material-symbols-outlined">
                                tune
                              </span>
                            </button>
                            <button
                              type="button"
                              aria-label={`Edit problems for ${contest.title}`}
                              onClick={() =>
                                navigate(`/contest/${contest.id}/problems/edit`)
                              }
                              title="Edit contest problems"
                            >
                              <span className="material-symbols-outlined">
                                edit
                              </span>
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${contest.title}`}
                              className="danger"
                              onClick={() =>
                                handleDeleteContest(contest.id, contest.title)
                              }
                              disabled={deletingContestId === contest.id}
                              title={
                                deletingContestId === contest.id
                                  ? "Deleting contest"
                                  : "Delete contest"
                              }
                            >
                              <span className="material-symbols-outlined">
                                delete
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="admin-empty-state">
                        {emptyMessage ||
                          "No contests found matching your filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="admin-table-footer">
              <p>
                {filteredContests.length > 0
                  ? `Showing ${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(
                      currentPage * PAGE_SIZE,
                      filteredContests.length
                    )} of ${filteredContests.length} ${entryLabel}`
                  : "Showing 0 entries"}
              </p>
              <div className="admin-pagination">
                <button
                  type="button"
                  aria-label="Previous page"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  disabled={currentPage === 1}
                >
                  <span className="material-symbols-outlined">
                    chevron_left
                  </span>
                </button>
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1
                ).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={page === currentPage ? "active" : ""}
                    aria-current={page === currentPage ? "page" : undefined}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Next page"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  <span className="material-symbols-outlined">
                    chevron_right
                  </span>
                </button>
              </div>
            </div>
          </section>

          <section className="admin-insights-grid">
            {insightCards.map((card) => (
              <article
                key={card.eyebrow}
                className={`admin-insight-card ${card.accent}`}
              >
                <div className="admin-insight-icon">
                  <span className="material-symbols-outlined">{card.icon}</span>
                </div>
                <div>
                  <p>{card.eyebrow}</p>
                  <h2>{card.value}</h2>
                  <span>{card.caption}</span>
                </div>
              </article>
            ))}
          </section>
        </section>
      </main>
    </div>
  );
}

export default AdminContestListTemplate;
