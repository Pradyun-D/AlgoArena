import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import ErrorPage from "../Auth_and_Profile/ErrorPage";
import LoadingPage from "../Auth_and_Profile/LoadingPage";
import { clearStoredAuthUser, getStoredAuthUser } from "../../Utils/auth_storage";
import { API_BASE_URL } from "../../Utils/api";
import { formatDisplayText } from "../../Utils/format_display_text";
import ArenaNavbar from "../../Components/ArenaNavbar";
import { fetchSessionUser } from "../../Utils/session_auth";
import { parseSafeUTCDate } from "../../Utils/date_helpers";

const formatDateTime = (value) => {
    if (!value) return "N/A";
    const parsed = parseSafeUTCDate(value);
    if (Number.isNaN(parsed.getTime())) return value;
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

const fadeUp = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0 },
};

const tableStagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.055, delayChildren: 0.28 } },
};

function MySubmissionsPage() {
    const navigate = useNavigate();
    const [submissions, setSubmissions] = useState([]);
    const [, setUser] = useState({});
    const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navLinks = [
        { label: "Contests", to: "/contests", active: false },
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
        let isMounted = true;
        loadSubmissions();

        const syncSessionUser = async () => {
            try {
                const data = await fetchSessionUser();
                if (!isMounted) return;
                setAuthUser(data);
                setUser(data || {});
            } catch {
                if (!isMounted) return;
                const fallbackUser = getStoredAuthUser();
                setAuthUser(fallbackUser);
                setUser(fallbackUser || {});
            }
        };

        syncSessionUser();

        const syncAuthUser = () => {
            const storedUser = getStoredAuthUser();
            setAuthUser(storedUser);
            setUser(storedUser || {});
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                syncSessionUser();
            }
        };

        window.addEventListener("storage", syncAuthUser);
        window.addEventListener("pageshow", syncSessionUser);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            isMounted = false;
            window.removeEventListener("storage", syncAuthUser);
            window.removeEventListener("pageshow", syncSessionUser);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);


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
            <ArenaNavbar navLinks={navLinks} authUser={authUser} />

            <main className="main-shell pt-24 pb-12 px-6 max-w-[1600px] mx-auto">
                <div className="space-y-12">
                    <motion.section
                        className="space-y-2"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                    >
                        <h1 className="text-4xl font-black font-headline tracking-tighter text-on-background uppercase">
                            My <span className="text-primary">Submissions</span>
                        </h1>
                        <p className="text-on-surface-variant font-body text-sm max-w-2xl">
                            Browse your submission history. Review your code, check verdicts, and analyze your performance.
                        </p>
                    </motion.section>

                    <motion.section
                        className="admin-panel"
                        initial={{ opacity: 0, y: 22, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.16, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    >
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
                                <motion.tbody variants={tableStagger} initial="hidden" animate="show">
                                    {submissions.length > 0 ? (
                                        submissions.map((sub) => (
                                            <motion.tr
                                                key={sub.submission_id}
                                                variants={fadeUp}
                                                transition={{ duration: 0.34, ease: "easeOut" }}
                                                whileHover={{ backgroundColor: "rgba(132,173,255,0.045)" }}
                                            >
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
                                                        <motion.div whileHover={{ scale: 1.14 }} whileTap={{ scale: 0.9 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>
                                                            <Link to={`/submissions/${sub.submission_id}`} className="admin-icon-button" aria-label="View Submission Code">
                                                                <span className="material-symbols-outlined">visibility</span>
                                                            </Link>
                                                        </motion.div>
                                                        <motion.div whileHover={{ scale: 1.14 }} whileTap={{ scale: 0.9 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>
                                                            <Link to={`/contest/${sub.contest_id}/problems/${sub.problem_id}`} className="admin-icon-button" aria-label="Go to Problem">
                                                                <span className="material-symbols-outlined">open_in_new</span>
                                                            </Link>
                                                        </motion.div>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))
                                    ) : (
                                        <motion.tr variants={fadeUp}>
                                            <td colSpan="6" className="admin-empty-state">
                                                You have not made any submissions yet.
                                            </td>
                                        </motion.tr>
                                    )}
                                </motion.tbody>
                            </table>
                        </div>
                    </motion.section>
                </div>
            </main>
        </div>
    );
}

export default MySubmissionsPage;
