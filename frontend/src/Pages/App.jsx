import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ContestsPage from './Pages/AllContests';
import MySubmissionsPage from './Pages/MySubmissions';
import ProblemSolvingPage from './Pages/ProblemSolving';
import ErrorPage from './Pages/ErrorPage';

// Assuming other pages like LandingPage, LoginPage, ContestDetail etc. are imported

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Assuming other routes like landing, login, etc. exist */}
        <Route path="/contests" element={<ContestsPage />} />
        <Route path="/submissions" element={<MySubmissionsPage />} />
        <Route path="/contest/:contestId/problems/:problemId" element={<ProblemSolvingPage />} />
        <Route path="*" element={<ErrorPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;