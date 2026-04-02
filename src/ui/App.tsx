import { Routes, Route } from "react-router-dom";
import ProjectBrowser from "./pages/ProjectBrowser.js";
import ConversationView from "./pages/ConversationView.js";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
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
