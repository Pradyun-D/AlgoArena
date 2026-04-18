import { NavLink, useNavigate } from "react-router-dom"

const navItems = [
  { label: "Overview", icon: "dashboard", to: "/admin/dashboard" },
  { label: "Permissions", icon: "admin_panel_settings", to: "/admin/permissions" },
  { label: "Drafts", icon: "description", to: "/drafts" },
  { label: "Settings", icon: "settings", to: "/admin/settings" },
  { label: "Profile", icon: "account_circle", to: "/admin/profile" },
];

function SidebarAdminDashboard() {
  const navigate = useNavigate();
  return (
    <aside className="admin-sidebar">
      <div>
        <div className="admin-sidebar-brand">
          <h2>ALGOARENA ADMIN</h2>
          <div>
            <p>Control Panel</p>
          </div>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Admin navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="admin-sidebar-footer">
        <button type="button" className="admin-create-button" onClick={() => navigate("/create")}>
          Create New Contest
        </button>
      </div>
    </aside>
  );
}

export default SidebarAdminDashboard;
