import { useEffect, useState } from "react";
import axios from "axios";
import SidebarAdminDashboard from "./SidebarAdminDashboard";
import ErrorPage from "../Pages/ErrorPage";
import LoadingPage from "../Pages/LoadingPage";
import "../Styles/admin_dashboard.css";

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
    value: "WORLD_FINALS_2024",
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
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "Draft";
  }

  if (now < start) {
    return "Draft";
  }

  if (now > end) {
    return "Completed";
  }

  return "Live";
};

function AdminContestListTemplate({
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contests, setContests] = useState([]);

  const fetchContests = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get(fetchUrl, { withCredentials: true });
      console.log(response)
      setContests(Array.isArray(response.data) ? response.data : []);
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
  };

  useEffect(() => {
    fetchContests();
  }, [fetchUrl]);

  if (loading) {
    return (
      <LoadingPage
        title={loadingTitle}
        subtitle={loadingSubtitle}
      />
    );
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
      registrants: typeof registrantsValue === "number"
        ? registrantsValue.toLocaleString("en-IN")
        : String(registrantsValue),
      status: getContestStatus(contest.start_time, contest.end_time, contest.visibility),
    };
  });

  return (
    <div className="admin-dashboard-page">
      <SidebarAdminDashboard />

      <main className="admin-dashboard-main">
        <header className="admin-topbar">
          <div className="admin-topbar-tabs">
            <a className="admin-topbar-link active" href="#dashboard">Dashboard</a>
            <a className="admin-topbar-link" href="#contests">Contests</a>
            <a className="admin-topbar-link" href="#problems">Problems</a>
            <a className="admin-topbar-link" href="#users">Users</a>
            <a className="admin-topbar-link" href="#system">System</a>
          </div>

          <div className="admin-topbar-actions">
            <button className="admin-icon-button" type="button" aria-label="Notifications">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="admin-icon-button" type="button" aria-label="Settings">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <button className="admin-avatar-button" type="button" aria-label="Admin profile">
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
                <article key={metric.label} className={`admin-mini-stat ${metric.accent}`}>
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
                  placeholder="SEARCH_CONTESTS_BY_TITLE_OR_ID..."
                />
              </label>

              <div className="admin-toolbar-filters">
                <button className="admin-filter-button" type="button">
                  <span>Status: All</span>
                  <span className="material-symbols-outlined">expand_more</span>
                </button>
                <button className="admin-filter-button" type="button">
                  <span className="material-symbols-outlined">calendar_month</span>
                  <span>Date Range</span>
                </button>
                <button className="admin-filter-icon" type="button" aria-label="Advanced filters">
                  <span className="material-symbols-outlined">filter_alt</span>
                </button>
              </div>
            </div>

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
                  {normalizedContests.length > 0 ? (
                    normalizedContests.map((contest) => (
                      <tr key={contest.id}>
                        <td>
                          <div className="contest-primary-cell">
                            <a href={`/contest/${contest.id}/`} className="contest-link">
                              {contest.title}
                            </a>
                            <span>ID: {contest.id}</span>
                          </div>
                        </td>
                        <td>
                          <div className="contest-time-cell">
                            <div>
                              <span className="material-symbols-outlined">schedule</span>
                              <span>{contest.start}</span>
                            </div>
                            <span>Ends: {contest.end}</span>
                          </div>
                        </td>
                        <td>
                          <span className="contest-registrants">{contest.registrants}</span>
                        </td>
                        <td>
                          <span className={`contest-status-pill ${statusClassMap[contest.status] || ""}`}>
                            {contest.status}
                          </span>
                        </td>
                        <td>
                          <div className="contest-actions">
                            <button type="button" aria-label={`Analytics for ${contest.title}`}>
                              <span className="material-symbols-outlined">monitoring</span>
                            </button>
                            <button type="button" aria-label={`Edit ${contest.title}`}>
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button type="button" aria-label={`Clone ${contest.title}`}>
                              <span className="material-symbols-outlined">content_copy</span>
                            </button>
                            <button type="button" aria-label={`Delete ${contest.title}`} className="danger">
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="admin-empty-state">
                        {emptyMessage}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="admin-table-footer">
              <p>
                {normalizedContests.length > 0
                  ? `Showing 1-${normalizedContests.length} of ${normalizedContests.length} ${entryLabel}`
                  : "Showing 0 entries"}
              </p>
              <div className="admin-pagination">
                <button type="button" aria-label="Previous page">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button type="button" className="active" aria-current="page">1</button>
                <button type="button">2</button>
                <button type="button">3</button>
                <button type="button" aria-label="Next page">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </section>

          <section className="admin-insights-grid">
            {insightCards.map((card) => (
              <article key={card.eyebrow} className={`admin-insight-card ${card.accent}`}>
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
