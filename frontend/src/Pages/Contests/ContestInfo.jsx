import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { motion, AnimatePresence } from "motion/react";
import LoadingPage from "../Auth_and_Profile/LoadingPage";
import "../../Styles/contest_info.css";
import ErrorPage from "../Auth_and_Profile/ErrorPage";
import { getStoredAuthUser } from "../../Utils/auth_storage";
import { API_BASE_URL } from "../../Utils/api";
import { fetchSessionUser } from "../../Utils/session_auth";
import { formatDisplayText } from "../../Utils/format_display_text";

// ── helpers (unchanged) ──────────────────────────────────────
const formatDateTime = (value) => {
  if (!value) return "TBA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const formatDuration = (startTime, endTime) => {
  const start = new Date(startTime); const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Not available";
  const diffInMinutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(diffInMinutes / 60); const minutes = diffInMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
};

const getContestStatus = (startTime, endTime) => {
  const now = new Date(); const start = new Date(startTime); const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Unknown";
  if (now < start) return "Upcoming";
  if (now > end) return "Ended";
  return "Live";
};

const formatCountdown = (targetTime) => {
  const target = new Date(targetTime);
  if (Number.isNaN(target.getTime())) return "Time unavailable";
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return "00:00:00";
  const hours = String(Math.floor(diff / 3600000)).padStart(2, "0");
  const minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
  const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const normalizeDifficulty = (difficulty) => {
  const value = String(difficulty || "Unknown").trim();
  const lowerValue = value.toLowerCase();
  if (lowerValue === "easy") return { label: "Easy", className: "text-success" };
  if (lowerValue === "medium") return { label: "Medium", className: "text-accent" };
  if (lowerValue === "hard") return { label: "Hard", className: "text-danger" };
  return { label: value, className: "" };
};

// ── animation variants ───────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

const stagger = (delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: delay } },
});

// ── component ────────────────────────────────────────────────
function ContestPage() {
  const { contestId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
  const location = useLocation();

  useEffect(() => {
    const fetchContestInfo = async () => {
      try {
        setLoading(true); setError(""); setErrorStatus(null);
        const contestResponse = await axios.get(`${API_BASE_URL}/contests/${contestId}/details/`, { withCredentials: true });
        const payload = contestResponse.data?.data;
        if (!payload?.contest) throw new Error(contestResponse.data?.message || "Contest data not found.");
        setData(payload);
      } catch (err) {
        setData(null);
        setError(err.response?.data?.message || err.response?.data?.error || err.message || "Unable to load contest details.");
        setErrorStatus(err.response?.status ?? null);
      } finally { setLoading(false); }
    };
    if (contestId) fetchContestInfo();
  }, [contestId, location.key]);

  useEffect(() => {
    let isMounted = true;
    const syncSessionUser = async () => {
      try {
        const user = await fetchSessionUser();
        if (isMounted) {
          setAuthUser(user);
        }
      } catch {
        if (isMounted) {
          setAuthUser(getStoredAuthUser());
        }
      }
    };
    syncSessionUser();
    const syncAuthUser = () => setAuthUser(getStoredAuthUser());
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncSessionUser();
      }
    };
    window.addEventListener("storage", syncAuthUser);
    window.addEventListener("pageshow", syncSessionUser);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", syncAuthUser);
      window.removeEventListener("pageshow", syncSessionUser);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!data?.contest) return undefined;
    const { start_time: startTime, end_time: endTime } = data.contest;
    const status = getContestStatus(startTime, endTime);
    const targetTime = status === "Upcoming" ? startTime : endTime;
    const updateCountdown = () => setCountdown(formatCountdown(targetTime));
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [data]);

  if (loading) return <LoadingPage title="Loading contest details" subtitle="Syncing schedule, scoring rules, and problem metadata before the round opens." />;

  if (error) {
    const isRunningContest = errorStatus === 403 || /contest is running/i.test(error);
    return <ErrorPage kicker={isRunningContest ? "Contest Locked" : "Contest Error"} code={isRunningContest ? "403" : "404"} title={isRunningContest ? "Contest is running" : "Contest Not Found"} copy={error} primaryAction={{ to: "/contests", label: "Back to Contests" }} />;
  }

  const contestInfo = data?.contest || {};
  const problems = Array.isArray(data?.problems) ? data.problems : [];
  const contestStatus = getContestStatus(contestInfo.start_time, contestInfo.end_time);
  const isLive = contestStatus === "Live";
  const isUpcoming = contestStatus === "Upcoming";
  const isPrivilegedUser = Boolean(authUser && ["problem_setter", "admin"].includes(authUser.role));
  const canManageProblems = Boolean(authUser && ["problem_setter", "admin"].includes(authUser.role));
  const createdByLabel = contestInfo.created_by_username || "Unknown";

  const getActionButton = () => {
    const btnProps = { whileHover: { scale: 1.02, y: -1 }, whileTap: { scale: 0.97 }, transition: { type: "spring", stiffness: 360, damping: 18 } };
    if (contestInfo.is_registered) {
      const firstProblemId = problems.length > 0 ? problems[0].problem_id : null;
      if (isLive && firstProblemId) return <motion.div {...btnProps}><Link to={`/contest/${contestId}/problems/${firstProblemId}`} className="btn btn-primary">Enter Contest</Link></motion.div>;
      return <motion.div {...btnProps}><button className="btn btn-primary success" disabled>Registration Completed</button></motion.div>;
    }
    if (isPrivilegedUser) {
      const firstProblemId = problems.length > 0 ? problems[0].problem_id : null;
      if (isLive && firstProblemId) return <motion.div {...btnProps}><Link to={`/contest/${contestId}/problems/${firstProblemId}`} className="btn btn-primary">Enter Contest</Link></motion.div>;
      return <motion.div {...btnProps}><button className="btn btn-primary success" disabled>Access Granted</button></motion.div>;
    }
    if (!authUser) return <motion.div {...btnProps}><Link to="/login" className="btn btn-primary">Login to Register</Link></motion.div>;
    if (isUpcoming) return <motion.div {...btnProps}><Link to={`/contest/${contestId}/register`} className="btn btn-primary">Register for Contest</Link></motion.div>;
    if (isLive) return <span className="btn btn-primary opacity-60 cursor-not-allowed">Registration Closed</span>;
    return <span className="btn btn-primary opacity-60 cursor-not-allowed">Contest Ended</span>;
  };

  return (
    <div className="app-container">
      <div className="main-layout">

        {/* ── Left sidebar nav ── */}
        <motion.aside
          className="layout-rail"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <nav className="sidebar-nav">
            {[
              { to: "/contests", icon: "←", label: "All Contests", className: "nav-item nav-item-back" },
              { href: "#overview", num: "01", label: "Overview", className: "nav-item active" },
              { href: "#problems", num: "02", label: "Problems", className: "nav-item" },
              { href: "#schedule", num: "03", label: "Schedule", className: "nav-item" },
              { to: `/contest/${contestId}/leaderboard`, icon: "🏆", label: "Standings", className: "nav-item" },
            ].map((item, i) =>
              item.to ? (
                <motion.div key={item.label} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07, duration: 0.35 }}>
                  <Link to={item.to} className={item.className}><span className="nav-item-icon">{item.icon}</span><span>{item.label}</span></Link>
                </motion.div>
              ) : (
                <motion.div key={item.label} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07, duration: 0.35 }}>
                  <a href={item.href} className={item.className}><span className="nav-item-icon">{item.num}</span><span>{item.label}</span></a>
                </motion.div>
              )
            )}
          </nav>
        </motion.aside>

        {/* ── Main content ── */}
        <motion.main
          className="card contest-shell"
          id="overview"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Hero */}
          <motion.section
            className="hero-section"
            variants={stagger(0.1)}
            initial="hidden"
            animate="show"
          >
            <div className="hero-copy">
              <motion.div className="badges" variants={fadeUp} transition={{ duration: 0.35 }}>
                <span className={`badge ${isLive ? "success" : ""}`}>{isLive ? "Live Competition" : contestStatus}</span>
                <span className="badge badge-muted">{formatDisplayText(contestInfo.visibility || "Public")}</span>
              </motion.div>
              <motion.h1 className="hero-title" variants={fadeUp} transition={{ duration: 0.42 }}>
                {formatDisplayText(contestInfo.title || "Untitled Contest")}
              </motion.h1>
            </div>
          </motion.section>

          {/* Brief */}
          <motion.section className="content-section" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.4 }}>
            <h2 className="section-title">Contest Brief</h2>
            <div className="markdown-body">
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                {contestInfo.description || "This contest currently has no published brief. Check back closer to the start time."}
              </ReactMarkdown>
            </div>
          </motion.section>

          {/* Schedule pillars stagger in on scroll */}
          <motion.section
            className="content-section"
            id="schedule"
            variants={stagger(0)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            <motion.h2 className="section-title" variants={fadeUp} transition={{ duration: 0.35 }}>Schedule</motion.h2>
            <div className="grid-2-col">
              {[
                { title: "Starts", value: formatDateTime(contestInfo.start_time) },
                { title: "Ends", value: formatDateTime(contestInfo.end_time) },
                { title: "Duration", value: formatDuration(contestInfo.start_time, contestInfo.end_time) },
                { title: "Created", value: formatDateTime(contestInfo.created_at) },
              ].map(({ title, value }) => (
                <motion.div className="pillar-box" key={title} variants={fadeUp} transition={{ duration: 0.38 }}>
                  <p className="pillar-title">{title}</p>
                  <p>{value}</p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Problem rows stagger in on scroll */}
          <motion.section
            className="content-section"
            id="problems"
            variants={stagger(0)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
          >
            <motion.h2 className="section-title" variants={fadeUp} transition={{ duration: 0.35 }}>Problem Set</motion.h2>
            {problems.length === 0 ? (
              <motion.div className="pillar-box" variants={fadeUp}>
                <p>No problems have been attached to this contest yet.</p>
              </motion.div>
            ) : (
              <div>
                {problems.map((problem, index) => {
                  const difficulty = normalizeDifficulty(problem.difficulty);
                  const solveLocked = contestStatus === "Upcoming";
                  return (
                    <motion.div
                      className="list-row"
                      key={problem.problem_id || index}
                      variants={fadeUp}
                      transition={{ duration: 0.36 }}
                      whileHover={{ x: 4, transition: { duration: 0.18 } }}
                    >
                      <div>
                        <p className="problem-title">{formatDisplayText(problem.title || `Problem ${index + 1}`)}</p>
                        <p className="mono problem-meta">
                          Max Score: {problem.max_score ?? "N/A"} | Time: {problem.time_limit_ms ?? "N/A"} ms | Memory: {problem.memory_limit_kb ?? "N/A"} KB
                        </p>
                        <p className="mono problem-meta" style={{ marginTop: "0.4rem", color: "var(--color-primary, #6bfe9c)", fontWeight: 600 }}>
                          Your Score: {problem.user_score ?? 0} / {problem.max_score ?? "N/A"}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span className={`difficulty-pill ${difficulty.className}`}>{difficulty.label}</span>
                        {solveLocked ? (
                          <span className="btn btn-outline" aria-disabled="true" style={{ opacity: 0.55, cursor: "not-allowed", pointerEvents: "none" }}>Solve</span>
                        ) : (
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 380, damping: 18 }}>
                            <Link className="btn btn-outline" to={`/contest/${contestId}/problems/${problem.problem_id}`}>Solve</Link>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.section>
        </motion.main>

        {/* ── Right status card ── */}
        <motion.aside
          className="layout-rail"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.18, ease: "easeOut" }}
        >
          <div className="card status-card">
            <div className="status-header">
              <p className="eyebrow">Contest Status</p>
              <h2 className="status-title">{contestStatus === "Upcoming" ? "Registration Open" : contestStatus}</h2>
              <p className="status-timer">
                {contestStatus === "Ended" ? "Contest finished" : `${contestStatus === "Upcoming" ? "Starts in " : "Ends in "}${countdown}`}
              </p>
            </div>

            <div className="stats-panel">
              {[
                { label: "Current Total Score", value: contestInfo.user_total_score ?? 0, mono: true },
                { label: "Problem Count", value: problems.length },
                { label: "Visibility", value: formatDisplayText(contestInfo.visibility || "Public") },
                { label: "Created By", value: createdByLabel, mono: true },
              ].map(({ label, value, mono }, i) => (
                <motion.div
                  className="stat-row"
                  key={label}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.08, duration: 0.35 }}
                >
                  <span className="stat-label">{label}</span>
                  <span className={mono ? "mono" : ""}>{value}</span>
                </motion.div>
              ))}
            </div>

            {getActionButton()}

            {canManageProblems ? (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 360, damping: 18 }}>
                <Link to={`/contest/${contestId}/problems/edit`} className="btn btn-outline">Manage Problems</Link>
              </motion.div>
            ) : null}

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 360, damping: 18 }}>
              <Link to="/contests" className="btn btn-outline">Back to Contest List</Link>
            </motion.div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}

export default ContestPage;
