import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import LoadingPage from "./LoadingPage";
import "../Styles/contest_info.css";
import ErrorPage from "./ErrorPage";
import { getStoredAuthUser } from "../Utils/auth_storage";
import { API_BASE_URL } from "../Utils/api";
import { formatDisplayText } from "../Utils/format_display_text";

const formatDateTime = (value) => {
  if (!value) {
    return "TBA";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Not available";
  }

  const diffInMinutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(diffInMinutes / 60);
  const minutes = diffInMinutes % 60;

  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  return `${minutes}m`;
};

const getContestStatus = (startTime, endTime) => {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Unknown";
  }

  if (now < start) {
    return "Upcoming";
  }

  if (now > end) {
    return "Ended";
  }

  return "Live";
};

const formatCountdown = (targetTime) => {
  const target = new Date(targetTime);

  if (Number.isNaN(target.getTime())) {
    return "Time unavailable";
  }

  const diff = target.getTime() - Date.now();
  if (diff <= 0) {
    return "00:00:00";
  }

  const hours = String(Math.floor(diff / 3600000)).padStart(2, "0");
  const minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
  const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
};

const normalizeDifficulty = (difficulty) => {
  const value = String(difficulty || "Unknown").trim();
  const lowerValue = value.toLowerCase();

  if (lowerValue === "easy") {
    return { label: "Easy", className: "text-success" };
  }

  if (lowerValue === "medium") {
    return { label: "Medium", className: "text-accent" };
  }

  if (lowerValue === "hard") {
    return { label: "Hard", className: "text-danger" };
  }

  return { label: value, className: "" };
};

function ContestPage() {
  const { contestId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState("");
  const [authUser, setAuthUser] = useState(() => getStoredAuthUser());

  useEffect(() => {
    const fetchContestInfo = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await axios.get(
          `${API_BASE_URL}/contests/${contestId}/details`
        );

        const payload = response.data?.data;

        if (!payload?.contest) {
          throw new Error(response.data?.message || "Contest data not found.");
        }

        setData(payload);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            "Unable to load contest details."
        );
      } finally {
        setLoading(false);
      }
    };

    if (contestId) {
      fetchContestInfo();
    }
  }, [contestId]);

  useEffect(() => {
    const syncAuthUser = () => setAuthUser(getStoredAuthUser());
    window.addEventListener("storage", syncAuthUser);
    return () => window.removeEventListener("storage", syncAuthUser);
  }, []);

  useEffect(() => {
    if (!data?.contest) {
      return undefined;
    }

    const { start_time: startTime, end_time: endTime } = data.contest;
    const status = getContestStatus(startTime, endTime);
    const targetTime = status === "Upcoming" ? startTime : endTime;

    const updateCountdown = () => {
      setCountdown(formatCountdown(targetTime));
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(timer);
  }, [data]);

  if (loading) {
    return (
      <LoadingPage
        title="Loading contest details"
        subtitle="Syncing schedule, scoring rules, and problem metadata before the round opens."
      />
    );
  }

  if (error) {
    return (
       <ErrorPage/>
    );
  }

  const contestInfo = data?.contest || {};
  const problems = Array.isArray(data?.problems) ? data.problems : [];
  const contestStatus = getContestStatus(contestInfo.start_time, contestInfo.end_time);
  const isLive = contestStatus === "Live";
  const canManageProblems = Boolean(authUser && ["problem_setter", "admin"].includes(authUser.role));
  const primaryCtaLabel =
    contestStatus === "Upcoming"
      ? "Register for Contest"
      : contestStatus === "Live"
        ? "Enter Contest"
        : "View Results";

  const handleRegister= async () => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/contests/${contestId}/register`,
        {},
        { withCredentials: true }
      );

      console.log(response.data);
    }
    catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  return (
    <div className="app-container">
      <div className="main-layout">
        <aside className="layout-rail">
          <nav className="sidebar-nav">
            <Link to="/contests" className="nav-item nav-item-back">
              <span className="nav-item-icon">←</span>
              <span>All Contests</span>
            </Link>
            <a href="#overview" className="nav-item active">
              <span className="nav-item-icon">01</span>
              <span>Overview</span>
            </a>
            <a href="#problems" className="nav-item">
              <span className="nav-item-icon">02</span>
              <span>Problems</span>
            </a>
            <a href="#schedule" className="nav-item">
              <span className="nav-item-icon">03</span>
              <span>Schedule</span>
            </a>
          </nav>
        </aside>

        <main className="card contest-shell" id="overview">
          <section className="hero-section">
            <div className="hero-copy">
              <div className="badges">
                <span className={`badge ${isLive ? "success" : ""}`}>
                  {isLive ? "Live Competition" : contestStatus}
                </span>
                <span className="badge badge-muted">
                  {formatDisplayText(contestInfo.visibility || "Public")}
                </span>
              </div>

              <h1 className="hero-title">{formatDisplayText(contestInfo.title || "Untitled Contest")}</h1>
            
            </div>

    
          </section>

          <section className="content-section">
            <h2 className="section-title">Contest Brief</h2>
            <div className="markdown-body">
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                {contestInfo.description ||
                  "This contest currently has no published brief. Check back closer to the start time."}
              </ReactMarkdown>
            </div>
          </section>

          <section className="content-section" id="schedule">
            <h2 className="section-title">Schedule</h2>
            <div className="grid-2-col">
              <div className="pillar-box">
                <p className="pillar-title">Starts</p>
                <p>{formatDateTime(contestInfo.start_time)}</p>
              </div>
              <div className="pillar-box">
                <p className="pillar-title">Ends</p>
                <p>{formatDateTime(contestInfo.end_time)}</p>
              </div>
              <div className="pillar-box">
                <p className="pillar-title">Duration</p>
                <p>{formatDuration(contestInfo.start_time, contestInfo.end_time)}</p>
              </div>
              <div className="pillar-box">
                <p className="pillar-title">Created</p>
                <p>{formatDateTime(contestInfo.created_at)}</p>
              </div>
            </div>
          </section>

          <section className="content-section" id="problems">
            <h2 className="section-title">Problem Set</h2>
            {problems.length === 0 ? (
              <div className="pillar-box">
                <p>No problems have been attached to this contest yet.</p>
              </div>
            ) : (
              <div>
                {problems.map((problem, index) => {
                  const difficulty = normalizeDifficulty(problem.difficulty);
                  const solveLocked = contestStatus === "Upcoming";

                  return (
                    <div className="list-row" key={problem.problem_id || index}>
                      <div>
                        <p className="problem-title">{formatDisplayText(problem.title || `Problem ${index + 1}`)}</p>
                        <p className="mono problem-meta">
                          Score: {problem.max_score ?? "N/A"} | Time: {problem.time_limit_ms ?? "N/A"} ms | Memory: {problem.memory_limit_kb ?? "N/A"} KB
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span className={`difficulty-pill ${difficulty.className}`}>
                          {difficulty.label}
                        </span>
                        {solveLocked ? (
                          <span
                            className="btn btn-outline"
                            aria-disabled="true"
                            title="Problem solving unlocks when the contest starts."
                            style={{ opacity: 0.55, cursor: "not-allowed", pointerEvents: "none" }}
                          >
                            Solve
                          </span>
                        ) : (
                          <Link className="btn btn-outline" to={`/contest/${contestId}/problems/${problem.problem_id}`}>
                            Solve
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <aside className="layout-rail">
          <div className="card status-card">
            <div className="status-header">
              <p className="eyebrow">
                Contest Status
              </p>
              <h2 className="status-title">
                {contestStatus === "Upcoming" ? "Registration Open" : contestStatus}
              </h2>
              <p className="status-timer">
                {contestStatus === "Ended"
                  ? "Contest finished"
                  : `${contestStatus === "Upcoming" ? "Starts in " : "Ends in "}${countdown}`}
              </p>
            </div>

            <div className="stats-panel">
              
              <div className="stat-row">
                <span className="stat-label">Problem Count</span>
                <span>{problems.length}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Visibility</span>
                <span>{formatDisplayText(contestInfo.visibility || "Public")}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Created By</span>
                <span className="mono">{contestInfo.created_by || "Unknown"}</span>
              </div>
            </div>

            <button className="btn btn-primary" type="button" onClick={handleRegister}>
              {primaryCtaLabel}
            </button>

            {canManageProblems ? (
              <Link to={`/contest/${contestId}/problems/edit`} className="btn btn-outline">
                Manage Problems
              </Link>
            ) : null}

            <Link to="/contests" className="btn btn-outline">
              Back to Contest List
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default ContestPage;
