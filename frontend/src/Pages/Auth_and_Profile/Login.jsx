import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "motion/react";
import { setStoredAuthUser } from "../../Utils/auth_storage";
import { API_BASE_URL } from "../../Utils/api";
import "../../Styles/auth_pages.css";
import ThemeToggle from "../../Components/ThemeToggle";
import LoadingPage from "./LoadingPage";
import { fetchSessionUser } from "../../Utils/session_auth";

// stagger container — each child reveals 90ms apart
const formStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.18 } },
};

const fieldReveal = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.38, ease: "easeOut" } },
};

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo || "/contests";
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const redirectIfAuthenticated = async () => {
      try {
        const sessionUser = await fetchSessionUser();
        if (!isMounted) return;
        if (sessionUser) {
          navigate("/contests", { replace: true });
          return;
        }
      } catch {
        // Fall through to the login form if session refresh fails.
      }
      if (isMounted) {
        setCheckingSession(false);
      }
    };

    redirectIfAuthenticated();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/accounts/api/login/`, form, {
        withCredentials: true,
      });
      setStoredAuthUser(response.data.user);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error ||
        "Unable to start session right now. Please verify your credentials."
      );
      // trigger shake on the panel
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <LoadingPage
        title="Checking your session"
        subtitle="Redirecting you to contests if you are already signed in."
      />
    );
  }

  return (
    <div className="auth-page auth-page-login">
      {/* Header slides down */}
      <motion.header
        className="auth-topbar"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <Link className="auth-brand" to="/">ALGOARENA</Link>
        <div className="auth-topbar-actions">
          <ThemeToggle />
          <Link className="auth-topbar-link" to="/register">Create Account</Link>
        </div>
      </motion.header>

      <main className="auth-main auth-grid-login">
        {/* Panel slides up + fades in, shakes on error */}
        <motion.section
          className="auth-panel auth-panel-terminal"
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={
            shake
              ? { x: [0, -10, 10, -8, 8, -4, 4, 0], opacity: 1, y: 0, scale: 1 }
              : { opacity: 1, y: 0, scale: 1 }
          }
          transition={
            shake
              ? { duration: 0.45, ease: "easeOut" }
              : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
          }
        >
          <div className="auth-panel-chrome">
            <span className="auth-dot auth-dot-red" />
            <span className="auth-dot auth-dot-amber" />
            <span className="auth-dot auth-dot-green" />
            <span className="auth-chrome-label">Session Initialize.sh</span>
          </div>

          <div className="auth-panel-body">
            {/* Copy fades in */}
            <motion.div
              className="auth-copy"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.22, ease: "easeOut" }}
            >
              <p className="auth-kicker">Encrypted Tunnel</p>
              <h1 className="auth-title">Identify Yourself</h1>
              <p className="auth-description">
                Sign in with your existing AlgoArena handle to access contests,
                saved preferences, and future personalized modules.
              </p>
            </motion.div>

            {/* Form fields stagger in */}
            <motion.form
              className="auth-form"
              onSubmit={handleSubmit}
              variants={formStagger}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={fieldReveal}>
                <label className="auth-label" htmlFor="identifier">Username / Email</label>
                <input
                  id="identifier"
                  name="identifier"
                  className="auth-input"
                  placeholder="root@algoarena.io"
                  value={form.identifier}
                  onChange={handleChange}
                />
              </motion.div>

              <motion.div variants={fieldReveal}>
                <label className="auth-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="auth-input"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                />
              </motion.div>

              {/* Error slides down */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="auth-error"
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                  >
                    <span className="auth-error-message">{error}</span>
                    <Link className="auth-error-action" to="/">
                      Return to landing page
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit — press scale + shine shimmer via CSS class */}
              <motion.div variants={fieldReveal}>
                <motion.button
                  className="auth-submit"
                  type="submit"
                  disabled={isSubmitting}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.015 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  {isSubmitting ? "Executing..." : "Execute Login"}
                </motion.button>
              </motion.div>
            </motion.form>

            <motion.p
              className="auth-footer-copy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65, duration: 0.4 }}
            >
              New operator? <Link to="/register">Create Account</Link>
            </motion.p>
          </div>
        </motion.section>
      </main>
    </div>
  );
}

export default LoginPage;