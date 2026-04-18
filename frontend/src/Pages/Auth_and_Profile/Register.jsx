import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { setStoredAuthUser } from "../../Utils/auth_storage";
import { API_BASE_URL } from "../../Utils/api";
import "../../Styles/auth_pages.css";
import ThemeToggle from "../../Components/ThemeToggle";

function RegisterPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        full_name: "",
        username: "",
        email: "",
        password: "",
        confirm_password: "",
    });
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
            const response = await axios.post(`${API_BASE_URL}/accounts/api/register/`, form);
            setStoredAuthUser(response.data.user);
            navigate("/profile/edit");
        } catch (err) {
            setError(
                err.response?.data?.error ||
                "Unable to initialize account right now. Please try again."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-page auth-page-register">
            <header className="auth-topbar">
                <Link className="auth-brand" to="/contests">ALGOARENA</Link>
                <div className="auth-topbar-actions">
                    <ThemeToggle />
                    <Link className="auth-topbar-link" to="/login">Login</Link>
                </div>
            </header>

            <main className="auth-main auth-grid-register">
                <section className="auth-panel auth-panel-register">
                    <div className="auth-panel-body">
                        <div className="auth-copy">
                            <p className="auth-kicker">Initialize Profile</p>
                            <h1 className="auth-title">Create Your Account</h1>
                            <p className="auth-description">
                                We only need the essentials now. You can update bio, college, and
                                avatar later from your profile settings.
                            </p>
                        </div>

                        <form className="auth-form auth-form-grid" onSubmit={handleSubmit}>
                            <div className="auth-field auth-field-full">
                                <label className="auth-label" htmlFor="full_name">Full Name</label>
                                <input
                                    id="full_name"
                                    name="full_name"
                                    className="auth-input"
                                    placeholder="Alan Turing"
                                    value={form.full_name}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="auth-field">
                                <label className="auth-label" htmlFor="username">Username</label>
                                <input
                                    id="username"
                                    name="username"
                                    className="auth-input"
                                    placeholder="syntax_hero"
                                    value={form.username}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="auth-field">
                                <label className="auth-label" htmlFor="email">Email</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    className="auth-input"
                                    placeholder="dev@algoarena.io"
                                    value={form.email}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="auth-field">
                                <label className="auth-label" htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    className="auth-input"
                                    placeholder="********"
                                    value={form.password}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="auth-field">
                                <label className="auth-label" htmlFor="confirm_password">Confirm Password</label>
                                <input
                                    id="confirm_password"
                                    name="confirm_password"
                                    type="password"
                                    className="auth-input"
                                    placeholder="********"
                                    value={form.confirm_password}
                                    onChange={handleChange}
                                />
                            </div>

                            {error ? <p className="auth-error auth-field-full">{error}</p> : null}

                            <div className="auth-field-full">
                                <button className="auth-submit" type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Initializing..." : "Initialize Account"}
                                </button>
                            </div>
                        </form>

                        <p className="auth-footer-copy">
                            Already registered? <Link to="/login">Start Session</Link>
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default RegisterPage;
