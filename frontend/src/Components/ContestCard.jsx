import { isLiveContest } from "../Utils/is_live_contest";
import ReactMarkdown from "react-markdown";

function ContestCard({ contest, contestBaseUrl }) {
    const isLive = isLiveContest(contest);
    const isCompleted = contest?.end_time
        ? new Date(contest.end_time).getTime() < Date.now()
        : false;

    const accentClass = isLive
        ? "border-secondary text-secondary"
        : "border-primary text-primary";
    const accentTextClass = isLive ? "text-secondary" : "text-primary";

    const actionClass = isLive
        ? "syntax-gradient text-on-primary-fixed"
        : "bg-surface-container-high border border-outline-variant/20 text-on-surface";

    const badgeLabel = isLive
        ? "Live Now"
        : isCompleted
            ? "Completed"
            : (contest.status || "Scheduled");

    return (
        <article className={`min-w-0 overflow-hidden bg-surface-container p-6 rounded-sm border-l-4 ${accentClass} transition-all hover:bg-surface-container-highest`}>
            <div className="flex justify-between items-start gap-4 mb-6">
                <div>
                    <span className={`text-xs font-bold uppercase tracking-widest font-headline ${accentTextClass}`}>
                        Contest #{contest.contest_id}
                    </span>
                    <h3 className="text-xl font-bold font-headline mt-1 uppercase">
                        {contest.title}
                    </h3>
                </div>

                <span className="bg-surface-container-low text-on-surface-variant px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-tight">
                    {badgeLabel}
                </span>
            </div>

            <div className="text-on-surface-variant text-sm leading-6 mb-6 min-h-12 prose prose-invert max-w-none break-words [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-sm [&_img]:block [&_img]:my-3 [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto">
            <ReactMarkdown>
                {contest.description || "Open the contest dashboard to view details, problems, leaderboard, and actions for this round."}
            </ReactMarkdown>
            </div>

            <a
                href={`${contestBaseUrl}${contest.contest_id}/`}
                className={`block w-full py-3 ${actionClass} font-bold text-sm uppercase tracking-widest rounded-sm text-center transition-all`}
            >
                View Contest
            </a>
        </article>
    );
}

export default ContestCard;
