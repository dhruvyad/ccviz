import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
  result: { content: string; sizeBytes: number; persistedPath: string | null };
  turnIndex: number;
  isMcp: boolean;
}

interface Turn {
  index: number;
  userMessage: { content: string };
  assistantMessage: {
    content: string;
    usage: { inputTokens: number; outputTokens: number };
  };
}

interface ContextWaterfallProps {
  turns: Turn[];
  toolCalls: ToolCall[];
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#f97316",
];

export default function ContextWaterfall({
  turns,
  toolCalls,
}: ContextWaterfallProps) {
  // Stacked bar: per-turn context breakdown
  const barData = useMemo(() => {
    return turns.map((turn) => {
      const userTextSize = new TextEncoder().encode(
        turn.userMessage.content
      ).length;
      const assistantSize = new TextEncoder().encode(
        turn.assistantMessage.content
      ).length;
      const turnToolCalls = toolCalls.filter(
        (tc) => tc.turnIndex === turn.index
      );
      const toolResultSize = turnToolCalls.reduce(
        (s, tc) => s + tc.result.sizeBytes,
        0
      );

      return {
        turn: turn.index + 1,
        userText: Math.round(userTextSize / 1024),
        toolResults: Math.round(toolResultSize / 1024),
        assistantOutput: Math.round(assistantSize / 1024),
      };
    });
  }, [turns, toolCalls]);

  // Pie: context by tool type
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    toolCalls.forEach((tc) => {
      const key = tc.isMcp ? `mcp:${tc.name.split("__")[1]}` : tc.name;
      map.set(key, (map.get(key) ?? 0) + tc.result.sizeBytes);
    });
    return Array.from(map.entries())
      .map(([name, bytes]) => ({ name, value: Math.round(bytes / 1024) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [toolCalls]);

  // Top 10 largest tool results
  const largestResults = useMemo(() => {
    return [...toolCalls]
      .sort((a, b) => b.result.sizeBytes - a.result.sizeBytes)
      .slice(0, 10);
  }, [toolCalls]);

  // Optimization suggestions
  const suggestions = useMemo(() => {
    const items: string[] = [];

    // Flag results > 10KB
    const largeResults = toolCalls.filter(
      (tc) => tc.result.sizeBytes > 10 * 1024
    );
    if (largeResults.length > 0) {
      items.push(
        `${largeResults.length} tool result(s) exceed 10KB — consider truncating or persisting to disk`
      );
    }

    // Flag repeated identical tool calls
    const callSignatures = new Map<string, number>();
    toolCalls.forEach((tc) => {
      const sig = `${tc.name}:${JSON.stringify(tc.result.content).slice(0, 100)}`;
      callSignatures.set(sig, (callSignatures.get(sig) ?? 0) + 1);
    });
    const duplicates = Array.from(callSignatures.entries()).filter(
      ([, count]) => count > 1
    );
    if (duplicates.length > 0) {
      items.push(
        `${duplicates.length} tool call(s) appear to be repeated with identical results`
      );
    }

    // Flag Read calls on large content
    const largeReads = toolCalls.filter(
      (tc) => tc.name === "Read" && tc.result.sizeBytes > 5000
    );
    if (largeReads.length > 0) {
      items.push(
        `${largeReads.length} Read call(s) returned > 5KB — consider reading specific line ranges`
      );
    }

    return items;
  }, [toolCalls]);

  return (
    <div className="space-y-8">
      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-400 mb-2">
            Optimization Suggestions
          </h3>
          <ul className="text-sm text-yellow-200/80 space-y-1">
            {suggestions.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Stacked bar */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Context Composition Per Turn (KB)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="turn" stroke="#6b7280" fontSize={12} />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              label={{
                value: "KB",
                angle: -90,
                position: "insideLeft",
                fill: "#6b7280",
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelFormatter={(l) => `Turn ${l}`}
              formatter={(value: number) => `${value} KB`}
            />
            <Bar
              dataKey="userText"
              stackId="a"
              fill="#10b981"
              name="User Text"
            />
            <Bar
              dataKey="toolResults"
              stackId="a"
              fill="#f59e0b"
              name="Tool Results"
            />
            <Bar
              dataKey="assistantOutput"
              stackId="a"
              fill="#3b82f6"
              name="Assistant Output"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie chart */}
      {pieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Context by Tool Type
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => `${value} KB`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top 10 table */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Top 10 Largest Tool Results
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left py-2 px-3">Tool</th>
                  <th className="text-right py-2 px-3">Size</th>
                  <th className="text-left py-2 px-3">Persisted</th>
                </tr>
              </thead>
              <tbody>
                {largestResults.map((tc) => (
                  <tr
                    key={tc.id}
                    className="border-b border-gray-800/50"
                  >
                    <td className="py-1.5 px-3 text-gray-200 font-mono text-xs truncate max-w-48">
                      {tc.name}
                    </td>
                    <td className="py-1.5 px-3 text-right text-yellow-400 text-xs">
                      {formatBytes(tc.result.sizeBytes)}
                    </td>
                    <td className="py-1.5 px-3 text-xs text-gray-500">
                      {tc.result.persistedPath ? "Yes" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
