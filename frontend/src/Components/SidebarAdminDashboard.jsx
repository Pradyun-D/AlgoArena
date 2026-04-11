import { NavLink, useNavigate } from "react-router-dom"

const navItems = [
  { label: "Overview", icon: "dashboard", to: "/admin/dashboard" },
  { label: "Active Contests", icon: "rocket_launch", to: "/admin/dashboard/active" },
  { label: "Drafts", icon: "description", to: "/admin/dashboard/drafts" },
  { label: "Archive", icon: "history", to: "/admin/dashboard/archive" },
  { label: "Analytics", icon: "analytics", to: "/admin/dashboard/analytics" },
];

const footerItems = [
  { label: "Support", icon: "help" },
  { label: "Logs", icon: "terminal" },
];

function SidebarAdminDashboard() {
  const navigate = useNavigate();
  return (
    <aside className="admin-sidebar">
      <div>
        <div className="admin-sidebar-brand">
          <h2>ALGO_ARENA//ADMIN</h2>
          <div>
            <p>Control Panel</p>
            <span>v2.4.0-stable</span>
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

        <div className="admin-sidebar-support">
          {footerItems.map((item) => (
            <a key={item.label} href={`#${item.label.toLowerCase()}`}>
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default SidebarAdminDashboard;
