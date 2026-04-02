import { useMemo, useCallback } from "react";
import { Group } from "@visx/group";
import { AreaStack, LinePath } from "@visx/shape";
import { scaleLinear, scaleOrdinal } from "@visx/scale";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { curveMonotoneX } from "@visx/curve";
import { useTooltip, useTooltipInPortal, defaultStyles } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import { ParentSize } from "@visx/responsive";

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

const KEYS = [
  "inputTokens",
  "outputTokens",
  "cacheCreationTokens",
  "cacheReadTokens",
] as const;
const COLORS = ["#00aaff", "#00ff88", "#ffaa00", "#aa66ff"];
const LABELS = ["Input", "Output", "Cache Create", "Cache Read"];

const margin = { top: 20, right: 10, bottom: 40, left: 50 };

export default function TokenChart({ data }: TokenChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-term-text-dim text-xs font-mono">
        -- no token data --
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {/* Legend */}
      <div className="flex gap-4 text-[10px]">
        {KEYS.map((key, i) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: COLORS[i] }}
            />
            <span className="text-term-text-dim">{LABELS[i]}</span>
          </div>
        ))}
      </div>

      {/* Stacked area */}
      <div>
        <h3 className="text-xs text-term-text-dim mb-2 font-mono">
          tokens/turn
        </h3>
        <div className="border border-term-border bg-term-surface" style={{ width: "100%" }}>
          <ParentSize debounceTime={100}>
            {({ width }) => (
              <StackedAreaChart width={width} height={280} data={data} />
            )}
          </ParentSize>
        </div>
      </div>

      {/* Cumulative */}
      <div>
        <h3 className="text-xs text-term-text-dim mb-2 font-mono">
          cumulative context growth
        </h3>
        <div className="border border-term-border bg-term-surface" style={{ width: "100%" }}>
          <ParentSize debounceTime={100}>
            {({ width }) => (
              <CumulativeChart width={width} height={280} data={data} />
            )}
          </ParentSize>
        </div>
      </div>

      {/* Table */}
      <div>
        <h3 className="text-xs text-term-text-dim mb-2 font-mono">
          breakdown
        </h3>
        <div className="border border-term-border overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-term-text-dim border-b border-term-border">
                <th className="text-left py-1.5 px-3">#</th>
                <th className="text-right py-1.5 px-3">input</th>
                <th className="text-right py-1.5 px-3">output</th>
                <th className="text-right py-1.5 px-3">cache_w</th>
                <th className="text-right py-1.5 px-3">cache_r</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr
                  key={d.turnIndex}
                  className="border-b border-term-border/50 hover:bg-term-border/30"
                >
                  <td className="py-1 px-3 text-term-text-dim">
                    {d.turnIndex + 1}
                  </td>
                  <td className="py-1 px-3 text-right text-term-blue">
                    {d.inputTokens.toLocaleString()}
                  </td>
                  <td className="py-1 px-3 text-right text-term-green">
                    {d.outputTokens.toLocaleString()}
                  </td>
                  <td className="py-1 px-3 text-right text-term-yellow">
                    {d.cacheCreationTokens.toLocaleString()}
                  </td>
                  <td className="py-1 px-3 text-right text-term-purple">
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
};

function StackedAreaChart({
  width,
  height,
  data,
}: {
  width: number;
  height: number;
  data: TokenDataPoint[];
}) {
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<TokenDataPoint>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  });

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, data.length - 1],
        range: [0, innerW],
      }),
    [data, innerW]
  );

  const maxY = useMemo(
    () =>
      Math.max(
        ...data.map(
          (d) =>
            d.inputTokens +
            d.outputTokens +
            d.cacheCreationTokens +
            d.cacheReadTokens
        )
      ),
    [data]
  );

  const yScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, maxY * 1.1],
        range: [innerH, 0],
        nice: true,
      }),
    [maxY, innerH]
  );

  const colorScale = scaleOrdinal({
    domain: KEYS as unknown as string[],
    range: COLORS,
  });

  const handleTooltip = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      const point = localPoint(event);
      if (!point) return;
      const x = point.x - margin.left;
      const idx = Math.round(xScale.invert(x));
      const clamped = Math.max(0, Math.min(data.length - 1, idx));
      showTooltip({
        tooltipData: data[clamped],
        tooltipLeft: point.x,
        tooltipTop: point.y,
      });
    },
    [data, xScale, showTooltip]
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
          <AreaStack
            keys={KEYS as unknown as string[]}
            data={data}
            x={(d) => xScale(d.data.turnIndex)}
            y0={(d) => yScale(d[0])}
            y1={(d) => yScale(d[1])}
            curve={curveMonotoneX}
          >
            {({ stacks, path }) =>
              stacks.map((stack) => (
                <path
                  key={stack.key}
                  d={path(stack) || ""}
                  fill={colorScale(stack.key)}
                  fillOpacity={0.25}
                  stroke={colorScale(stack.key)}
                  strokeWidth={1}
                  strokeOpacity={0.6}
                />
              ))
            }
          </AreaStack>
          <AxisBottom
            top={innerH}
            scale={xScale}
            stroke="#333"
            tickStroke="#333"
            tickLabelProps={{
              fill: "#555",
              fontSize: 10,
              fontFamily: "monospace",
              textAnchor: "middle",
            }}
            label="turn"
            labelProps={{
              fill: "#555",
              fontSize: 10,
              fontFamily: "monospace",
              textAnchor: "middle",
            }}
          />
          <AxisLeft
            scale={yScale}
            stroke="#333"
            tickStroke="#333"
            tickFormat={(v) => {
              const n = v as number;
              return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`;
            }}
            tickLabelProps={{
              fill: "#555",
              fontSize: 10,
              fontFamily: "monospace",
              textAnchor: "end",
              dx: -4,
            }}
          />
          <rect
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={handleTooltip}
            onMouseLeave={hideTooltip}
          />
          {tooltipOpen && tooltipData && (
            <line
              x1={xScale(tooltipData.turnIndex)}
              x2={xScale(tooltipData.turnIndex)}
              y1={0}
              y2={innerH}
              stroke="#00ff88"
              strokeWidth={1}
              strokeOpacity={0.3}
              strokeDasharray="3,3"
            />
          )}
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
          <div>Turn {tooltipData.turnIndex + 1}</div>
          <div style={{ color: "#00aaff" }}>
            in: {tooltipData.inputTokens.toLocaleString()}
          </div>
          <div style={{ color: "#00ff88" }}>
            out: {tooltipData.outputTokens.toLocaleString()}
          </div>
          <div style={{ color: "#ffaa00" }}>
            cache_w: {tooltipData.cacheCreationTokens.toLocaleString()}
          </div>
          <div style={{ color: "#aa66ff" }}>
            cache_r: {tooltipData.cacheReadTokens.toLocaleString()}
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
}

function CumulativeChart({
  width,
  height,
  data,
}: {
  width: number;
  height: number;
  data: TokenDataPoint[];
}) {
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<TokenDataPoint>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  });

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, data.length - 1],
        range: [0, innerW],
      }),
    [data, innerW]
  );

  const maxY = useMemo(
    () =>
      Math.max(
        ...data.map((d) =>
          Math.max(d.cumulativeInputTokens, d.cumulativeOutputTokens)
        )
      ),
    [data]
  );

  const yScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, maxY * 1.1],
        range: [innerH, 0],
        nice: true,
      }),
    [maxY, innerH]
  );

  const handleTooltip = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      const point = localPoint(event);
      if (!point) return;
      const x = point.x - margin.left;
      const idx = Math.round(xScale.invert(x));
      const clamped = Math.max(0, Math.min(data.length - 1, idx));
      showTooltip({
        tooltipData: data[clamped],
        tooltipLeft: point.x,
        tooltipTop: point.y,
      });
    },
    [data, xScale, showTooltip]
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
          <LinePath
            data={data}
            x={(d) => xScale(d.turnIndex)}
            y={(d) => yScale(d.cumulativeInputTokens)}
            stroke="#00aaff"
            strokeWidth={1.5}
            curve={curveMonotoneX}
          />
          <LinePath
            data={data}
            x={(d) => xScale(d.turnIndex)}
            y={(d) => yScale(d.cumulativeOutputTokens)}
            stroke="#00ff88"
            strokeWidth={1.5}
            curve={curveMonotoneX}
          />
          <AxisBottom
            top={innerH}
            scale={xScale}
            stroke="#333"
            tickStroke="#333"
            tickLabelProps={{
              fill: "#555",
              fontSize: 10,
              fontFamily: "monospace",
              textAnchor: "middle",
            }}
          />
          <AxisLeft
            scale={yScale}
            stroke="#333"
            tickStroke="#333"
            tickFormat={(v) => {
              const n = v as number;
              if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
              if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
              return `${n}`;
            }}
            tickLabelProps={{
              fill: "#555",
              fontSize: 10,
              fontFamily: "monospace",
              textAnchor: "end",
              dx: -4,
            }}
          />
          <rect
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={handleTooltip}
            onMouseLeave={hideTooltip}
          />
          {tooltipOpen && tooltipData && (
            <line
              x1={xScale(tooltipData.turnIndex)}
              x2={xScale(tooltipData.turnIndex)}
              y1={0}
              y2={innerH}
              stroke="#00ff88"
              strokeWidth={1}
              strokeOpacity={0.3}
              strokeDasharray="3,3"
            />
          )}
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
          <div>Turn {tooltipData.turnIndex + 1}</div>
          <div style={{ color: "#00aaff" }}>
            cum_in: {tooltipData.cumulativeInputTokens.toLocaleString()}
          </div>
          <div style={{ color: "#00ff88" }}>
            cum_out: {tooltipData.cumulativeOutputTokens.toLocaleString()}
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
}
