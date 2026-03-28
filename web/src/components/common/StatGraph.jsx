import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Tooltip from './Tooltip';
import '../../styles/components/StatGraph.css';

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Resolve a CSS variable or raw colour for use in SVG style props */
const token = (c) => (!c ? 'var(--border-brand)' : c.startsWith('--') ? `var(${c})` : c);

/** Nice rounded ceiling for axis max */
const niceMax = (max, steps = 5) => {
    if (max === 0) return steps;
    const raw = max * 1.15;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const nice = Math.ceil(raw / mag) * mag;
    return nice;
};

/** Build evenly-spaced Y-axis tick values */
const yTicks = (max, steps = 5) =>
    Array.from({ length: steps + 1 }, (_, i) => (max / steps) * i);

/** Format a number compactly: 1200 → 1.2k */
const fmt = (v, decimals) => {
    if (v == null) return '—';
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
    if (decimals != null) return Number(v).toFixed(decimals);
    return String(Math.round(v * 10) / 10);
};

const fmtWithUnit = (value, decimals, unit) => {
    const base = fmt(value, decimals);
    return unit ? `${base} ${unit}` : base;
};

/** Smooth cubic bezier path through points */
const toBezierPath = (data, xScale, yScale, chartH) => {
    if (data.length < 2) return '';
    const pts = data.map((v, i) => [xScale(i), chartH - yScale(v)]);
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i - 1];
        const [cx, cy] = pts[i];
        const cpx = px + (cx - px) * 0.45;
        d += ` C ${cpx},${py} ${cpx},${cy} ${cx},${cy}`;
    }
    return d;
};

/** Closed area path back along baseline */
const toAreaPath = (data, xScale, yScale, chartH) => {
    if (data.length < 2) return '';
    const pts = data.map((v, i) => [xScale(i), chartH - yScale(v)]);
    const last = pts[pts.length - 1];
    let d = `M ${pts[0][0]},${chartH} L ${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i - 1];
        const [cx, cy] = pts[i];
        const cpx = px + (cx - px) * 0.45;
        d += ` C ${cpx},${py} ${cpx},${cy} ${cx},${cy}`;
    }
    d += ` L ${last[0]},${chartH} Z`;
    return d;
};

const LINE_COLORS = [
    '--border-brand',
    '--border-accent',
    '--border-success',
    '--border-warning',
    '--border-danger',
];

/* ══════════════════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Chart layout hook ── */
function useChartLayout(series, height, padL, padR, padT, padB) {
    return useMemo(() => {
        const allValues = series.flatMap(s => s.data);
        const dataMax = Math.max(...allValues, 0);
        const max = niceMax(dataMax);
        const ticks = yTicks(max);
        const count = Math.max(...series.map(s => s.data.length), 1);
        const INTERNAL = 500;
        const chartH = height - padT - padB;
        const chartW = INTERNAL - padL - padR;
        const xScale = (i) => padL + (i / Math.max(count - 1, 1)) * chartW;
        const yScale = (v) => (v / max) * chartH;
        return { max, ticks, count, chartW, chartH, xScale, yScale, totalW: INTERNAL };
    }, [series, height, padL, padR, padT, padB]);
}

/* ── Grid lines (horizontal + vertical) ── */
const Grid = ({ ticks, chartW, chartH, yScale, showGrid, count, xScale }) => (
    <g aria-hidden="true">
        {showGrid && ticks.map((t, i) => (
            <line key={`h-${i}`} x1={0} y1={chartH - yScale(t)} x2={chartW} y2={chartH - yScale(t)}
                className="sg-grid-line" />
        ))}
        {showGrid && count > 1 && xScale && Array.from({ length: count }, (_, i) => (
            <line key={`v-${i}`} x1={xScale(i)} y1={0} x2={xScale(i)} y2={chartH}
                className="sg-grid-line sg-grid-line--vert" />
        ))}
        <line x1={0} y1={chartH} x2={chartW} y2={chartH} className="sg-baseline" />
    </g>
);

/* ── Left Y-axis ── */
const YAxis = ({ ticks, chartH, yScale, unit, offset = -8 }) => (
    <g aria-hidden="true">
        {ticks.map((t, i) => (
            <text key={i} x={offset} y={chartH - yScale(t) + 4}
                textAnchor="end" className="sg-axis-label">
                {fmt(t)}{i === ticks.length - 1 && unit ? ` ${unit}` : ''}
            </text>
        ))}
    </g>
);

/* ── Right Y-axis (dual-axis) ── */
const YAxisRight = ({ ticks, chartH, yScale, unit, chartW }) => (
    <g aria-hidden="true">
        {ticks.map((t, i) => (
            <text key={i} x={chartW + 8} y={chartH - yScale(t) + 4}
                textAnchor="start" className="sg-axis-label sg-axis-label--right">
                {fmt(t)}{i === ticks.length - 1 && unit ? ` ${unit}` : ''}
            </text>
        ))}
    </g>
);

/* ── X-axis labels ── */
const XAxis = ({ labels, chartH, xScale, total }) => {
    // Estimate px width of each label at ~7px per character (mono 8px font, scaled SVG)
    // We work in SVG internal units (viewBox 500 wide maps to real px)
    // Minimum gap between label centres to avoid overlap: charWidth * labelLen + padding
    const CHAR_W = 6.5; // SVG units per character at 8px mono
    const MIN_GAP = 8;  // SVG units of breathing room between labels

    // Compute the minimum step so no two adjacent shown labels overlap
    let step = 1;
    if (total > 1) {
        const spacing = Math.abs(xScale(1) - xScale(0)); // SVG units between points
        // Width of the widest label in this set
        const maxLabelW = labels.reduce((m, l) => Math.max(m, String(l).length), 0) * CHAR_W;
        const minStep = Math.ceil((maxLabelW + MIN_GAP) / spacing);
        step = Math.max(1, minStep);
    }

    return (
        <g aria-hidden="true">
            {labels.map((l, i) => i % step !== 0 ? null : (
                <text key={i} x={xScale(i)} y={chartH + 18}
                    textAnchor="middle" className="sg-axis-label">{l}</text>
            ))}
        </g>
    );
};

/* ── Legend ── */
const Legend = ({ series }) => (
    <div className="sg-legend" aria-label="Chart legend">
        {series.map((s, i) => (
            <div key={i} className="sg-legend-item">
                <span className="sg-legend-swatch" style={{ background: token(s.color) }} />
                <span className="sg-legend-label">{s.label}</span>
                {s.unit && <span className="sg-legend-unit">{s.unit}</span>}
            </div>
        ))}
    </div>
);

/* ── Animated path draw on mount ── */
const AnimLine = ({ d, color, strokeWidth = 2 }) => {
    const ref = useRef(null);
    const done = useRef(false);
    useEffect(() => {
        if (done.current || !ref.current) return;
        const len = ref.current.getTotalLength?.() ?? 800;
        ref.current.style.strokeDasharray = len;
        ref.current.style.strokeDashoffset = len;
        ref.current.style.transition = 'stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)';
        requestAnimationFrame(() => {
            if (ref.current) ref.current.style.strokeDashoffset = '0';
        });
        done.current = true;
    }, [d]);
    return (
        <path ref={ref} d={d} fill="none" stroke={token(color)}
            strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    );
};

/* ── Animated bar grow on mount ── */
const AnimBar = ({ x, y, width, height: bh, chartH, color, opacity, onMouseEnter }) => {
    const ref = useRef(null);
    const done = useRef(false);
    useEffect(() => {
        if (done.current || !ref.current) return;
        ref.current.style.transform = `scaleY(0)`;
        ref.current.style.transformOrigin = `${x + width / 2}px ${chartH}px`;
        ref.current.style.transition = 'transform 500ms cubic-bezier(0.4,0,0.2,1)';
        requestAnimationFrame(() => {
            if (ref.current) ref.current.style.transform = 'scaleY(1)';
        });
        done.current = true;
    }, []);
    return (
        <rect ref={ref} x={x} y={y} width={width} height={bh} rx={2}
            fill={token(color)} opacity={opacity}
            style={{ cursor: 'pointer', transition: 'opacity 150ms ease' }}
            onMouseEnter={onMouseEnter} />
    );
};

/* ══════════════════════════════════════════════════════════════
   VARIANT: LINE / AREA
══════════════════════════════════════════════════════════════ */
const LineChart = ({ series, labels, height, showGrid, showDots, showAxes, unit, animate, stacked }) => {
    const PAD = { l: 44, r: 16, t: 12, b: 28 };
    const { max, ticks, count, chartW, chartH, xScale, yScale, totalW } =
        useChartLayout(series, height, PAD.l, PAD.r, PAD.t, PAD.b);

    const [hover, setHover] = useState(null);
    const svgRef = useRef(null);
    const containerRef = useRef(null);

    const ds = series.map((s, i) => ({ ...s, color: s.color || LINE_COLORS[i % LINE_COLORS.length] }));

    const handleMouseMove = useCallback((e) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const plotLeftPx = (PAD.l / totalW) * rect.width;
        const plotWidthPx = (chartW / totalW) * rect.width;
        const plotRatio = clamp((x - plotLeftPx) / Math.max(plotWidthPx, 1), 0, 1);
        const xi = clamp(Math.round(plotRatio * (count - 1)), 0, count - 1);
        const pxX = plotLeftPx + (xi / Math.max(count - 1, 1)) * plotWidthPx;
        setHover({ xi, x: pxX, y: e.clientY - rect.top });
    }, [count, chartW, totalW, PAD.l]);

    const tooltipItems = hover
        ? ds.map(s => ({
            label: s.label,
            swatchColor: token(s.color),
            value: fmtWithUnit(s.data[hover.xi] ?? 0, s.decimals, unit),
        }))
        : [];

    return (
        <div ref={containerRef} className="sg-chart-area" style={{ position: 'relative' }}>
            <svg ref={svgRef} viewBox={`0 0 ${totalW} ${height}`} className="sg-svg"
                onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)}
                aria-label="Line chart" role="img">
                <g transform={`translate(${PAD.l},${PAD.t})`}>
                    {showAxes && <YAxis ticks={ticks} chartH={chartH} yScale={yScale} unit={unit} />}
                    <Grid ticks={ticks} chartW={chartW} chartH={chartH} yScale={yScale} showGrid={showGrid} count={count} xScale={(i) => xScale(i) - PAD.l} />
                    {showAxes && <XAxis labels={labels} chartH={chartH} xScale={(i) => xScale(i) - PAD.l} total={count} />}

                    {/* Area fills */}
                    {ds.map((s, si) => (
                        <path key={`area-${si}`}
                            d={toAreaPath(s.data, (i) => xScale(i) - PAD.l, yScale, chartH)}
                            fill={token(s.color)} opacity={stacked ? 0.18 : 0.08} />
                    ))}

                    {/* Lines */}
                    {ds.map((s, si) => {
                        const d = toBezierPath(s.data, (i) => xScale(i) - PAD.l, yScale, chartH);
                        return animate
                            ? <AnimLine key={`line-${si}`} d={d} color={s.color} strokeWidth={2} />
                            : <path key={`line-${si}`} d={d} fill="none" stroke={token(s.color)}
                                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
                    })}

                    {/* Crosshair */}
                    {hover && (
                        <line x1={xScale(hover.xi) - PAD.l} y1={0}
                            x2={xScale(hover.xi) - PAD.l} y2={chartH} className="sg-crosshair" />
                    )}

                    {/* Dots */}
                    {showDots && ds.map((s, si) => s.data.map((v, i) => (
                        <circle key={`dot-${si}-${i}`}
                            cx={xScale(i) - PAD.l} cy={chartH - yScale(v)}
                            r={hover?.xi === i ? 5 : 3}
                            fill={token(s.color)} className="sg-dot"
                            style={{ opacity: hover ? (hover.xi === i ? 1 : 0.3) : 0.7 }} />
                    )))}
                </g>
            </svg>
            {hover && <Tooltip x={hover.x} y={hover.y} items={tooltipItems} containerRef={containerRef} placement="side" />}
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════
   VARIANT: DUAL-AXIS LINE
   Two series on independent Y scales — left axis = series[0],
   right axis = series[1]. Both normalised to the same chartH.
   Extra series[2+] are plotted on the left scale.
══════════════════════════════════════════════════════════════ */
const DualAxisChart = ({ series, labels, height, showGrid, showDots, showAxes, animate }) => {
    const PAD = { l: 44, r: 44, t: 12, b: 28 };
    const INTERNAL = 500;
    const chartH = height - PAD.t - PAD.b;
    const chartW = INTERNAL - PAD.l - PAD.r;
    const count = Math.max(...series.map(s => s.data.length), 1);
    const xScale = (i) => PAD.l + (i / Math.max(count - 1, 1)) * chartW;

    // Per-series independent scales
    const scales = useMemo(() => series.map(s => {
        const max = niceMax(Math.max(...s.data, 0));
        const ticks = yTicks(max);
        const yScale = (v) => (v / max) * chartH;
        return { max, ticks, yScale };
    }), [series, chartH]);

    const leftScale = scales[0];
    const rightScale = scales[1] ?? scales[0];

    const ds = series.map((s, i) => ({
        ...s,
        color: s.color || LINE_COLORS[i % LINE_COLORS.length],
        yScale: scales[i]?.yScale ?? leftScale.yScale,
    }));

    const [hover, setHover] = useState(null);
    const svgRef = useRef(null);
    const containerRef = useRef(null);

    const handleMouseMove = useCallback((e) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const plotLeftPx = (PAD.l / INTERNAL) * rect.width;
        const plotWidthPx = (chartW / INTERNAL) * rect.width;
        const plotRatio = clamp((x - plotLeftPx) / Math.max(plotWidthPx, 1), 0, 1);
        const xi = clamp(Math.round(plotRatio * (count - 1)), 0, count - 1);
        const pxX = plotLeftPx + (xi / Math.max(count - 1, 1)) * plotWidthPx;
        setHover({ xi, x: pxX, y: e.clientY - rect.top });
    }, [count, chartW]);

    const tooltipItems = hover
        ? ds.map(s => ({
            label: s.label,
            swatchColor: token(s.color),
            value: fmtWithUnit(s.data[hover.xi] ?? 0, s.decimals, s.unit ?? ''),
        }))
        : [];

    return (
        <div ref={containerRef} className="sg-chart-area" style={{ position: 'relative' }}>
            <svg ref={svgRef} viewBox={`0 0 ${INTERNAL} ${height}`} className="sg-svg"
                onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)}
                aria-label="Dual axis line chart" role="img">
                <g transform={`translate(0,${PAD.t})`}>
                    {/* Left Y-axis (series 0) */}
                    {showAxes && (
                        <g transform={`translate(${PAD.l},0)`}>
                            <YAxis ticks={leftScale.ticks} chartH={chartH} yScale={leftScale.yScale}
                                unit={ds[0]?.unit} />
                        </g>
                    )}
                    {/* Right Y-axis (series 1) */}
                    {showAxes && ds[1] && (
                        <g transform={`translate(${PAD.l},0)`}>
                            <YAxisRight ticks={rightScale.ticks} chartH={chartH} yScale={rightScale.yScale}
                                unit={ds[1]?.unit} chartW={chartW} />
                        </g>
                    )}

                    <g transform={`translate(${PAD.l},0)`}>
                        {/* Grid from left scale */}
                        <Grid ticks={leftScale.ticks} chartW={chartW} chartH={chartH}
                            yScale={leftScale.yScale} showGrid={showGrid} count={count} xScale={(i) => xScale(i) - PAD.l} />
                        {showAxes && (
                            <XAxis labels={labels} chartH={chartH}
                                xScale={(i) => xScale(i) - PAD.l} total={count} />
                        )}

                        {/* Area fills */}
                        {ds.map((s, si) => (
                            <path key={`da-area-${si}`}
                                d={toAreaPath(s.data, (i) => xScale(i) - PAD.l, s.yScale, chartH)}
                                fill={token(s.color)} opacity={0.07} />
                        ))}

                        {/* Lines */}
                        {ds.map((s, si) => {
                            const d = toBezierPath(s.data, (i) => xScale(i) - PAD.l, s.yScale, chartH);
                            return animate
                                ? <AnimLine key={`da-line-${si}`} d={d} color={s.color} strokeWidth={2} />
                                : <path key={`da-line-${si}`} d={d} fill="none" stroke={token(s.color)}
                                    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
                        })}

                        {/* Crosshair */}
                        {hover && (
                            <line x1={xScale(hover.xi) - PAD.l} y1={0}
                                x2={xScale(hover.xi) - PAD.l} y2={chartH} className="sg-crosshair" />
                        )}

                        {/* Dots */}
                        {showDots && ds.map((s, si) => s.data.map((v, i) => (
                            <circle key={`da-dot-${si}-${i}`}
                                cx={xScale(i) - PAD.l} cy={chartH - s.yScale(v)}
                                r={hover?.xi === i ? 5 : 3}
                                fill={token(s.color)} className="sg-dot"
                                style={{ opacity: hover ? (hover.xi === i ? 1 : 0.3) : 0.7 }} />
                        )))}
                    </g>
                </g>
            </svg>
            {hover && <Tooltip x={hover.x} y={hover.y} items={tooltipItems} containerRef={containerRef} placement="side" />}
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════
   VARIANT: BAR (vertical, grouped)
══════════════════════════════════════════════════════════════ */
const BarChart = ({ series, labels, height, showGrid, showAxes, unit, animate }) => {
    const PAD = { l: 44, r: 16, t: 12, b: 28 };
    const { max, ticks, count, chartW, chartH, xScale, yScale, totalW } =
        useChartLayout(series, height, PAD.l, PAD.r, PAD.t, PAD.b);

    const [hoveredXi, setHoveredXi] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);

    const ds = series.map((s, i) => ({ ...s, color: s.color || LINE_COLORS[i % LINE_COLORS.length] }));
    const groupW = (chartW / count) * 0.78;
    const barW = groupW / ds.length;
    const barX = (xi, si) => (xi / count) * chartW + (chartW / count - groupW) / 2 + si * barW;

    const tooltipItems = hoveredXi != null
        ? ds.map(s => ({
            label: s.label,
            swatchColor: token(s.color),
            value: fmtWithUnit(s.data[hoveredXi] ?? 0, s.decimals, unit),
        }))
        : [];

    return (
        <div ref={containerRef} className="sg-chart-area" style={{ position: 'relative' }}>
            <svg viewBox={`0 0 ${totalW} ${height}`} className="sg-svg"
                onMouseMove={(e) => {
                    if (hoveredXi == null) return;
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setHoveredXi(null)}
                aria-label="Bar chart" role="img">
                <g transform={`translate(${PAD.l},${PAD.t})`}>
                    {showAxes && <YAxis ticks={ticks} chartH={chartH} yScale={yScale} unit={unit} />}
                    <Grid ticks={ticks} chartW={chartW} chartH={chartH} yScale={yScale} showGrid={showGrid} count={count} xScale={(i) => (i / count) * chartW + chartW / (count * 2)} />
                    {showAxes && <XAxis labels={labels} chartH={chartH}
                        xScale={(i) => (i / count) * chartW + chartW / (count * 2)} total={count} />}

                    {ds.map((s, si) => s.data.map((v, xi) => {
                        const bh = yScale(v);
                        const bx = barX(xi, si);
                        const by = chartH - bh;
                        const op = hoveredXi != null ? (hoveredXi === xi ? 0.95 : 0.35) : 0.78;
                        return animate
                            ? <AnimBar key={`bar-${si}-${xi}`} x={bx} y={by} width={barW - 2} height={bh}
                                chartH={chartH} color={s.color} opacity={op}
                                onMouseEnter={(e) => {
                                    const rect = containerRef.current?.getBoundingClientRect();
                                    if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                                    setHoveredXi(xi);
                                }} />
                            : <rect key={`bar-${si}-${xi}`} x={bx} y={by} width={barW - 2} height={bh} rx={2}
                                fill={token(s.color)} opacity={op}
                                style={{ cursor: 'pointer', transition: 'opacity 150ms ease' }}
                                onMouseEnter={(e) => {
                                    const rect = containerRef.current?.getBoundingClientRect();
                                    if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                                    setHoveredXi(xi);
                                }} />;
                    }))}
                </g>
            </svg>
            {hoveredXi != null && <Tooltip x={tooltipPos.x} y={tooltipPos.y} items={tooltipItems} containerRef={containerRef} placement="side" />}
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════
   VARIANT: HORIZONTAL BAR
   series[0].data = values, series[0].labels = row labels
   OR pass top-level `labels` prop for row names.
   Ideal for ranked lists (Top Failing Endpoints etc.)
══════════════════════════════════════════════════════════════ */
const HBarChart = ({ series, labels, height, showAxes, unit, animate }) => {
    const ds = series.map((s, i) => ({ ...s, color: s.color || LINE_COLORS[i % LINE_COLORS.length] }));
    const rowLabels = labels.length ? labels : ds[0]?.data.map((_, i) => `Item ${i + 1}`);
    const count = rowLabels.length;

    // Each series contributes bars per row — typically single series
    const allVals = ds.flatMap(s => s.data);
    const dataMax = Math.max(...allVals, 1);
    const max = niceMax(dataMax);

    // Layout
    const W = 500;
    const PAD = { l: 120, r: 48, t: 8, b: 8 };
    const rowH = Math.max(24, Math.floor((height - PAD.t - PAD.b) / count));
    const totalH = rowH * count + PAD.t + PAD.b;
    const chartW = W - PAD.l - PAD.r;
    const xScale = (v) => (v / max) * chartW;

    const [hoveredRow, setHoveredRow] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);

    const tooltipItems = hoveredRow != null
        ? ds.map((s) => {
            const rowLabel = rowLabels[hoveredRow] ?? '';
            const seriesLabel = s.label || 'Value';
            const labelText = ds.length > 1
                ? `${rowLabel} — ${seriesLabel}`
                : String(rowLabel || seriesLabel);
            return {
                label: labelText,
                swatchColor: token(s.color),
                value: fmtWithUnit(s.data[hoveredRow] ?? 0, s.decimals, unit),
            };
        })
        : [];

    // Stagger animation refs per bar
    const barRefs = useRef([]);
    useEffect(() => {
        if (!animate) return;
        barRefs.current.forEach((el, i) => {
            if (!el) return;
            el.style.transform = 'scaleX(0)';
            el.style.transformOrigin = '0 50%';
            el.style.transition = `transform 500ms ${i * 40}ms cubic-bezier(0.4,0,0.2,1)`;
            requestAnimationFrame(() => { if (el) el.style.transform = 'scaleX(1)'; });
        });
    }, [animate]);

    return (
        <div ref={containerRef} className="sg-chart-area" style={{ position: 'relative' }}>
            <svg viewBox={`0 0 ${W} ${totalH}`} className="sg-svg"
                onMouseMove={(e) => {
                    if (hoveredRow == null) return;
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setHoveredRow(null)}
                aria-label="Horizontal bar chart" role="img">
                <g transform={`translate(${PAD.l},${PAD.t})`}>
                    {/* Vertical guide lines */}
                    {[0.25, 0.5, 0.75, 1].map(f => (
                        <line key={f} x1={xScale(max * f)} y1={0}
                            x2={xScale(max * f)} y2={rowH * count}
                            className="sg-grid-line" />
                    ))}

                    {rowLabels.map((label, ri) => {
                        const cy = ri * rowH + rowH / 2;
                        const isHov = hoveredRow === ri;

                        return (
                            <g key={ri}
                                onMouseEnter={(e) => {
                                    const rect = containerRef.current?.getBoundingClientRect();
                                    if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                                    setHoveredRow(ri);
                                }}
                                style={{ cursor: 'pointer' }}>

                                {/* Row label */}
                                <text x={-8} y={cy + 4} textAnchor="end"
                                    className={`sg-axis-label sg-hbar-label${isHov ? ' sg-hbar-label--active' : ''}`}>
                                    {String(label).length > 18 ? String(label).slice(0, 17) + '…' : label}
                                </text>

                                {/* Background track */}
                                <rect x={0} y={cy - rowH * 0.28} width={chartW} height={rowH * 0.56}
                                    rx={3} className="sg-hbar-track" />

                                {/* Filled bar */}
                                {ds.map((s, si) => {
                                    const bw = xScale(s.data[ri] ?? 0);
                                    const bh = rowH * 0.56 / ds.length;
                                    const by = cy - rowH * 0.28 + si * bh;
                                    const op = hoveredRow != null ? (isHov ? 0.95 : 0.4) : 0.78;
                                    return (
                                        <rect key={si}
                                            ref={el => { barRefs.current[ri * ds.length + si] = el; }}
                                            x={0} y={by} width={Math.max(bw, 2)} height={bh - 1}
                                            rx={3} fill={token(s.color)} opacity={op}
                                            style={{ transition: 'opacity 150ms ease' }} />
                                    );
                                })}

                                {/* Value label at bar end */}
                                {showAxes && (
                                    <text x={xScale(ds[0]?.data[ri] ?? 0) + 5} y={cy + 4}
                                        className="sg-axis-label" style={{ opacity: isHov ? 1 : 0.6 }}>
                                        {fmt(ds[0]?.data[ri])}{unit ? ` ${unit}` : ''}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Baseline */}
                    <line x1={0} y1={0} x2={0} y2={rowH * count} className="sg-baseline" />
                </g>
            </svg>
            {hoveredRow != null && (
                <Tooltip x={tooltipPos.x} y={tooltipPos.y} items={tooltipItems} containerRef={containerRef} placement="side" />
            )}
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════
   VARIANT: GAUGE
   Renders one KPI per series entry as a horizontal fill bar
   with an optional threshold line.

   series: [{ label, value, max, threshold, thresholdDir, color, unit }]
     thresholdDir: 'min' (must be above) | 'max' (must be below)
══════════════════════════════════════════════════════════════ */
const GaugeChart = ({ series, animate }) => {
    const gaugeRefs = useRef([]);

    useEffect(() => {
        if (!animate) return;
        gaugeRefs.current.forEach((el, i) => {
            if (!el) return;
            el.style.transform = 'scaleX(0)';
            el.style.transformOrigin = 'left center';
            el.style.transition = `transform 600ms ${i * 80}ms cubic-bezier(0.4,0,0.2,1)`;
            requestAnimationFrame(() => { if (el) el.style.transform = 'scaleX(1)'; });
        });
    }, [animate]);

    return (
        <div className="sg-gauge-list">
            {series.map((s, i) => {
                const pct = clamp((s.value ?? 0) / (s.max ?? 100), 0, 1);
                const tPct = s.threshold != null ? clamp(s.threshold / (s.max ?? 100), 0, 1) : null;

                // Determine health colour
                let healthColor = '--interactive-success';
                if (tPct != null) {
                    const breached = s.thresholdDir === 'min'
                        ? (s.value ?? 0) < (s.threshold ?? 0)
                        : (s.value ?? 0) > (s.threshold ?? 0);
                    if (breached) healthColor = '--interactive-danger';
                }

                return (
                    <div key={i} className="sg-gauge-row">
                        {/* Label + value */}
                        <div className="sg-gauge-meta" style={{ position: 'relative' }}>
                            <span className="sg-gauge-label">{s.label}</span>
                            <span className="sg-gauge-value" style={{
                                position: 'absolute',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                color: token(healthColor),
                                fontWeight: 'bold'
                            }}>
                                {fmt(s.value, s.decimals)}{s.unit ? ` ${s.unit}` : ''}
                            </span>
                        </div>

                        {/* Track */}
                        <div className="sg-gauge-track">
                            {/* Fill */}
                            <div
                                ref={el => { gaugeRefs.current[i] = el; }}
                                className="sg-gauge-fill"
                                style={{
                                    width: `${pct * 100}%`,
                                    background: token(healthColor),
                                }}
                            />
                            {/* Threshold marker */}
                            {tPct != null && (
                                <>
                                    <div className="sg-gauge-threshold" style={{
                                        left: `${tPct * 100}%`,
                                        width: '1px',
                                        height: '100%',
                                        backgroundColor: 'var(--accent-indicator)',
                                        position: 'absolute',
                                        top: 0
                                    }} />
                                    <div className="sg-gauge-threshold-label" style={{
                                        position: 'absolute',
                                        left: `${tPct * 100}%`,
                                        top: '100%',
                                        transform: 'translateX(-50%)',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {s.thresholdDir === 'min' ? '≥' : '≤'}{fmt(s.threshold)}{s.unit ? s.unit : ''}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════
   VARIANT: DONUT
   series: [{ label, value, color }]
   Renders a proportional ring with a centred total + legend.
══════════════════════════════════════════════════════════════ */
const DonutChart = ({ series, height = 200, title: centerLabel }) => {
    const [hovered, setHovered] = useState(null);
    const ds = series.map((s, i) => ({ ...s, color: s.color || LINE_COLORS[i % LINE_COLORS.length] }));
    const total = ds.reduce((acc, s) => acc + (s.value ?? 0), 0);
    if (total === 0) return <div className="sg-empty">No data</div>;

    const R = 70;   // outer radius
    const r = 46;   // inner radius (hole)
    const CX = 100;
    const CY = 100;
    const W = 200;
    const H = 200;

    // Build arc paths
    let cursor = -Math.PI / 2; // start at 12 o'clock
    const arcs = ds.map((s, i) => {
        const frac = (s.value ?? 0) / total;
        const angle = frac * 2 * Math.PI;
        const x1o = CX + R * Math.cos(cursor);
        const y1o = CY + R * Math.sin(cursor);
        const x1i = CX + r * Math.cos(cursor);
        const y1i = CY + r * Math.sin(cursor);
        cursor += angle;
        const x2o = CX + R * Math.cos(cursor);
        const y2o = CY + R * Math.sin(cursor);
        const x2i = CX + r * Math.cos(cursor);
        const y2i = CY + r * Math.sin(cursor);
        const large = angle > Math.PI ? 1 : 0;
        const d = [
            `M ${x1o} ${y1o}`,
            `A ${R} ${R} 0 ${large} 1 ${x2o} ${y2o}`,
            `L ${x2i} ${y2i}`,
            `A ${r} ${r} 0 ${large} 0 ${x1i} ${y1i}`,
            'Z',
        ].join(' ');
        return { ...s, d, frac, midAngle: cursor - angle / 2 };
    });

    const hovItem = hovered != null ? ds[hovered] : null;

    return (
        <div className="sg-donut-wrap">
            <svg viewBox={`0 0 ${W} ${H}`} className="sg-donut-svg"
                style={{ width: Math.min(height, 200), height: Math.min(height, 200), flexShrink: 0 }}
                aria-label="Donut chart" role="img">
                {arcs.map((arc, i) => (
                    <path key={i} d={arc.d}
                        fill={token(arc.color)}
                        opacity={hovered != null ? (hovered === i ? 1 : 0.35) : 0.85}
                        style={{
                            transition: 'opacity 150ms ease, transform 150ms ease',
                            transform: hovered === i ? `translate(${Math.cos(arc.midAngle) * 4}px,${Math.sin(arc.midAngle) * 4}px)` : 'none',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                    />
                ))}

                {/* Centre text */}
                <text x={CX} y={CY - 8} textAnchor="middle" className="sg-donut-center-value">
                    {hovItem ? fmt(hovItem.value) : fmt(total)}
                </text>
                <text x={CX} y={CY + 10} textAnchor="middle" className="sg-donut-center-label">
                    {hovItem ? hovItem.label : (centerLabel || 'total')}
                </text>
                {hovItem && (
                    <text x={CX} y={CY + 26} textAnchor="middle" className="sg-donut-center-pct">
                        {(hovItem.frac * 100).toFixed(1)}%
                    </text>
                )}
            </svg>

            {/* Legend */}
            <div className="sg-donut-legend">
                {ds.map((s, i) => (
                    <div key={i} className={`sg-donut-legend-row${hovered === i ? ' is-active' : ''}`}
                        onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                        <span className="sg-legend-swatch" style={{ background: token(s.color) }} />
                        <span className="sg-donut-legend-label">{s.label}</span>
                        <span className="sg-donut-legend-value">{fmt(s.value)}</span>
                        <span className="sg-donut-legend-pct">{((s.value / total) * 100).toFixed(0)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════
   VARIANT: SPARKLINE
   Minimal inline trend — no axes, no labels.
══════════════════════════════════════════════════════════════ */
const Sparkline = ({ series, height = 48 }) => {
    const s = series[0];
    if (!s) return null;
    const color = s.color || LINE_COLORS[0];
    const data = s.data;
    if (!data?.length) return <span className="sg-empty">No data</span>;
    const W = 120, H = height;
    const max = Math.max(...data, 1);
    const xs = (i) => (i / Math.max(data.length - 1, 1)) * W;
    const ys = (v) => H - (v / max) * H * 0.85 - H * 0.075;
    const pts = data.map((v, i) => `${xs(i)},${ys(v)}`).join(' ');
    const last = data[data.length - 1];
    const trend = data.length > 1 ? last - data[0] : 0;

    return (
        <div className="sg-sparkline-wrap">
            <svg viewBox={`0 0 ${W} ${H}`} className="sg-sparkline-svg" aria-hidden="true">
                <path d={`M0,${H} ${pts} L${W},${H} Z`} fill={token(color)} opacity={0.12} />
                <polyline points={pts} fill="none" stroke={token(color)}
                    strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={xs(data.length - 1)} cy={ys(last)} r={3} fill={token(color)} />
            </svg>
            <span className="sg-spark-trend"
                style={{ color: trend >= 0 ? 'var(--icon-success)' : 'var(--icon-danger)' }}>
                {trend >= 0 ? '↑' : '↓'} {fmt(Math.abs(trend), 1)}
            </span>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════
   STAT GRAPH — main export
══════════════════════════════════════════════════════════════ */

/**
 * StatGraph
 *
 * Props:
 *   variant      'line' | 'area' | 'bar' | 'hbar' | 'dual' | 'gauge' | 'donut' | 'sparkline'
 *
 *   series       Array<{
 *                  label     string
 *                  color     string        CSS var ('--border-brand') or hex
 *                  data      number[]      values
 *                  unit      string        (dual/gauge: per-series unit override)
 *                  decimals  number        (decimal places for fmt)
 *                  // gauge only:
 *                  value     number
 *                  max       number
 *                  threshold number
 *                  thresholdDir 'min'|'max'
 *                }>
 *
 *   labels       string[]   x-axis / row labels
 *   title        string
 *   subtitle     string
 *   unit         string     global unit (appended to tooltip values)
 *   height       number     px (default 240; donut uses as diameter cap)
 *   showGrid     boolean    (default true)
 *   showDots     boolean    (default true, line/dual only)
 *   showLegend   boolean    (default true)
 *   showAxes     boolean    (default true)
 *   animate      boolean    (default true)
 *   className    string
 */
const StatGraph = ({
    variant = 'line',
    series = [],
    labels = [],
    title,
    subtitle,
    unit = '',
    height = 240,
    showGrid = true,
    showDots = true,
    showLegend = true,
    showAxes = true,
    animate = true,
    deferUntilVisible = false,
    reveal = 'fade',
    observerThreshold = 0.12,
    observerRootMargin = '160px 0px',
    placeholderHeight,
    className = '',
}) => {
    const isSpark = variant === 'sparkline';
    const isGauge = variant === 'gauge';
    const isDonut = variant === 'donut';
    const isHBar = variant === 'hbar';
    const showHeader = (title || subtitle) && !isSpark;
    // Legend: show for multi-series line/bar/dual/area; always for hbar if multi-series
    const showLeg = showLegend && !isSpark && !isGauge && !isDonut && series.length > 1;
    const revealType = ['fade', 'slide', 'zoom', 'none'].includes(reveal) ? reveal : 'fade';

    const ds = series.map((s, i) => ({ ...s, color: s.color || LINE_COLORS[i % LINE_COLORS.length] }));
    const rootRef = useRef(null);
    const [hasEnteredView, setHasEnteredView] = useState(!deferUntilVisible);
    const [revealVisible, setRevealVisible] = useState(false);

    useEffect(() => {
        if (hasEnteredView) return;
        if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
            setHasEnteredView(true);
            return;
        }
        const target = rootRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry?.isIntersecting) {
                    setHasEnteredView(true);
                    observer.disconnect();
                }
            },
            { threshold: observerThreshold, rootMargin: observerRootMargin }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [hasEnteredView, observerRootMargin, observerThreshold]);

    useEffect(() => {
        if (!hasEnteredView || revealType === 'none') return undefined;
        const frameId = window.requestAnimationFrame(() => setRevealVisible(true));
        return () => window.cancelAnimationFrame(frameId);
    }, [hasEnteredView, revealType]);

    if (!series.length) return null;

    const estimatedHeight = placeholderHeight
        || Math.max(72, height + (showHeader ? 34 : 0) + (showLeg ? 26 : 0));

    if (!hasEnteredView) {
        return (
            <div
                ref={rootRef}
                className={`sg-root sg-placeholder ${className}`.trim()}
                style={{ minHeight: estimatedHeight }}
                aria-hidden="true"
            />
        );
    }

    const revealClass = revealType === 'none'
        ? ''
        : ` sg-reveal sg-reveal--${revealType}${revealVisible ? ' sg-reveal--visible' : ''}`;

    return (
        <div
            ref={rootRef}
            className={`sg-root${isSpark ? ' sg-root--spark' : ''}${revealClass} ${className}`.trim()}
        >

            {showHeader && (
                <div className="sg-header">
                    {title && <span className="sg-title">{title}</span>}
                    {subtitle && <span className="sg-subtitle">{subtitle}</span>}
                </div>
            )}

            {showLeg && <Legend series={ds} />}

            {isSpark && <Sparkline series={ds} height={height} />}

            {(variant === 'line' || variant === 'area') && (
                <LineChart series={ds} labels={labels} height={height}
                    showGrid={showGrid} showDots={showDots} showAxes={showAxes}
                    unit={unit} animate={animate} stacked={variant === 'area'} />
            )}

            {variant === 'dual' && (
                <DualAxisChart series={ds} labels={labels} height={height}
                    showGrid={showGrid} showDots={showDots} showAxes={showAxes}
                    animate={animate} />
            )}

            {variant === 'bar' && (
                <BarChart series={ds} labels={labels} height={height}
                    showGrid={showGrid} showAxes={showAxes} unit={unit} animate={animate} />
            )}

            {isHBar && (
                <HBarChart series={ds} labels={labels} height={height}
                    showAxes={showAxes} unit={unit} animate={animate} />
            )}

            {isGauge && <GaugeChart series={ds} animate={animate} />}

            {isDonut && <DonutChart series={ds} height={height} title={title} />}

        </div>
    );
};

export default StatGraph;