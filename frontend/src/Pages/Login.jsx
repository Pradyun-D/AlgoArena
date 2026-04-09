import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { setStoredAuthUser } from "../Utils/auth_storage";
import "../Styles/auth_pages.css";

function LoginPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ identifier: "", password: "" });
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            const response = await axios.post("http://127.0.0.1:8000/accounts/api/login/", form);
            setStoredAuthUser(response.data.user);
            navigate("/contests");
        } catch (err) {
            setError(
                err.response?.data?.error ||
                "Unable to start session right now. Please verify your credentials."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-page auth-page-login">
            <header className="auth-topbar">
                <Link className="auth-brand" to="/contests">ALGO_ARENA</Link>
                <div className="auth-topbar-actions">
                    <Link className="auth-topbar-link" to="/register">CREATE_ACCOUNT</Link>
                </div>
            </header>

            <main className="auth-main auth-grid-login">
                <section className="auth-panel auth-panel-terminal">
                    <div className="auth-panel-chrome">
                        <span className="auth-dot auth-dot-red"></span>
                        <span className="auth-dot auth-dot-amber"></span>
                        <span className="auth-dot auth-dot-green"></span>
                        <span className="auth-chrome-label">Session_Initialize.sh</span>
                    </div>

                    <div className="auth-panel-body">
                        <div className="auth-copy">
                            <p className="auth-kicker">Encrypted Tunnel</p>
                            <h1 className="auth-title">Identify Yourself</h1>
                            <p className="auth-description">
                                Sign in with your existing AlgoArena handle to access contests,
                                saved preferences, and future personalized modules.
                            </p>
                        </div>

                        <form className="auth-form" onSubmit={handleSubmit}>
                            <label className="auth-label" htmlFor="identifier">Username / Email</label>
                            <input
                                id="identifier"
                                name="identifier"
                                className="auth-input"
                                placeholder="root@algoarena.io"
                                value={form.identifier}
                                onChange={handleChange}
                            />

                            <label className="auth-label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                className="auth-input"
                                placeholder="••••••••"
                                value={form.password}
                                onChange={handleChange}
                            />

                            {error ? <p className="auth-error">{error}</p> : null}

                            <button className="auth-submit" type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "EXECUTING..." : "EXECUTE_LOGIN"}
                            </button>
                        </form>

                        <p className="auth-footer-copy">
                            New operator? <Link to="/register">CREATE_ACCOUNT</Link>
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default LoginPage;
