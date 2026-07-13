"use client";

import { Knob } from "@/components/ui/knob";
import type { AudioOptions } from "@/lib/audio-processor";
import { useState, useRef } from "react";

interface AudioControlsProps {
  options: AudioOptions;
  onChange: (options: AudioOptions) => void;
  disabled?: boolean;
}

function MacroKnob({
  options,
  onChange,
  disabled,
}: {
  options: AudioOptions;
  onChange: (options: AudioOptions) => void;
  disabled?: boolean;
}) {
  const [val, setVal] = useState(0);

  // Single ref holds all drag state — never captured in stale closures
  const dragState = useRef<{
    startY: number;
    baseline: AudioOptions;
    pointerId: number;
  } | null>(null);

  // Always-fresh refs so event handlers always see the latest values
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));

  const r = (v: number, decimals: number) => Math.round(v * 10 ** decimals) / 10 ** decimals;

  const applyMacro = (macroVal: number, baseline: AudioOptions): AudioOptions => {
    const p = macroVal / 100;
    return {
      ...baseline,
      panSpeed:         r(clamp(baseline.panSpeed         + 1.95 * p, 0.05, 2),   2),
      panDepth:         r(clamp(baseline.panDepth         + 1    * p, 0,    1),   2),
      panCurve:         r(clamp(baseline.panCurve         + 100  * p, 0,    100), 0),
      spatialMode:      macroVal > 0 ? 1 : macroVal < 0 ? 0 : baseline.spatialMode,
      elevationDepth:   r(clamp(baseline.elevationDepth   + 100  * p, 0,    100), 0),
      bassCenterAmount: r(clamp(baseline.bassCenterAmount + 100  * p, 0,    100), 0),
      variationAmount:  r(clamp(baseline.variationAmount  + 100  * p, 0,    100), 0),
      reverbAmount:     r(clamp(baseline.reverbAmount     + 100  * p, 0,    100), 0),
      reverbDecay:      r(clamp(baseline.reverbDecay      + 4.5  * p, 0.5,  5),   1),
      reverbPreDelay:   r(clamp(baseline.reverbPreDelay   + 50   * p, 0,    50),  0),
      airAmount:        r(clamp(baseline.airAmount        + 100  * p, 0,    100), 0),
      spatialWidth:     r(clamp(baseline.spatialWidth     + 100  * p, 0,    100), 0),
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    // Snapshot baseline HERE from the always-fresh ref — never re-captured mid-drag
    dragState.current = {
      startY: e.clientY,
      baseline: optionsRef.current,
      pointerId: e.pointerId,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current || e.pointerId !== dragState.current.pointerId) return;
    e.preventDefault();
    const deltaY = dragState.current.startY - e.clientY;
    const newVal = Math.round(Math.max(-100, Math.min(100, (deltaY / 180) * 100)));
    setVal(newVal);
    onChangeRef.current(applyMacro(newVal, dragState.current.baseline));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState.current || e.pointerId !== dragState.current.pointerId) return;
    // Spring back: knob visually resets to 0, but values stay at their newly modified state
    dragState.current = null;
    setVal(0);
  };

  // SVG dial geometry
  const MIN_ANGLE = -135;
  const MAX_ANGLE = 135;
  const sz = 90;
  const cx = sz / 2, cy = sz / 2;
  const trackR = sz * 0.39;
  const bodyR = sz * 0.22;
  const norm = (val + 100) / 200;
  const angle = MIN_ANGLE + norm * (MAX_ANGLE - MIN_ANGLE);
  const midAngle = MIN_ANGLE + 0.5 * (MAX_ANGLE - MIN_ANGLE); // = 0°

  const polarToXY = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const describeArc = (a1: number, a2: number, r: number) => {
    const s = polarToXY(a1, r), e = polarToXY(a2, r);
    const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const trackPath = describeArc(MIN_ANGLE, MAX_ANGLE, trackR);
  const valuePath = val !== 0
    ? (val > 0 ? describeArc(midAngle, angle, trackR) : describeArc(angle, midAngle, trackR))
    : null;
  const indInner = polarToXY(angle, bodyR * 1.1);
  const indOuter = polarToXY(angle, trackR * 0.76);

  return (
    <div className="flex flex-col items-center justify-center gap-4 bg-[var(--charcoal-4)] p-6 rounded-[12px] border border-[var(--light-cream)] h-full w-full">
      <div className="text-[11px] font-bold text-[var(--charcoal)] tracking-widest uppercase">
        Global Macro
      </div>
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => { if (!disabled) onChangeRef.current(applyMacro(-1, optionsRef.current)); }}
          disabled={disabled}
          className="w-8 h-8 shrink-0 rounded-full border border-[var(--light-cream)] flex items-center justify-center font-bold text-[var(--charcoal)] hover:bg-[var(--cream)] active:scale-95 transition-all disabled:opacity-50"
        >-</button>

        <div className={`flex flex-col items-center gap-1 select-none ${disabled ? "opacity-30" : ""}`}>
          <svg
            width={sz} height={sz}
            viewBox={`0 0 ${sz} ${sz}`}
            style={{ cursor: disabled ? "not-allowed" : "ns-resize", touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <path d={trackPath} fill="none" stroke="var(--light-cream)" strokeWidth="3" strokeLinecap="round" />
            {valuePath && (
              <path
                d={valuePath} fill="none"
                stroke={val > 0 ? "#7a9e7e" : "#c47a7a"}
                strokeWidth="3" strokeLinecap="round"
              />
            )}
            <circle cx={cx} cy={cy} r={bodyR} fill="var(--cream)" stroke="var(--light-cream)" strokeWidth="1.5" />
            <line
              x1={indInner.x} y1={indInner.y}
              x2={indOuter.x} y2={indOuter.y}
              stroke="var(--charcoal)" strokeWidth="2" strokeLinecap="round"
            />
          </svg>
          <div className="text-center leading-none">
            <div className="text-[10px] font-semibold text-[var(--charcoal)] uppercase tracking-wide">Scale</div>
            <div className="text-[10px] text-[var(--muted-gray)] tabular-nums mt-0.5">
              {val === 0 ? "0%" : val > 0 ? `+${val}%` : `${val}%`}
            </div>
          </div>
        </div>

        <button
          onClick={() => { if (!disabled) onChangeRef.current(applyMacro(1, optionsRef.current)); }}
          disabled={disabled}
          className="w-8 h-8 shrink-0 rounded-full border border-[var(--light-cream)] flex items-center justify-center font-bold text-[var(--charcoal)] hover:bg-[var(--cream)] active:scale-95 transition-all disabled:opacity-50"
        >+</button>
      </div>
    </div>
  );
}

export function AudioControls({ options, onChange, disabled }: AudioControlsProps) {
  const set = (key: keyof AudioOptions, value: number) =>
    onChange({ ...options, [key]: value });

  return (
    <div className="flex flex-col 2xl:flex-row gap-6 items-stretch">
      <div className="flex-1 flex flex-col gap-5">
        {/* PANNING row */}
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-[var(--muted-gray)] mb-3">
            Panning
          </div>
          <div className="flex flex-wrap justify-center sm:justify-start gap-4 sm:gap-6">
            <Knob
              id="knob-pan-speed"
              label="Speed"
              value={options.panSpeed}
              min={0.05} max={2} step={0.05}
              formatValue={(v) => `${v.toFixed(2)}Hz`}
              onChange={(v) => set("panSpeed", v)}
              disabled={disabled}
            />
            <Knob
              id="knob-pan-depth"
              label="Depth"
              value={options.panDepth}
              min={0} max={1} step={0.05}
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => set("panDepth", v)}
              disabled={disabled}
            />
            <Knob
              id="knob-pan-curve"
              label="Reality"
              value={options.panCurve}
              min={0} max={100} step={1}
              formatValue={(v) => `${v}%`}
              onChange={(v) => set("panCurve", v)}
              disabled={disabled}
            />
            <Knob
              id="knob-spatial-mode"
              label="Mode"
              value={options.spatialMode}
              min={0} max={1} step={1}
              formatValue={(v) => (v >= 1 ? "HRTF 3D" : "Stereo")}
              onChange={(v) => set("spatialMode", v)}
              disabled={disabled}
            />
            <Knob
              id="knob-elevation"
              label="Elevatn"
              value={options.elevationDepth}
              min={0} max={100} step={1}
              formatValue={(v) => (v <= 0 ? "Flat" : v < 40 ? "Tilt" : v < 75 ? "High" : "Vert")}
              onChange={(v) => set("elevationDepth", v)}
              disabled={disabled}
            />
            <Knob
              id="knob-bass-center"
              label="Bass"
              value={options.bassCenterAmount}
              min={0} max={100} step={1}
              formatValue={(v) => `${v}%`}
              onChange={(v) => set("bassCenterAmount", v)}
              disabled={disabled}
            />
            <Knob
              id="knob-variation"
              label="Variatn"
              value={options.variationAmount}
              min={0} max={100} step={1}
              formatValue={(v) => v < 20 ? "None" : v < 60 ? "Nat." : "Wild"}
              onChange={(v) => set("variationAmount", v)}
              disabled={disabled}
            />
          </div>
        </div>

        {/* REVERB & SPACE row */}
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-[var(--muted-gray)] mb-3">
            Reverb &amp; Space
          </div>
          <div className="flex flex-wrap justify-center sm:justify-start gap-4 sm:gap-6">
            <Knob
              id="knob-reverb-amount"
              label="Amount"
              value={options.reverbAmount}
              min={0} max={100} step={1}
              formatValue={(v) => `${v}%`}
              onChange={(v) => set("reverbAmount", v)}
              disabled={disabled}
            />
            <Knob
              id="knob-reverb-decay"
              label="Decay"
              value={options.reverbDecay}
              min={0.5} max={5} step={0.1}
              formatValue={(v) => `${v.toFixed(1)}s`}
              onChange={(v) => set("reverbDecay", v)}
              disabled={disabled}
            />
            <Knob
              id="knob-reverb-predelay"
              label="Pre-dly"
              value={options.reverbPreDelay}
              min={0} max={50} step={1}
              formatValue={(v) => `${v}ms`}
              onChange={(v) => set("reverbPreDelay", v)}
              disabled={disabled}
            />
            <Knob
              id="knob-air"
              label="Air"
              value={options.airAmount}
              min={0} max={100} step={1}
              formatValue={(v) => `${v}%`}
              onChange={(v) => set("airAmount", v)}
              disabled={disabled}
            />
            <Knob
              id="knob-spatial-width"
              label="Width"
              value={options.spatialWidth}
              min={0} max={100} step={1}
              formatValue={(v) => `${v}%`}
              onChange={(v) => set("spatialWidth", v)}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* MACRO CONTROL (Right Sidebar) */}
      <div className="2xl:w-[240px] shrink-0 border-t 2xl:border-t-0 2xl:border-l border-[var(--light-cream)] pt-6 2xl:pt-0 2xl:pl-6 flex">
        <MacroKnob options={options} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}
