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
      <p className="text-term-text-dim text-xs font-mono">
        -- no subagents spawned --
      </p>
    );
  }

  const maxTokens = Math.max(
    mainTotals.inputTokens + mainTotals.outputTokens,
    ...subagents.map((s) => s.totals.inputTokens + s.totals.outputTokens)
  );

  return (
    <div className="space-y-4">
      {/* Token comparison */}
      <div className="border border-term-border bg-term-surface p-4">
        <h3 className="text-xs text-term-text-dim font-mono mb-3">
          token comparison
        </h3>
        <div className="space-y-2">
          <TokenBar
            label="main"
            input={mainTotals.inputTokens}
            output={mainTotals.outputTokens}
            maxTokens={maxTokens}
          />
          {subagents.map((sa) => (
            <TokenBar
              key={sa.id}
              label={`${sa.agentType}: ${sa.description.slice(0, 30)}`}
              input={sa.totals.inputTokens}
              output={sa.totals.outputTokens}
              maxTokens={maxTokens}
            />
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-[10px] font-mono">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-term-blue" />
            <span className="text-term-text-dim">input</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-term-green" />
            <span className="text-term-text-dim">output</span>
          </div>
        </div>
      </div>

      {/* Subagent cards */}
      {subagents.map((sa) => (
        <div key={sa.id} className="border border-term-border">
          <button
            onClick={() =>
              setExpandedId(expandedId === sa.id ? null : sa.id)
            }
            className="w-full text-left px-3 py-2 hover:bg-term-surface transition-colors font-mono"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-term-purple">
                  [{sa.agentType}]
                </span>
                <span className="text-xs text-term-text">
                  {sa.description}
                </span>
              </div>
              <div className="flex gap-3 text-[10px] text-term-text-dim">
                <span>{sa.totals.turnCount}t</span>
                <span>{sa.totals.toolCalls}tc</span>
                <span>
                  {(
                    sa.totals.inputTokens + sa.totals.outputTokens
                  ).toLocaleString()}
                  tok
                </span>
                <span>{expandedId === sa.id ? "▾" : "▸"}</span>
              </div>
            </div>
          </button>
          {expandedId === sa.id && (
            <div className="border-t border-term-border p-3">
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
      <div className="flex justify-between text-[10px] font-mono text-term-text-dim mb-0.5">
        <span className="truncate max-w-xs">{label}</span>
        <span>{total.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-term-border">
        <div className="h-full flex" style={{ width: `${pct}%` }}>
          <div
            className="bg-term-blue h-full"
            style={{ width: `${inputPct}%` }}
          />
          <div
            className="bg-term-green h-full"
            style={{ width: `${100 - inputPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
