import AdminContestListTemplate from "../Components/AdminContestListTemplate";

function AdminDashboard() {
  return (
    <AdminContestListTemplate
      title="Contest Management"
      description="Monitor and orchestrate ongoing algorithmic competitions across the global arena. Use this overview to track upcoming and recent contest activity across the system."
      fetchUrl="http://127.0.0.1:8000/contests/"
      errorTitle="The admin dashboard could not be loaded."
      emptyMessage="No contests are available yet. Create a new contest to populate the admin table."
      entryLabel="entries"
    />
  );
}

export default AdminDashboard;
