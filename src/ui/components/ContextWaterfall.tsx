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

const STACK_KEYS = ["userText", "toolResults", "assistantOutput"] as const;
const STACK_COLORS = ["#00ff88", "#ffaa00", "#00aaff"];
const STACK_LABELS = ["user text", "tool results", "assistant output"];

const PIE_COLORS = [
  "#00aaff",
  "#00ff88",
  "#ffaa00",
  "#aa66ff",
  "#ff4444",
  "#00dddd",
  "#ff8800",
  "#88ff00",
];

/** Map a tool call to its category key (same logic used for pie chart) */
function toolCategory(tc: ToolCall): string {
  return tc.isMcp ? `mcp:${tc.name.split("__")[1]}` : tc.name;
}

export default function ContextWaterfall({
  turns,
  toolCalls,
}: ContextWaterfallProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
        turn: `${turn.index + 1}`,
        userText: Math.round(userTextSize / 1024),
        toolResults: Math.round(toolResultSize / 1024),
        assistantOutput: Math.round(assistantSize / 1024),
      };
    });
  }, [turns, toolCalls]);

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

  // Tool calls filtered by selected category
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
      items.push(
        `${largeResults.length} tool result(s) exceed 10KB`
      );
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
      items.push(
        `${dupes.length} repeated tool call(s) with identical results`
      );
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

  // Color for the selected category
  const selectedCategoryColor = useMemo(() => {
    if (!selectedCategory) return null;
    const idx = pieData.findIndex((d) => d.name === selectedCategory);
    return idx >= 0 ? PIE_COLORS[idx % PIE_COLORS.length] : "#555";
  }, [selectedCategory, pieData]);

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
      <div className="flex gap-4 text-[10px] font-mono">
        {STACK_KEYS.map((key, i) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2"
              style={{ backgroundColor: STACK_COLORS[i] }}
            />
            <span className="text-term-text-dim">{STACK_LABELS[i]}</span>
          </div>
        ))}
      </div>

      {/* Stacked bar */}
      <div className="border border-term-border bg-term-surface">
        <ParentSize debounceTime={100}>
          {({ width }) => (
            <StackedBarChart width={width} height={300} data={barData} />
          )}
        </ParentSize>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie chart */}
        {pieData.length > 0 && (
          <PieChartWithTooltip
            pieData={pieData}
            pieColors={PIE_COLORS}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
          />
        )}

        {/* Top results (filtered when category active) */}
        <div className="border border-term-border bg-term-surface p-4">
          <h3 className="text-xs text-term-text-dim font-mono mb-3">
            largest results
            {selectedCategory && (
              <span style={{ color: selectedCategoryColor ?? undefined }}>
                {" "}
                — {selectedCategory}
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

      {/* Deep dive panel — shown when a category is selected */}
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

/* ── Deep dive panel for a selected tool category ── */

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

  const totalBytes = toolCalls.reduce(
    (s, tc) => s + tc.result.sizeBytes,
    0
  );

  // Sort by size descending
  const sorted = useMemo(
    () => [...toolCalls].sort((a, b) => b.result.sizeBytes - a.result.sizeBytes),
    [toolCalls]
  );

  return (
    <div
      className="border bg-term-surface p-4 space-y-3"
      style={{ borderColor: categoryColor + "66" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono">
          <span style={{ color: categoryColor }}>
            {category}
          </span>
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
              {/* Header */}
              <button
                onClick={() =>
                  setExpandedId(isExpanded ? null : tc.id)
                }
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

              {/* Expanded detail */}
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

/* ── Stacked bar chart ── */

interface StackedBarTooltipData {
  turn: string;
  userText: number;
  toolResults: number;
  assistantOutput: number;
}

function StackedBarChart({
  width,
  height,
  data,
}: {
  width: number;
  height: number;
  data: Record<string, any>[];
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
  } = useTooltip<StackedBarTooltipData>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  });

  const xScale = scaleBand({
    domain: data.map((d) => d.turn),
    range: [0, innerW],
    padding: 0.2,
  });

  const maxY = Math.max(
    ...data.map(
      (d) =>
        (d.userText ?? 0) + (d.toolResults ?? 0) + (d.assistantOutput ?? 0)
    ),
    1
  );

  const yScale = scaleLinear({
    domain: [0, maxY * 1.1],
    range: [innerH, 0],
    nice: true,
  });

  const colorScale = scaleOrdinal({
    domain: STACK_KEYS as unknown as string[],
    range: STACK_COLORS,
  });

  const handleBarHover = useCallback(
    (event: React.MouseEvent<SVGRectElement>, d: Record<string, any>) => {
      const point = localPoint(event);
      if (!point) return;
      showTooltip({
        tooltipData: d as StackedBarTooltipData,
        tooltipLeft: point.x,
        tooltipTop: point.y,
      });
    },
    [showTooltip]
  );

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
            keys={STACK_KEYS as unknown as string[]}
            x={(d) => d.turn}
            xScale={xScale}
            yScale={yScale}
            color={colorScale}
          >
            {(barStacks) =>
              barStacks.map((barStack) =>
                barStack.bars.map((bar) => (
                  <rect
                    key={`bar-stack-${barStack.index}-${bar.index}`}
                    x={bar.x}
                    y={bar.y}
                    height={bar.height}
                    width={bar.width}
                    fill={bar.color}
                    fillOpacity={0.35}
                    stroke={bar.color}
                    strokeWidth={0.5}
                    strokeOpacity={0.5}
                    onMouseMove={(e: React.MouseEvent<SVGRectElement>) =>
                      handleBarHover(e, data[bar.index])
                    }
                    onMouseLeave={hideTooltip}
                  />
                ))
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
          <div>Turn {tooltipData.turn}</div>
          <div style={{ color: "#00ff88" }}>
            user: {tooltipData.userText}KB
          </div>
          <div style={{ color: "#ffaa00" }}>
            tools: {tooltipData.toolResults}KB
          </div>
          <div style={{ color: "#00aaff" }}>
            assistant: {tooltipData.assistantOutput}KB
          </div>
        </TooltipInPortal>
      )}
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
        <span className="text-term-text-dim/50 ml-2">
          (click to drill down)
        </span>
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
                  const isOther =
                    selectedCategory != null && !isSelected;
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
                style={{
                  backgroundColor: pieColors[i % pieColors.length],
                }}
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
