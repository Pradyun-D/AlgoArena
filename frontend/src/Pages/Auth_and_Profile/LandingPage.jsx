import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../../Styles/landing_page.css";
import ThemeToggle from "../../Components/ThemeToggle";
import { motion } from "motion/react";
import axios from "axios";
import { getStoredAuthUser } from "../../Utils/auth_storage";
import { fetchSessionUser } from "../../Utils/session_auth";
import { API_BASE_URL } from "../../Utils/api";
import SiteFooter from "../../Components/SiteFooter";

// ── Reusable animation variants ──────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0  },
};

const staggerContainer = (staggerChildren = 0.12, delayChildren = 0) => ({
  hidden: {},
  show:   { transition: { staggerChildren, delayChildren } },
});

// ── Feature data ─────────────────────────────────────────────────────────────

function LandingPage() {
  const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
  const [sessionReady, setSessionReady] = useState(false);
  const [platformMetrics, setPlatformMetrics] = useState({
    active_contests: 0,
    completed_contests: 0,
    total_submissions: 0,
    upcoming_contests: 0,
  });

  const formatMetric = (value) => new Intl.NumberFormat("en-IN").format(Number(value) || 0);

  useEffect(() => {
    let isMounted = true;

    const syncSessionUser = async () => {
      try {
        const user = await fetchSessionUser();
        if (!isMounted) return;
        setAuthUser(user);
      } catch {
        if (!isMounted) return;
        setAuthUser(getStoredAuthUser());
      } finally {
        if (isMounted) {
          setSessionReady(true);
        }
      }
    };

    syncSessionUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    axios.get(`${API_BASE_URL}/accounts/api/platform-metrics/`)
      .then((response) => {
        if (!isMounted) return;
        setPlatformMetrics({
          active_contests: Number(response.data?.active_contests) || 0,
          completed_contests: Number(response.data?.completed_contests) || 0,
          total_submissions: Number(response.data?.total_submissions) || 0,
          upcoming_contests: Number(response.data?.upcoming_contests) || 0,
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setPlatformMetrics({
          active_contests: 0,
          completed_contests: 0,
          total_submissions: 0,
          upcoming_contests: 0,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const featureItems = [
    {
      label: "Active Contests",
      value: formatMetric(platformMetrics.active_contests),
      description: "Rounds currently open for solving across the public arena.",
    },
    {
      label: "Completed Contests",
      value: formatMetric(platformMetrics.completed_contests),
      description: "Archived rounds available for review and post-contest analysis.",
    },
    {
      label: "Total Submissions",
      value: formatMetric(platformMetrics.total_submissions),
      description: "Code runs already judged through the platform pipeline.",
    },
  ];

  const signedInName = authUser?.full_name || authUser?.username || authUser?.email || "operator";

  return (
    <div className="landing-page">
      <div className="landing-noise" aria-hidden="true" />
      <div className="landing-stars" aria-hidden="true">
        <span className="star star-a" />
        <span className="star star-b" />
        <span className="star star-c" />
        <span className="star star-d" />
        <span className="star star-e" />
        <span className="star star-f" />
      </div>

      {/* ── Header ── fade in from top */}
      <motion.header
        className="landing-header"
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        <Link to="/" className="landing-brand" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <img src="/app.ico" alt="AlgoArena Logo" style={{ width: "36px", height: "36px", objectFit: "contain" }} />
          ALGOARENA
        </Link>

        <nav className="landing-nav" aria-label="Primary">
          <a href="#statistics">Statistics</a>
        </nav>

        <div className="landing-actions">
          <ThemeToggle className="landing-theme-toggle" />
          {authUser ? (
            <>
              <span className="landing-session-pill">
                Signed in as {signedInName}
              </span>
              <Link to="/contests" className="landing-link-button">
                Contests
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="landing-link-button">
                Log In
              </Link>
              <Link to="/register" className="landing-primary-button">
                Register
              </Link>
            </>
          )}
        </div>
      </motion.header>

      <main className="landing-main">
        <section className="landing-hero">

          {/* ── Hero copy — staggered children ── */}
          <motion.div
            className="hero-copy"
            variants={staggerContainer(0.11, 0.15)}
            initial="hidden"
            animate="show"
          >
            <motion.div
              className="hero-status"
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <span className="hero-status-dot" />
              <span>{authUser ? "Session Active" : "Practice Arena Online"}</span>
            </motion.div>

            <motion.p
              className="hero-kicker"
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              Compete. Improve. Repeat.
            </motion.p>

            <motion.h1
              className={`hero-title ${authUser ? "hero-title--signed-in" : ""}`}
              variants={fadeUp}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              {authUser ? (
                <>
                  Welcome back, {signedInName}
                  <br />
                  pick up right where you left off.
                </>
              ) : (
                <>
                  Write better code
                  <br />
                  under real pressure.
                </>
              )}
            </motion.h1>

            <motion.p
              className={`hero-description ${authUser ? "hero-description--signed-in" : ""}`}
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              {authUser
                ? "Your account is already active. Jump back into contests, review submissions, or head to the leaderboard."
                : "Live contests, clean problem pages, and submission history — all in one arena built for consistent practice and competition."}
            </motion.p>

            <motion.div
              className="hero-buttons"
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <Link to="/contests" className="landing-primary-button">
                {authUser ? "Go to Contests" : "Enter Arena"}
              </Link>
              {authUser ? (
                <Link to="/submissions" className="landing-secondary-button">
                  My Submissions
                </Link>
              ) : (
                <Link to="/register" className="landing-secondary-button">
                  Create Account
                </Link>
              )}
            </motion.div>
          </motion.div>

          {/* ── Hero visual — fade + scale in ── */}
          <motion.div
            className="hero-visual"
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.25, ease: "easeOut" }}
          >
            <div className="orbital-ring ring-one" />
            <div className="orbital-ring ring-two" />
            <div className="orbital-ring ring-three" />

            {/* Planet — CSS handles the float, framer just does the entrance */}
            <motion.div
              className="hero-planet"
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.4, ease: [0.34, 1.26, 0.64, 1] }}
            >
              <div className="hero-core" />
              <div className="hero-glow" />
            </motion.div>

            {/* Signal card — slides in from the right */}
            <motion.div
              className="signal-card signal-card-top"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.75, ease: [0.34, 1.26, 0.64, 1] }}
            >
              <span className="signal-label">Live Contests</span>
              <span className="signal-value">{formatMetric(platformMetrics.active_contests)}</span>
            </motion.div>

            {/* Signal card — slides in from the left */}
            <motion.div
              className="signal-card signal-card-bottom"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.9, ease: [0.34, 1.26, 0.64, 1] }}
            >
              <span className="signal-label">Upcoming Rounds</span>
              <span className="signal-value">{formatMetric(platformMetrics.upcoming_contests)}</span>
            </motion.div>
          </motion.div>
        </section>

        {sessionReady && authUser ? (
          <motion.section
            className="landing-session-banner"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <span className="landing-session-banner__label">Signed in</span>
            <p>
              You are already logged in as <strong>{signedInName}</strong>. Continue from contests whenever you are ready.
            </p>
          </motion.section>
        ) : null}

        {/* ── Feature strip — stagger in on scroll ── */}
        <motion.section
          className="feature-strip"
          id="statistics"
          variants={staggerContainer(0.1, 0)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
        >
          {featureItems.map((item) => (
            <motion.article
              className="feature-card"
              key={item.label}
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <p className="feature-label">{item.label}</p>
              <p className="feature-value">{item.value}</p>
              <p className="feature-description">{item.description}</p>
            </motion.article>
          ))}
        </motion.section>
      </main>

      <SiteFooter className="landing-footer" />
    </div>
  );
}

export default LandingPage;