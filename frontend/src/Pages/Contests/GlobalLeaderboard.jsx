import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../../Utils/api";
import ArenaNavbar from "../../Components/ArenaNavbar";
import { motion } from "motion/react";
import LoadingPage from "../Auth_and_Profile/LoadingPage";
import ErrorPage from "../Auth_and_Profile/ErrorPage";
import { clearStoredAuthUser, getStoredAuthUser } from "../../Utils/auth_storage";
import { fetchSessionUser } from "../../Utils/session_auth";

function GlobalLeaderboard() {
    const navigate = useNavigate();
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    
    const [authUser, setAuthUser] = useState(() => getStoredAuthUser());

    useEffect(() => {
        let isMounted = true;
        
        const fetchLeaderboard = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/accounts/api/leaderboard/`, { withCredentials: true });
                if (response.status === 200 && isMounted) {
                    setLeaderboard(response.data.leaderboard);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err.response?.data?.error || "Failed to load global standings.");
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
    }, []);


    if (loading) return <LoadingPage title="Loading Global Standings" subtitle="Crunching average performance points across all contests..." />;
    
    if (error) {
        return <ErrorPage kicker="Leaderboard Error" code="500" title="Standings Not Found" copy={error} primaryAction={{ to: `/contests`, label: "Back to Contests" }} />;
    }

    const navLinks = [
        { label: "Contests", to: "/contests", active: false },
        { label: "Global Leaderboard", to: "/leaderboard", active: true },
        { label: "My Submissions", to: "/submissions", active: false },
    ];

    return (
        <div className="bg-background text-on-background min-h-screen">
            <ArenaNavbar navLinks={navLinks} authUser={authUser} />
            
            <main className="max-w-[1400px] mx-auto pt-24 px-6 pb-12">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <div className="flex items-center justify-between mb-8">
                        <h1 className="text-3xl font-black uppercase text-on-background font-headline tracking-tight">
                            Global Leaderboard <span className="text-primary material-symbols-outlined align-middle ml-2">public</span>
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
                                <th className="px-4 py-4 font-bold border-r border-outline-variant/20 text-center w-12">Rank</th>
                                <th className="px-4 py-4 font-bold border-r border-outline-variant/20 min-w-[200px]">Participant</th>
                                <th className="px-4 py-4 font-black border-r border-outline-variant/20 text-center w-32 text-on-surface">Average Contest Score</th>
                            </tr>
                        </thead>
                        <tbody className="font-mono text-[13px]">
                            {leaderboard.map((user, i) => (
                                <tr key={user.user_id} className={`border-b border-outline-variant/20 hover:bg-surface-container-highest transition-colors ${i % 2 === 0 ? "bg-surface-container" : "bg-surface-container-low"}`}>
                                    <td className="px-4 py-3 text-center border-r border-outline-variant/20 text-on-surface-variant font-bold text-[14px]">
                                        #{user.rank}
                                    </td>
                                    <td className="px-4 py-3 border-r border-outline-variant/20 font-bold text-on-surface">
                                        <div className="flex items-center gap-3">
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt={user.username} className="w-8 h-8 rounded-full border border-outline-variant/50" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase">
                                                    {user.username.charAt(0)}
                                                </div>
                                            )}
                                            <div className="flex flex-col">
                                                <span className="hover:text-primary transition-colors cursor-pointer">{user.username}</span>
                                                {user.full_name && user.full_name !== user.username && (
                                                    <span className="text-[10px] text-on-surface-variant font-sans">{user.full_name}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center border-r border-outline-variant/20 font-black text-on-surface text-[15px]">
                                        {user.average_performance_score}%
                                    </td>
                                </tr>
                            ))}
                            {leaderboard.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-16 text-center text-on-surface-variant italic font-sans text-sm">
                                        No participants on the platform yet.
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

export default GlobalLeaderboard;
