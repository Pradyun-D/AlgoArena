import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import LoadingPage from "../Pages/Auth_and_Profile/LoadingPage";
import ErrorPage from "../Pages/Auth_and_Profile/ErrorPage";
import { fetchSessionUser } from "../Utils/session_auth";

function AdminRoute({ children }) {
    const [state, setState] = useState({
        loading: true,
        allowed: false,
        error: "",
    });

    useEffect(() => {
        let isMounted = true;

        fetchSessionUser()
            .then((user) => {
                if (!isMounted) {
                    return;
                }

                if (user?.status && user.status !== "active") {
                    setState({ loading: false, allowed: false, error: "" });
                    return;
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
        return <Navigate to="/" replace />;
    }

    return children;
}

export default AdminRoute;
