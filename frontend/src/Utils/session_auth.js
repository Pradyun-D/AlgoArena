import axios from "axios";
import { API_BASE_URL } from "./api";
import { clearStoredAuthUser, setStoredAuthUser } from "./auth_storage";

let refreshRequest = null;

const refreshSession = async () => {
    if (!refreshRequest) {
        refreshRequest = axios.post(
            `${API_BASE_URL}/accounts/api/refresh-session/`,
            {},
            { withCredentials: true }
        ).finally(() => {
            refreshRequest = null;
        });
    }

    return refreshRequest;
};

export const fetchSessionUser = async () => {
    const loadSessionUser = async () => {
        const response = await axios.get(`${API_BASE_URL}/accounts/api/session/`, {
            withCredentials: true,
        });
        return response.data?.user || null;
    };

    try {
        const user = await loadSessionUser();
        if (user) {
            setStoredAuthUser(user);
            return user;
        }
    } catch (error) {
        if (![401, 403].includes(error.response?.status)) {
            throw error;
        }
    }

    try {
        await refreshSession();
        const refreshedUser = await loadSessionUser();
        if (refreshedUser) {
            setStoredAuthUser(refreshedUser);
            return refreshedUser;
        }
    } catch {
        // Fall through to the shared logout state below.
    }

    clearStoredAuthUser();
    return null;
};
