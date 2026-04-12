import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import LoadingPage from "./LoadingPage";
import ErrorPage from "./ErrorPage";
import { API_BASE_URL } from "../Utils/api";
import { formatDisplayText } from "../Utils/format_display_text";
import "../Styles/admin_dashboard.css";

const formatDraftDate = (value) => {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

function DraftsDashboard() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState(null);
  const [error, setError] = useState("");

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get(`${API_BASE_URL}/contests/drafts/`, {
        withCredentials: true,
      });
      setDrafts(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Unable to load drafts right now."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handlePublish = async (draftId) => {
    const confirmed = window.confirm(
      "Publish this draft as a contest now? This will only work if all required contest details are filled."
    );
    if (!confirmed) {
      return;
    }

    try {
      setPublishingId(draftId);
      setError("");
      const response = await axios.post(
        `${API_BASE_URL}/contests/drafts/${draftId}/publish/`,
        {},
        { withCredentials: true }
      );
      const contestId = response.data?.contest?.contest_id;
      setDrafts((current) => current.filter((draft) => draft.contest_id !== draftId));
      if (contestId) {
        navigate(`/contest/${contestId}/`);
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Unable to publish this draft."
      );
    } finally {
      setPublishingId(null);
    }
  };

  if (loading) {
    return (
      <LoadingPage
        title="Loading drafts"
        subtitle="Collecting saved contest drafts and preparing publish actions."
      />
    );
  }

  if (error && drafts.length === 0) {
    return (
      <ErrorPage
        kicker="Draft Error"
        code="500"
        title="The drafts dashboard could not be loaded."
        copy={error}
        primaryAction={{ label: "Retry", onClick: fetchDrafts }}
        secondaryAction={{ label: "View Contests", to: "/contests" }}
      />
    );
  }

  return (
    <div
      className="admin-dashboard-page"
      style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
    >
      <main className="admin-dashboard-main" style={{ minWidth: 0 }}>
        <header className="admin-topbar">
          <div className="admin-topbar-tabs">
            <Link className="admin-topbar-link" to="/contests">Contests</Link>
            <Link className="admin-topbar-link active" to="/drafts">Drafts</Link>
            <Link className="admin-topbar-link" to="/create">Create</Link>
          </div>

          <div className="admin-topbar-actions">
            <Link className="admin-create-button" to="/create">New Draft</Link>
          </div>
        </header>

        <section className="admin-dashboard-content" style={{ maxWidth: "1400px", width: "100%", margin: "0 auto" }}>
          <div className="admin-page-header">
            <div>
              <p className="admin-section-kicker">Draft Workspace</p>
              <h1>Saved Contest Drafts</h1>
              <p className="admin-page-description">
                Review incomplete contest plans, keep metadata safe, and publish a draft into a live contest when it is ready.
              </p>
            </div>
          </div>

          {error ? <p className="auth-error">{error}</p> : null}

          <section className="admin-panel">
            <div className="admin-table-wrap">
              <table className="admin-contest-table">
                <thead>
                  <tr>
                    <th>Draft</th>
                    <th>Schedule</th>
                    <th>Visibility</th>
                    <th>Saved</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.length > 0 ? (
                    drafts.map((draft) => (
                      <tr key={draft.contest_id}>
                        <td>
                          <div className="contest-primary-cell">
                            <strong>{formatDisplayText(draft.title || "Untitled Draft")}</strong>
                          </div>
                        </td>
                        <td>
                          <div className="contest-time-cell">
                            <div>
                              <span className="material-symbols-outlined">schedule</span>
                              <span>{formatDraftDate(draft.start_time)}</span>
                            </div>
                            <span>Ends: {formatDraftDate(draft.end_time)}</span>
                          </div>
                        </td>
                        <td>
                          <span className="contest-status-pill status-draft">
                            {formatDisplayText(draft.visibility || "public")}
                          </span>
                        </td>
                        <td>{formatDraftDate(draft.updated_at || draft.created_at)}</td>
                        <td>
                          <div className="contest-actions">
                            <button
                              type="button"
                              onClick={() => navigate(`/create?draft=${draft.contest_id}`)}
                              aria-label={`Edit ${draft.title || "draft"}`}
                            >
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePublish(draft.contest_id)}
                              disabled={publishingId === draft.contest_id}
                              aria-label={`Publish ${draft.title || "draft"}`}
                            >
                              <span className="material-symbols-outlined">Rocket Launch</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="admin-empty-state">
                        No drafts saved yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

export default DraftsDashboard;
