import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ContestsPage from "./Pages/contests";

function App() {
  return (
    <Router>
      <Routes>
        
        <Route path="/contests" element={<ContestsPage />} />
      </Routes>
    </Router>
  );
}

export default App;
