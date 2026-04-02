import { useState } from "react";
import Timeline from "./Timeline.js";

interface SubagentSummary {
  id: string;
  agentType: string;
  description: string;
  turns: any[];
  toolCalls: any[];
  tokenTimeline: any[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    toolCalls: number;
    turnCount: number;
  };
}

interface SubagentPanelProps {
  subagents: SubagentSummary[];
  mainTotals: {
    inputTokens: number;
    outputTokens: number;
  };
}

export default function SubagentPanel({
  subagents,
  mainTotals,
}: SubagentPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (subagents.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No subagents were spawned in this conversation.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Token comparison */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Token Usage Comparison
        </h3>
        <div className="space-y-2">
          <TokenBar
            label="Main conversation"
            input={mainTotals.inputTokens}
            output={mainTotals.outputTokens}
            maxTokens={Math.max(
              mainTotals.inputTokens + mainTotals.outputTokens,
              ...subagents.map(
                (s) => s.totals.inputTokens + s.totals.outputTokens
              )
            )}
          />
          {subagents.map((sa) => (
            <TokenBar
              key={sa.id}
              label={`${sa.agentType}: ${sa.description.slice(0, 40)}`}
              input={sa.totals.inputTokens}
              output={sa.totals.outputTokens}
              maxTokens={Math.max(
                mainTotals.inputTokens + mainTotals.outputTokens,
                ...subagents.map(
                  (s) => s.totals.inputTokens + s.totals.outputTokens
                )
              )}
            />
          ))}
        </div>
      </div>

      {/* Subagent cards */}
      {subagents.map((sa) => (
        <div
          key={sa.id}
          className="border border-gray-800 rounded-lg overflow-hidden"
        >
          <button
            onClick={() =>
              setExpandedId(expandedId === sa.id ? null : sa.id)
            }
            className="w-full text-left p-4 hover:bg-gray-900/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-purple-400 mr-2">
                  {sa.agentType}
                </span>
                <span className="text-sm text-gray-200">
                  {sa.description}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-gray-500">
                <span>{sa.totals.turnCount} turns</span>
                <span>{sa.totals.toolCalls} tool calls</span>
                <span>
                  {(sa.totals.inputTokens + sa.totals.outputTokens).toLocaleString()}{" "}
                  tokens
                </span>
                <span>{expandedId === sa.id ? "▾" : "▸"}</span>
              </div>
            </div>
          </button>
          {expandedId === sa.id && (
            <div className="border-t border-gray-800 p-4">
              <Timeline turns={sa.turns} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TokenBar({
  label,
  input,
  output,
  maxTokens,
}: {
  label: string;
  input: number;
  output: number;
  maxTokens: number;
}) {
  const total = input + output;
  const pct = maxTokens > 0 ? (total / maxTokens) * 100 : 0;
  const inputPct = total > 0 ? (input / total) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span className="truncate max-w-xs">{label}</span>
        <span>{total.toLocaleString()}</span>
      </div>
      <div className="h-3 bg-gray-800 rounded overflow-hidden">
        <div
          className="h-full flex rounded"
          style={{ width: `${pct}%` }}
        >
          <div
            className="bg-blue-500 h-full"
            style={{ width: `${inputPct}%` }}
          />
          <div
            className="bg-green-500 h-full"
            style={{ width: `${100 - inputPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
