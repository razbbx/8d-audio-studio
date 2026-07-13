"use client";

import { useState, useCallback, useEffect } from "react";
import type { AudioOptions } from "@/lib/audio-processor";

interface CsvEditorProps {
  options: AudioOptions;
  onChange: (options: AudioOptions) => void;
}

// Ordered fields with user-facing labels matching the knob UI
const FIELDS: { key: keyof AudioOptions; label: string; min: number; max: number; decimals: number }[] = [
  { key: "panSpeed",         label: "Speed",   min: 0.05, max: 2,   decimals: 2 },
  { key: "panDepth",         label: "Depth",   min: 0,    max: 1,   decimals: 2 },
  { key: "panCurve",         label: "Reality", min: 0,    max: 100, decimals: 0 },
  { key: "spatialMode",      label: "Mode",    min: 0,    max: 1,   decimals: 0 },
  { key: "elevationDepth",   label: "Elevatn", min: 0,    max: 100, decimals: 0 },
  { key: "bassCenterAmount", label: "Bass",    min: 0,    max: 100, decimals: 0 },
  { key: "variationAmount",  label: "Variatn", min: 0,    max: 100, decimals: 0 },
  { key: "reverbAmount",     label: "Amount",  min: 0,    max: 100, decimals: 0 },
  { key: "reverbDecay",      label: "Decay",   min: 0.5,  max: 5,   decimals: 1 },
  { key: "reverbPreDelay",   label: "Pre-dly", min: 0,    max: 50,  decimals: 0 },
  { key: "airAmount",        label: "Air",     min: 0,    max: 100, decimals: 0 },
  { key: "spatialWidth",     label: "Width",   min: 0,    max: 100, decimals: 0 },
];

// Format: "Speed: 0.15, Depth: 0.84, ..."
function optionsToCsv(opts: AudioOptions): string {
  return FIELDS.map(f => {
    const v = opts[f.key];
    const formatted = typeof v === "number" ? v.toFixed(f.decimals) : String(v);
    return `${f.label}: ${formatted}`;
  }).join(", ");
}

// Accepts both "Speed: 0.15, ..." and plain "0.15, 0.84, ..."
function csvToOptions(csv: string, current: AudioOptions): { result: AudioOptions; error: string | null } {
  // Strip "Label: " prefixes if present
  const parts = csv.split(",").map(s => {
    const trimmed = s.trim();
    // If it contains a colon, take the part after it
    const colonIdx = trimmed.indexOf(":");
    return colonIdx >= 0 ? trimmed.slice(colonIdx + 1).trim() : trimmed;
  });

  if (parts.length !== FIELDS.length) {
    return { result: current, error: `Expected ${FIELDS.length} values, got ${parts.length}` };
  }

  const result = { ...current };
  for (let i = 0; i < FIELDS.length; i++) {
    const f = FIELDS[i];
    const n = parseFloat(parts[i]);
    if (isNaN(n)) return { result: current, error: `"${parts[i]}" is not a number (field: ${f.label})` };
    const clamped = Math.max(f.min, Math.min(f.max, n));
    const rounded = Math.round(clamped * 10 ** f.decimals) / 10 ** f.decimals;
    (result as Record<string, number>)[f.key] = rounded;
  }
  return { result, error: null };
}

export function CsvEditor({ options, onChange }: CsvEditorProps) {
  const [text, setText] = useState(() => optionsToCsv(options));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Keep textarea in sync when knobs change externally (only when not editing)
  useEffect(() => {
    if (!isFocused) {
      setText(optionsToCsv(options));
      setError(null);
    }
  }, [options, isFocused]);

  const handleApply = useCallback(() => {
    const { result, error: err } = csvToOptions(text, options);
    if (err) {
      setError(err);
    } else {
      setError(null);
      onChange(result);
    }
  }, [text, options, onChange]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleApply();
    }
  };

  return (
    <div className="mt-5 border-t border-[var(--light-cream)] pt-4">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-[var(--muted-gray)] mb-2">
        CSV Parameter Editor
      </div>

      <div className="flex flex-col gap-2">
        {/* Textarea with label: value format */}
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setError(null); }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          rows={4}
          spellCheck={false}
          className={[
            "w-full font-mono text-[11px] resize-none rounded-[6px] px-3 py-2.5 leading-relaxed",
            "bg-[var(--cream)] text-[var(--charcoal)] border",
            "focus:outline-none focus:ring-1 focus:ring-[var(--charcoal)]",
            "transition-all duration-150",
            error ? "border-red-400" : "border-[var(--light-cream)]",
          ].join(" ")}
        />

        {/* Error */}
        {error && (
          <div className="text-[11px] text-red-500 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
              <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleApply}
            className="flex-1 h-[30px] text-[12px] font-semibold rounded-[5px] bg-[var(--charcoal)] text-[var(--cream)] hover:opacity-80 active:scale-[0.98] transition-all"
          >
            Apply <span className="opacity-40 text-[10px] ml-1">Ctrl+Enter</span>
          </button>
          <button
            onClick={handleCopy}
            className="h-[30px] px-3 text-[12px] font-medium rounded-[5px] border border-[var(--light-cream)] text-[var(--charcoal)] hover:bg-[var(--light-cream)] active:scale-[0.98] transition-all flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
