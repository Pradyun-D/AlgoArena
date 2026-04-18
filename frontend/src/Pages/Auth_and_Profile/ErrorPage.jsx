import { Link } from "react-router-dom";
import { motion } from "motion/react";
import "../../Styles/error_page.css";

function ErrorAction({ action, className }) {
  if (!action?.label) return null;

  if (action.to) {
    return (
      <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 380, damping: 18 }}>
        <Link to={action.to} className={className}>{action.label}</Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      className={className}
      onClick={action.onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 18 }}
    >
      {action.label}
    </motion.button>
  );
}

function ErrorPage({
  kicker = "Route Failure",
  code = "404",
  title = "This page does not exist.",
  copy = "The route you tried to open is outside the arena. Head back to the landing page or jump straight into the contests list.",
  primaryAction = { label: "Return Home", to: "/" },
  secondaryAction = { label: "View Contests", to: "/contests" },
}) {
  return (
    <div className="error-page">
      <div className="error-stars" aria-hidden="true">
        <span className="error-star error-star-a" />
        <span className="error-star error-star-b" />
        <span className="error-star error-star-c" />
        <span className="error-star error-star-d" />
      </div>

      {/* Shell springs in from below */}
      <motion.div
        className="error-shell"
        initial={{ opacity: 0, y: 48, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.p
          className="error-kicker"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.35 }}
        >
          {kicker}
        </motion.p>

        {/* Code number slams in */}
        <motion.h1
          className="error-code"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.5, ease: [0.34, 1.26, 0.64, 1] }}
        >
          {code}
        </motion.h1>

        <motion.h2
          className="error-title"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.38 }}
        >
          {title}
        </motion.h2>

        <motion.p
          className="error-copy"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.46, duration: 0.38 }}
        >
          {copy}
        </motion.p>

        <motion.div
          className="error-actions"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.38 }}
        >
          <ErrorAction action={primaryAction} className="error-btn error-btn-primary" />
          <ErrorAction action={secondaryAction} className="error-btn error-btn-secondary" />
        </motion.div>
      </motion.div>
    </div>
  );
}

export default ErrorPage;
