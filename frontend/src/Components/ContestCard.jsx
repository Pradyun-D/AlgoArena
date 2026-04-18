import { isLiveContest } from "../Utils/is_live_contest";
import ReactMarkdown from "react-markdown";
import { formatDisplayText } from "../Utils/format_display_text";

const formatCardDate = (value) => {
    if (!value) {
        return "TBA";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
};

function ContestCard({ contest, contestBaseUrl }) {
    const isLive = isLiveContest(contest);
    const isCompleted = String(contest?.status || "").toLowerCase() === "completed";
    const participantCount = Number(contest?.participants_count ?? contest?.participants ?? 0);

    const accentClass = isLive
        ? "contest-card--live"
        : isCompleted
            ? "contest-card--completed"
            : "contest-card--draft";

    const actionClass = isLive
        ? "syntax-gradient text-on-primary-fixed shadow-[0_18px_30px_rgba(57,101,255,0.28)]"
        : "bg-surface-container-high border border-outline-variant/20 text-on-surface hover:bg-surface-container-highest";

    const badgeLabel = isLive
        ? "Live Now"
        : isCompleted
            ? "Completed"
            : formatDisplayText(contest.status || "Scheduled");
    const previewDescription = contest.description || "Open the contest dashboard to view details, problems, leaderboard, and actions for this round.";
    const scheduleLabel = isLive
        ? "Ends"
        : "Starts";
    const scheduleValue = isLive ? contest.end_time : contest.start_time;

    return (
        <article className={`contest-card group min-w-0 ${accentClass}`}>
            <div className="contest-card__glow" />
            <div className="contest-card__accent" />

            <div className="contest-card__content">
                <div className="contest-card__header">
                    <div className="contest-card__title-block">
                        <p className="contest-card__eyebrow">Contest</p>
                        <h3 className="contest-card__title">
                            {formatDisplayText(contest.title || "Untitled Contest")}
                        </h3>
                    </div>

                    <span className="contest-card__badge">
                        {badgeLabel}
                    </span>
                </div>

                <div className="contest-card__meta">
                    <div className="contest-card__chip contest-card__chip--count">
                        <span className="contest-card__chip-label">Registered participants</span>
                        <span className="contest-card__chip-value">
                            {participantCount.toLocaleString("en-IN")}
                        </span>
                    </div>

                    <div className="contest-card__chip contest-card__chip--schedule">
                        <span className="contest-card__chip-label">{scheduleLabel}</span>
                        <span className="contest-card__chip-value contest-card__chip-value--small">
                            {formatCardDate(scheduleValue)}
                        </span>
                    </div>
                </div>

                <div className="contest-card__description prose prose-invert max-w-none break-words text-on-surface-variant">
                    <ReactMarkdown>{previewDescription}</ReactMarkdown>
                </div>

                <a
                    href={`${contestBaseUrl}${contest.contest_id}/`}
                    className={`contest-card__action ${actionClass}`}
                >
                    View Contest
                </a>
            </div>
        </article>
    );
}

export default ContestCard;
