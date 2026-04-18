import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ContestsPage from "./Pages/AllContests";
import AdminDashboard from "./Pages/AdminDashboard";
import AdminUsersPage from "./Pages/AdminUsersPage";
import MySubmissionsPage from "./Pages/MySubmissions";
import SubmissionViewPage from "./Pages/SubmissionView";
import ContestRegistrationPage from "./Pages/ContestRegistration";
import ContestFormPage from "./Pages/CreateNewContest";
import DraftsDashboard from "./Pages/DraftsDashboard";
import ContestPage from "./Pages/ContestInfo";
import ContestProblemManagerPage from "./Pages/ContestProblemManager";
import ProblemSolvingPage from "./Pages/ProblemSolving";
import ErrorPage from "./Pages/ErrorPage";
import LandingPage from "./Pages/LandingPage";
import LoginPage from "./Pages/Login";
import RegisterPage from "./Pages/Register";
import ProfileSettingsPage from "./Pages/ProfileSettings";
import ProblemSetterRoute from "./Components/ProblemSetterRoute";
import AdminRoute from "./Components/AdminRoute";
import { ThemeProvider } from "./Theme/ThemeProvider";

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
