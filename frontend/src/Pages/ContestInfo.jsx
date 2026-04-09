import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import "../Styles/contest_info.css";

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

  useEffect(() => {
    const fetchContestInfo = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await axios.get(
          `http://127.0.0.1:8000/contests/${contestId}/details`
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
      <div className="app-container">
        <div className="main-layout">
          <div className="card">
            <p>Loading contest details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <div className="main-layout">
          <div className="card">
            <h2 className="section-title">Contest Details</h2>
            <p className="text-danger">{error}</p>
            <Link to="/contests" className="btn btn-outline">
              Back to Contests
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const contestInfo = data?.contest || {};
  const problems = Array.isArray(data?.problems) ? data.problems : [];
  const contestStatus = getContestStatus(contestInfo.start_time, contestInfo.end_time);
  const isLive = contestStatus === "Live";
  const primaryCtaLabel =
    contestStatus === "Upcoming"
      ? "Register for Contest"
      : contestStatus === "Live"
        ? "Enter Contest"
        : "View Results";

  return (
    <div className="app-container">
      <div className="main-layout">
        <aside>
          <nav className="sidebar-nav">
            <Link to="/contests" className="nav-item">
              <span>←</span>
              <span>All Contests</span>
            </Link>
            <a href="#overview" className="nav-item active">
              <span>•</span>
              <span>Overview</span>
            </a>
            <a href="#problems" className="nav-item">
              <span>•</span>
              <span>Problems</span>
            </a>
            <a href="#schedule" className="nav-item">
              <span>•</span>
              <span>Schedule</span>
            </a>
          </nav>
        </aside>

        <main className="card" id="overview">
          <section className="hero-section">
            <div className="badges">
              <span className={`badge ${isLive ? "success" : ""}`}>
                {isLive ? "Live Competition" : contestStatus}
              </span>
              <span className="badge">
                {contestInfo.visibility || "Public"}
              </span>
            </div>

            <h1 className="hero-title">{contestInfo.title || "Untitled Contest"}</h1>
            <p className="hero-subtitle">
              {contestInfo.description || "Contest description is not available yet."}
            </p>
          </section>

          <section>
            <h2 className="section-title">Contest Brief</h2>
            <p>
              {contestInfo.description ||
                "This contest currently has no published brief. Check back closer to the start time."}
            </p>
          </section>

          <section id="schedule">
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

          <section id="problems">
            <h2 className="section-title">Problem Set</h2>
            {problems.length === 0 ? (
              <div className="pillar-box">
                <p>No problems have been attached to this contest yet.</p>
              </div>
            ) : (
              <div>
                {problems.map((problem, index) => {
                  const difficulty = normalizeDifficulty(problem.difficulty);

                  return (
                    <div className="list-row" key={problem.problem_id || index}>
                      <div>
                        <p>{problem.title || `Problem ${index + 1}`}</p>
                        <p className="mono" style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
                          Score: {problem.max_score ?? "N/A"} | Time: {problem.time_limit_ms ?? "N/A"} ms | Memory: {problem.memory_limit_kb ?? "N/A"} KB
                        </p>
                      </div>
                      <span className={`mono ${difficulty.className}`}>
                        {difficulty.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <aside>
          <div className="card">
            <div className="status-header">
              <p className="mono" style={{ color: "var(--text-secondary)", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>
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

            <div>
              <div className="stat-row">
                <span className="stat-label">Contest ID</span>
                <span className="mono">{contestInfo.contest_id || contestId}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Problem Count</span>
                <span>{problems.length}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Visibility</span>
                <span>{contestInfo.visibility || "Public"}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Created By</span>
                <span className="mono">{contestInfo.created_by || "Unknown"}</span>
              </div>
            </div>

            <button className="btn btn-primary" type="button">
              {primaryCtaLabel}
            </button>

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
