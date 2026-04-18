import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../../Utils/api";
import { getStoredAuthUser, setStoredAuthUser } from "../../Utils/auth_storage";
import "../../Styles/auth_pages.css";
import ThemeToggle from "../../Components/ThemeToggle";
import { useTheme } from "../../Theme/ThemeProvider";
import ErrorPage from "../Auth_and_Profile/ErrorPage";

function ContestRegistrationPage() {
    const navigate = useNavigate();
    const { contestId } = useParams();
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState("");
    const [errorStatus, setErrorStatus] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [checkingRegistration, setCheckingRegistration] = useState(true);
    const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
    const { isDarkMode } = useTheme();

    useEffect(() => {
        let isMounted = true;

        axios.get(`${API_BASE_URL}/accounts/api/session/`, { withCredentials: true })
            .then((response) => {
                if (!isMounted) {
                    return;
                }

                const user = response.data?.user || null;
                if (user) {
                    setStoredAuthUser(user);
                }
                setAuthUser(user);
            })
            .catch(() => {
                if (isMounted) {
                    setAuthUser(getStoredAuthUser());
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const checkRegistrationStatus = async () => {
            try {
                setCheckingRegistration(true);
                setError("");
                setErrorStatus(null);

                const response = await axios.get(
                    `${API_BASE_URL}/contests/${contestId}/details/`,
                    { withCredentials: true }
                );

                if (!isMounted) {
                    return;
                }

                const contest = response.data?.data?.contest;
                if (!contest) {
                    throw new Error(response.data?.message || "Contest data not found.");
                }

                if (contest.is_registered) {
                    navigate(`/contest/${contestId}/`, { replace: true });
                }
            } catch (err) {
                if (isMounted) {
                    setErrorStatus(err.response?.status ?? null);
                    setError(
                        err.response?.data?.message ||
                        err.response?.data?.error ||
                        err.message ||
                        "Unable to verify contest registration."
                    );
                }
            } finally {
                if (isMounted) {
                    setCheckingRegistration(false);
                }
            }
        };

        if (contestId) {
            checkRegistrationStatus();
        }

        return () => {
            isMounted = false;
        };
    }, [contestId, navigate]);

    useEffect(() => {
        if (!authUser) {
            return;
        }

        if (["problem_setter", "admin"].includes(authUser.role)) {
            navigate(`/contest/${contestId}/`, { replace: true });
        }
    }, [authUser, contestId, navigate]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!agreed) {
            setError("You must agree to the terms and conditions to register.");
            return;
        }
        setError("");
        setSubmitting(true);
        try {
            await axios.post(`${API_BASE_URL}/contests/${contestId}/register/`, {}, { withCredentials: true });
            navigate(`/contest/${contestId}/`);
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.message || "Registration failed. You may already be registered or an error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={`auth-page auth-page-login ${isDarkMode ? 'dark-mode' : ''}`}>
            {error && (errorStatus === 403 || /contest is running/i.test(error)) ? (
                <ErrorPage
                    kicker="Contest Locked"
                    code="403"
                    title="Contest is running"
                    copy={error}
                    primaryAction={{ to: `/contest/${contestId}/`, label: "Back to Contest" }}
                    secondaryAction={{ to: "/contests", label: "View Contests" }}
                />
            ) : (
            <>
            <header className="auth-topbar">
                <Link className="auth-brand" to="/contests">ALGOARENA</Link>
                <div className="auth-topbar-actions">
                    <ThemeToggle />
                    <Link className="auth-topbar-link" to={`/contest/${contestId}/`}>BACK TO CONTEST</Link>
                </div>
            </header>
            <main className="auth-main auth-grid-login">
                <section className="auth-panel auth-panel-terminal">
                    <div className="auth-panel-chrome">
                        <span className="auth-dot auth-dot-red"></span>
                        <span className="auth-dot auth-dot-amber"></span>
                        <span className="auth-dot auth-dot-green"></span>
                        <span className="auth-chrome-label">Contest_Registration.sh</span>
                    </div>
                    <div className="auth-panel-body">
                        <div className="auth-copy">
                            <p className="auth-kicker">Final Confirmation</p>
                            <h1 className="auth-title">Terms of Engagement</h1>
                            <p className="auth-description" style={{ maxWidth: 'none' }}>
                                By registering for this contest, you agree to the following terms:
                            </p>
                            <ul className="list-disc list-inside text-on-surface-variant text-sm space-y-2 my-4">
                                <li>All submissions must be your own original work.</li>
                                <li>Do not share solutions or collaborate with other participants during the contest.</li>
                                <li>The decisions of the judges are final.</li>
                                <li>Violation of these rules may result in disqualification and a ban from the platform.</li>
                            </ul>
                        </div>
                        {checkingRegistration ? (
                            <div className="auth-form">
                                <p className="auth-description">Checking your registration status...</p>
                            </div>
                        ) : (
                            <form className="auth-form" onSubmit={handleSubmit}>
                                <div className="flex items-center gap-2 mb-4">
                                    <input id="agree-terms" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-4 h-4 accent-primary" />
                                    <label htmlFor="agree-terms" className="auth-label" style={{ marginBottom: 0 }}>
                                        I agree to the terms and conditions.
                                    </label>
                                </div>
                                {error && <p className="auth-error">{error}</p>}
                                <button className="auth-submit" type="submit" disabled={!agreed || submitting}>
                                    {submitting ? 'REGISTERING...' : 'CONFIRM REGISTRATION'}
                                </button>
                            </form>
                        )}
                    </div>
                </section>
            </main>
            </>
            )}
        </div>
    );
}

export default ContestRegistrationPage;
