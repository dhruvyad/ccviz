import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Timeline from "../components/Timeline.js";
import TokenChart from "../components/TokenChart.js";
import ToolCallTable from "../components/ToolCallTable.js";
import ContextWaterfall from "../components/ContextWaterfall.js";
import SubagentPanel from "../components/SubagentPanel.js";

interface ParsedConversation {
  id: string;
  title: string | null;
  agentName: string | null;
  startedAt: string;
  model: string;
  gitBranch: string;
  version: string;
  turns: any[];
  toolCalls: any[];
  tokenTimeline: any[];
  subagents: any[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    toolCalls: number;
    durationMs: number | null;
    turnCount: number;
  };
}

const TABS = [
  "Timeline",
  "Token Usage",
  "Tool Calls",
  "Context Budget",
  "Subagents",
] as const;
type Tab = (typeof TABS)[number];

export default function ConversationView() {
  const { projectPath, sessionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ParsedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Timeline");

  useEffect(() => {
    if (!projectPath || !sessionId) return;
    setLoading(true);
    fetch(
      `/api/conversations/${encodeURIComponent(projectPath)}/${sessionId}`
    )
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [projectPath, sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Parsing conversation...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen text-red-400">
        {error ?? "Failed to load conversation"}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-950 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate("/")}
              className="text-gray-500 hover:text-gray-300 text-sm"
            >
              &larr; Back
            </button>
            <h1 className="text-lg font-semibold text-gray-100">
              {data.title || data.agentName || data.id.slice(0, 12)}
            </h1>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            {data.model && <span>Model: {data.model}</span>}
            {data.gitBranch && <span>Branch: {data.gitBranch}</span>}
            {data.totals.durationMs != null && (
              <span>
                Duration: {formatDuration(data.totals.durationMs)}
              </span>
            )}
            <span>{data.totals.turnCount} turns</span>
            <span>{data.totals.toolCalls} tool calls</span>
            <span>
              {data.totals.inputTokens.toLocaleString()} in /{" "}
              {data.totals.outputTokens.toLocaleString()} out
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
                activeTab === tab
                  ? "bg-gray-900 text-gray-100 border-t border-x border-gray-700"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab}
              {tab === "Subagents" && data.subagents.length > 0 && (
                <span className="ml-1.5 text-xs text-purple-400">
                  ({data.subagents.length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6 max-w-7xl mx-auto">
        {activeTab === "Timeline" && <Timeline turns={data.turns} />}

        {activeTab === "Token Usage" && (
          <TokenChart data={data.tokenTimeline} />
        )}

        {activeTab === "Tool Calls" && (
          <ToolCallTable
            toolCalls={data.toolCalls}
            projectPath={projectPath!}
            sessionId={sessionId!}
          />
        )}

        {activeTab === "Context Budget" && (
          <ContextWaterfall
            turns={data.turns}
            toolCalls={data.toolCalls}
          />
        )}

        {activeTab === "Subagents" && (
          <SubagentPanel
            subagents={data.subagents}
            mainTotals={{
              inputTokens: data.totals.inputTokens,
              outputTokens: data.totals.outputTokens,
            }}
          />
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}
