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
  result: { sizeBytes: number };
  turnIndex: number;
  durationMs: number;
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

  return (
    <div className="space-y-1">
      {turns.map((turn, i) => (
        <TurnCard
          key={turn.index}
          turn={turn}
          metrics={metrics[i]}
          maxContext={maxContext}
        />
      ))}
    </div>
  );
}

function TurnCard({
  turn,
  metrics,
  maxContext,
}: {
  turn: Turn;
  metrics: TurnMetrics;
  maxContext: number;
}) {
  const [expandUser, setExpandUser] = useState(false);
  const [expandAssistant, setExpandAssistant] = useState(false);

  const toolColor = (name: string) => {
    if (name.startsWith("mcp__")) return "text-term-blue";
    if (name === "Agent") return "text-term-purple";
    return "text-term-text-dim";
  };

  const toolBg = (name: string) => {
    if (name.startsWith("mcp__"))
      return "border-term-blue/30 bg-term-blue/5";
    if (name === "Agent")
      return "border-term-purple/30 bg-term-purple/5";
    return "border-term-border bg-term-surface";
  };

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
              ({formatK(metrics.toolResultBytes)}B tools)
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

        {/* Tool calls */}
        {turn.assistantMessage.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {turn.assistantMessage.toolCalls.map((tc) => (
              <span
                key={tc.id}
                className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono border ${toolBg(tc.name)} ${toolColor(tc.name)}`}
              >
                {tc.name}
              </span>
            ))}
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
