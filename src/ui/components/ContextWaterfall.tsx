import { useMemo, useCallback, useState } from "react";
import { Group } from "@visx/group";
import { BarStack } from "@visx/shape";
import { scaleLinear, scaleBand, scaleOrdinal } from "@visx/scale";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { ParentSize } from "@visx/responsive";
import { Pie } from "@visx/shape";
import { useTooltip, useTooltipInPortal, defaultStyles } from "@visx/tooltip";
import { localPoint } from "@visx/event";

const tooltipStyles = {
  ...defaultStyles,
  background: "#111",
  border: "1px solid #333",
  color: "#b0b0b0",
  fontSize: 10,
  fontFamily: "monospace",
  padding: "6px 8px",
  borderRadius: 0,
  boxShadow: "0 2px 8px rgba(0,0,0,0.8)",
} as const;

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

// Expanded color palette — enough for many tool types
const TOOL_COLORS = [
  "#ff4444", "#00aaff", "#ffaa00", "#aa66ff", "#00ff88",
  "#00dddd", "#ff8800", "#88ff00", "#ff66aa", "#66aaff",
  "#ddaa00", "#aa44ff", "#44ddaa", "#ff6644", "#44aadd",
];
const USER_COLOR = "#00ff88";
const ASSISTANT_COLOR = "#335566";

const PIE_COLORS = [
  "#00aaff", "#00ff88", "#ffaa00", "#aa66ff", "#ff4444",
  "#00dddd", "#ff8800", "#88ff00",
];

function toolCategory(tc: ToolCall): string {
  return tc.isMcp ? `mcp:${tc.name.split("__")[1]}` : tc.name;
}

export default function ContextWaterfall({
  turns,
  toolCalls,
}: ContextWaterfallProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<{
    turnIndex: number;
    toolKey: string;
  } | null>(null);

  // Find top tool categories by total bytes for the bar chart
  const topToolKeys = useMemo(() => {
    const map = new Map<string, number>();
    toolCalls.forEach((tc) => {
      const key = toolCategory(tc);
      map.set(key, (map.get(key) ?? 0) + tc.result.sizeBytes);
    });
    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 8).map(([k]) => k);
    const hasOther = sorted.length > 8;
    return { top, hasOther };
  }, [toolCalls]);

  // All stack keys: userText, then individual tools (+ "other"), then assistantOutput
  const stackKeys = useMemo(() => {
    const keys = ["userText", ...topToolKeys.top];
    if (topToolKeys.hasOther) keys.push("_other");
    keys.push("assistantOutput");
    return keys;
  }, [topToolKeys]);

  // Color map for stack keys
  const stackColorMap = useMemo(() => {
    const map: Record<string, string> = { userText: USER_COLOR, assistantOutput: ASSISTANT_COLOR };
    topToolKeys.top.forEach((key, i) => {
      map[key] = TOOL_COLORS[i % TOOL_COLORS.length];
    });
    if (topToolKeys.hasOther) map["_other"] = "#444";
    return map;
  }, [topToolKeys]);

  // Build per-turn stacked data with individual tool breakdowns
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

      const row: Record<string, any> = {
        turn: `${turn.index + 1}`,
        turnIndex: turn.index,
        userText: Math.round(userTextSize / 1024),
        assistantOutput: Math.round(assistantSize / 1024),
      };

      // Per-tool bytes
      const toolBytes = new Map<string, number>();
      turnToolCalls.forEach((tc) => {
        const key = toolCategory(tc);
        toolBytes.set(key, (toolBytes.get(key) ?? 0) + tc.result.sizeBytes);
      });

      let otherBytes = 0;
      for (const [key, bytes] of toolBytes) {
        if (topToolKeys.top.includes(key)) {
          row[key] = Math.round(bytes / 1024);
        } else {
          otherBytes += bytes;
        }
      }

      // Fill missing tool keys with 0
      for (const key of topToolKeys.top) {
        if (!(key in row)) row[key] = 0;
      }
      if (topToolKeys.hasOther) {
        row["_other"] = Math.round(otherBytes / 1024);
      }

      return row;
    });
  }, [turns, toolCalls, topToolKeys]);

  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    toolCalls.forEach((tc) => {
      const key = toolCategory(tc);
      map.set(key, (map.get(key) ?? 0) + tc.result.sizeBytes);
    });
    return Array.from(map.entries())
      .map(([name, bytes]) => ({ name, value: Math.round(bytes / 1024) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [toolCalls]);

  const filteredToolCalls = useMemo(() => {
    if (!selectedCategory) return toolCalls;
    return toolCalls.filter((tc) => toolCategory(tc) === selectedCategory);
  }, [toolCalls, selectedCategory]);

  const largestResults = useMemo(() => {
    return [...filteredToolCalls]
      .sort((a, b) => b.result.sizeBytes - a.result.sizeBytes)
      .slice(0, 10);
  }, [filteredToolCalls]);

  const suggestions = useMemo(() => {
    const items: string[] = [];
    const largeResults = toolCalls.filter(
      (tc) => tc.result.sizeBytes > 10 * 1024
    );
    if (largeResults.length > 0) {
      items.push(`${largeResults.length} tool result(s) exceed 10KB`);
    }
    const callSigs = new Map<string, number>();
    toolCalls.forEach((tc) => {
      const sig = `${tc.name}:${JSON.stringify(tc.result.content).slice(0, 100)}`;
      callSigs.set(sig, (callSigs.get(sig) ?? 0) + 1);
    });
    const dupes = Array.from(callSigs.entries()).filter(
      ([, count]) => count > 1
    );
    if (dupes.length > 0) {
      items.push(`${dupes.length} repeated tool call(s) with identical results`);
    }
    const largeReads = toolCalls.filter(
      (tc) => tc.name === "Read" && tc.result.sizeBytes > 5000
    );
    if (largeReads.length > 0) {
      items.push(`${largeReads.length} Read call(s) returned >5KB`);
    }
    return items;
  }, [toolCalls]);

  const handleSelectCategory = (name: string) => {
    setSelectedCategory((prev) => (prev === name ? null : name));
  };

  const selectedCategoryColor = useMemo(() => {
    if (!selectedCategory) return null;
    const idx = pieData.findIndex((d) => d.name === selectedCategory);
    return idx >= 0 ? PIE_COLORS[idx % PIE_COLORS.length] : "#555";
  }, [selectedCategory, pieData]);

  // Tool calls for the inspected bar segment
  const inspectedCalls = useMemo(() => {
    if (!inspecting) return [];
    const key = inspecting.toolKey;
    return toolCalls
      .filter((tc) => {
        if (tc.turnIndex !== inspecting.turnIndex) return false;
        if (key === "_other") {
          return !topToolKeys.top.includes(toolCategory(tc));
        }
        return toolCategory(tc) === key;
      })
      .sort((a, b) => b.result.sizeBytes - a.result.sizeBytes);
  }, [inspecting, toolCalls, topToolKeys]);

  const handleBarClick = (turnIndex: number, toolKey: string) => {
    // Ignore clicks on userText/assistantOutput
    if (toolKey === "userText" || toolKey === "assistantOutput") return;
    setInspecting((prev) =>
      prev?.turnIndex === turnIndex && prev?.toolKey === toolKey
        ? null
        : { turnIndex, toolKey }
    );
  };

  return (
    <div className="space-y-6">
      {suggestions.length > 0 && (
        <div className="border border-term-yellow/30 bg-term-yellow/5 p-3">
          <h3 className="text-xs text-term-yellow font-mono mb-1.5">
            suggestions
          </h3>
          <ul className="text-[11px] text-term-yellow/80 font-mono space-y-0.5">
            {suggestions.map((s, i) => (
              <li key={i}>
                <span className="text-term-yellow mr-1">!</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono">
        {stackKeys.map((key) => (
          <div key={key} className="flex items-center gap-1">
            <div
              className="w-2 h-2"
              style={{ backgroundColor: stackColorMap[key] }}
            />
            <span className="text-term-text-dim">
              {key === "_other" ? "other tools" : key}
            </span>
          </div>
        ))}
      </div>

      {/* Stacked bar */}
      <div className="border border-term-border bg-term-surface">
        <ParentSize debounceTime={100}>
          {({ width }) => (
            <ToolStackedBarChart
              width={width}
              height={300}
              data={barData}
              stackKeys={stackKeys}
              colorMap={stackColorMap}
              inspecting={inspecting}
              onBarClick={handleBarClick}
            />
          )}
        </ParentSize>
      </div>

      {/* Inspect panel for clicked bar segment */}
      {inspecting && inspectedCalls.length > 0 && (
        <BarSegmentInspector
          turnIndex={inspecting.turnIndex}
          toolKey={inspecting.toolKey}
          toolCalls={inspectedCalls}
          color={stackColorMap[inspecting.toolKey] ?? "#555"}
          onClose={() => setInspecting(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieData.length > 0 && (
          <PieChartWithTooltip
            pieData={pieData}
            pieColors={PIE_COLORS}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
          />
        )}

        <div className="border border-term-border bg-term-surface p-4">
          <h3 className="text-xs text-term-text-dim font-mono mb-3">
            largest results
            {selectedCategory && (
              <span style={{ color: selectedCategoryColor ?? undefined }}>
                {" "}— {selectedCategory}
              </span>
            )}
          </h3>
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="text-term-text-dim border-b border-term-border">
                <th className="text-left py-1 px-2">tool</th>
                <th className="text-right py-1 px-2">size</th>
                <th className="text-right py-1 px-2">disk</th>
              </tr>
            </thead>
            <tbody>
              {largestResults.map((tc) => (
                <tr key={tc.id} className="border-b border-term-border/30">
                  <td className="py-0.5 px-2 text-term-text truncate max-w-40">
                    {tc.name}
                  </td>
                  <td className="py-0.5 px-2 text-right text-term-yellow">
                    {formatBytes(tc.result.sizeBytes)}
                  </td>
                  <td className="py-0.5 px-2 text-right text-term-text-dim">
                    {tc.result.persistedPath ? "y" : "n"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCategory && (
        <CategoryDeepDive
          category={selectedCategory}
          categoryColor={selectedCategoryColor ?? "#555"}
          toolCalls={filteredToolCalls}
          onClose={() => setSelectedCategory(null)}
        />
      )}
    </div>
  );
}

/* ── Per-tool stacked bar chart ── */

interface BarTooltipData {
  turn: string;
  toolKey: string;
  value: number;
  turnData: Record<string, any>;
}

function ToolStackedBarChart({
  width,
  height,
  data,
  stackKeys,
  colorMap,
  inspecting,
  onBarClick,
}: {
  width: number;
  height: number;
  data: Record<string, any>[];
  stackKeys: string[];
  colorMap: Record<string, string>;
  inspecting: { turnIndex: number; toolKey: string } | null;
  onBarClick: (turnIndex: number, toolKey: string) => void;
}) {
  const margin = { top: 10, right: 10, bottom: 30, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<BarTooltipData>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  });

  const xScale = scaleBand({
    domain: data.map((d) => d.turn),
    range: [0, innerW],
    padding: 0.2,
  });

  const maxY = useMemo(
    () =>
      Math.max(
        ...data.map((d) =>
          stackKeys.reduce((s, k) => s + (d[k] ?? 0), 0)
        ),
        1
      ),
    [data, stackKeys]
  );

  const yScale = scaleLinear({
    domain: [0, maxY * 1.1],
    range: [innerH, 0],
    nice: true,
  });

  const colorScale = scaleOrdinal({
    domain: stackKeys,
    range: stackKeys.map((k) => colorMap[k] ?? "#444"),
  });

  if (width < 100) return null;

  return (
    <div style={{ position: "relative" }}>
      <svg ref={containerRef} width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={yScale}
            width={innerW}
            stroke="#1a1a1a"
            strokeDasharray="2,3"
          />
          <BarStack
            data={data}
            keys={stackKeys}
            x={(d) => d.turn}
            xScale={xScale}
            yScale={yScale}
            color={colorScale}
          >
            {(barStacks) =>
              barStacks.map((barStack) =>
                barStack.bars.map((bar) => {
                  const turnData = data[bar.index];
                  const toolKey = barStack.key;
                  const isClickable =
                    toolKey !== "userText" && toolKey !== "assistantOutput";
                  const isInspected =
                    inspecting?.turnIndex === turnData.turnIndex &&
                    inspecting?.toolKey === toolKey;
                  return (
                    <rect
                      key={`bar-${barStack.index}-${bar.index}`}
                      x={bar.x}
                      y={bar.y}
                      height={bar.height}
                      width={bar.width}
                      fill={bar.color}
                      fillOpacity={isInspected ? 0.9 : 0.4}
                      stroke={isInspected ? "#fff" : bar.color}
                      strokeWidth={isInspected ? 1.5 : 0.5}
                      strokeOpacity={isInspected ? 1 : 0.5}
                      style={{ cursor: isClickable ? "pointer" : "default" }}
                      onClick={() => {
                        if (isClickable) onBarClick(turnData.turnIndex, toolKey);
                      }}
                      onMouseMove={(e: React.MouseEvent<SVGRectElement>) => {
                        const point = localPoint(e);
                        if (!point) return;
                        showTooltip({
                          tooltipData: {
                            turn: turnData.turn,
                            toolKey,
                            value: turnData[toolKey] ?? 0,
                            turnData,
                          },
                          tooltipLeft: point.x,
                          tooltipTop: point.y,
                        });
                      }}
                      onMouseLeave={hideTooltip}
                    />
                  );
                })
              )
            }
          </BarStack>
          <AxisBottom
            top={innerH}
            scale={xScale}
            stroke="#333"
            tickStroke="#333"
            tickLabelProps={{
              fill: "#555",
              fontSize: 9,
              fontFamily: "monospace",
              textAnchor: "middle",
            }}
          />
          <AxisLeft
            scale={yScale}
            stroke="#333"
            tickStroke="#333"
            tickFormat={(v) => `${v}K`}
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
      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          left={tooltipLeft}
          top={tooltipTop}
          style={tooltipStyles}
          offsetLeft={10}
          offsetTop={-10}
        >
          <div>
            Turn {tooltipData.turn} ·{" "}
            <span style={{ color: colorMap[tooltipData.toolKey] }}>
              {tooltipData.toolKey === "_other"
                ? "other tools"
                : tooltipData.toolKey}
            </span>
          </div>
          <div>{tooltipData.value}KB</div>
          {tooltipData.toolKey !== "userText" &&
            tooltipData.toolKey !== "assistantOutput" && (
              <div className="text-term-text-dim" style={{ marginTop: 2, fontSize: 9 }}>
                click to inspect
              </div>
            )}
        </TooltipInPortal>
      )}
    </div>
  );
}

/* ── Inspector for a clicked bar segment ── */

function BarSegmentInspector({
  turnIndex,
  toolKey,
  toolCalls,
  color,
  onClose,
}: {
  turnIndex: number;
  toolKey: string;
  toolCalls: ToolCall[];
  color: string;
  onClose: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const totalBytes = toolCalls.reduce((s, tc) => s + tc.result.sizeBytes, 0);

  return (
    <div
      className="border bg-term-surface p-4 space-y-3"
      style={{ borderColor: color + "66" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono">
          <span className="text-term-text-dim">turn {turnIndex + 1} · </span>
          <span style={{ color }}>
            {toolKey === "_other" ? "other tools" : toolKey}
          </span>
          <span className="text-term-text-dim ml-2">
            {toolCalls.length} call{toolCalls.length !== 1 ? "s" : ""} ·{" "}
            {formatBytes(totalBytes)}
          </span>
        </h3>
        <button
          onClick={onClose}
          className="text-[10px] font-mono text-term-text-dim hover:text-term-text"
        >
          [close]
        </button>
      </div>

      <div className="space-y-px">
        {toolCalls.map((tc) => {
          const isExpanded = expandedId === tc.id;
          return (
            <div key={tc.id} className="border border-term-border/40">
              <button
                onClick={() => setExpandedId(isExpanded ? null : tc.id)}
                className="w-full text-left px-2.5 py-1.5 flex items-center gap-2 hover:bg-term-bg/50 transition-colors"
              >
                <span
                  className="text-[10px] font-mono flex-1 truncate"
                  style={{ color }}
                >
                  {tc.name}
                </span>
                <span className="text-[9px] font-mono text-term-text-dim flex-shrink-0 flex gap-2">
                  <span
                    className={
                      tc.result.sizeBytes > 10240 ? "text-term-yellow" : ""
                    }
                  >
                    {formatBytes(tc.result.sizeBytes)}
                  </span>
                  <span>{isExpanded ? "▾" : "▸"}</span>
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-term-border/30 px-2.5 py-2 space-y-2 bg-term-bg">
                  <div>
                    <span className="text-[9px] font-mono text-term-green">
                      input
                    </span>
                    <pre className="text-[10px] text-term-text font-mono bg-term-surface border border-term-border/40 p-2 mt-0.5 overflow-x-auto max-h-48 overflow-y-auto">
                      {formatInput(tc.input)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-term-yellow">
                      result{" "}
                      <span className="text-term-text-dim">
                        ({formatBytes(tc.result.sizeBytes)})
                      </span>
                    </span>
                    <pre className="text-[10px] text-term-text font-mono bg-term-surface border border-term-border/40 p-2 mt-0.5 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {tc.result.content.length > 2000
                        ? tc.result.content.slice(0, 2000) + "\n..."
                        : tc.result.content || "[empty]"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Category deep dive (from pie chart) ── */

function CategoryDeepDive({
  category,
  categoryColor,
  toolCalls,
  onClose,
}: {
  category: string;
  categoryColor: string;
  toolCalls: ToolCall[];
  onClose: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const totalBytes = toolCalls.reduce((s, tc) => s + tc.result.sizeBytes, 0);
  const sorted = useMemo(
    () =>
      [...toolCalls].sort((a, b) => b.result.sizeBytes - a.result.sizeBytes),
    [toolCalls]
  );

  return (
    <div
      className="border bg-term-surface p-4 space-y-3"
      style={{ borderColor: categoryColor + "66" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono">
          <span style={{ color: categoryColor }}>{category}</span>
          <span className="text-term-text-dim ml-2">
            {toolCalls.length} call{toolCalls.length !== 1 ? "s" : ""} ·{" "}
            {formatBytes(totalBytes)} total
          </span>
        </h3>
        <button
          onClick={onClose}
          className="text-[10px] font-mono text-term-text-dim hover:text-term-text"
        >
          [close]
        </button>
      </div>

      <div className="space-y-px">
        {sorted.map((tc) => {
          const isExpanded = expandedId === tc.id;
          return (
            <div key={tc.id} className="border border-term-border/40">
              <button
                onClick={() => setExpandedId(isExpanded ? null : tc.id)}
                className="w-full text-left px-2.5 py-1.5 flex items-center gap-2 hover:bg-term-bg/50 transition-colors"
              >
                <span className="text-[10px] font-mono text-term-text-dim">
                  t{tc.turnIndex + 1}
                </span>
                <span
                  className="text-[10px] font-mono flex-1 truncate"
                  style={{ color: categoryColor }}
                >
                  {tc.name}
                </span>
                <span className="text-[9px] font-mono text-term-text-dim flex-shrink-0 flex gap-2">
                  <span
                    className={
                      tc.result.sizeBytes > 10240 ? "text-term-yellow" : ""
                    }
                  >
                    {formatBytes(tc.result.sizeBytes)}
                  </span>
                  <span>{isExpanded ? "▾" : "▸"}</span>
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-term-border/30 px-2.5 py-2 space-y-2 bg-term-bg">
                  <div>
                    <span className="text-[9px] font-mono text-term-green">
                      input
                    </span>
                    <pre className="text-[10px] text-term-text font-mono bg-term-surface border border-term-border/40 p-2 mt-0.5 overflow-x-auto max-h-48 overflow-y-auto">
                      {formatInput(tc.input)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-term-yellow">
                      result{" "}
                      <span className="text-term-text-dim">
                        ({formatBytes(tc.result.sizeBytes)})
                      </span>
                    </span>
                    <pre className="text-[10px] text-term-text font-mono bg-term-surface border border-term-border/40 p-2 mt-0.5 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {tc.result.content.length > 2000
                        ? tc.result.content.slice(0, 2000) + "\n..."
                        : tc.result.content || "[empty]"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Interactive pie chart ── */

function PieChartWithTooltip({
  pieData,
  pieColors,
  selectedCategory,
  onSelectCategory,
}: {
  pieData: { name: string; value: number }[];
  pieColors: string[];
  selectedCategory: string | null;
  onSelectCategory: (name: string) => void;
}) {
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<{ name: string; value: number }>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  });

  return (
    <div className="border border-term-border bg-term-surface p-4">
      <h3 className="text-xs text-term-text-dim font-mono mb-3">
        context by tool
        <span className="text-term-text-dim/50 ml-2">(click to drill down)</span>
      </h3>
      <div className="flex justify-center" style={{ position: "relative" }}>
        <svg ref={containerRef} width={240} height={240}>
          <Group top={120} left={120}>
            <Pie
              data={pieData}
              pieValue={(d) => d.value}
              outerRadius={100}
              innerRadius={40}
              padAngle={0.02}
            >
              {(pie) =>
                pie.arcs.map((arc, i) => {
                  const isSelected = selectedCategory === arc.data.name;
                  const isOther = selectedCategory != null && !isSelected;
                  return (
                    <g key={arc.data.name}>
                      <path
                        d={pie.path(arc) || ""}
                        fill={pieColors[i % pieColors.length]}
                        fillOpacity={isOther ? 0.15 : isSelected ? 0.8 : 0.5}
                        stroke={pieColors[i % pieColors.length]}
                        strokeWidth={isSelected ? 2 : 0.5}
                        style={{ cursor: "pointer" }}
                        onClick={() => onSelectCategory(arc.data.name)}
                        onMouseMove={(
                          e: React.MouseEvent<SVGPathElement>
                        ) => {
                          const point = localPoint(e);
                          if (!point) return;
                          showTooltip({
                            tooltipData: arc.data,
                            tooltipLeft: point.x,
                            tooltipTop: point.y,
                          });
                        }}
                        onMouseLeave={hideTooltip}
                      />
                    </g>
                  );
                })
              }
            </Pie>
          </Group>
        </svg>
        {tooltipOpen && tooltipData && (
          <TooltipInPortal
            left={tooltipLeft}
            top={tooltipTop}
            style={tooltipStyles}
            offsetLeft={10}
            offsetTop={-10}
          >
            <div>{tooltipData.name}</div>
            <div>{tooltipData.value}KB</div>
          </TooltipInPortal>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2 text-[10px] font-mono">
        {pieData.map((d, i) => {
          const isSelected = selectedCategory === d.name;
          const isOther = selectedCategory != null && !isSelected;
          return (
            <button
              key={d.name}
              className="flex items-center gap-1.5 text-left hover:bg-term-border/20 px-0.5 -mx-0.5 transition-colors"
              style={{ opacity: isOther ? 0.4 : 1 }}
              onClick={() => onSelectCategory(d.name)}
            >
              <div
                className="w-1.5 h-1.5 flex-shrink-0"
                style={{ backgroundColor: pieColors[i % pieColors.length] }}
              />
              <span
                className="truncate"
                style={{
                  color: isSelected
                    ? pieColors[i % pieColors.length]
                    : "#555",
                }}
              >
                {d.name}
              </span>
              <span className="text-term-text-dim ml-auto flex-shrink-0">
                {d.value}K
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Helpers ── */

function formatInput(input: Record<string, any>): string {
  const entries = Object.entries(input);
  if (entries.length === 0) return "{}";
  const full = JSON.stringify(input, null, 2);
  if (full.length < 500) return full;
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
