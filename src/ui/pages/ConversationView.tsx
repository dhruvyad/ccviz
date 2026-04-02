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
  "timeline",
  "tokens",
  "tools",
  "context",
  "subagents",
] as const;
type Tab = (typeof TABS)[number];

export default function ConversationView() {
  const { projectPath, sessionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ParsedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("timeline");

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
      <div className="flex items-center justify-center h-screen text-term-text-dim font-mono text-xs">
        parsing...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen text-term-red font-mono text-xs">
        {error ?? "failed to load"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-term-bg">
      {/* Top bar */}
      <div className="border-b border-term-border bg-term-bg sticky top-0 z-10">
        <div className="px-5 py-3">
          <div className="flex items-center gap-3 mb-1.5">
            <button
              onClick={() => navigate("/")}
              className="text-term-text-dim hover:text-term-green text-xs font-mono"
            >
              cd ..
            </button>
            <span className="text-term-text-dim text-xs">/</span>
            <h1 className="text-sm font-mono text-term-text-bright">
              {data.title || data.agentName || data.id.slice(0, 12)}
            </h1>
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] font-mono text-term-text-dim">
            {data.model && (
              <span>
                model=<span className="text-term-text">{data.model}</span>
              </span>
            )}
            {data.gitBranch && (
              <span>
                branch=
                <span className="text-term-text">{data.gitBranch}</span>
              </span>
            )}
            {data.totals.durationMs != null && (
              <span>
                time=
                <span className="text-term-text">
                  {formatDuration(data.totals.durationMs)}
                </span>
              </span>
            )}
            <span>
              turns=
              <span className="text-term-text">{data.totals.turnCount}</span>
            </span>
            <span>
              tools=
              <span className="text-term-text">{data.totals.toolCalls}</span>
            </span>
            <span>
              in=
              <span className="text-term-blue">
                {data.totals.inputTokens.toLocaleString()}
              </span>
            </span>
            <span>
              out=
              <span className="text-term-green">
                {data.totals.outputTokens.toLocaleString()}
              </span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 flex gap-px font-mono">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                activeTab === tab
                  ? "bg-term-surface text-term-green border-t border-x border-term-border"
                  : "text-term-text-dim hover:text-term-text"
              }`}
            >
              {tab}
              {tab === "subagents" && data.subagents.length > 0 && (
                <span className="ml-1 text-term-purple">
                  ({data.subagents.length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-5 max-w-7xl mx-auto">
        {activeTab === "timeline" && <Timeline turns={data.turns} />}
        {activeTab === "tokens" && <TokenChart data={data.tokenTimeline} />}
        {activeTab === "tools" && (
          <ToolCallTable
            toolCalls={data.toolCalls}
            projectPath={projectPath!}
            sessionId={sessionId!}
          />
        )}
        {activeTab === "context" && (
          <ContextWaterfall
            turns={data.turns}
            toolCalls={data.toolCalls}
          />
        )}
        {activeTab === "subagents" && (
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
  if (mins < 60) return `${mins}m${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h${mins % 60}m`;
}
