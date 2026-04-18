import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "motion/react";
import { API_BASE_URL } from "../../Utils/api";
import "../../Styles/auth_pages.css";
import ThemeToggle from "../../Components/ThemeToggle";
import LoadingPage from "./LoadingPage";
import { fetchSessionUser } from "../../Utils/session_auth";

const formStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const fieldReveal = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.36, ease: "easeOut" } },
};

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
    confirm_password: "",
  });
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
        // Fall through to the registration form if session refresh fails.
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
      await axios.post(`${API_BASE_URL}/accounts/api/register/`, form);
      navigate("/login", { replace: true, state: { returnTo: "/profile/edit" } });
    } catch (err) {
      setError(
        err.response?.data?.error ||
        "Unable to initialize account right now. Please try again."
      );
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
    <div className="auth-page auth-page-register">
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
          <Link className="auth-topbar-link" to="/login">Login</Link>
        </div>
      </motion.header>

      <main className="auth-main auth-grid-register">
        {/* Panel slides up, shakes on error */}
        <motion.section
          className="auth-panel auth-panel-register"
          initial={{ opacity: 0, y: 36, scale: 0.97 }}
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
          <div className="auth-panel-body">
            {/* Copy block */}
            <motion.div
              className="auth-copy"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
            >
              <p className="auth-kicker">Initialize Profile</p>
              <h1 className="auth-title">Create Your Account</h1>
              <p className="auth-description">
                We only need the essentials now. You can update bio, college, and
                avatar later from your profile settings.
              </p>
            </motion.div>

            {/* Form fields stagger in */}
            <motion.form
              className="auth-form auth-form-grid"
              onSubmit={handleSubmit}
              variants={formStagger}
              initial="hidden"
              animate="show"
            >
              <motion.div className="auth-field auth-field-full" variants={fieldReveal}>
                <label className="auth-label" htmlFor="full_name">Full Name</label>
                <input
                  id="full_name"
                  name="full_name"
                  className="auth-input"
                  placeholder="Alan Turing"
                  value={form.full_name}
                  onChange={handleChange}
                />
              </motion.div>

              <motion.div className="auth-field" variants={fieldReveal}>
                <label className="auth-label" htmlFor="username">Username</label>
                <input
                  id="username"
                  name="username"
                  className="auth-input"
                  placeholder="syntax_hero"
                  value={form.username}
                  onChange={handleChange}
                />
              </motion.div>

              <motion.div className="auth-field" variants={fieldReveal}>
                <label className="auth-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="auth-input"
                  placeholder="dev@algoarena.io"
                  value={form.email}
                  onChange={handleChange}
                />
              </motion.div>

              <motion.div className="auth-field" variants={fieldReveal}>
                <label className="auth-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="auth-input"
                  placeholder="********"
                  value={form.password}
                  onChange={handleChange}
                />
              </motion.div>

              <motion.div className="auth-field" variants={fieldReveal}>
                <label className="auth-label" htmlFor="confirm_password">Confirm Password</label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  className="auth-input"
                  placeholder="********"
                  value={form.confirm_password}
                  onChange={handleChange}
                />
              </motion.div>

              {/* Error slides down */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="auth-error auth-field-full"
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

              {/* Submit button */}
              <motion.div className="auth-field-full" variants={fieldReveal}>
                <motion.button
                  className="auth-submit"
                  type="submit"
                  disabled={isSubmitting}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.015 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  {isSubmitting ? "Initializing..." : "Initialize Account"}
                </motion.button>
              </motion.div>
            </motion.form>

            <motion.p
              className="auth-footer-copy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.72, duration: 0.4 }}
            >
              Already registered? <Link to="/login">Start Session</Link>
            </motion.p>
          </div>
        </motion.section>
      </main>
    </div>
  );
}

export default RegisterPage;