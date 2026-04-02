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
    <div className="space-y-4">
      {turns.map((turn) => (
        <TurnCard key={turn.index} turn={turn} />
      ))}
    </div>
  );
}

function TurnCard({ turn }: { turn: Turn }) {
  const [expandUser, setExpandUser] = useState(false);
  const [expandAssistant, setExpandAssistant] = useState(false);

  const toolCallColors = (name: string) => {
    if (name.startsWith("mcp__")) return "bg-blue-900/50 text-blue-300 border-blue-800";
    if (name === "Agent") return "bg-purple-900/50 text-purple-300 border-purple-800";
    return "bg-gray-800 text-gray-300 border-gray-700";
  };

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      {/* Turn header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
        <span className="text-xs font-mono text-gray-500">
          Turn {turn.index + 1}
        </span>
        <div className="flex gap-3 text-xs text-gray-500">
          {turn.durationMs != null && (
            <span>{(turn.durationMs / 1000).toFixed(1)}s</span>
          )}
          <span>
            {turn.assistantMessage.usage.inputTokens.toLocaleString()} in /{" "}
            {turn.assistantMessage.usage.outputTokens.toLocaleString()} out
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* User message */}
        {turn.userMessage.content && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-green-400">USER</span>
              <span className="text-xs text-gray-600">
                {new Date(turn.userMessage.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div
              className={`text-sm text-gray-300 whitespace-pre-wrap ${
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
                className="text-xs text-blue-400 hover:text-blue-300 mt-1"
              >
                {expandUser ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {/* Tool calls */}
        {turn.assistantMessage.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {turn.assistantMessage.toolCalls.map((tc) => (
              <span
                key={tc.id}
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${toolCallColors(tc.name)}`}
              >
                {tc.name}
              </span>
            ))}
          </div>
        )}

        {/* Assistant message */}
        {turn.assistantMessage.content && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-blue-400">
                ASSISTANT
              </span>
              <span className="text-xs text-gray-600">
                {new Date(turn.assistantMessage.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div
              className={`text-sm text-gray-300 whitespace-pre-wrap ${
                !expandAssistant && turn.assistantMessage.content.length > 500
                  ? "line-clamp-5"
                  : ""
              }`}
            >
              {turn.assistantMessage.content}
            </div>
            {turn.assistantMessage.content.length > 500 && (
              <button
                onClick={() => setExpandAssistant(!expandAssistant)}
                className="text-xs text-blue-400 hover:text-blue-300 mt-1"
              >
                {expandAssistant ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
