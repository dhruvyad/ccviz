import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

interface Conversation {
  sessionId: string;
  sizeBytes: number;
  lastModified: string;
  title: string | null;
  agentName: string | null;
  model: string | null;
  startedAt: string | null;
  lastTimestamp: string | null;
  lineCount: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  projectEncoded: string;
}

export default function ConversationList({
  conversations,
  projectEncoded,
}: ConversationListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.agentName?.toLowerCase().includes(q) ||
        c.sessionId.toLowerCase().includes(q) ||
        c.model?.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  return (
    <div>
      <input
        type="text"
        placeholder="Search conversations..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
      />

      <div className="space-y-2">
        {filtered.map((convo) => (
          <button
            key={convo.sessionId}
            onClick={() =>
              navigate(`/conversation/${projectEncoded}/${convo.sessionId}`)
            }
            className="w-full text-left p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-gray-100 truncate">
                  {convo.title || convo.agentName || convo.sessionId.slice(0, 12)}
                </h3>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {convo.sessionId}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-400">
                  {formatDate(convo.lastModified)}
                </p>
                {convo.model && (
                  <p className="text-xs text-gray-500 mt-1">{convo.model}</p>
                )}
              </div>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span>{formatSize(convo.sizeBytes)}</span>
              <span>{convo.lineCount} messages</span>
              {convo.startedAt && convo.lastTimestamp && (
                <span>{formatDuration(convo.startedAt, convo.lastTimestamp)}</span>
              )}
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">
            No conversations found.
          </p>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);

  if (diffHrs < 1) return `${Math.round(diffMs / 60000)}m ago`;
  if (diffHrs < 24) return `${Math.round(diffHrs)}h ago`;
  if (diffHrs < 24 * 7) return `${Math.round(diffHrs / 24)}d ago`;
  return d.toLocaleDateString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}
