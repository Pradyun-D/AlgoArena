import { useEffect, useState } from "react";
import ContestCard from "../Components/ContestCard";
import Sidebar from "../Components/Sidebar";

function ContestsPage() {
    const [contests, setContests] = useState([]);
    const [user, setUser] = useState({});

    const contestBaseUrl = "/contest/";
    const leaderboardUrl = contests.length > 0
        ? `/leaderboard/${contests[0].contest_id}/`
        : "/contests";

    useEffect(() => {
        fetch("http://127.0.0.1:8000/contests/api/contests/?format=json")
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Contests request failed with ${res.status}`);
                }
                return res.json();
            })
            .then((data) => setContests(Array.isArray(data) ? data : []))
            .catch(() => setContests([]));

        fetch("/api/user/")
            .then((res) => {
                if (!res.ok) {
                    return null;
                }
                return res.json();
            })
            .then((data) => setUser(data || {}))
            .catch(() => setUser({}));
    }, []);

    return (
        <div className="contest-page bg-background text-on-background min-h-screen">
            <nav className="nav-shell fixed top-0 left-0 right-0 z-50 flex justify-between items-center w-full px-6 h-16 border-none">
                <div className="flex items-center gap-8">
                    <a className="text-2xl font-black tracking-tighter text-primary font-headline uppercase" href="/contests">
                        AlgoArena
                    </a>
                    <div className="hidden md:flex gap-6 h-full items-center">
                        <a className="text-gray-500 hover:text-gray-300 transition-colors font-headline tracking-tight font-bold uppercase text-sm" href="/profile">
                            Dashboard
                        </a>
                        <a className="text-primary border-b-2 border-[#84adff] pb-1 font-headline tracking-tight font-bold uppercase text-sm" href="/contests">
                            Contests
                        </a>
                        <a className="text-gray-500 hover:text-gray-300 transition-colors font-headline tracking-tight font-bold uppercase text-sm" href={leaderboardUrl}>
                            Leaderboard
                        </a>
                        <a className="text-gray-500 hover:text-gray-300 transition-colors font-headline tracking-tight font-bold uppercase text-sm" href="/profile">
                            My Submissions
                        </a>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button className="p-2 text-gray-500 hover:bg-[#1a1a1a] transition-all rounded-sm scale-95 active:opacity-80">
                        <span className="material-symbols-outlined">notifications</span>
                    </button>
                    <button className="p-2 text-gray-500 hover:bg-[#1a1a1a] transition-all rounded-sm scale-95 active:opacity-80">
                        <span className="material-symbols-outlined">settings</span>
                    </button>
                    <div className="w-8 h-8 rounded-full bg-surface-container-highest overflow-hidden border border-outline-variant/20">
                        <img
                            className="w-full h-full object-cover"
                            alt="Developer avatar"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBn0TdTfqR870CXvGgzkQRK50fbGHgW4z1UOQe6CKKnkqOjE8pXi4yJi9X3RbAXs6oSw9loiGNy72cw9wZgk9xydSemrpY18fshrYeiq5pT2_zNGUnvHk7PJ23GEL72fd2pM2UXlUtvcqNAaS18PHHnm94rcwy8C6gpueAU8W0oNh3jjl3Xf294Y27Kf7EXMpmxjV9BJ1gSaA5XFKuNmjvY2pM5tMGvou9YBXG595ruH3pUHJjqgFUaKqTzikTYiO13Aejd5km66LI"
                        />
                    </div>
                </div>
            </nav>

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
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold font-headline tracking-tight text-secondary flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">sensors</span>
                                AVAILABLE CONTESTS
                            </h2>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                                {contests.length} loaded
                            </span>
                        </div>

                        {contests.length === 0 ? (
                            <div className="bg-surface-container-low p-8 rounded-sm border border-dashed border-outline-variant/40 text-center">
                                <span className="material-symbols-outlined text-4xl text-on-surface-variant">trophy</span>
                                <h3 className="mt-4 text-lg font-bold font-headline uppercase">No Contests Found</h3>
                                <p className="mt-2 text-sm text-on-surface-variant">
                                    New rounds will appear here as soon as they are available.
                                </p>
                            </div>
                        ) : (
                            <div className="contest-grid grid grid-cols-1 md:grid-cols-2 gap-4">
                                {contests.map((contest) => (
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
                    <Sidebar user={user} />

                    <div className="bg-surface-container-low p-6 rounded-sm space-y-4">
                        <h4 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">
                            Platform Metrics
                        </h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-on-surface-variant">Online Users</span>
                                <span className="text-secondary">42,891</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-on-surface-variant">Submissions / Day</span>
                                <span className="text-on-surface">1.2M</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-on-surface-variant">Server Latency</span>
                                <span className="text-primary">12ms</span>
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
