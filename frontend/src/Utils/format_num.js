export const formatNumber = (value) => {
    return typeof value === "number"
        ? new Intl.NumberFormat().format(value)
        : "0";
};
