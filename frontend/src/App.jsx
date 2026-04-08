import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ContestsPage from "./Pages/Contests";
import ContestFormPage from "./Pages/createNewContest";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/create" element={<ContestFormPage />} />
        <Route path="/contests" element={<ContestsPage />} />
      </Routes>
    </Router>
  );
}

export default App;
