import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import SidebarAdminDashboard from "./SidebarAdminDashboard";
import ThemeToggle from "./ThemeToggle";
import ErrorPage from "../Pages/ErrorPage";
import LoadingPage from "../Pages/LoadingPage";
import { API_BASE_URL } from "../Utils/api";
import "../Styles/admin_dashboard.css";

const PAGE_SIZE = 10;

const roleOptions = [
  { value: "user", label: "User" },
  { value: "problem_setter", label: "Problem Setter" },
  { value: "admin", label: "Admin" },
];

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
];

const roleClassMap = {
  admin: "status-completed",
  problem_setter: "status-live",
  user: "status-draft",
};

const statusClassMap = {
  active: "status-live",
  suspended: "status-draft",
  banned: "status-completed",
};

const normalizeRole = (value) => {
  const normalized = String(value || "").toLowerCase();
  return normalized || "user";
};

const normalizeStatus = (value) => {
  const normalized = String(value || "").toLowerCase();
  return ["active", "suspended", "banned"].includes(normalized) ? normalized : "";
};

const formatDisplayDate = (value) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const buildInitialDrafts = (rows) => (
  rows.reduce((accumulator, row) => {
    const key = row.external_id || row.uuid;
    accumulator[key] = {
      role: normalizeRole(row.role),
      status: normalizeStatus(row.status) || "active",
    };
    return accumulator;
  }, {})
);

function AdminMemberManagementTemplate({
  activeTab,
  title,
  description,
  fetchUrl,
  entryLabel,
  searchPlaceholder,
  emptyMessage,
  roleFilterOptions,
  primaryActionLabel,
  primaryActionHint,
  defaultRoleFilter = "all",
  showRoleFilter = true,
  loadingTitle,
  loadingSubtitle,
}) {
  const [members, setMembers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(defaultRoleFilter);
  const [statusFilter, setStatusFilter] = useState("all");
  const [savingId, setSavingId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get(fetchUrl, { withCredentials: true });
      const rows = Array.isArray(response.data) ? response.data : [];
      setMembers(rows);
      setDrafts(buildInitialDrafts(rows));
      setCurrentPage(1);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load admin member data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [fetchUrl]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const normalizedSearch = searchQuery.trim().toLowerCase();
      const matchesSearch = !normalizedSearch || [
        member.username,
        member.email,
        member.full_name,
        member.external_id,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch));

      const draft = drafts[member.external_id] || {};
      const memberRole = normalizeRole(draft.role || member.role);
      const memberStatus = normalizeStatus(draft.status || member.status);

      const matchesRole = roleFilter === "all" || memberRole === roleFilter;
      const matchesStatus = statusFilter === "all" || memberStatus === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [drafts, members, roleFilter, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredMembers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredMembers]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const metrics = useMemo(() => {
    const activeCount = members.filter((member) => normalizeStatus(member.status) === "active").length;
    const setterCount = members.filter((member) => normalizeRole(member.role) === "problem_setter").length;
    const adminCount = members.filter((member) => normalizeRole(member.role) === "admin").length;

    return [
      { label: `Total ${entryLabel}`, value: members.length.toLocaleString("en-IN"), accent: "blue" },
      { label: "Active Accounts", value: activeCount.toLocaleString("en-IN"), accent: "green" },
      { label: "Setters", value: setterCount.toLocaleString("en-IN"), accent: "blue" },
      { label: "Admins", value: adminCount.toLocaleString("en-IN"), accent: "green" },
    ];
  }, [entryLabel, members]);

  const handleDraftChange = (memberId, field, value) => {
    setFeedback("");
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [memberId]: {
        ...(currentDrafts[memberId] || {}),
        [field]: value,
      },
    }));
  };

  const hasChanges = (member) => {
    const draft = drafts[member.external_id];
    if (!draft) {
      return false;
    }

    return draft.role !== normalizeRole(member.role) || draft.status !== (normalizeStatus(member.status) || "active");
  };

  const handleSave = async (member) => {
    const memberId = member.external_id;
    const draft = drafts[memberId];

    if (!draft || !hasChanges(member)) {
      return;
    }

    try {
      setSavingId(memberId);
      setFeedback("");
      const response = await axios.patch(
        `${API_BASE_URL}/admin-api/users/${memberId}/permissions/`,
        {
          role: draft.role,
          status: draft.status,
        },
        { withCredentials: true }
      );

      const updatedUser = response.data?.user;
      if (updatedUser) {
        setMembers((currentMembers) => currentMembers.map((currentMember) => (
          currentMember.external_id === memberId
            ? { ...currentMember, ...updatedUser }
            : currentMember
        )));

        setDrafts((currentDrafts) => ({
          ...currentDrafts,
          [memberId]: {
            role: normalizeRole(updatedUser.role),
            status: normalizeStatus(updatedUser.status) || "active",
          },
        }));
      }

      setFeedback(response.data?.message || "Permissions updated.");
    } catch (err) {
      setFeedback(err.response?.data?.error || "Unable to update permissions.");
    } finally {
      setSavingId("");
    }
  };

  if (loading) {
    return <LoadingPage title={loadingTitle} subtitle={loadingSubtitle} />;
  }

  if (error) {
    return (
      <ErrorPage
        kicker="Admin"
        title="Member Management Unavailable"
        copy={error}
        primaryAction={{ label: "Retry", onClick: fetchMembers }}
        secondaryAction={{ label: "Dashboard", to: "/admin/dashboard" }}
      />
    );
  }

  return (
    <div className="admin-dashboard-page">
      <SidebarAdminDashboard />

      <main className="admin-dashboard-main">
        <header className="admin-topbar">
          <div className="admin-topbar-tabs">
            <Link className={`admin-topbar-link ${activeTab === "dashboard" ? "active" : ""}`} to="/admin/dashboard">Dashboard</Link>
            <Link className={`admin-topbar-link ${activeTab === "permissions" ? "active" : ""}`} to="/admin/permissions">Permissions</Link>
          </div>

          <div className="admin-topbar-actions">
            <ThemeToggle />
            <button className="admin-icon-button" type="button" aria-label="Notifications">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="admin-icon-button" type="button" aria-label="Settings">
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
              <h1>{title}</h1>
              <p className="admin-page-description">{description}</p>
            </div>

            <div className="admin-header-metrics admin-header-metrics--wide">
              {metrics.map((metric) => (
                <article key={metric.label} className={`admin-mini-stat ${metric.accent}`}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </article>
              ))}
            </div>
          </div>

          <section className="admin-panel">
            <div className="admin-panel-toolbar admin-panel-toolbar--stacked">
              <div className="admin-panel-toolbar-main">
                <label className="admin-searchbar" htmlFor="member-search">
                  <span className="material-symbols-outlined">search</span>
                  <input
                    id="member-search"
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </label>

                <div className="admin-toolbar-filters">
                  {showRoleFilter ? (
                    <select
                      className="admin-filter-button"
                      value={roleFilter}
                      onChange={(event) => setRoleFilter(event.target.value)}
                    >
                      {roleFilterOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <select
                    className="admin-filter-button"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">Status: All</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              </div>

              <div className="admin-inline-banner">
                <div>
                  <strong>{primaryActionLabel}</strong>
                  <span>{primaryActionHint}</span>
                </div>
                {feedback ? <p className="admin-inline-feedback">{feedback}</p> : null}
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-contest-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Email</th>
                    <th>Joined</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Permissions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMembers.length > 0 ? (
                    paginatedMembers.map((member) => {
                      const memberRole = normalizeRole(member.role);
                      const memberStatus = normalizeStatus(member.status);
                      const draft = drafts[member.external_id] || {
                        role: memberRole,
                        status: memberStatus || "active",
                      };

                      return (
                        <tr key={member.external_id}>
                          <td className="admin-code-cell">{member.external_id}</td>
                          <td>
                            <div className="admin-member-cell">
                              <div className="admin-member-avatar">
                                {(member.username || member.full_name || "?")[0]?.toUpperCase()}
                              </div>
                              <div className="contest-primary-cell">
                                <strong>{member.username || "Unknown User"}</strong>
                                <span>{member.full_name || member.college || "No profile details yet"}</span>
                              </div>
                            </div>
                          </td>
                          <td>{member.email || "N/A"}</td>
                          <td>{formatDisplayDate(member.date_joined)}</td>
                          <td>
                            <span className={`contest-status-pill ${roleClassMap[memberRole] || "status-draft"}`}>
                              {memberRole.replace("_", " ")}
                            </span>
                          </td>
                          <td>
                            {memberStatus ? (
                              <span className={`contest-status-pill ${statusClassMap[memberStatus] || "status-draft"}`}>
                                {memberStatus}
                              </span>
                            ) : (
                              <span className="contest-status-pill status-draft">unknown</span>
                            )}
                          </td>
                          <td>
                            <div className="admin-permission-editor">
                              <select
                                className="admin-member-select"
                                value={draft.role}
                                onChange={(event) => handleDraftChange(member.external_id, "role", event.target.value)}
                              >
                                {roleOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>

                              <select
                                className="admin-member-select"
                                value={draft.status}
                                onChange={(event) => handleDraftChange(member.external_id, "status", event.target.value)}
                              >
                                {statusOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                className={`admin-save-button ${hasChanges(member) ? "is-dirty" : ""}`}
                                onClick={() => handleSave(member)}
                                disabled={!hasChanges(member) || savingId === member.external_id}
                              >
                                {savingId === member.external_id ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="admin-empty-state">
                        {emptyMessage}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="admin-table-footer">
              <p>
                {filteredMembers.length > 0
                  ? `Showing ${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, filteredMembers.length)} of ${filteredMembers.length} ${entryLabel}`
                  : `Showing 0 ${entryLabel}`}
              </p>
              <div className="admin-pagination">
                <button
                  type="button"
                  aria-label="Previous page"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={page === currentPage ? "active" : ""}
                    aria-current={page === currentPage ? "page" : undefined}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Next page"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

export default AdminMemberManagementTemplate;
