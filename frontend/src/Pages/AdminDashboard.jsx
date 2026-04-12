import AdminContestListTemplate from "../Components/AdminContestListTemplate";
import { API_BASE_URL } from "../Utils/api";

function AdminDashboard() {
  return (
    <AdminContestListTemplate
      title="Contest Management"
      description="Monitor and orchestrate ongoing algorithmic competitions across the global arena. Use this overview to track upcoming and recent contest activity across the system."
      fetchUrl={`${API_BASE_URL}/contests/admin/dashboard/`}
      errorTitle="The admin dashboard could not be loaded."
      emptyMessage="No contests are available yet. Create a new contest to populate the admin table."
      entryLabel="entries"
    />
  );
}

export default AdminDashboard;
