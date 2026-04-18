import { useEffect, useState } from "react";
import axios from "axios";
import ContestCard from "../../Components/ContestCard";
import { Link } from "react-router-dom";
import Sidebar from "../../Components/Sidebar";
import ErrorPage from "../Auth_and_Profile/ErrorPage";
import LoadingPage from "../Auth_and_Profile/LoadingPage";
import { clearStoredAuthUser, getStoredAuthUser, setStoredAuthUser } from "../../Utils/auth_storage";
import { API_BASE_URL } from "../../Utils/api";
import ArenaNavbar from "../../Components/ArenaNavbar";

function ContestsPage() {
    const [availableContests, setAvailableContests] = useState([]);
    const [pastContests, setPastContests] = useState([]);
    const [user, setUser] = useState({});
    const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
    const [platformMetrics, setPlatformMetrics] = useState({
        total_users: 0,
        total_submissions: 0,
        server_latency_ms: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const contestBaseUrl = "/contest/";
    const leaderboardUrl = availableContests.length > 0
        ? `/leaderboard/${availableContests[0].contest_id}/`
        : "/contests";

    const loadContests = async () => {
        try {
            setLoading(true);
            setError("");

            const [availableResponse, pastResponse, metricsResponse] = await Promise.allSettled([
                axios.get(`${API_BASE_URL}/contests/`),
                axios.get(`${API_BASE_URL}/contests/past/`),
                axios.get(`${API_BASE_URL}/accounts/api/platform-metrics/`),
            ]);

            if (availableResponse.status === "fulfilled") {
                setAvailableContests(Array.isArray(availableResponse.value.data) ? availableResponse.value.data : []);
            } else {
                throw availableResponse.reason;
            }

            if (pastResponse.status === "fulfilled") {
                setPastContests(Array.isArray(pastResponse.value.data) ? pastResponse.value.data : []);
            } else {
                throw pastResponse.reason;
            }

            if (metricsResponse.status === "fulfilled") {
                setPlatformMetrics({
                    total_users: Number(metricsResponse.value.data?.total_users) || 0,
                    total_submissions: Number(metricsResponse.value.data?.total_submissions) || 0,
                    server_latency_ms: Number(metricsResponse.value.data?.server_latency_ms) || 0,
                });
            }
        } catch (err) {
            setError(
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                "Unable to load contests right now."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadContests();

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

    const sidebarUser = authUser ? {
        ...user,
        is_logged_in: true,
        username: authUser.username || user.username,
        created_at: authUser.created_at,
        avatar_url: authUser.profile?.avatar_url || "",
    } : {
        ...user,
        is_logged_in: false,
    };

    const canCreateContest = Boolean(authUser && ["problem_setter", "admin"].includes(authUser.role));
    const canAccessAdminDashboard = Boolean(authUser && authUser.role === "admin");
    const formatMetric = (value) => new Intl.NumberFormat("en-IN").format(Number(value) || 0);
    const navLinks = [
        { label: "Contests", to: "/contests", active: true },
        { label: "Leaderboard", to: leaderboardUrl, active: false },
        { label: "My Submissions", to: "/submissions", active: false },
    ];

    if (loading) {
        return (
            <LoadingPage
                title="Loading contest registry"
                subtitle="Syncing live rounds, archived contests, and leaderboard shortcuts for the arena."
            />
        );
    }

    if (error) {
        return (
            <ErrorPage
                kicker="Contest Feed Error"
                code="500"
                title="The contests list could not be loaded."
                copy={error}
                primaryAction={{ label: "Retry", onClick: loadContests }}
                secondaryAction={{ label: "Return Home", to: "/" }}
            />
        );
    }

    return (
        <div className="contest-page bg-background text-on-background min-h-screen">
            <ArenaNavbar navLinks={navLinks} authUser={authUser} onLogout={handleLogout} />

            <main className="main-shell pt-24 pb-12 px-6 max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-9 space-y-12">
                    <section className="space-y-2">
                        <h1 className="text-4xl font-black font-headline tracking-tighter text-on-background uppercase">
                            Contest <span className="text-primary">Registry</span>
                        </h1>
                        <p className="text-on-surface-variant font-body text-sm max-w-2xl">
                            Browse active and upcoming competitive programming rounds. Optimize your
                            performance through consistent participation in global contests.
                        </p>
                        {canCreateContest ? (
                            <div className="mt-12 flex flex-wrap gap-4">
                                <Link
                                    to="/create"
                                    className="inline-block font-headline font-black uppercase tracking-widest rounded-sm"
                                    style={{
                                        padding: "0.95rem 1.35rem",
                                        color: "#03111c",
                                        background: "linear-gradient(135deg, #84adff 0%, #4f8eff 48%, #69f0a7 100%)",
                                        boxShadow: "0 18px 36px rgba(32, 112, 255, 0.22)",
                                        border: "1px solid rgba(132, 173, 255, 0.28)",
                                    }}
                                >
                                    <span
                                        className="material-symbols-outlined"
                                        style={{ fontSize: "1rem", verticalAlign: "middle", marginRight: "0.5rem" }}
                                    >
                                        add_circle
                                    </span>
                                    Create Contest
                                </Link>

                                <Link
                                    to="/drafts"
                                    className="inline-block font-headline font-black uppercase tracking-widest rounded-sm"
                                    style={{
                                        padding: "0.95rem 1.35rem",
                                        color: "#e8f0ff",
                                        background: "linear-gradient(135deg, #1f2937 0%, #293548 48%, #374151 100%)",
                                        boxShadow: "0 18px 36px rgba(15, 23, 42, 0.22)",
                                        border: "1px solid rgba(148, 163, 184, 0.24)",
                                    }}
                                >
                                    <span
                                        className="material-symbols-outlined"
                                        style={{ fontSize: "1rem", verticalAlign: "middle", marginRight: "0.5rem" }}
                                    >
                                        draft
                                    </span>
                                    Access Drafts
                                </Link>

                                {canAccessAdminDashboard ? (
                                    <Link
                                        to="/admin/dashboard"
                                        className="inline-block font-headline font-black uppercase tracking-widest rounded-sm"
                                        style={{
                                            padding: "0.95rem 1.35rem",
                                            color: "#d9ecff",
                                            background: "linear-gradient(135deg, #12253c 0%, #193657 48%, #28507b 100%)",
                                            boxShadow: "0 18px 36px rgba(10, 21, 37, 0.28)",
                                            border: "1px solid rgba(132, 173, 255, 0.2)",
                                        }}
                                    >
                                        <span
                                            className="material-symbols-outlined"
                                            style={{ fontSize: "1rem", verticalAlign: "middle", marginRight: "0.5rem" }}
                                        >
                                          admin_panel_settings
                                        </span>
                                        Access Admin Dashboard
                                    </Link>
                                ) : null}
                            </div>
                        ) : null}
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold font-headline tracking-tight text-secondary flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">sensors</span>
                                AVAILABLE CONTESTS
                            </h2>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                                {availableContests.length} loaded
                            </span>
                        </div>

                        {availableContests.length === 0 ? (
                            <div className="bg-surface-container-low p-8 rounded-sm border border-dashed border-outline-variant/40 text-center">
                                <span className="material-symbols-outlined text-4xl text-on-surface-variant">trophy</span>
                                <h3 className="mt-4 text-lg font-bold font-headline uppercase">No Contests Found</h3>
                                <p className="mt-2 text-sm text-on-surface-variant">
                                    New rounds will appear here as soon as they are available.
                                </p>
                            </div>
                        ) : (
                            <div className="contest-grid grid grid-cols-1 md:grid-cols-2 gap-4">
                                {availableContests.map((contest) => (
                                    <ContestCard
                                        key={contest.contest_id}
                                        contest={contest}
                                        contestBaseUrl={contestBaseUrl}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold font-headline tracking-tight text-on-surface flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">history</span>
                                PAST CONTESTS
                            </h2>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                                {pastContests.length} archived
                            </span>
                        </div>

                        {pastContests.length === 0 ? (
                            <div className="bg-surface-container-low p-8 rounded-sm border border-dashed border-outline-variant/40 text-center">
                                <span className="material-symbols-outlined text-4xl text-on-surface-variant">history</span>
                                <h3 className="mt-4 text-lg font-bold font-headline uppercase">No Past Contests Yet</h3>
                                <p className="mt-2 text-sm text-on-surface-variant">
                                    Completed contests will show up here once they have finished.
                                </p>
                            </div>
                        ) : (
                            <div className="contest-grid grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pastContests.map((contest) => (
                                    <ContestCard
                                        key={contest.contest_id}
                                        contest={contest}
                                        contestBaseUrl={contestBaseUrl}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <aside className="md:col-span-3 sidebar-shell space-y-6">
                    <Sidebar user={sidebarUser} />

                    <div className="bg-surface-container-low p-6 rounded-sm space-y-4">
                        <h4 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">
                            Platform Metrics
                        </h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-on-surface-variant">Total Users</span>
                                <span className="text-secondary">{formatMetric(platformMetrics.total_users)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-on-surface-variant">Total Submissions</span>
                                <span className="text-on-surface">{formatMetric(platformMetrics.total_submissions)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-on-surface-variant">Server Latency</span>
                                <span className="text-primary">{formatMetric(platformMetrics.server_latency_ms)}ms</span>
                            </div>
                        </div>
                    </div>
                </aside>
            </main>

            <button className="md:hidden fixed bottom-6 right-6 w-14 h-14 syntax-gradient rounded-sm shadow-2xl flex items-center justify-center text-on-background z-50">
                <span className="material-symbols-outlined">search</span>
            </button>
        </div>
    );
}

export default ContestsPage;
