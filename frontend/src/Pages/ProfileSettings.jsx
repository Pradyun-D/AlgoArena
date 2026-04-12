import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getStoredAuthUser, setStoredAuthUser } from "../Utils/auth_storage";
import { API_BASE_URL } from "../Utils/api";
import "../Styles/auth_pages.css";

function ProfileSettingsPage() {
    const navigate = useNavigate();
    const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
    const [form, setForm] = useState({
        username: "",
        full_name: "",
        bio: "",
        avatar_url: "",
        college: "",
    });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!authUser) {
            navigate("/login");
            return;
        }

        setForm({
            username: authUser.username || "",
            full_name: authUser.profile?.full_name || "",
            bio: authUser.profile?.bio || "",
            avatar_url: authUser.profile?.avatar_url || "",
            college: authUser.profile?.college || "",
        });
    }, [authUser, navigate]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!authUser?.uuid) {
            return;
        }

        setError("");
        setSuccess("");
        setIsSubmitting(true);

        try {
            const response = await axios.put(
                `${API_BASE_URL}/accounts/api/profile/${authUser.uuid}/`,
                form,
            );
            setStoredAuthUser(response.data.user);
            setAuthUser(response.data.user);
            setSuccess("Profile saved successfully.");
        } catch (err) {
            setError(
                err.response?.data?.error ||
                "We could not save your profile just now."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-page auth-page-register">
            <header className="auth-topbar">
                <Link className="auth-brand" to="/contests">Algo Arena</Link>
                <div className="auth-topbar-actions">
                    <Link className="auth-topbar-link" to="/contests">Back To Contests</Link>
                </div>
            </header>

            <main className="auth-main auth-grid-register">
                <section className="auth-panel auth-panel-register">
                    <div className="auth-panel-body">
                        <div className="auth-copy">
                            <p className="auth-kicker">Profile Control</p>
                            <h1 className="auth-title">Complete Your Profile</h1>
                            <p className="auth-description">
                                These details are optional and can be refined anytime later.
                            </p>
                        </div>

                        <form className="auth-form auth-form-grid" onSubmit={handleSubmit}>
                            <div className="auth-field">
                                <label className="auth-label" htmlFor="profile-username">Username</label>
                                <input
                                    id="profile-username"
                                    name="username"
                                    className="auth-input"
                                    value={form.username}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="auth-field">
                                <label className="auth-label" htmlFor="profile-full-name">Full Name</label>
                                <input
                                    id="profile-full-name"
                                    name="full_name"
                                    className="auth-input"
                                    value={form.full_name}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="auth-field auth-field-full">
                                <label className="auth-label" htmlFor="profile-college">College</label>
                                <input
                                    id="profile-college"
                                    name="college"
                                    className="auth-input"
                                    placeholder="Institute or university"
                                    value={form.college}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="auth-field auth-field-full">
                                <label className="auth-label" htmlFor="profile-avatar-url">Avatar URL</label>
                                <input
                                    id="profile-avatar-url"
                                    name="avatar_url"
                                    className="auth-input"
                                    placeholder="https://..."
                                    value={form.avatar_url}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="auth-field auth-field-full">
                                <label className="auth-label" htmlFor="profile-bio">Bio</label>
                                <textarea
                                    id="profile-bio"
                                    name="bio"
                                    className="auth-input auth-textarea"
                                    placeholder="Tell the arena a little about yourself"
                                    value={form.bio}
                                    onChange={handleChange}
                                />
                            </div>

                            {error ? <p className="auth-error auth-field-full">{error}</p> : null}
                            {success ? <p className="auth-success auth-field-full">{success}</p> : null}

                            <div className="auth-field-full auth-actions-row">
                                <Link className="auth-secondary-link" to="/contests">
                                    Skip For Now
                                </Link>
                                <button className="auth-submit auth-submit-inline" type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Saving..." : "Save Profile"}
                                </button>
                            </div>
                        </form>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default ProfileSettingsPage;
