import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import LoadingPage from "../Pages/LoadingPage";
import ErrorPage from "../Pages/ErrorPage";
import { clearStoredAuthUser, setStoredAuthUser } from "../Utils/auth_storage";
import { API_BASE_URL } from "../Utils/api";

function AdminRoute({ children }) {
    const [state, setState] = useState({
        loading: true,
        allowed: false,
        error: "",
    });

    useEffect(() => {
        let isMounted = true;

        axios.get(`${API_BASE_URL}/accounts/api/session/`, { withCredentials: true })
            .then((response) => {
                if (!isMounted) {
                    return;
                }

                const user = response.data?.user;
                if (user) {
                    setStoredAuthUser(user);
                }

                setState({
                    loading: false,
                    allowed: user?.role === "admin",
                    error: "",
                });
            })
            .catch((error) => {
                if (!isMounted) {
                    return;
                }

                if (error.response?.status === 401 || error.response?.status === 403) {
                    clearStoredAuthUser();
                    setState({ loading: false, allowed: false, error: "" });
                    return;
                }

                setState({
                    loading: false,
                    allowed: false,
                    error: error.response?.data?.error || "We could not verify your admin access.",
                });
            });

        return () => {
            isMounted = false;
        };
    }, []);

    if (state.loading) {
        return (
            <LoadingPage
                title="Checking admin access"
                subtitle="Verifying administrator permissions before opening the control panel."
            />
        );
    }

    if (state.error) {
        return (
            <ErrorPage
                kicker="Admin Access Error"
                code="500"
                title="Admin access could not be verified."
                copy={state.error}
                primaryAction={{ label: "Back To Contests", to: "/contests" }}
            />
        );
    }

    if (!state.allowed) {
        return <Navigate to="/contests" replace />;
    }

    return children;
}

export default AdminRoute;
