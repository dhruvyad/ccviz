import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FolderTree from "../components/FolderTree.js";
import ConversationList from "../components/ConversationList.js";

interface RecentConversation {
  sessionId: string;
  projectEncoded: string;
  sizeBytes: number;
  lastModified: string;
  title: string | null;
  agentName: string | null;
  model: string | null;
  startedAt: string | null;
  lastTimestamp: string | null;
  lineCount: number;
}

export default function ProjectBrowser() {
  const navigate = useNavigate();
  const [tree, setTree] = useState<any[]>([]);
  const [selected, setSelected] = useState<{
    encoded: string;
    decoded: string;
  } | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [recent, setRecent] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setTree(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/recent?limit=20")
      .then((r) => r.json())
      .then((data) => {
        setRecent(data);
        setLoadingRecent(false);
      })
      .catch(() => setLoadingRecent(false));
  }, []);

  const handleSelect = async (encoded: string, decoded: string) => {
    setSelected({ encoded, decoded });
    setLoadingConvos(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(encoded)}/conversations`
      );
      const data = await res.json();
      setConversations(data);
    } catch {
      setConversations([]);
    }
    setLoadingConvos(false);
  };

  return (
    <div className="flex h-screen bg-term-bg">
      {/* Sidebar */}
      <div className="w-64 border-r border-term-border flex flex-col flex-shrink-0">
        <div className="px-3 py-3 border-b border-term-border">
          <h1 className="text-sm text-term-green term-glow font-bold tracking-wider">
            ccviz
          </h1>
          <p className="text-[10px] text-term-text-dim mt-0.5">
            conversation visualizer
          </p>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {loading ? (
            <p className="text-term-text-dim text-xs p-3 font-mono">
              loading...
            </p>
          ) : tree.length === 0 ? (
            <p className="text-term-text-dim text-xs p-3 font-mono">
              no projects found
            </p>
          ) : (
            <FolderTree
              tree={tree}
              onSelect={handleSelect}
              selected={selected?.encoded ?? null}
            />
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-5">
        {!selected ? (
          <div>
            <h2 className="text-sm text-term-text-bright font-mono mb-1">
              recent conversations
            </h2>
            <p className="text-[10px] text-term-text-dim font-mono mb-4">
              across all projects
            </p>
            {loadingRecent ? (
              <p className="text-term-text-dim text-xs font-mono">
                loading...
              </p>
            ) : recent.length === 0 ? (
              <p className="text-term-text-dim text-xs font-mono">
                no conversations found
              </p>
            ) : (
              <div className="space-y-px">
                {recent.map((convo) => (
                  <button
                    key={`${convo.projectEncoded}-${convo.sessionId}`}
                    onClick={() =>
                      navigate(
                        `/conversation/${convo.projectEncoded}/${convo.sessionId}`
                      )
                    }
                    className="w-full text-left px-3 py-2.5 border border-term-border hover:border-term-border-hi hover:bg-term-surface transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs text-term-text-bright group-hover:text-term-green transition-colors truncate">
                          {convo.title ||
                            convo.agentName ||
                            convo.sessionId.slice(0, 16)}
                        </h3>
                        <p className="text-[10px] text-term-text-dim mt-0.5 truncate font-mono">
                          {decodeProjectName(convo.projectEncoded)}
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
                          {formatDuration(
                            convo.startedAt,
                            convo.lastTimestamp
                          )}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelected(null)}
                  className="text-term-text-dim hover:text-term-green text-xs font-mono"
                >
                  recent
                </button>
                <span className="text-term-text-dim text-xs">/</span>
                <h2 className="text-sm text-term-text-bright font-mono">
                  <span className="text-term-green">~/</span>
                  {selected.decoded}
                </h2>
              </div>
              <p className="text-[10px] text-term-text-dim mt-1">
                {conversations.length} conversation
                {conversations.length !== 1 ? "s" : ""}
              </p>
            </div>
            {loadingConvos ? (
              <p className="text-term-text-dim text-xs font-mono">
                loading...
              </p>
            ) : (
              <ConversationList
                conversations={conversations}
                projectEncoded={selected.encoded}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function decodeProjectName(encoded: string): string {
  // Just show the last segment(s) as a hint
  const parts = encoded.slice(1).split("-");
  // Take last 2-3 meaningful parts
  const meaningful = parts.slice(-2);
  return meaningful.join("/");
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
