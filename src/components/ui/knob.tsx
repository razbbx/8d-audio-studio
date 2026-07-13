"use client";

import { useCallback, useRef } from "react";

interface KnobProps {
  id?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  hint?: string;
  formatValue?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
  size?: number;
  accentColor?: string;
}

// Knob sweep: from -135° to +135° (270° total range)
const MIN_ANGLE = -135;
const MAX_ANGLE = 135;

function polarToXY(angleDeg: number, r: number, cx: number, cy: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  startAngle: number,
  endAngle: number,
  r: number,
  cx: number,
  cy: number,
) {
  const s = polarToXY(startAngle, r, cx, cy);
  const e = polarToXY(endAngle, r, cx, cy);
  const large = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function Knob({
  id,
  value,
  min,
  max,
  step = 0.01,
  label,
  formatValue = (v) => String(v),
  onChange,
  disabled,
  size = 60,
}: KnobProps) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const cx = size / 2;
  const cy = size / 2;
  const trackR = size * 0.39;
  const bodyR = size * 0.22;

  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const currentAngle = MIN_ANGLE + norm * (MAX_ANGLE - MIN_ANGLE);

  const trackPath = describeArc(MIN_ANGLE, MAX_ANGLE, trackR, cx, cy);
  const valuePath =
    norm > 0.005
      ? describeArc(MIN_ANGLE, currentAngle, trackR, cx, cy)
      : null;

  // Indicator: short line from inner body edge to near the arc
  const indOuter = polarToXY(currentAngle, trackR * 0.76, cx, cy);
  const indInner = polarToXY(currentAngle, bodyR * 1.1, cx, cy);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (disabled) return;
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startValue: value };
      svgRef.current?.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const deltaY = dragRef.current.startY - ev.clientY; // up = increase
        const range = max - min;
        const delta = (deltaY / 180) * range; // 180px = full sweep
        let next = dragRef.current.startValue + delta;
        next = Math.round((next - min) / step) * step + min;
        next = Math.max(min, Math.min(max, next));
        onChange(parseFloat(next.toFixed(10)));
      };

      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [disabled, value, min, max, step, onChange],
  );

  // Keyboard support
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      let next = value;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") next = Math.min(max, value + step);
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") next = Math.max(min, value - step);
      else return;
      e.preventDefault();
      onChange(parseFloat(next.toFixed(10)));
    },
    [disabled, value, min, max, step, onChange],
  );

  // Double-click resets to midpoint
  const handleDoubleClick = useCallback(() => {
    if (disabled) return;
    const mid = min + (max - min) / 2;
    onChange(parseFloat(mid.toFixed(10)));
  }, [disabled, min, max, onChange]);

  return (
    <div
      className="flex flex-col items-center gap-1 select-none"
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      style={{ outline: "none" }}
    >
      <svg
        ref={svgRef}
        id={id}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        style={{
          cursor: disabled ? "not-allowed" : "ns-resize",
          touchAction: "none",
          WebkitUserSelect: "none",
        }}
        className={`transition-opacity duration-200 ${disabled ? "opacity-30" : "opacity-100"}`}
      >
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="var(--light-cream)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Value arc */}
        {valuePath && (
          <path
            d={valuePath}
            fill="none"
            stroke="var(--charcoal)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
        {/* Knob body */}
        <circle
          cx={cx}
          cy={cy}
          r={bodyR}
          fill="var(--cream)"
          stroke="var(--light-cream)"
          strokeWidth="1.5"
        />
        {/* Indicator line */}
        <line
          x1={indInner.x}
          y1={indInner.y}
          x2={indOuter.x}
          y2={indOuter.y}
          stroke="var(--charcoal)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      <div className="text-center leading-none">
        <div className="text-[10px] font-semibold text-[var(--charcoal)] uppercase tracking-wide whitespace-nowrap">
          {label}
        </div>
        <div className="text-[10px] text-[var(--muted-gray)] tabular-nums mt-0.5">
          {formatValue(value)}
        </div>
      </div>
    </div>
  );
}
