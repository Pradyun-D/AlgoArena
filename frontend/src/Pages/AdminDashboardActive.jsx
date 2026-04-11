import AdminContestListTemplate from "../Components/AdminContestListTemplate";

function AdminDashboardActive() {
  return (
    <AdminContestListTemplate
      title="Active Contests"
      description="Monitor contests that are currently running so you can focus on live operational activity."
      fetchUrl="http://127.0.0.1:8000/contests/active/"
      errorTitle="The active contests page could not be loaded."
      emptyMessage="No active contests are running right now."
      entryLabel="active entries"
    />
  );
}

export default AdminDashboardActive;
