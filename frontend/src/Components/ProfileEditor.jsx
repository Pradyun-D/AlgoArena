import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import SidebarAdminDashboard from "./SidebarAdminDashboard";
import LoadingPage from "../Pages/Auth_and_Profile/LoadingPage";
import ErrorPage from "../Pages/Auth_and_Profile/ErrorPage";
import { API_BASE_URL } from "../Utils/api";
import { setStoredAuthUser } from "../Utils/auth_storage";
import "../Styles/auth_pages.css";
import "../Styles/admin_dashboard.css";

function ProfileEditor({ variant = "auth" }) {
  const navigate = useNavigate();
  const isAdminVariant = variant === "admin";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [userUuid, setUserUuid] = useState("");
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    bio: "",
    avatar_url: "",
    college: "",
    email: "",
    role: "",
    status: "",
  });

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError("");
      const sessionResponse = await axios.get(`${API_BASE_URL}/accounts/api/session/`, { withCredentials: true });
      const currentUser = sessionResponse.data?.user;

      if (!currentUser?.uuid) {
        if (isAdminVariant) {
          throw new Error("Unable to load the current admin profile.");
        }
        navigate("/login");
        return;
      }

      const profileResponse = await axios.get(`${API_BASE_URL}/accounts/api/profile/${currentUser.uuid}/`, { withCredentials: true });
      const user = profileResponse.data?.user;
      if (!user) {
        throw new Error("Profile data is unavailable.");
      }

      setUserUuid(user.uuid);
      setForm({
        username: user.username || "",
        full_name: user.profile?.full_name || "",
        bio: user.profile?.bio || "",
        avatar_url: user.profile?.avatar_url || "",
        college: user.profile?.college || "",
        email: user.email || "",
        role: user.role || "",
        status: user.status || "",
      });
      setStoredAuthUser(user);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Unable to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const updateField = (event) => {
    const { name, value } = event.target;
    setMessage("");
    setForm((current) => ({ ...current, [name]: value }));
  };

  const saveProfile = async (event) => {
    if (event) {
      event.preventDefault();
    }
    if (!userUuid) {
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      const response = await axios.put(
        `${API_BASE_URL}/accounts/api/profile/${userUuid}/`,
        {
          username: form.username,
          full_name: form.full_name,
          bio: form.bio,
          avatar_url: form.avatar_url,
          college: form.college,
        },
        { withCredentials: true }
      );
      if (response.data?.user) {
        setStoredAuthUser(response.data.user);
      }
      setMessage("Profile updated successfully.");
    } catch (err) {
      setMessage(err.response?.data?.error || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LoadingPage
        title={isAdminVariant ? "Loading Admin Profile" : "Loading Profile"}
        subtitle={isAdminVariant
          ? "Pulling current admin identity and profile data."
          : "Loading your current profile details."}
      />
    );
  }

  if (error) {
    return (
      <ErrorPage
        kicker={isAdminVariant ? "Admin Profile" : "Profile Control"}
        title={isAdminVariant ? "Profile could not be loaded." : "Profile settings could not be loaded."}
        copy={error}
        primaryAction={{ label: "Retry", onClick: loadProfile }}
        secondaryAction={{ label: isAdminVariant ? "Dashboard" : "Contests", to: isAdminVariant ? "/admin/dashboard" : "/contests" }}
      />
    );
  }

  if (isAdminVariant) {
    return (
      <div className="admin-dashboard-page">
        <SidebarAdminDashboard />

        <main className="admin-dashboard-main">
          <header className="admin-topbar">
            <div className="admin-topbar-tabs">
              <Link className="admin-topbar-link" to="/admin/dashboard">Dashboard</Link>
              <Link className="admin-topbar-link" to="/contests">Contests</Link>
              <Link className="admin-topbar-link" to="/admin/permissions">Permissions</Link>
              <Link className="admin-topbar-link active" to="/admin/profile">Profile</Link>
            </div>

            <div className="admin-topbar-actions">
              <ThemeToggle />
              <button className="admin-icon-button" type="button" aria-label="Settings" onClick={() => navigate("/admin/settings")}>
                <span className="material-symbols-outlined">settings</span>
              </button>
              <button className="admin-avatar-button" type="button" aria-label="Admin profile">
                <span className="material-symbols-outlined">account_circle</span>
              </button>
            </div>
          </header>

          <section className="admin-dashboard-content">
            <div className="admin-page-header">
              <div>
                <p className="admin-section-kicker">Admin Console</p>
                <h1>Profile</h1>
                <p className="admin-page-description">Update the admin account details shown around the platform.</p>
              </div>
            </div>

            <section className="admin-panel admin-profile-layout">
              <article className="admin-profile-summary">
                <div className="admin-profile-avatar-large">
                  {(form.username || form.full_name || "?")[0]?.toUpperCase()}
                </div>
                <h2>{form.full_name || form.username || "Admin User"}</h2>
                <p>{form.email}</p>
                <div className="admin-profile-badges">
                  <span className="contest-status-pill status-completed">{form.role || "admin"}</span>
                  <span className="contest-status-pill status-live">{form.status || "active"}</span>
                </div>
              </article>

              <form className="admin-profile-form" onSubmit={saveProfile}>
                <div className="admin-form-grid">
                  <label className="admin-form-field">
                    <span>Username</span>
                    <input name="username" value={form.username} onChange={updateField} />
                  </label>
                  <label className="admin-form-field">
                    <span>Full Name</span>
                    <input name="full_name" value={form.full_name} onChange={updateField} />
                  </label>
                  <label className="admin-form-field">
                    <span>College</span>
                    <input name="college" value={form.college} onChange={updateField} />
                  </label>
                  <label className="admin-form-field">
                    <span>Avatar URL</span>
                    <input name="avatar_url" value={form.avatar_url} onChange={updateField} />
                  </label>
                </div>

                <label className="admin-form-field">
                  <span>Bio</span>
                  <textarea name="bio" value={form.bio} onChange={updateField} rows="5" />
                </label>

                <div className="admin-profile-actions">
                  <button type="submit" className="admin-save-button is-dirty" disabled={saving}>
                    {saving ? "Saving..." : "Save Profile"}
                  </button>
                </div>

                {message ? (
                  <div className="admin-inline-banner admin-inline-banner--compact">
                    <p className="admin-inline-feedback">{message}</p>
                  </div>
                ) : null}
              </form>
            </section>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-page auth-page-register">
      <header className="auth-topbar">
        <Link className="auth-brand" to="/contests">Algo Arena</Link>
        <div className="auth-topbar-actions">
          <ThemeToggle />
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

            <form className="auth-form auth-form-grid" onSubmit={saveProfile}>
              <div className="auth-field">
                <label className="auth-label" htmlFor="profile-username">Username</label>
                <input
                  id="profile-username"
                  name="username"
                  className="auth-input"
                  value={form.username}
                  onChange={updateField}
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="profile-full-name">Full Name</label>
                <input
                  id="profile-full-name"
                  name="full_name"
                  className="auth-input"
                  value={form.full_name}
                  onChange={updateField}
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
                  onChange={updateField}
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
                  onChange={updateField}
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
                  onChange={updateField}
                />
              </div>

              {message ? <p className="auth-success auth-field-full">{message}</p> : null}

              <div className="auth-field-full auth-actions-row">
                <Link className="auth-secondary-link" to="/contests">
                  Skip For Now
                </Link>
                <button className="auth-submit auth-submit-inline" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ProfileEditor;
