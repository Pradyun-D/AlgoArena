const contests = JSON.parse(document.getElementById("contests-data").textContent);
const sidebarUser = JSON.parse(document.getElementById("sidebar-user-data").textContent);

const {
    contestBaseUrl,
    leaderboardBaseUrl
} = window.APP_CONFIG;

const contestList = document.getElementById("contest-list");
const contestCount = document.getElementById("contest-count");
const emptyState = document.getElementById("empty-state");
const navbarLeaderboardLink = document.getElementById("navbar-leaderboard-link");

const sidebarUsername = document.getElementById("sidebar-username");
const sidebarRating = document.getElementById("sidebar-rating");
const sidebarTotalSolved = document.getElementById("sidebar-total-solved");
const sidebarAvgRank = document.getElementById("sidebar-avg-rank");
const sidebarTopPercentile = document.getElementById("sidebar-top-percentile");

const registeredRoundsList = document.getElementById("registered-rounds-list");
const registeredRoundsEmpty = document.getElementById("registered-rounds-empty");

const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const isLiveContest = (contest) => {
    if (contest.start_time && contest.end_time) {
        const now = Date.now();
        const start = new Date(contest.start_time).getTime();
        const end = new Date(contest.end_time).getTime();

        if (Number.isNaN(start) || Number.isNaN(end)) return false;

        return start <= now && now <= end;
    }
    return false;
};

const buildContestCard = (contest) => {
    const isLive = isLiveContest(contest);

    const accentClass = isLive ? "border-secondary text-secondary" : "border-primary text-primary";
    const accentTextClass = isLive ? "text-secondary" : "text-primary";
    const actionClass = isLive
        ? "syntax-gradient text-on-primary-fixed"
        : "bg-surface-container-high border border-outline-variant/20 text-on-surface";

    const badgeLabel = isLive ? "Live Now" : (contest.status || "Scheduled");

    return `
        <article class="bg-surface-container p-6 rounded-sm border-l-4 ${accentClass}">
            <div class="flex justify-between mb-6">
                <div>
                    <span class="text-xs font-bold uppercase ${accentTextClass}">
                        Contest #${escapeHtml(contest.contest_id)}
                    </span>
                    <h3 class="text-xl font-bold mt-1 uppercase">
                        ${escapeHtml(contest.title)}
                    </h3>
                </div>
                <span class="text-[10px] font-bold">
                    ${escapeHtml(badgeLabel)}
                </span>
            </div>

            <p class="text-sm mb-6">${escapeHtml(contest.description)}</p>

            <a href="${contestBaseUrl}${encodeURIComponent(contest.contest_id)}/"
               class="block w-full py-3 ${actionClass} text-center">
               View Contest
            </a>
        </article>
    `;
};

const formatNumber = (value) =>
    typeof value === "number" ? new Intl.NumberFormat().format(value) : "0";

// Sidebar
sidebarUsername.textContent = sidebarUser.username || "guest_user";
sidebarRating.textContent =
    typeof sidebarUser.rating === "number" && sidebarUser.rating > 0
        ? `Rating (${formatNumber(sidebarUser.rating)})`
        : "Unrated";

sidebarTotalSolved.textContent = formatNumber(sidebarUser.total_solved);
sidebarAvgRank.textContent =
    typeof sidebarUser.avg_rank === "number"
        ? `#${formatNumber(sidebarUser.avg_rank)}`
        : "N/A";

sidebarTopPercentile.textContent =
    sidebarUser.top_percentile
        ? `Top ${sidebarUser.top_percentile}%`
        : "No contest history yet";

// Leaderboard link
if (contests.length > 0 && navbarLeaderboardLink) {
    navbarLeaderboardLink.href =
        `${leaderboardBaseUrl}${encodeURIComponent(contests[0].contest_id)}/leaderboard/`;
}

// Contests
contestCount.textContent = `${contests.length} loaded`;

if (contests.length === 0) {
    emptyState.classList.remove("hidden");
} else {
    contestList.innerHTML = contests.map(buildContestCard).join("");
}
