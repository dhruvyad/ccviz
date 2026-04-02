import { useState, useMemo } from "react";

interface Turn {
  index: number;
  userMessage: {
    timestamp: string;
    content: string;
    toolResults: { toolUseId: string; content: string }[];
  };
  assistantMessage: {
    timestamp: string;
    content: string;
    toolCalls: { id: string; name: string }[];
    usage: {
      inputTokens: number;
      outputTokens: number;
      cacheCreationTokens: number;
      cacheReadTokens: number;
    };
  };
  durationMs: number | null;
}

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
  result: { content: string; sizeBytes: number; persistedPath: string | null };
  turnIndex: number;
  durationMs: number;
  isMcp: boolean;
  mcpServer: string | null;
}

interface TimelineProps {
  turns: Turn[];
  toolCalls?: ToolCall[];
}

interface TurnMetrics {
  outputTokens: number;
  toolResultBytes: number;
  totalContextAdded: number; // output tokens + tool result bytes / ~4 (rough char-to-token)
}

function getHeatColor(ratio: number): string {
  if (ratio < 0.25) return "#00ff88"; // green
  if (ratio < 0.5) return "#88ff00"; // yellow-green
  if (ratio < 0.7) return "#ffaa00"; // amber
  if (ratio < 0.85) return "#ff6600"; // orange
  return "#ff2200"; // red
}

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

export default function Timeline({ turns, toolCalls = [] }: TimelineProps) {
  // Calculate per-turn context contribution
  const metrics = useMemo(() => {
    const result: TurnMetrics[] = turns.map((turn) => {
      const outputTokens = turn.assistantMessage.usage.outputTokens;
      const turnToolCalls = toolCalls.filter(
        (tc) => tc.turnIndex === turn.index
      );
      const toolResultBytes = turnToolCalls.reduce(
        (s, tc) => s + tc.result.sizeBytes,
        0
      );
      // Rough: 1 token ≈ 4 bytes
      const totalContextAdded = outputTokens + Math.round(toolResultBytes / 4);
      return { outputTokens, toolResultBytes, totalContextAdded };
    });
    return result;
  }, [turns, toolCalls]);

  const maxContext = useMemo(
    () => Math.max(1, ...metrics.map((m) => m.totalContextAdded)),
    [metrics]
  );

  // Group tool calls by turn
  const toolCallsByTurn = useMemo(() => {
    const map = new Map<number, ToolCall[]>();
    toolCalls.forEach((tc) => {
      const list = map.get(tc.turnIndex) ?? [];
      list.push(tc);
      map.set(tc.turnIndex, list);
    });
    return map;
  }, [toolCalls]);

  return (
    <div className="space-y-1">
      {turns.map((turn, i) => (
        <TurnCard
          key={turn.index}
          turn={turn}
          metrics={metrics[i]}
          maxContext={maxContext}
          turnToolCalls={toolCallsByTurn.get(turn.index) ?? []}
        />
      ))}
    </div>
  );
}

function TurnCard({
  turn,
  metrics,
  maxContext,
  turnToolCalls,
}: {
  turn: Turn;
  metrics: TurnMetrics;
  maxContext: number;
  turnToolCalls: ToolCall[];
}) {
  const [expandUser, setExpandUser] = useState(false);
  const [expandAssistant, setExpandAssistant] = useState(false);
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);

  const ratio = maxContext > 0 ? metrics.totalContextAdded / maxContext : 0;
  const barColor = getHeatColor(ratio);
  const barPct = Math.max(1, ratio * 100);

  return (
    <div className="border border-term-border hover:border-term-border-hi transition-colors">
      {/* Header with context bar */}
      <div className="bg-term-surface border-b border-term-border/50">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] font-mono text-term-text-dim">
            turn {turn.index + 1}
          </span>
          <div className="flex gap-3 text-[10px] font-mono text-term-text-dim">
            {turn.durationMs != null && (
              <span>{(turn.durationMs / 1000).toFixed(1)}s</span>
            )}
            <span>
              <span className="text-term-blue">
                {turn.assistantMessage.usage.inputTokens.toLocaleString()}
              </span>
              {" / "}
              <span className="text-term-green">
                {turn.assistantMessage.usage.outputTokens.toLocaleString()}
              </span>
            </span>
          </div>
        </div>
        {/* Context contribution bar */}
        <div className="px-3 pb-1.5 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-term-border/50 overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${barPct}%`,
                backgroundColor: barColor,
                opacity: 0.7,
              }}
            />
          </div>
          <span
            className="text-[9px] font-mono flex-shrink-0"
            style={{ color: barColor }}
          >
            +{formatK(metrics.totalContextAdded)} tok
          </span>
          {metrics.toolResultBytes > 0 && (
            <span className="text-[9px] font-mono text-term-text-dim flex-shrink-0">
              ({formatBytes(metrics.toolResultBytes)} tools)
            </span>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* User */}
        {turn.userMessage.content && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-term-green">
                $
              </span>
              <span className="text-[10px] font-mono text-term-text-dim">
                {new Date(turn.userMessage.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div
              className={`text-xs text-term-text whitespace-pre-wrap font-mono ${
                !expandUser && turn.userMessage.content.length > 300
                  ? "line-clamp-3"
                  : ""
              }`}
            >
              {turn.userMessage.content}
            </div>
            {turn.userMessage.content.length > 300 && (
              <button
                onClick={() => setExpandUser(!expandUser)}
                className="text-[10px] text-term-blue hover:text-term-cyan font-mono mt-0.5"
              >
                {expandUser ? "[less]" : "[more]"}
              </button>
            )}
          </div>
        )}

        {/* Tool calls — expandable cards */}
        {turnToolCalls.length > 0 && (
          <div className="space-y-1">
            {turnToolCalls.map((tc) => {
              const isExpanded = expandedToolId === tc.id;
              const isMcp = tc.name.startsWith("mcp__");
              const isAgent = tc.name === "Agent";
              const accentColor = isMcp
                ? "#00aaff"
                : isAgent
                  ? "#aa66ff"
                  : "#555";

              return (
                <div key={tc.id} className="border border-term-border/60">
                  {/* Tool header — always visible, clickable */}
                  <button
                    onClick={() =>
                      setExpandedToolId(isExpanded ? null : tc.id)
                    }
                    className="w-full text-left px-2 py-1 flex items-center gap-2 hover:bg-term-surface/50 transition-colors"
                  >
                    <span
                      className="text-[10px] font-mono font-semibold"
                      style={{ color: accentColor }}
                    >
                      {tc.name}
                    </span>
                    <span className="text-[9px] font-mono text-term-text-dim ml-auto flex-shrink-0 flex gap-2">
                      {tc.durationMs > 0 && (
                        <span>
                          {(tc.durationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                      <span
                        className={
                          tc.result.sizeBytes > 10240
                            ? "text-term-yellow"
                            : ""
                        }
                      >
                        {formatBytes(tc.result.sizeBytes)}
                      </span>
                      <span>{isExpanded ? "▾" : "▸"}</span>
                    </span>
                  </button>

                  {/* Expanded: input + result preview */}
                  {isExpanded && (
                    <div className="border-t border-term-border/40 px-2 py-2 space-y-2 bg-term-bg">
                      {/* Input params */}
                      <div>
                        <span className="text-[9px] font-mono text-term-green">
                          input
                        </span>
                        <pre className="text-[10px] text-term-text font-mono bg-term-surface border border-term-border/40 p-2 mt-0.5 overflow-x-auto max-h-48 overflow-y-auto">
                          {formatInput(tc.input)}
                        </pre>
                      </div>
                      {/* Result preview */}
                      <div>
                        <span className="text-[9px] font-mono text-term-yellow">
                          result{" "}
                          <span className="text-term-text-dim">
                            ({formatBytes(tc.result.sizeBytes)})
                          </span>
                        </span>
                        <pre className="text-[10px] text-term-text font-mono bg-term-surface border border-term-border/40 p-2 mt-0.5 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {tc.result.content.length > 1500
                            ? tc.result.content.slice(0, 1500) + "\n..."
                            : tc.result.content || "[empty]"}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Assistant */}
        {turn.assistantMessage.content && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-term-blue">
                &gt;
              </span>
              <span className="text-[10px] font-mono text-term-text-dim">
                {new Date(
                  turn.assistantMessage.timestamp
                ).toLocaleTimeString()}
              </span>
            </div>
            <div
              className={`text-xs text-term-text whitespace-pre-wrap font-mono ${
                !expandAssistant &&
                turn.assistantMessage.content.length > 500
                  ? "line-clamp-5"
                  : ""
              }`}
            >
              {turn.assistantMessage.content}
            </div>
            {turn.assistantMessage.content.length > 500 && (
              <button
                onClick={() => setExpandAssistant(!expandAssistant)}
                className="text-[10px] text-term-blue hover:text-term-cyan font-mono mt-0.5"
              >
                {expandAssistant ? "[less]" : "[more]"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatInput(input: Record<string, any>): string {
  // Show key params concisely: for common tools, show the most relevant fields
  const entries = Object.entries(input);
  if (entries.length === 0) return "{}";

  // For short inputs, just show JSON
  const full = JSON.stringify(input, null, 2);
  if (full.length < 500) return full;

  // For long inputs, show keys and truncated values
  const lines: string[] = [];
  for (const [key, val] of entries) {
    const valStr =
      typeof val === "string"
        ? val.length > 200
          ? `"${val.slice(0, 200)}..."`
          : JSON.stringify(val)
        : JSON.stringify(val, null, 2);
    lines.push(`${key}: ${valStr}`);
  }
  return lines.join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
