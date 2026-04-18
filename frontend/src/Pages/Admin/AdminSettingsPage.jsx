import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SidebarAdminDashboard from "../../Components/SidebarAdminDashboard";
import ThemeToggle from "../../Components/ThemeToggle";
import "../../Styles/admin_dashboard.css";

const SETTINGS_KEY = "algoarena-admin-settings";

const defaultSettings = {
  deleteConfirm: true,
  compactTables: false,
  landingPage: "dashboard",
};

function AdminSettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      }
    } catch {
      setSettings(defaultSettings);
    }
  }, []);

  const updateSetting = (field, value) => {
    const nextSettings = { ...settings, [field]: value };
    setSettings(nextSettings);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    setSaved("Settings saved.");
  };

  return (
    <div className="admin-dashboard-page">
      <SidebarAdminDashboard />

      <main className="admin-dashboard-main">
        <header className="admin-topbar">
          <div className="admin-topbar-tabs">
            <Link className="admin-topbar-link" to="/admin/dashboard">Dashboard</Link>
            <Link className="admin-topbar-link" to="/contests">Contests</Link>
            <Link className="admin-topbar-link" to="/admin/permissions">Permissions</Link>
            <Link className="admin-topbar-link active" to="/admin/settings">Settings</Link>
          </div>

          <div className="admin-topbar-actions">
            <ThemeToggle />
            <button className="admin-avatar-button" type="button" aria-label="Admin profile" onClick={() => navigate("/admin/profile")}>
              <span className="material-symbols-outlined">account_circle</span>
            </button>
          </div>
        </header>

        <section className="admin-dashboard-content">
          <div className="admin-page-header">
            <div>
              <p className="admin-section-kicker">Admin Console</p>
              <h1>Settings</h1>
              <p className="admin-page-description">Quick dashboard preferences for how the control panel behaves on this device.</p>
            </div>
          </div>

          <section className="admin-panel admin-settings-grid">
            <article className="admin-settings-card">
              <div>
                <p className="admin-settings-label">Delete Confirmation</p>
                <span>Keep a confirmation step before contest deletion.</span>
              </div>
              <button
                type="button"
                className={`admin-toggle-pill ${settings.deleteConfirm ? "active" : ""}`}
                onClick={() => updateSetting("deleteConfirm", !settings.deleteConfirm)}
              >
                {settings.deleteConfirm ? "On" : "Off"}
              </button>
            </article>

            <article className="admin-settings-card">
              <div>
                <p className="admin-settings-label">Compact Tables</p>
                <span>Use a tighter admin table density when enabled.</span>
              </div>
              <button
                type="button"
                className={`admin-toggle-pill ${settings.compactTables ? "active" : ""}`}
                onClick={() => updateSetting("compactTables", !settings.compactTables)}
              >
                {settings.compactTables ? "On" : "Off"}
              </button>
            </article>

            <article className="admin-settings-card admin-settings-card--wide">
              <div>
                <p className="admin-settings-label">Default Landing Page</p>
                <span>Choose where the admin flow should begin for this browser.</span>
              </div>
              <select
                className="admin-member-select"
                value={settings.landingPage}
                onChange={(event) => updateSetting("landingPage", event.target.value)}
              >
                <option value="dashboard">Dashboard</option>
                <option value="permissions">Permissions</option>
                <option value="drafts">Drafts</option>
              </select>
            </article>
          </section>

          {saved ? (
            <div className="admin-inline-banner admin-inline-banner--compact">
              <p className="admin-inline-feedback">{saved}</p>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default AdminSettingsPage;
