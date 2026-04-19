import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { motion, AnimatePresence } from "motion/react";
import { API_BASE_URL } from "../../Utils/api";
import { getStoredAuthUser } from "../../Utils/auth_storage";
import { fetchSessionUser } from "../../Utils/session_auth";
import ArenaNavbar from "../../Components/ArenaNavbar";
import LoadingPage from "../Auth_and_Profile/LoadingPage";
import ErrorPage from "../Auth_and_Profile/ErrorPage";
import "../../Styles/contest_editorial.css";

// ── IMPORT HELPERS ───────────────────────────────────────────────────────────
import { 
  normalizeDifficulty, 
  formatDate, 
  formatRemaining, 
  parseSafeUTCDate 
} from "../../Utils/editorial_helper";


// ── COMPONENT ────────────────────────────────────────────────────────────────
function ContestEditorialPage() {
  const { contestId, problemId } = useParams();
  const navigate = useNavigate();

  const [authUser,   setAuthUser]  = useState(() => getStoredAuthUser());
  const [problem,    setProblem]   = useState(null);
  const [contest,    setContest]   = useState(null);
  const [editorial,  setEditorial] = useState(null);
  const [loading,    setLoading]   = useState(true);
  const [error,      setError]     = useState("");
  const [remaining,  setRemaining] = useState(0);

  const isPrivileged = Boolean(
    authUser && ["problem_setter", "admin"].includes(authUser.role)
  );

  // contest ended if end_time is in the past (privileged users bypass this)
  const contestEnded = contest
    ? parseSafeUTCDate(contest.end_time).getTime() <= Date.now()
    : false;
  const canView = isPrivileged || contestEnded;

  // ── sync session user ──────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const sync = async () => {
      try {
        const user = await fetchSessionUser();
        if (mounted) setAuthUser(user);
      } catch {
        if (mounted) setAuthUser(getStoredAuthUser());
      }
    };
    sync();
    const onVisibility = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { mounted = false; document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  // ── fetch problem info + editorial ─────────────────────────────────────────
  useEffect(() => {
    if (!contestId || !problemId) return;
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true); setError("");

        const contestRes = await axios.get(
          `${API_BASE_URL}/contests/${contestId}/details/`,
          { withCredentials: true, signal: controller.signal }
        );
        const contestData = contestRes.data?.data?.contest || null;
        const problems    = contestRes.data?.data?.problems || [];
        const found       = problems.find((p) => String(p.problem_id) === String(problemId));

        setContest(contestData);
        setProblem(found || null);

        // Check if contest has ended (frontend guard — backend also enforces this)
        const endMs = contestData ? parseSafeUTCDate(contestData.end_time).getTime() : NaN;
        const ended = !isNaN(endMs) && endMs <= Date.now();
        const privUser = Boolean(authUser && ["problem_setter", "admin"].includes(authUser.role));

        console.log("[Editorial] end_time=", contestData?.end_time, "| ended=", ended, "| privUser=", privUser);

        if (ended || privUser) {
          try {
            const editRes = await axios.get(
              `${API_BASE_URL}/contests/editorial/${problemId}/`,
              { withCredentials: true, signal: controller.signal }
            );
            setEditorial(editRes.data?.editorial || null);
          } catch (editErr) {
            if (editErr.name !== "CanceledError" && editErr.name !== "AbortError") {
              if (editErr.response?.status !== 404 && editErr.response?.status !== 403) {
                setError(editErr.response?.data?.error || "Failed to load editorial.");
              }
              setEditorial(null);
            }
          }
        }
      } catch (err) {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          setError(err.response?.data?.error || err.message || "Failed to load page.");
        }
      } finally {
        // Only clear loading if this request wasn't cancelled by React cleanup.
        // The live (second) mount will handle setLoading(false) itself.
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => controller.abort();
  }, [contestId, problemId]); // ← no isPrivileged dep: authUser is read directly inside load()

  // ── live countdown ticker (only while contest is still running) ────────────
  useEffect(() => {
    if (!contest?.end_time || isPrivileged) return;
    const endMs = parseSafeUTCDate(contest.end_time).getTime();

    // Contest already ended — no need for a ticker, don't reload
    if (endMs <= Date.now()) return;

    const tick = () => {
      const diff = endMs - Date.now();
      setRemaining(Math.max(0, diff));
      if (diff <= 0) {
        window.location.reload();
      }
    };
    
    // Initial run
    tick();

    // Only set up interval if we didn't just reload
    if (endMs > Date.now()) {
      const timer = setInterval(tick, 1000);
      return () => clearInterval(timer);
    }
  }, [contest, isPrivileged]);


  // ── nav links ──────────────────────────────────────────────────────────────
  const navLinks = [
    { label: "Overview",       to: `/contest/${contestId}/`,            active: false },
    { label: "Leaderboard",    to: `/contest/${contestId}/leaderboard`, active: false },
    { label: "My Submissions", to: "/submissions",                      active: false },
  ];

  // ── render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <LoadingPage
      title="Loading Editorial"
      subtitle="Fetching problem details and editorial content..."
    />
  );

  if (error) return (
    <ErrorPage
      kicker="Editorial Error"
      code="500"
      title="Could not load editorial"
      copy={error}
      primaryAction={{ to: `/contest/${contestId}/`, label: "Back to Contest" }}
    />
  );

  if (!canView) return (
    <div className="editorial-page">
      <ArenaNavbar navLinks={navLinks} authUser={authUser} />
      <main className="editorial-shell">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="editorial-empty" style={{ minHeight: 380, gap: "1.25rem" }}>
            <span className="material-symbols-outlined editorial-empty__icon" style={{ fontSize: "3rem", opacity: 0.5 }}>
              lock
            </span>
            <p className="editorial-empty__title">Editorial Locked</p>
            <p className="editorial-empty__sub">
              Editorials are unlocked once the contest ends. Come back when it&apos;s over!
            </p>
            {remaining > 0 && (
              <motion.div
                key={Math.floor(remaining / 1000)}
                initial={{ opacity: 0.6, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  color: "var(--color-primary)",
                  letterSpacing: "0.06em",
                }}
              >
                {formatRemaining(remaining)}
              </motion.div>
            )}
            <Link to={`/contest/${contestId}/`} className="editorial-edit-btn" style={{ marginTop: "0.5rem" }}>
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Contest
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );

  return (
    <div className="editorial-page">
      <ArenaNavbar navLinks={navLinks} authUser={authUser} />

      <main className="editorial-shell">

        {/* ── Breadcrumb ── */}
        <motion.nav
          className="editorial-breadcrumb"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          aria-label="breadcrumb"
        >
          <Link to="/contests">Contests</Link>
          <span className="sep">/</span>
          <Link to={`/contest/${contestId}/`}>Contest</Link>
          <span className="sep">/</span>
          {problem
            ? <Link to={`/contest/${contestId}/problems/${problemId}`}>{problem.title}</Link>
            : <span>Problem</span>
          }
          <span className="sep">/</span>
          <span>Editorial</span>
        </motion.nav>

        {/* ── Header ── */}
        <motion.div
          className="editorial-header"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.05 }}
        >
          <div className="editorial-header__left">
            <p className="editorial-kicker">Editorial</p>
            <h1 className="editorial-title">
              {problem ? problem.title : "Problem"} — Solution
            </h1>
            <div className="editorial-meta">
              {problem?.difficulty && (
                <span className={`editorial-difficulty-pill ${normalizeDifficulty(problem.difficulty)}`}>
                  {problem.difficulty}
                </span>
              )}
              {editorial?.created_at && (
                <>
                  <span className="editorial-meta__dot" />
                  <span>Published {formatDate(editorial.created_at)}</span>
                </>
              )}
              {editorial?.updated_at && editorial.updated_at !== editorial.created_at && (
                <>
                  <span className="editorial-meta__dot" />
                  <span>Updated {formatDate(editorial.updated_at)}</span>
                </>
              )}
            </div>
          </div>

          <AnimatePresence>
            {isPrivileged && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <Link to={`/contest/${contestId}/problems/${problemId}/editorial/edit`} className="editorial-edit-btn">
                  <span className="material-symbols-outlined">edit</span>
                  {editorial ? "Edit Editorial" : "Write Editorial"}
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="editorial-divider" />

        {/* ── Content ── */}
        <AnimatePresence mode="wait">
          {editorial ? (
            <motion.div
              key="editorial-content"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, delay: 0.1 }}
            >
              <article className="editorial-body">
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                  {editorial.content}
                </ReactMarkdown>
              </article>
            </motion.div>
          ) : (
            <motion.div
              key="editorial-empty"
              className="editorial-empty"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <span className="material-symbols-outlined editorial-empty__icon">
                description
              </span>
              <p className="editorial-empty__title">No Editorial Yet</p>
              <p className="editorial-empty__sub">
                The editorial for this problem hasn&apos;t been published yet.
                Check back after the contest ends.
              </p>
              {isPrivileged && (
                <Link to={`/contest/${contestId}/problems/${problemId}/editorial/edit`} className="editorial-empty__cta">
                  <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>add</span>
                  Write Editorial
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Back to problem ── */}
        <motion.div
          style={{ marginTop: "2.5rem" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Link
            to={`/contest/${contestId}/problems/${problemId}`}
            className="editorial-edit-btn"
            style={{ display: "inline-flex" }}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Problem
          </Link>
        </motion.div>

      </main>
    </div>
  );
}

export default ContestEditorialPage;