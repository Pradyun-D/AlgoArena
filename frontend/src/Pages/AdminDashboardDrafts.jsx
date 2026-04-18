import AdminContestListTemplate from "../Components/AdminContestListTemplate";
import { API_BASE_URL } from "../Utils/api";

function AdminDashboardDrafts() {
  return (
    <AdminContestListTemplate
      activeTab="drafts"
      sectionKicker="Draft Workspace"
      title="Saved Contest Drafts"
      description="Review incomplete contest plans, keep metadata safe, and publish a draft into a live contest when it is ready."
      fetchUrl={`${API_BASE_URL}/contests/drafts/`}
      tableVariant="drafts"
      loadingTitle="Loading drafts"
      loadingSubtitle="Collecting saved contest drafts and preparing publish actions."
      errorTitle="The drafts dashboard could not be loaded."
      errorFallback="Unable to load drafts right now."
      emptyMessage="No drafts saved yet."
      showHeaderMetrics={false}
      primaryAction={{ label: "New Draft", to: "/create" }}
    />
  );
}

export default AdminDashboardDrafts;
