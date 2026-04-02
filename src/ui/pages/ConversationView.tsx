import { useParams } from "react-router-dom";

export default function ConversationView() {
  const { projectPath, sessionId } = useParams();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Conversation</h1>
      <p className="text-gray-400">
        {projectPath} / {sessionId}
      </p>
    </div>
  );
}
