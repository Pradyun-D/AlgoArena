import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ContestsPage from "./Pages/AllContests";
import ContestFormPage from "./Pages/CreateNewContest";
import ContestPage from "./Pages/ContestInfo";
import ErrorPage from "./Pages/ErrorPage";
import LandingPage from "./Pages/LandingPage";
import LoginPage from "./Pages/Login";
import RegisterPage from "./Pages/Register";
import ProfileSettingsPage from "./Pages/ProfileSettings";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile/edit" element={<ProfileSettingsPage />} />
        <Route path="/create" element={<ContestFormPage />} />
        <Route path="/contests" element={<ContestsPage />} />
        <Route path="/contest/:contestId/" element={<ContestPage />} />
        <Route path="*" element={<ErrorPage />} />
      </Routes>
    </Router>
  );
}

export default App;
