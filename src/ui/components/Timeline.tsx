import { useState } from "react";

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

interface TimelineProps {
  turns: Turn[];
}

export default function Timeline({ turns }: TimelineProps) {
  return (
    <div className="space-y-1">
      {turns.map((turn) => (
        <TurnCard key={turn.index} turn={turn} />
      ))}
    </div>
  );
}

function TurnCard({ turn }: { turn: Turn }) {
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

  return (
    <div className="border border-term-border hover:border-term-border-hi transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-term-border/50 bg-term-surface">
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
