export const parseContestTime = (value) => {
    if (!value) {
        return Number.NaN;
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    const normalizedValue =
        typeof value === "string" && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value)
            ? `${value}Z`
            : value;

    return new Date(normalizedValue).getTime();
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
