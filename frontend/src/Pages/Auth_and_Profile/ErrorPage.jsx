import { Link } from "react-router-dom";
import "../../Styles/error_page.css";

function ErrorAction({ action, className }) {
  if (!action?.label) {
    return null;
  }

  if (action.to) {
    return (
      <Link to={action.to} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={action.onClick}>
      {action.label}
    </button>
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

      <div className="error-shell">
        <p className="error-kicker">{kicker}</p>
        <h1 className="error-code">{code}</h1>
        <h2 className="error-title">{title}</h2>
        <p className="error-copy">{copy}</p>

        <div className="error-actions">
          <ErrorAction action={primaryAction} className="error-btn error-btn-primary" />
          <ErrorAction action={secondaryAction} className="error-btn error-btn-secondary" />
        </div>
      </div>
    </div>
  );
}

export default ErrorPage;
