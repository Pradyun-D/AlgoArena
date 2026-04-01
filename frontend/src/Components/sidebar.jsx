import { formatNumber } from "../Utils/format_num";

function Sidebar({ user }) {
    const registeredRounds = Array.isArray(user.registered_rounds) ? user.registered_rounds : [];

    return (
        <div className="bg-surface-container-low p-6 rounded-sm space-y-8 border-t-2 border-primary">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-sm bg-surface-container flex items-center justify-center text-primary border border-outline-variant/20">
                    <span className="material-symbols-outlined text-3xl">terminal</span>
                </div>
                <div>
                    <h3 className="text-sm font-bold font-headline uppercase tracking-tighter">
                        {user.username || "guest_user"}
                    </h3>
                    <span className="text-[10px] text-secondary">
                        {typeof user.rating === "number" && user.rating > 0
                            ? `Rating (${formatNumber(user.rating)})`
                            : "Unrated"}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="bg-surface-container p-3 rounded-sm">
                    <span className="block text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mb-1">
                        Total Solved
                    </span>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-black font-headline leading-none">
                            {formatNumber(user.total_solved)}
                        </span>
                        <span className="text-[10px] text-secondary font-bold">Problems Solved</span>
                    </div>
                </div>

                <div className="bg-surface-container p-3 rounded-sm">
                    <span className="block text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mb-1">
                        Average Rank
                    </span>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-black font-headline leading-none">
                            {typeof user.avg_rank === "number"
                                ? `#${formatNumber(user.avg_rank)}`
                                : "N/A"}
                        </span>
                        <span className="text-[10px] text-primary font-bold">
                            {user.top_percentile
                                ? `Top ${user.top_percentile}%`
                                : "No contest history yet"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] border-b border-outline-variant/20 pb-2">
                    Registered Rounds
                </h4>

                {registeredRounds.length > 0 ? (
                    <div className="space-y-3">
                        {registeredRounds.map((round, index) => (
                            <div className="flex items-center gap-3" key={`${round.title || "round"}-${index}`}>
                                <div className={`w-1 h-8 rounded-full ${round.is_live ? "bg-secondary" : "bg-primary"}`}></div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase leading-tight">
                                        {round.title}
                                    </p>
                                    <p className="text-[9px] text-on-surface-variant">
                                        {round.subtitle}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                        No registered contests yet
                    </p>
                )}
            </div>
        </div>
    );
}

export default Sidebar;
