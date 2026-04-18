import AdminMemberManagementTemplate from "../Components/AdminMemberManagementTemplate";
import { API_BASE_URL } from "../Utils/api";

function AdminUsersPage() {
  return (
    <AdminMemberManagementTemplate
      activeTab="permissions"
      title="Permissions"
      description="Review every platform account, filter by role, and update access state and permissions from one place."
      fetchUrl={`${API_BASE_URL}/admin-api/users/`}
      entryLabel="members"
      searchPlaceholder="Search by username, email, name or ID..."
      emptyMessage="No members match the current filters."
      roleFilterOptions={[
        { value: "all", label: "Role: All" },
        { value: "admin", label: "Role: Admin" },
        { value: "problem_setter", label: "Role: Problem Setter" },
        { value: "user", label: "Role: User" },
      ]}
      primaryActionLabel="Edit permissions inline"
      primaryActionHint="Choose a role and status for any user, then save that row."
      loadingTitle="Loading Permissions"
      loadingSubtitle="Fetching all platform users and permission settings."
    />
  );
}

export default AdminUsersPage;
