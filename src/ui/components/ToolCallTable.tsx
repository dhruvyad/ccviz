import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import ToolCallDetail from "./ToolCallDetail.js";

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
  result: {
    content: string;
    sizeBytes: number;
    persistedPath: string | null;
  };
  startTimestamp: string;
  endTimestamp: string;
  durationMs: number;
  turnIndex: number;
  isMcp: boolean;
  mcpServer: string | null;
}

interface ToolCallTableProps {
  toolCalls: ToolCall[];
  projectPath: string;
  sessionId: string;
}

type SortKey = "name" | "durationMs" | "sizeBytes" | "turnIndex";

export default function ToolCallTable({
  toolCalls,
  projectPath,
  sessionId,
}: ToolCallTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("turnIndex");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterName, setFilterName] = useState("");
  const [filterMcp, setFilterMcp] = useState<"all" | "mcp" | "native">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return toolCalls.filter((tc) => {
      if (filterName && !tc.name.toLowerCase().includes(filterName.toLowerCase()))
        return false;
      if (filterMcp === "mcp" && !tc.isMcp) return false;
      if (filterMcp === "native" && tc.isMcp) return false;
      return true;
    });
  }, [toolCalls, filterName, filterMcp]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "name":
          av = a.name;
          bv = b.name;
          break;
        case "durationMs":
          av = a.durationMs;
          bv = b.durationMs;
          break;
        case "sizeBytes":
          av = a.result.sizeBytes;
          bv = b.result.sizeBytes;
          break;
        case "turnIndex":
          av = a.turnIndex;
          bv = b.turnIndex;
          break;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortAsc]);

  // Aggregation data
  const countByName = useMemo(() => {
    const map = new Map<string, number>();
    toolCalls.forEach((tc) => map.set(tc.name, (map.get(tc.name) ?? 0) + 1));
    return Array.from(map.entries())
      .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 20) + "..." : name, fullName: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [toolCalls]);

  const sizeByName = useMemo(() => {
    const map = new Map<string, number>();
    toolCalls.forEach((tc) =>
      map.set(tc.name, (map.get(tc.name) ?? 0) + tc.result.sizeBytes)
    );
    return Array.from(map.entries())
      .map(([name, bytes]) => ({
        name: name.length > 20 ? name.slice(0, 20) + "..." : name,
        fullName: name,
        bytes,
        kb: Math.round(bytes / 1024),
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 15);
  }, [toolCalls]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const mcpCount = toolCalls.filter((tc) => tc.isMcp).length;

  return (
    <div className="space-y-6">
      {/* Aggregation charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            Call Count by Tool
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={countByName} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#6b7280" fontSize={12} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#6b7280"
                fontSize={11}
                width={140}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelFormatter={(_l, payload) => payload?.[0]?.payload?.fullName ?? _l}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            Total Result Size by Tool (KB)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sizeByName} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#6b7280" fontSize={12} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#6b7280"
                fontSize={11}
                width={140}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelFormatter={(_l, payload) => payload?.[0]?.payload?.fullName ?? _l}
              />
              <Bar dataKey="kb" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="text-gray-400">
          Total: <span className="text-gray-200">{toolCalls.length}</span>
        </span>
        <span className="text-gray-400">
          MCP: <span className="text-blue-400">{mcpCount}</span>
        </span>
        <span className="text-gray-400">
          Native: <span className="text-gray-200">{toolCalls.length - mcpCount}</span>
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Filter by tool name..."
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={filterMcp}
          onChange={(e) => setFilterMcp(e.target.value as any)}
          className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All tools</option>
          <option value="mcp">MCP only</option>
          <option value="native">Native only</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-gray-800">
              {(
                [
                  ["name", "Tool Name"],
                  ["turnIndex", "Turn"],
                  ["durationMs", "Duration"],
                  ["sizeBytes", "Result Size"],
                ] as const
              ).map(([key, label]) => (
                <th
                  key={key}
                  className="text-left py-2 px-3 cursor-pointer hover:text-gray-300"
                  onClick={() => handleSort(key)}
                >
                  {label} {sortKey === key && (sortAsc ? "↑" : "↓")}
                </th>
              ))}
              <th className="text-left py-2 px-3">MCP</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((tc) => (
              <ToolCallRow
                key={tc.id}
                tc={tc}
                expanded={expandedId === tc.id}
                onToggle={() =>
                  setExpandedId(expandedId === tc.id ? null : tc.id)
                }
                projectPath={projectPath}
                sessionId={sessionId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToolCallRow({
  tc,
  expanded,
  onToggle,
  projectPath,
  sessionId,
}: {
  tc: any;
  expanded: boolean;
  onToggle: () => void;
  projectPath: string;
  sessionId: string;
}) {
  return (
    <>
      <tr
        className="border-b border-gray-800/50 hover:bg-gray-900/50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="py-1.5 px-3 text-gray-200 font-mono text-xs">
          {tc.name}
        </td>
        <td className="py-1.5 px-3 text-gray-400">{tc.turnIndex + 1}</td>
        <td className="py-1.5 px-3 text-gray-400">
          {tc.durationMs != null ? `${(tc.durationMs / 1000).toFixed(1)}s` : "—"}
        </td>
        <td className="py-1.5 px-3 text-gray-400">
          {formatBytes(tc.result.sizeBytes)}
        </td>
        <td className="py-1.5 px-3">
          {tc.isMcp && (
            <span className="text-xs text-blue-400">{tc.mcpServer}</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0">
            <ToolCallDetail
              toolCall={tc}
              projectPath={projectPath}
              sessionId={sessionId}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
