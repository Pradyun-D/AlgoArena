import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../../Styles/landing_page.css";
import ThemeToggle from "../../Components/ThemeToggle";
import { motion } from "motion/react";
import { getStoredAuthUser } from "../../Utils/auth_storage";
import { fetchSessionUser } from "../../Utils/session_auth";

// ── Reusable animation variants ──────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0  },
};

const fadeIn = {
  hidden: { opacity: 0 },
  show:   { opacity: 1 },
};

const staggerContainer = (staggerChildren = 0.12, delayChildren = 0) => ({
  hidden: {},
  show:   { transition: { staggerChildren, delayChildren } },
});

// ── Feature data ─────────────────────────────────────────────────────────────

const featureItems = [
  {
    label: "Fast Judging",
    value: "< 120ms",
    description: "Low-latency verdicts for the rounds that matter.",
  },
  {
    label: "Live Arena",
    value: "24/7",
    description: "Contests, practice runs, and ranked sessions in one flow.",
  },
  {
    label: "Secure Runs",
    value: "Isolated",
    description: "Sandboxed execution with clean resource boundaries.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────

function LandingPage() {
  const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
  const [sessionReady, setSessionReady] = useState(false);

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
        <Link to="/" className="landing-brand">
          Algo Arena
        </Link>

        <nav className="landing-nav" aria-label="Primary">
          <a href="#features">Features</a>
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
              <span>{authUser ? "Session Active" : "Deep Space Arena Online"}</span>
            </motion.div>

            <motion.p
              className="hero-kicker"
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              Competitive coding, reframed as a launch sequence.
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
                  your next contest is waiting.
                </>
              ) : (
                <>
                  Enter a coding arena
                  <br />
                  built like a starfield.
                </>
              )}
            </motion.h1>

            <motion.p
              className={`hero-description ${authUser ? "hero-description--signed-in" : ""}`}
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              {authUser
                ? "Your session is already active. Jump straight back into contests, submissions, and leaderboards."
                : "Run contests, climb live leaderboards, and push submissions through a cleaner, faster interface with a cinematic space backdrop."}
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
              <span className="signal-label">Contest Pulse</span>
              <span className="signal-value">LIVE FEED</span>
            </motion.div>

            {/* Signal card — slides in from the left */}
            <motion.div
              className="signal-card signal-card-bottom"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.9, ease: [0.34, 1.26, 0.64, 1] }}
            >
              <span className="signal-label">Sandbox</span>
              <span className="signal-value">STABLE ORBIT</span>
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
              You are already logged in as <strong>{signedInName}</strong>. Head straight to the contests page to continue.
            </p>
          </motion.section>
        ) : null}

        {/* ── Feature strip — stagger in on scroll ── */}
        <motion.section
          className="feature-strip"
          id="features"
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
    </div>
  );
}

export default LandingPage;
