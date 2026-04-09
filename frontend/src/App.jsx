import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ContestsPage from "./Pages/AllContests";
import ContestFormPage from "./Pages/CreateNewContest";
import ContestPage from "./Pages/ContestInfo";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/create" element={<ContestFormPage />} />
        <Route path="/contests" element={<ContestsPage />} />
        <Route path="/contest/:contestId/" element={<ContestPage />} />
      </Routes>
    </Router>
  );
}

export default App;
