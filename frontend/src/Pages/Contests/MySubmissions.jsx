import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import ErrorPage from "../Auth_and_Profile/ErrorPage";
import LoadingPage from "../Auth_and_Profile/LoadingPage";
import { clearStoredAuthUser, getStoredAuthUser, setStoredAuthUser } from "../../Utils/auth_storage";
import { API_BASE_URL } from "../../Utils/api";
import { formatDisplayText } from "../../Utils/format_display_text";
import ArenaNavbar from "../../Components/ArenaNavbar";

const formatDateTime = (value) => {
    if (!value) {
        return "N/A";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return parsed.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getVerdictClass = (verdict) => {
    const lowerVerdict = (verdict || "").toLowerCase();
    if (lowerVerdict.includes("accepted")) {
        return "status-live"; // Green
    }
    if (lowerVerdict.includes("wrong") || lowerVerdict.includes("error")) {
        return "status-completed"; // Red-ish
    }
    return "status-draft"; // Yellow/gray
};

function MySubmissionsPage() {
    const [submissions, setSubmissions] = useState([]);
    const [user, setUser] = useState({});
    const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navLinks = [
        { label: "Contests", to: "/contests", active: false },
        { label: "Leaderboard", to: "/leaderboard", active: false },
        { label: "My Submissions", to: "/submissions", active: true },
    ];

    const loadSubmissions = async () => {
        try {
            setLoading(true);
            setError("");
            const response = await axios.get(`${API_BASE_URL}/contests/submissions/`, {
                withCredentials: true,
            });
            setSubmissions(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                "Unable to load your submissions right now."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSubmissions();

        axios.get(`${API_BASE_URL}/accounts/api/session/`, { withCredentials: true })
            .then((res) => res.data?.user || null)
            .then((data) => {
                if (data) {
                    setStoredAuthUser(data);
                    setAuthUser(data);
                }
                setUser(data || {});
            })
            .catch(() => setUser({}));

        const syncAuthUser = () => setAuthUser(getStoredAuthUser());
        window.addEventListener("storage", syncAuthUser);

        return () => window.removeEventListener("storage", syncAuthUser);
    }, []);

    const handleLogout = async () => {
        try {
            await axios.post(`${API_BASE_URL}/accounts/api/logout/`, {}, { withCredentials: true });
        } catch {
            // Clear local state even if the server-side logout request fails.
        } finally {
            clearStoredAuthUser();
            setAuthUser(null);
            setUser({});
        }
    };

    if (loading) {
        return (
            <LoadingPage
                title="Loading your submissions"
                subtitle="Fetching your submission history across all contests from the arena."
            />
        );
    }

    if (error) {
        return (
            <ErrorPage
                kicker="Submissions Error"
                code="500"
                title="Your submissions could not be loaded."
                copy={error}
                primaryAction={{ label: "Retry", onClick: loadSubmissions }}
                secondaryAction={{ label: "View Contests", to: "/contests" }}
            />
        );
    }

    return (
        <div className="contest-page bg-background text-on-background min-h-screen">
            <ArenaNavbar navLinks={navLinks} authUser={authUser} onLogout={handleLogout} />

            <main className="main-shell pt-24 pb-12 px-6 max-w-[1600px] mx-auto">
                <div className="space-y-12">
                    <section className="space-y-2">
                        <h1 className="text-4xl font-black font-headline tracking-tighter text-on-background uppercase">
                            My <span className="text-primary">Submissions</span>
                        </h1>
                        <p className="text-on-surface-variant font-body text-sm max-w-2xl">
                            Browse your submission history. Review your code, check verdicts, and analyze your performance.
                        </p>
                    </section>

                    <section className="admin-panel">
                        <div className="admin-table-wrap">
                            <table className="admin-contest-table">
                                <thead>
                                    <tr>
                                        <th>Problem / Contest</th>
                                        <th>Submitted At</th>
                                        <th>Language</th>
                                        <th>Verdict</th>
                                        <th>Status</th>
                                        <th>Exec. Time</th>
                                        <th>Memory</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.length > 0 ? (
                                        submissions.map((sub) => (
                                            <tr key={sub.submission_id}>
                                                <td>
                                                    <div className="contest-primary-cell">
                                                        <Link to={`/contest/${sub.contest_id}/problems/${sub.problem_id}`} className="contest-link">
                                                            {formatDisplayText(sub.problem_title || "Unknown Problem")}
                                                        </Link>
                                                        <span>
                                                            In: <Link to={`/contest/${sub.contest_id}/`} className="text-xs text-on-surface-variant hover:text-primary">
                                                                {formatDisplayText(sub.contest_title || "Unknown Contest")}
                                                            </Link>
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>{formatDateTime(sub.submitted_at)}</td>
                                                <td>{formatDisplayText(sub.language_name || "Unknown Language")}</td>
                                                <td>
                                                    <span className={`contest-status-pill ${getVerdictClass(sub.verdict)}`}>
                                                        {formatDisplayText(sub.verdict || "Pending")}
                                                    </span>
                                                </td>
                                                <td>{formatDisplayText(sub.status || "Pending")}</td>
                                                <td>{sub.execution_time_ms !== null ? `${sub.execution_time_ms} ms` : 'N/A'}</td>
                                                <td>{sub.memory_used_kb !== null ? `${sub.memory_used_kb} KB` : 'N/A'}</td>
                                                <td>
                                                    <div className="contest-actions">
                                                        <Link to={`/submissions/${sub.submission_id}`} className="admin-icon-button" aria-label="View Submission Code">
                                                            <span className="material-symbols-outlined">visibility</span>
                                                        </Link>
                                                        <Link to={`/contest/${sub.contest_id}/problems/${sub.problem_id}`} className="admin-icon-button" aria-label="Go to Problem">
                                                            <span className="material-symbols-outlined">open_in_new</span>
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="admin-empty-state">
                                                You have not made any submissions yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default MySubmissionsPage;
