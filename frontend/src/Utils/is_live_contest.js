export const isLiveContest = (contest) => {
    if (contest.start_time && contest.end_time) {
        const now = Date.now();
        const start = new Date(contest.start_time).getTime();
        const end = new Date(contest.end_time).getTime();

        if (Number.isNaN(start) || Number.isNaN(end)) return false;

        return start <= now && now <= end;
    }
    return false;
};
