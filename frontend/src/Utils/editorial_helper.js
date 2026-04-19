// src/Utils/editorial_helpers.js

export const normalizeDifficulty = (d) => {
  const v = String(d || "").toLowerCase().trim();
  if (v === "easy")   return "is-easy";
  if (v === "medium") return "is-medium";
  if (v === "hard")   return "is-hard";
  return "";
};


export const parseSafeUTCDate = (value) => {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  
  let str = String(value).trim().replace(" ", "T");
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(str)) {
      str += "Z";
  }
  return new Date(str);
};

export const formatDate = (value) => {
  if (!value) return null;
  const d = parseSafeUTCDate(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

/** Returns a human-readable remaining duration string, e.g. "2h 34m 10s" */
export const formatRemaining = (ms) => {
  if (ms <= 0) return "0s";
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};