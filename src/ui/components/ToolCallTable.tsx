import { useState, useMemo } from "react";
import { Group } from "@visx/group";
import { Bar } from "@visx/shape";
import { scaleLinear, scaleBand } from "@visx/scale";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { ParentSize } from "@visx/responsive";
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
      if (
        filterName &&
        !tc.name.toLowerCase().includes(filterName.toLowerCase())
      )
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

  const countByName = useMemo(() => {
    const map = new Map<string, number>();
    toolCalls.forEach((tc) => map.set(tc.name, (map.get(tc.name) ?? 0) + 1));
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [toolCalls]);

  const sizeByName = useMemo(() => {
    const map = new Map<string, number>();
    toolCalls.forEach((tc) =>
      map.set(tc.name, (map.get(tc.name) ?? 0) + tc.result.sizeBytes)
    );
    return Array.from(map.entries())
      .map(([name, bytes]) => ({
        name,
        kb: Math.round(bytes / 1024),
      }))
      .sort((a, b) => b.kb - a.kb)
      .slice(0, 12);
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
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-term-border bg-term-surface p-3">
          <h3 className="text-xs text-term-text-dim mb-2 font-mono">
            call count
          </h3>
          <ParentSize debounceTime={100}>
            {({ width }) => (
              <HBarChart
                width={width}
                height={Math.max(120, countByName.length * 22 + 40)}
                data={countByName.map((d) => ({
                  label: d.name.length > 22 ? d.name.slice(0, 22) + ".." : d.name,
                  value: d.count,
                }))}
                color="#00aaff"
              />
            )}
          </ParentSize>
        </div>
        <div className="border border-term-border bg-term-surface p-3">
          <h3 className="text-xs text-term-text-dim mb-2 font-mono">
            result size (KB)
          </h3>
          <ParentSize debounceTime={100}>
            {({ width }) => (
              <HBarChart
                width={width}
                height={Math.max(120, sizeByName.length * 22 + 40)}
                data={sizeByName.map((d) => ({
                  label: d.name.length > 22 ? d.name.slice(0, 22) + ".." : d.name,
                  value: d.kb,
                }))}
                color="#ffaa00"
              />
            )}
          </ParentSize>
        </div>
      </div>

      {/* Stats + Filters */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
        <span className="text-term-text-dim">
          total:{" "}
          <span className="text-term-text">{toolCalls.length}</span>
        </span>
        <span className="text-term-text-dim">
          mcp: <span className="text-term-blue">{mcpCount}</span>
        </span>
        <span className="text-term-text-dim">
          native:{" "}
          <span className="text-term-text">{toolCalls.length - mcpCount}</span>
        </span>
        <span className="text-term-text-dim">|</span>
        <input
          type="text"
          placeholder="filter..."
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="bg-transparent border-b border-term-border text-term-text placeholder-term-text-dim focus:outline-none focus:border-term-green py-0.5 w-32"
        />
        <select
          value={filterMcp}
          onChange={(e) => setFilterMcp(e.target.value as any)}
          className="bg-term-bg border border-term-border text-term-text text-xs py-0.5 px-1 focus:outline-none"
        >
          <option value="all">all</option>
          <option value="mcp">mcp</option>
          <option value="native">native</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-term-border overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-term-text-dim border-b border-term-border">
              {(
                [
                  ["name", "tool"],
                  ["turnIndex", "#"],
                  ["durationMs", "time"],
                  ["sizeBytes", "size"],
                ] as const
              ).map(([key, label]) => (
                <th
                  key={key}
                  className="text-left py-1.5 px-3 cursor-pointer hover:text-term-text"
                  onClick={() => handleSort(key)}
                >
                  {label}
                  {sortKey === key && (
                    <span className="text-term-green ml-1">
                      {sortAsc ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              ))}
              <th className="text-left py-1.5 px-3">mcp</th>
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

function HBarChart({
  width,
  height,
  data,
  color,
}: {
  width: number;
  height: number;
  data: { label: string; value: number }[];
  color: string;
}) {
  const margin = { top: 4, right: 30, bottom: 4, left: 120 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const yScale = scaleBand({
    domain: data.map((d) => d.label),
    range: [0, innerH],
    padding: 0.3,
  });

  const xScale = scaleLinear({
    domain: [0, Math.max(...data.map((d) => d.value), 1)],
    range: [0, innerW],
    nice: true,
  });

  if (width < 100) return null;

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        {data.map((d) => (
          <g key={d.label}>
            <Bar
              x={0}
              y={yScale(d.label)!}
              width={Math.max(0, xScale(d.value))}
              height={yScale.bandwidth()}
              fill={color}
              fillOpacity={0.4}
              stroke={color}
              strokeWidth={0.5}
              strokeOpacity={0.6}
            />
            <text
              x={xScale(d.value) + 4}
              y={yScale(d.label)! + yScale.bandwidth() / 2}
              dy="0.35em"
              fill="#555"
              fontSize={9}
              fontFamily="monospace"
            >
              {d.value}
            </text>
          </g>
        ))}
        <AxisLeft
          scale={yScale}
          stroke="transparent"
          tickStroke="transparent"
          tickLabelProps={{
            fill: "#555",
            fontSize: 9,
            fontFamily: "monospace",
            textAnchor: "end",
            dx: -4,
          }}
        />
      </Group>
    </svg>
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
        className="border-b border-term-border/50 hover:bg-term-border/30 cursor-pointer"
        onClick={onToggle}
      >
        <td className="py-1 px-3 text-term-text">{tc.name}</td>
        <td className="py-1 px-3 text-term-text-dim">{tc.turnIndex + 1}</td>
        <td className="py-1 px-3 text-term-text-dim">
          {tc.durationMs != null
            ? `${(tc.durationMs / 1000).toFixed(1)}s`
            : "—"}
        </td>
        <td className="py-1 px-3 text-term-text-dim">
          {formatBytes(tc.result.sizeBytes)}
        </td>
        <td className="py-1 px-3">
          {tc.isMcp && (
            <span className="text-term-blue">{tc.mcpServer}</span>
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
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
