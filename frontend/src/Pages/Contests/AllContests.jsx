import { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "motion/react";
import ContestCard from "../../Components/ContestCard";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "../../Components/Sidebar";
import ErrorPage from "../Auth_and_Profile/ErrorPage";
import LoadingPage from "../Auth_and_Profile/LoadingPage";
import { clearStoredAuthUser, getStoredAuthUser } from "../../Utils/auth_storage";
import { API_BASE_URL } from "../../Utils/api";
import ArenaNavbar from "../../Components/ArenaNavbar";
import { fetchSessionUser } from "../../Utils/session_auth";

// ── variants ────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0  },
};

const cardStagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07 } },
};

// animated metric counter
function AnimatedMetric({ value, formatter }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) return;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    let frame = 0;
    const tick = () => {
      frame++;
      current = Math.min(Math.round(increment * frame), value);
      setDisplay(current);
      if (current < value) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{formatter(display)}</>;
}

function ContestsPage() {
    const navigate = useNavigate();
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

           const [allResponse, metricsResponse] = await Promise.allSettled([
            axios.get(`${API_BASE_URL}/contests/`),
            axios.get(`${API_BASE_URL}/accounts/api/platform-metrics/`),
              ]);

            let allContests = [];
              if (allResponse.status === "fulfilled") {
            allContests = Array.isArray(allResponse.value.data) ? allResponse.value.data : [];
            }

            // Use backend-provided status field instead of parsing dates
            const available = allContests
                .filter(c => c.status === "Live" || c.status === "Draft")
                .sort((a, b) => {
                    if (a.status === "Live" && b.status !== "Live") return -1;
                    if (a.status !== "Live" && b.status === "Live") return 1;
                    return new Date(a.start_time) - new Date(b.start_time);
                });

            const past = allContests
                .filter(c => c.status === "Completed")
                .sort((a, b) => new Date(b.end_time) - new Date(a.end_time));

             setAvailableContests(available);
             setPastContests(past);

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
        let isMounted = true;
        loadContests();

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


    const sidebarUser = authUser
        ? {
            ...user,
            ...authUser,
            profile: {
                ...(user.profile || {}),
                ...(authUser.profile || {}),
            },
            is_logged_in: true,
            avatar_url: authUser.profile?.avatar_url || user.avatar_url || user.profile?.avatar_url || "",
        }
        : { ...user, is_logged_in: false };

    const canCreateContest = Boolean(authUser && ["problem_setter", "admin"].includes(authUser.role));
    const canAccessAdminDashboard = Boolean(authUser && authUser.role === "admin");
    const formatMetric = (value) => new Intl.NumberFormat("en-IN").format(Number(value) || 0);
    const navLinks = [
        { label: "Contests", to: "/contests", active: true },
        { label: "Leaderboard", to: leaderboardUrl, active: false },
        { label: "My Submissions", to: "/submissions", active: false },
    ];

    if (loading) return <LoadingPage title="Loading contest registry" subtitle="Syncing live rounds, archived contests, and leaderboard shortcuts for the arena." />;
    if (error) return <ErrorPage kicker="Contest Feed Error" code="500" title="The contests list could not be loaded." copy={error} primaryAction={{ label: "Retry", onClick: loadContests }} secondaryAction={{ label: "Return Home", to: "/" }} />;

    return (
        <div className="contest-page bg-background text-on-background min-h-screen">
            <ArenaNavbar navLinks={navLinks} authUser={authUser} />

            <main className="main-shell pt-24 pb-12 px-6 max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-9 space-y-12">

               
                    <motion.section
                        className="space-y-2"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                    >
                        <h1 className="text-4xl font-black font-headline tracking-tighter text-on-background uppercase">
                            Contest <span className="text-primary">Registry</span>
                        </h1>
                        <p className="text-on-surface-variant font-body text-sm max-w-2xl">
                            Browse upcoming rounds and past competitions. Register early, solve fast, climb the board.
                        </p>

                        {canCreateContest ? (
                            <motion.div
                                className="flex flex-wrap gap-3 pt-2"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.18, duration: 0.38 }}
                            >
                                {[
                                    { to: "/create", icon: "add_circle", label: "Create Contest", bg: "linear-gradient(135deg,#7ea9e8 0%,#628fd8 48%,#7ebf9a 100%)", color: "#08131f", shadow: "0 12px 26px rgba(32,112,255,0.16)", border: "1px solid rgba(132,173,255,0.2)" },
                                    { to: "/drafts", icon: "draft", label: "Access Drafts", bg: "linear-gradient(135deg,#243040 0%,#2a3747 48%,#364152 100%)", color: "#e8f0ff", shadow: "0 12px 26px rgba(15,23,42,0.16)", border: "1px solid rgba(148,163,184,0.18)" },
                                    ...(canAccessAdminDashboard ? [{ to: "/admin", icon: "admin_panel_settings", label: "Access Admin Dashboard", bg: "linear-gradient(135deg,#17304a 0%,#1e4260 48%,#2e5877 100%)", color: "#d9ecff", shadow: "0 12px 26px rgba(10,21,37,0.18)", border: "1px solid rgba(132,173,255,0.16)" }] : []),
                                ].map((btn) => (
                                    <motion.div key={btn.to} whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 380, damping: 18 }}>
                                        <Link to={btn.to} className="inline-block font-headline font-black uppercase tracking-widest rounded-sm" style={{ padding: "0.95rem 1.35rem", color: btn.color, background: btn.bg, boxShadow: btn.shadow, border: btn.border }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: "1rem", verticalAlign: "middle", marginRight: "0.5rem" }}>{btn.icon}</span>
                                            {btn.label}
                                        </Link>
                                    </motion.div>
                                ))}
                            </motion.div>
                        ) : null}
                    </motion.section>

              
                    <motion.section
                        className="space-y-4"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.22, duration: 0.42 }}
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="contest-section-title contest-section-title--available text-lg font-bold font-headline tracking-tight flex items-center gap-2">
                                <span className="contest-section-icon material-symbols-outlined">radar</span>
                                AVAILABLE CONTESTS
                            </h2>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                                {availableContests.length} loaded
                            </span>
                        </div>

                        {availableContests.length === 0 ? (
                            <motion.div
                                className="bg-surface-container-low p-8 rounded-sm border border-dashed border-outline-variant/40 text-center"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                            >
                                <span className="material-symbols-outlined text-4xl text-on-surface-variant">trophy</span>
                                <h3 className="mt-4 text-lg font-bold font-headline uppercase">No Contests Found</h3>
                                <p className="mt-2 text-sm text-on-surface-variant">New rounds will appear here as soon as they are available.</p>
                            </motion.div>
                        ) : (
                            <motion.div
                                className="contest-grid contest-grid--cards grid grid-cols-1 gap-4"
                                variants={cardStagger}
                                initial="hidden"
                                animate="show"
                            >
                                {availableContests.map((contest) => (
                                    <motion.div className="contest-card-frame" key={contest.contest_id} variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }} whileHover={{ y: -3 }}>
                                        <ContestCard contest={contest} contestBaseUrl={contestBaseUrl} />
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </motion.section>

                    {/* ── Past contests ── */}
                    <motion.section
                        className="space-y-4"
                        variants={cardStagger}
                        initial="hidden"
                        animate="show"
                    >
                        <motion.div className="flex items-center justify-between" variants={fadeUp} transition={{ duration: 0.38 }}>
                            <h2 className="contest-section-title contest-section-title--past text-lg font-bold font-headline tracking-tight flex items-center gap-2">
                                <span className="contest-section-icon material-symbols-outlined">inventory_2</span>
                                PAST CONTESTS
                            </h2>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                                {pastContests.length} archived
                            </span>
                        </motion.div>

                        {pastContests.length === 0 ? (
                            <motion.div className="bg-surface-container-low p-8 rounded-sm border border-dashed border-outline-variant/40 text-center" variants={fadeUp}>
                                <span className="material-symbols-outlined text-4xl text-on-surface-variant">history</span>
                                <h3 className="mt-4 text-lg font-bold font-headline uppercase">No Past Contests Yet</h3>
                                <p className="mt-2 text-sm text-on-surface-variant">Completed contests will show up here once they have finished.</p>
                            </motion.div>
                        ) : (
                            <motion.div
                                className="contest-grid contest-grid--cards grid grid-cols-1 gap-4"
                                variants={cardStagger}
                            >
                                {pastContests.map((contest) => (
                                    <motion.div className="contest-card-frame" key={contest.contest_id} variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }} whileHover={{ y: -3 }}>
                                        <ContestCard contest={contest} contestBaseUrl={contestBaseUrl} />
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </motion.section>
                </div>

         
                <motion.aside
                    className="md:col-span-3 sidebar-shell space-y-6"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
                >
                    <Sidebar user={sidebarUser} />

                    <div className="bg-surface-container-low p-6 rounded-sm space-y-4">
                        <h4 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">
                            Platform Metrics
                        </h4>
                        <div className="space-y-4">
                            {[
                                { label: "Total Users", value: platformMetrics.total_users, cls: "text-secondary" },
                                { label: "Total Submissions", value: platformMetrics.total_submissions, cls: "text-on-surface" },
                                { label: "Server Latency", value: platformMetrics.server_latency_ms, cls: "text-primary", suffix: "ms" },
                            ].map(({ label, value, cls, suffix }) => (
                                <motion.div
                                    key={label}
                                    className="flex justify-between items-center text-[11px]"
                                    initial={{ opacity: 0, x: 12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + Math.random() * 0.2, duration: 0.35 }}
                                >
                                    <span className="text-on-surface-variant">{label}</span>
                                    <span className={cls}>
                                        <AnimatedMetric value={value} formatter={(v) => `${formatMetric(v)}${suffix || ""}`} />
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.aside>
            </main>

            <motion.button
                className="md:hidden fixed bottom-6 right-6 w-14 h-14 syntax-gradient rounded-sm shadow-2xl flex items-center justify-center text-on-background z-50"
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.08 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
            >
                <span className="material-symbols-outlined">search</span>
            </motion.button>
        </div>
    );
}

export default ContestsPage;