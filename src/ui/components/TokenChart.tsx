import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface TokenDataPoint {
  turnIndex: number;
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cumulativeInputTokens: number;
  cumulativeOutputTokens: number;
}

interface TokenChartProps {
  data: TokenDataPoint[];
}

export default function TokenChart({ data }: TokenChartProps) {
  if (data.length === 0) {
    return <p className="text-gray-500 text-sm">No token data available.</p>;
  }

  return (
    <div className="space-y-8">
      {/* Per-turn stacked area */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Tokens Per Turn
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="turnIndex"
              stroke="#6b7280"
              fontSize={12}
              label={{
                value: "Turn",
                position: "insideBottom",
                offset: -5,
                fill: "#6b7280",
              }}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickFormatter={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelFormatter={(l) => `Turn ${l}`}
              formatter={(value: number) => value.toLocaleString()}
            />
            <Area
              type="monotone"
              dataKey="inputTokens"
              stackId="1"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.4}
              name="Input"
            />
            <Area
              type="monotone"
              dataKey="outputTokens"
              stackId="1"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.4}
              name="Output"
            />
            <Area
              type="monotone"
              dataKey="cacheCreationTokens"
              stackId="1"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.4}
              name="Cache Creation"
            />
            <Area
              type="monotone"
              dataKey="cacheReadTokens"
              stackId="1"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.4}
              name="Cache Read"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative line chart */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Cumulative Context Growth
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="turnIndex" stroke="#6b7280" fontSize={12} />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickFormatter={(v) =>
                v >= 1000000
                  ? `${(v / 1000000).toFixed(1)}M`
                  : v >= 1000
                    ? `${(v / 1000).toFixed(0)}k`
                    : v
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelFormatter={(l) => `Turn ${l}`}
              formatter={(value: number) => value.toLocaleString()}
            />
            <Line
              type="monotone"
              dataKey="cumulativeInputTokens"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Cumulative Input"
            />
            <Line
              type="monotone"
              dataKey="cumulativeOutputTokens"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="Cumulative Output"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Per-turn table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Per-Turn Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="text-left py-2 px-3">Turn</th>
                <th className="text-right py-2 px-3">Input</th>
                <th className="text-right py-2 px-3">Output</th>
                <th className="text-right py-2 px-3">Cache Create</th>
                <th className="text-right py-2 px-3">Cache Read</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr
                  key={d.turnIndex}
                  className="border-b border-gray-800/50 hover:bg-gray-900/50"
                >
                  <td className="py-1.5 px-3 text-gray-400">{d.turnIndex + 1}</td>
                  <td className="py-1.5 px-3 text-right text-blue-400">
                    {d.inputTokens.toLocaleString()}
                  </td>
                  <td className="py-1.5 px-3 text-right text-green-400">
                    {d.outputTokens.toLocaleString()}
                  </td>
                  <td className="py-1.5 px-3 text-right text-yellow-400">
                    {d.cacheCreationTokens.toLocaleString()}
                  </td>
                  <td className="py-1.5 px-3 text-right text-purple-400">
                    {d.cacheReadTokens.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
