import { parseSafeUTCDate } from "./date_helpers";

export const parseContestTime = (value) => {
    return parseSafeUTCDate(value).getTime();
};

export const isLiveContest = (contest) => {
    if (contest.start_time && contest.end_time) {
        const now = Date.now();
        const start = parseContestTime(contest.start_time);
        const end = parseContestTime(contest.end_time);

        if (Number.isNaN(start) || Number.isNaN(end)) return false;

        return start <= now && now <= end;
    }
    return false;
};