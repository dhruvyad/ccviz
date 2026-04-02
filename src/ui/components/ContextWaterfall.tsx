import { useMemo, useCallback } from "react";
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

export default function ContextWaterfall({
  turns,
  toolCalls,
}: ContextWaterfallProps) {
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
      const key = tc.isMcp ? `mcp:${tc.name.split("__")[1]}` : tc.name;
      map.set(key, (map.get(key) ?? 0) + tc.result.sizeBytes);
    });
    return Array.from(map.entries())
      .map(([name, bytes]) => ({ name, value: Math.round(bytes / 1024) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [toolCalls]);

  const largestResults = useMemo(() => {
    return [...toolCalls]
      .sort((a, b) => b.result.sizeBytes - a.result.sizeBytes)
      .slice(0, 10);
  }, [toolCalls]);

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
          <PieChartWithTooltip pieData={pieData} pieColors={PIE_COLORS} />
        )}

        {/* Top results */}
        <div className="border border-term-border bg-term-surface p-4">
          <h3 className="text-xs text-term-text-dim font-mono mb-3">
            largest results
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
    </div>
  );
}

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
  const margin = { top: 10, right: 20, bottom: 30, left: 50 };
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
            userText: {tooltipData.userText}KB
          </div>
          <div style={{ color: "#ffaa00" }}>
            toolResults: {tooltipData.toolResults}KB
          </div>
          <div style={{ color: "#00aaff" }}>
            assistantOutput: {tooltipData.assistantOutput}KB
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
}

function PieChartWithTooltip({
  pieData,
  pieColors,
}: {
  pieData: { name: string; value: number }[];
  pieColors: string[];
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
                pie.arcs.map((arc, i) => (
                  <g key={arc.data.name}>
                    <path
                      d={pie.path(arc) || ""}
                      fill={pieColors[i % pieColors.length]}
                      fillOpacity={0.5}
                      stroke={pieColors[i % pieColors.length]}
                      strokeWidth={0.5}
                      onMouseMove={(e: React.MouseEvent<SVGPathElement>) => {
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
                ))
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
        {pieData.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 flex-shrink-0"
              style={{
                backgroundColor: pieColors[i % pieColors.length],
              }}
            />
            <span className="text-term-text-dim truncate">
              {d.name}
            </span>
            <span className="text-term-text-dim ml-auto flex-shrink-0">
              {d.value}K
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
