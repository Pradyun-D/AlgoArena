import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import LoadingPage from "../Pages/LoadingPage";
import ErrorPage from "../Pages/ErrorPage";
import { clearStoredAuthUser, setStoredAuthUser } from "../Utils/auth_storage";
import { API_BASE_URL } from "../Utils/api";

function ProblemSetterRoute({ children }) {
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
                    allowed: user?.role === "problem_setter" || user?.role === "admin",
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
                    error: error.response?.data?.error || "We could not verify your contest creation access.",
                });
            });

        return () => {
            isMounted = false;
        };
    }, []);

    if (state.loading) {
        return (
            <LoadingPage
                title="Checking contest access"
                subtitle="Verifying your role before opening the contest editor."
            />
        );
    }

    if (state.error) {
        return (
            <ErrorPage
                kicker="Access Check Error"
                code="500"
                title="Contest access could not be verified."
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

export default ProblemSetterRoute;
