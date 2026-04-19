export const parseSafeUTCDate = (value) => {
    if (!value) return new Date(NaN);
    if (value instanceof Date) return value;

    let str = String(value).trim().replace(" ", "T");
    
    // Ensure it's treated as UTC by appending 'Z' if missing
    if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(str)) {
        str += "Z";
    }

    return new Date(str);
};