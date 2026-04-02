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
      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className="text-term-green">$</span>
        <input
          type="text"
          placeholder="grep conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-b border-term-border text-term-text placeholder-term-text-dim focus:outline-none focus:border-term-green py-1"
        />
      </div>

      <div className="space-y-px">
        {filtered.map((convo) => (
          <button
            key={convo.sessionId}
            onClick={() =>
              navigate(`/conversation/${projectEncoded}/${convo.sessionId}`)
            }
            className="w-full text-left px-3 py-2.5 border border-term-border hover:border-term-border-hi hover:bg-term-surface transition-colors group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-xs text-term-text-bright group-hover:text-term-green transition-colors truncate">
                  {convo.title || convo.agentName || convo.sessionId.slice(0, 16)}
                </h3>
                <p className="text-xs text-term-text-dim mt-0.5 truncate font-mono">
                  {convo.sessionId}
                </p>
              </div>
              <div className="text-right flex-shrink-0 text-xs">
                <p className="text-term-text-dim">
                  {formatDate(convo.lastModified)}
                </p>
                {convo.model && (
                  <p className="text-term-text-dim mt-0.5 text-[10px]">
                    {convo.model}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-1.5 text-[10px] text-term-text-dim">
              <span>{formatSize(convo.sizeBytes)}</span>
              <span>{convo.lineCount} msg</span>
              {convo.startedAt && convo.lastTimestamp && (
                <span>
                  {formatDuration(convo.startedAt, convo.lastTimestamp)}
                </span>
              )}
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <p className="text-term-text-dim text-xs text-center py-8 font-mono">
            -- no results --
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
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h${mins % 60}m`;
}
