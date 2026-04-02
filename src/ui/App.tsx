import { Routes, Route } from "react-router-dom";
import ProjectBrowser from "./pages/ProjectBrowser.js";
import ConversationView from "./pages/ConversationView.js";

export default function App() {
  return (
    <div className="min-h-screen bg-term-bg text-term-text">
      <Routes>
        <Route path="/" element={<ProjectBrowser />} />
        <Route
          path="/conversation/:projectPath/:sessionId"
          element={<ConversationView />}
        />
      </Routes>
    </div>
  );
}
