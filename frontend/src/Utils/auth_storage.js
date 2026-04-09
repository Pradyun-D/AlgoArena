const AUTH_STORAGE_KEY = "algoarena_auth_user";

export const getStoredAuthUser = () => {
    try {
        const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const setStoredAuthUser = (user) => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
};

export const clearStoredAuthUser = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
};
