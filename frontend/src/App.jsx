import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ContestsPage from "./Pages/Contests/AllContests";
import AdminDashboard from "./Pages/Admin/AdminDashboard";
import AdminUsersPage from "./Pages/Admin/AdminUsersPage";
import AdminSettingsPage from "./Pages/Admin/AdminSettingsPage";
import AdminProfilePage from "./Pages/Admin/AdminProfilePage";
import MySubmissionsPage from "./Pages/Contests/MySubmissions";
import SubmissionViewPage from "./Pages/Contests/SubmissionView";
import ContestRegistrationPage from "./Pages/Contests/ContestRegistration";
import ContestFormPage from "./Pages/Contests/CreateNewContest";
import DraftsDashboard from "./Pages/Contests/DraftsDashboard";
import ContestPage from "./Pages/Contests/ContestInfo";
import LeaderboardPage from "./Pages/Contests/Leaderboard";
import ContestProblemManagerPage from "./Pages/Contests/ContestProblemManager";
import ProblemSolvingPage from "./Pages/Contests/ProblemSolving";
import ErrorPage from "./Pages/Auth_and_Profile/ErrorPage";
import LandingPage from "./Pages/Auth_and_Profile/LandingPage";
import LoginPage from "./Pages/Auth_and_Profile/Login";
import RegisterPage from "./Pages/Auth_and_Profile/Register";
import ProfileSettingsPage from "./Pages/Auth_and_Profile/ProfileSettings";
import ProblemSetterRoute from "./Components/ProblemSetterRoute";
import AdminRoute from "./Components/AdminRoute";
import { ThemeProvider } from "./Theme/ThemeProvider";
import AdminLandingRedirect from "./Components/AdminLandingRedirect";

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/profile/edit" element={<ProfileSettingsPage />} />
          <Route
            path="/admin"
            element={(
              <AdminRoute>
                <AdminLandingRedirect />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/dashboard"
            element={(
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/permissions"
            element={(
              <AdminRoute>
                <AdminUsersPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/settings"
            element={(
              <AdminRoute>
                <AdminSettingsPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/profile"
            element={(
              <AdminRoute>
                <AdminProfilePage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/users"
            element={<Navigate to="/admin/permissions" replace />}
          />
          <Route
            path="/admin/problem-setters"
            element={<Navigate to="/admin/permissions" replace />}
          />
          <Route
            path="/create"
            element={(
              <ProblemSetterRoute>
                <ContestFormPage />
              </ProblemSetterRoute>
            )}
          />
          <Route
            path="/drafts"
            element={(
              <ProblemSetterRoute>
                <DraftsDashboard />
              </ProblemSetterRoute>
            )}
          />
          <Route path="/contests" element={<ContestsPage />} />
          <Route path="/submissions" element={<MySubmissionsPage />} />
          <Route path="/submissions/:submissionId" element={<SubmissionViewPage />} />
          <Route path="/contest/:contestId/" element={<ContestPage />} />
          <Route path="/contest/:contestId/leaderboard" element={<LeaderboardPage />} />
          <Route path="/contest/:contestId/register" element={<ContestRegistrationPage />} />
          <Route
            path="/contest/:contestId/problems/edit"
            element={(
              <ProblemSetterRoute>
                <ContestProblemManagerPage />
              </ProblemSetterRoute>
            )}
          />
          <Route path="/contest/:contestId/problems/:problemId" element={<ProblemSolvingPage />} />
          <Route path="*" element={<ErrorPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
