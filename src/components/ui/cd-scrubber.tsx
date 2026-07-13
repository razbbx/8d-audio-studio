"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface CDScrubberProps {
  isPlaying: boolean;
  progress: number; // 0 to 1
  onSeek: (p: number) => void;
  onTogglePlay: () => void;
  disabled?: boolean;
}

// Fixed speed: 33 RPM ≈ 0.55 rotations/sec = 198°/sec
const RPM_DEG_PER_MS = (33 * 360) / 60 / 1000;

export function CDScrubber({
  isPlaying,
  progress,
  onSeek,
  onTogglePlay,
  disabled,
}: CDScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cdBodyRef = useRef<HTMLDivElement>(null);

  // Visual rotation angle (degrees). Accumulates continuously — not tied to progress.
  const rotationRef = useRef(0);
  // rAF for playing spin
  const spinRafRef = useRef<number | undefined>(undefined);
  const lastTimestampRef = useRef<number | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    lastAngle: number;
    pointerId: number;
  } | null>(null);

  // Throttle: only fire onSeek at most 10× per second to avoid audio engine spam
  const lastSeekTimeRef = useRef(0);

  // "Live" progress ref so pointer handlers always see the latest value
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  const applyRotation = useCallback(() => {
    if (cdBodyRef.current) {
      cdBodyRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
    }
  }, []);

  useEffect(() => {
    if (isPlaying && !isDragging) {
      const spin = (ts: number) => {
        if (lastTimestampRef.current !== null) {
          rotationRef.current += (ts - lastTimestampRef.current) * RPM_DEG_PER_MS;
          applyRotation();
        }
        lastTimestampRef.current = ts;
        spinRafRef.current = requestAnimationFrame(spin);
      };
      spinRafRef.current = requestAnimationFrame(spin);
    } else {
      if (spinRafRef.current) cancelAnimationFrame(spinRafRef.current);
      lastTimestampRef.current = null;
    }

    return () => {
      if (spinRafRef.current) cancelAnimationFrame(spinRafRef.current);
    };
  }, [isPlaying, isDragging, applyRotation]);

  // ── Drag: rotational seek ─────────────────────────────────────────────────
  const getAngle = (e: { clientX: number; clientY: number }, rect: DOMRect) => {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = containerRef.current!.getBoundingClientRect();
      const startAngle = getAngle(e, rect);

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { lastAngle: startAngle, pointerId: e.pointerId };
      setIsDragging(true);
    },
    [disabled]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
      e.preventDefault();

      const rect = containerRef.current!.getBoundingClientRect();
      const currentAngle = getAngle(e, rect);

      let delta = currentAngle - dragRef.current.lastAngle;
      // Clamp to ±180 to handle the ±180° discontinuity
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      // Visual: spin the disc by the drag delta
      rotationRef.current += delta;
      applyRotation();

      // Seek: 0.75 full clockwise rotations = 100% of the track (fast, responsive)
      const progressDelta = delta / (360 * 0.75);
      const next = Math.max(0, Math.min(1, progressRef.current + progressDelta));

      dragRef.current.lastAngle = currentAngle;

      // Throttle audio seeks to avoid click spam (max 10/sec)
      const now = performance.now();
      if (now - lastSeekTimeRef.current > 100) {
        lastSeekTimeRef.current = now;
        onSeekRef.current(next);
      } else {
        // Still update the stored progress so rotation stays accurate
        progressRef.current = next;
      }
    },
    [applyRotation]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const circumference = 301.59; // 2π × 48

  return (
    <div className="flex flex-col items-center gap-3 select-none">

      {/* CD Platter */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={[
          "relative w-[160px] h-[160px] rounded-full flex items-center justify-center transition-transform duration-150",
          disabled ? "opacity-40" : "",
          isDragging ? "scale-[1.04] cursor-grabbing" : "cursor-grab",
        ].join(" ")}
        style={{ touchAction: "none" }}
      >
        {/* Progress ring */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Track */}
          <circle
            cx="50" cy="50" r="48"
            fill="none"
            stroke="var(--light-cream)"
            strokeWidth="2.5"
          />
          {/* Progress */}
          <circle
            cx="50" cy="50" r="48"
            fill="none"
            stroke="var(--charcoal)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${progress * circumference} ${circumference}`}
            style={{ transition: "stroke-dasharray 80ms linear" }}
          />
        </svg>

        {/* CD body — spins via JS transform */}
        <div
          ref={cdBodyRef}
          className="absolute inset-[8px] rounded-full bg-[#111] shadow-2xl border border-[#2a2a2a] overflow-hidden flex items-center justify-center"
          style={{ willChange: "transform" }}
        >
          {/* Rainbow iridescent shimmer */}
          <div className="absolute inset-0 rounded-full" style={{
            background: "conic-gradient(from 0deg, rgba(255,0,100,0.08), rgba(0,200,255,0.08), rgba(255,220,0,0.08), rgba(100,255,0,0.08), rgba(200,0,255,0.08), rgba(255,0,100,0.08))"
          }} />
          {/* Groove rings */}
          {[15, 27, 38].map(pct => (
            <div key={pct} className="absolute rounded-full border border-white/[0.04]" style={{ inset: `${pct}%` }} />
          ))}
          {/* Highlight sheen */}
          <div className="absolute inset-0 bg-gradient-to-tl from-white/0 via-white/[0.06] to-white/0 rounded-full" />

          {/* Center label */}
          <div className="relative z-10 w-[42%] h-[42%] rounded-full bg-gradient-to-br from-[#c4a97b] to-[#7a5c30] flex items-center justify-center shadow-inner border border-[#6b4f28]/40">
            {/* Spindle hole */}
            <div className="w-[18%] h-[18%] rounded-full bg-[#0a0a0a] border border-[#333]" />
          </div>
        </div>

        {/* Drag hint: ring of tiny arrows shown on hover (desktop only) */}
        {!disabled && !isDragging && (
          <div className="absolute inset-0 rounded-full pointer-events-none hidden md:flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300" style={{ background: "rgba(0,0,0,0)" }}>
          </div>
        )}
      </div>

      {/* Play / Pause button — BELOW the CD, not overlaid */}
      <button
        className={[
          "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200",
          "bg-[var(--charcoal)] text-[var(--cream)] shadow-md",
          "hover:scale-105 active:scale-95",
          disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={isPlaying ? "Pause preview" : "Play preview"}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
        )}
      </button>

      {/* Label */}
      <div className="text-center leading-none">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--charcoal)]">
          {isPlaying ? "Playing" : "Preview"}
        </div>
        <div className="text-[9px] text-[var(--muted-gray)] mt-1">
          Spin to scrub
        </div>
      </div>

      {/* Mobile scrub slider */}
      <div className="mt-1 md:hidden w-full px-1">
        <input
          type="range"
          min="0" max="1" step="0.001"
          value={progress}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full accent-[var(--charcoal)]"
        />
      </div>
    </div>
  );
}
