import { Link } from "react-router-dom";
import "../Styles/error_page.css";

function ErrorPage() {
  return (
    <div className="error-page">
      <div className="error-stars" aria-hidden="true">
        <span className="error-star error-star-a" />
        <span className="error-star error-star-b" />
        <span className="error-star error-star-c" />
        <span className="error-star error-star-d" />
      </div>

      <div className="error-shell">
        <p className="error-kicker">Route Failure</p>
        <h1 className="error-code">404</h1>
        <h2 className="error-title">This page does not exist.</h2>
        <p className="error-copy">
          The route you tried to open is outside the arena. Head back to the landing page
          or jump straight into the contests list.
        </p>

        <div className="error-actions">
          <Link to="/" className="error-btn error-btn-primary">
            Return Home
          </Link>
          <Link to="/contests" className="error-btn error-btn-secondary">
            View Contests
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ErrorPage;
