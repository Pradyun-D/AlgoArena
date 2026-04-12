import AdminContestListTemplate from "../Components/AdminContestListTemplate";
import { API_BASE_URL } from "../Utils/api";

function AdminDashboardActive() {
  return (
    <AdminContestListTemplate
      title="Active Contests"
      description="Monitor contests that are currently running so you can focus on live operational activity."
      fetchUrl={`${API_BASE_URL}/contests/admin/dashboard/active/`}
      errorTitle="The active contests page could not be loaded."
      emptyMessage="No active contests are running right now."
      entryLabel="active entries"
    />
  );
}

export default AdminDashboardActive;
