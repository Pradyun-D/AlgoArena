import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../../Utils/api";
import ArenaNavbar from "../../Components/ArenaNavbar";
import { motion } from "motion/react";
import LoadingPage from "../Auth_and_Profile/LoadingPage";
import ErrorPage from "../Auth_and_Profile/ErrorPage";
import { clearStoredAuthUser, getStoredAuthUser } from "../../Utils/auth_storage";
import { fetchSessionUser } from "../../Utils/session_auth";

function Leaderboard() {
    const { contestId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState({ leaderboard: [], problems: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    
    const [authUser, setAuthUser] = useState(() => getStoredAuthUser());

    useEffect(() => {
        let isMounted = true;
        
        const fetchLeaderboard = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/contests/${contestId}/leaderboard/`, { withCredentials: true });
                if (response.data.status === 200 && isMounted) {
                    setData(response.data.data);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err.response?.data?.error || "Failed to load standings.");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        const syncSessionUser = async () => {
            try {
                const userData = await fetchSessionUser();
                if (isMounted) setAuthUser(userData);
            } catch {
                if (isMounted) setAuthUser(getStoredAuthUser());
            }
        };

        fetchLeaderboard();
        syncSessionUser();

        return () => {
            isMounted = false;
        };
    }, [contestId]);

    const handleLogout = async () => {
        try {
            await axios.post(`${API_BASE_URL}/accounts/api/logout/`, {}, { withCredentials: true });
        } catch { /* ignore */ } finally {
            clearStoredAuthUser(); 
            setAuthUser(null);
            navigate("/", { replace: true });
        }
    };

    if (loading) return <LoadingPage title="Loading Standings" subtitle="Crunching the latest points and penalties..." />;
    
    if (error) {
        return <ErrorPage kicker="Leaderboard Error" code="500" title="Standings Not Found" copy={error} primaryAction={{ to: `/contest/${contestId}/`, label: "Back to Contest" }} />;
    }

    const navLinks = [
        { label: "Overview", to: `/contest/${contestId}/`, active: false },
        { label: "Leaderboard", to: `/contest/${contestId}/leaderboard`, active: true },
        { label: "My Submissions", to: "/submissions", active: false },
    ];

    return (
        <div className="bg-background text-on-background min-h-screen">
            <ArenaNavbar navLinks={navLinks} authUser={authUser} onLogout={handleLogout} />
            
            <main className="max-w-[1400px] mx-auto pt-24 px-6 pb-12">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <div className="flex items-center justify-between mb-8">
                        <h1 className="text-3xl font-black uppercase text-on-background font-headline tracking-tight">
                            Standings <span className="text-primary material-symbols-outlined align-middle ml-2">format_list_numbered</span>
                        </h1>
                    </div>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="overflow-x-auto bg-surface-container rounded-sm border border-outline-variant/30 shadow-xl"
                >
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead>
                            <tr className="bg-surface-container-high border-b border-outline-variant/30 text-[11px] text-on-surface-variant uppercase tracking-wider">
                                <th className="px-4 py-4 font-bold border-r border-outline-variant/20 text-center w-12">#</th>
                                <th className="px-4 py-4 font-bold border-r border-outline-variant/20 min-w-[200px]">Who</th>
                                <th className="px-4 py-4 font-black border-r border-outline-variant/20 text-center w-20 text-on-surface">
                                    <div className="text-sm">=</div>
                                </th>
                                {data.problems.map(p => (
                                    <th key={p.problem_id} className="px-4 py-2 text-center border-r border-outline-variant/20 w-24">
                                        <Link to={`/contest/${contestId}/problems/${p.problem_id}`} className="hover:text-primary transition-colors block">
                                            <div className="text-[14px] font-black">{p.letter}</div>
                                            <div className="text-[10px] text-on-surface-variant font-normal">{p.max_score}</div>
                                        </Link>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="font-mono text-[13px]">
                            {data.leaderboard.map((user, i) => (
                                <tr key={user.user_id} className={`border-b border-outline-variant/20 hover:bg-surface-container-highest transition-colors ${i % 2 === 0 ? "bg-surface-container" : "bg-surface-container-low"}`}>
                                    <td className="px-4 py-3 text-center border-r border-outline-variant/20 text-on-surface-variant">{user.rank}</td>
                                    <td className="px-4 py-3 border-r border-outline-variant/20 font-bold text-on-surface hover:text-primary transition-colors cursor-pointer">{user.username}</td>
                                    <td className="px-4 py-3 text-center border-r border-outline-variant/20 font-black text-on-surface">
                                        {user.total_score}
                                    </td>
                                    
                                    {data.problems.map(p => {
                                        const scoreData = user.scores[p.problem_id];
                                        const hasScore = scoreData && scoreData.score > 0;
                                        
                                        return (
                                            <td key={p.problem_id} className="px-4 py-3 text-center border-r border-outline-variant/20">
                                                {hasScore ? (
                                                    <div className="flex flex-col items-center justify-center">
                                                        <span className="text-primary font-bold text-[14px]">{scoreData.score}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-outline-variant/50"></span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            {data.leaderboard.length === 0 && (
                                <tr>
                                    <td colSpan={data.problems.length + 3} className="px-4 py-16 text-center text-on-surface-variant italic font-sans text-sm">
                                        No participants have submitted scores yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </motion.div>
            </main>
        </div>
    );
}

export default Leaderboard;
