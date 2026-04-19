const toUTC = (value) => {
  if (!value) return new Date(NaN);
  const str = String(value).trim();
  return new Date(/Z|[+-]\d{2}:\d{2}$/.test(str) ? str : str + "Z");
};

const endTime = "2024-10-10T15:30:00Z";
console.log("Input:", endTime);
console.log("toUTC:", toUTC(endTime).getTime());
console.log("Date.now:", Date.now());
console.log("Ended:", toUTC(endTime).getTime() <= Date.now());
