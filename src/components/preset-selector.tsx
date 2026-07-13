"use client";

import type { AudioOptions } from "@/lib/audio-processor";
import { SPATIAL_HRTF, SPATIAL_STEREO } from "@/lib/audio-processor";

interface PresetSelectorProps {
  activePreset: string | null;
  onSelect: (preset: string, options: AudioOptions) => void;
  disabled?: boolean;
}

const PRESETS: Array<{
  id: string;
  label: string;
  options: AudioOptions;
}> = [
  {
    id: "developer",
    label: "Developer's Preset",
    options: {
      panSpeed: 0.15,
      panDepth: 0.84,
      panCurve: 54,
      bassCenterAmount: 100,
      variationAmount: 100,
      reverbAmount: 44,
      reverbDecay: 2.6,
      reverbPreDelay: 27,
      airAmount: 49,
      spatialWidth: 64,
      spatialMode: SPATIAL_HRTF,
      elevationDepth: 30,
    },
  },
  {
    id: "cinematic",
    label: "Cinematic",
    options: {
      panSpeed: 0.08,
      panDepth: 0.85,
      panCurve: 50,
      reverbAmount: 80,
      reverbDecay: 5.0,
      reverbPreDelay: 50,
      spatialWidth: 100,
      variationAmount: 60,
      bassCenterAmount: 100,
      airAmount: 75,
      spatialMode: SPATIAL_HRTF,
      elevationDepth: 55,
    },
  },
  {
    id: "concert-hall",
    label: "Concert Hall",
    options: {
      panSpeed: 0.1,
      panDepth: 0.8,
      panCurve: 60,
      reverbAmount: 60,
      reverbDecay: 4.5,
      reverbPreDelay: 55,
      spatialWidth: 80,
      variationAmount: 40,
      bassCenterAmount: 100,
      airAmount: 85,
      spatialMode: SPATIAL_HRTF,
      elevationDepth: 20,
    },
  },
  {
    id: "float",
    label: "Floating",
    options: {
      panSpeed: 0.12,
      panDepth: 0.5,
      panCurve: 20,
      reverbAmount: 90,
      reverbDecay: 3.5,
      reverbPreDelay: 25,
      spatialWidth: 100,
      variationAmount: 100,
      bassCenterAmount: 80,
      airAmount: 95,
      spatialMode: SPATIAL_HRTF,
      elevationDepth: 75,
    },
  },
  {
    id: "subtle",
    label: "Subtle",
    options: {
      panSpeed: 0.15,
      panDepth: 0.6,
      panCurve: 30,
      reverbAmount: 20,
      reverbDecay: 1.5,
      reverbPreDelay: 15,
      spatialWidth: 40,
      variationAmount: 20,
      bassCenterAmount: 100,
      airAmount: 25,
      spatialMode: SPATIAL_HRTF,
      elevationDepth: 10,
    },
  },
  {
    id: "standard",
    label: "Standard",
    options: {
      panSpeed: 0.25,
      panDepth: 0.9,
      panCurve: 70,
      reverbAmount: 35,
      reverbDecay: 2.5,
      reverbPreDelay: 18,
      spatialWidth: 70,
      variationAmount: 50,
      bassCenterAmount: 100,
      airAmount: 35,
      spatialMode: SPATIAL_HRTF,
      elevationDepth: 35,
    },
  },
  {
    id: "club",
    label: "Nightclub",
    options: {
      panSpeed: 0.3,
      panDepth: 0.85,
      panCurve: 80,
      reverbAmount: 40,
      reverbDecay: 0.6,
      reverbPreDelay: 5,
      spatialWidth: 60,
      variationAmount: 30,
      bassCenterAmount: 100,
      airAmount: 20,
      spatialMode: SPATIAL_HRTF,
      elevationDepth: 15,
    },
  },
  {
    id: "lofi-room",
    label: "Lo-Fi Room",
    options: {
      panSpeed: 0.35,
      panDepth: 0.75,
      panCurve: 40,
      reverbAmount: 45,
      reverbDecay: 0.8,
      reverbPreDelay: 12,
      spatialWidth: 30,
      variationAmount: 80,
      bassCenterAmount: 100,
      airAmount: 5,
      spatialMode: SPATIAL_STEREO,
      elevationDepth: 0,
    },
  },
  {
    id: "intense",
    label: "Intense",
    options: {
      panSpeed: 0.5,
      panDepth: 1.0,
      panCurve: 100,
      reverbAmount: 60,
      reverbDecay: 2.2,
      reverbPreDelay: 45,
      spatialWidth: 90,
      variationAmount: 80,
      bassCenterAmount: 100,
      airAmount: 70,
      spatialMode: SPATIAL_HRTF,
      elevationDepth: 65,
    },
  },
  {
    id: "claustrophobia",
    label: "Claustrophobia",
    options: {
      panSpeed: 0.8,
      panDepth: 1.0,
      panCurve: 100,
      reverbAmount: 15,
      reverbDecay: 0.5,
      reverbPreDelay: 2,
      spatialWidth: 30,
      variationAmount: 90,
      bassCenterAmount: 100,
      airAmount: 0,
      spatialMode: SPATIAL_HRTF,
      elevationDepth: 5,
    },
  },
  {
    id: "centrifuge",
    label: "Centrifuge",
    options: {
      panSpeed: 1.5,
      panDepth: 1.0,
      panCurve: 90,
      reverbAmount: 25,
      reverbDecay: 0.3,
      reverbPreDelay: 5,
      spatialWidth: 50,
      variationAmount: 10,
      bassCenterAmount: 100,
      airAmount: 40,
      spatialMode: SPATIAL_STEREO,
      elevationDepth: 0,
    },
  },
  {
    id: "sphere",
    label: "3D Sphere",
    options: {
      panSpeed: 0.18,
      panDepth: 1.0,
      panCurve: 80,
      reverbAmount: 50,
      reverbDecay: 3.0,
      reverbPreDelay: 30,
      spatialWidth: 85,
      variationAmount: 70,
      bassCenterAmount: 100,
      airAmount: 60,
      spatialMode: SPATIAL_HRTF,
      elevationDepth: 90,
    },
  },
  {
    id: "helicopter",
    label: "Helicopter",
    options: {
      panSpeed: 0.6,
      panDepth: 0.9,
      panCurve: 95,
      reverbAmount: 30,
      reverbDecay: 0.8,
      reverbPreDelay: 8,
      spatialWidth: 60,
      variationAmount: 60,
      bassCenterAmount: 90,
      airAmount: 50,
      spatialMode: SPATIAL_HRTF,
      elevationDepth: 100,
    },
  },
];

export function PresetSelector({
  activePreset,
  onSelect,
  disabled,
}: PresetSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((preset, index) => {
        const isActive = activePreset === preset.id;
        
        if (preset.id === "developer") {
          return (
            <button
              key={preset.id}
              id={`preset-${preset.id}`}
              onClick={() => !disabled && onSelect(preset.id, preset.options)}
              disabled={disabled}
              className={`
                px-5 py-1.5 text-[13px] rounded-full font-bold transition-all duration-200 border-2
                border-[var(--charcoal)] text-[var(--cream)]
                bg-[var(--charcoal)] hover:opacity-80 hover:scale-105
                ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                ${isActive ? "ring-2 ring-offset-2 ring-[var(--charcoal)] ring-offset-[var(--cream)]" : ""}
              `}
            >
              ✨ {preset.label}
            </button>
          );
        }

        // Dynamically compute color from green (140) to red (0)
        // Adjust index since developer is at index 0
        const stdIndex = index - 1;
        const hue = 140 - (stdIndex / (PRESETS.length - 2)) * 140; 
        const baseColor = `hsl(${hue}, 45%, 52%)`;
        const activeBg = `hsl(${hue}, 45%, 52%)`;
        
        return (
          <button
            key={preset.id}
            id={`preset-${preset.id}`}
            onClick={() => !disabled && onSelect(preset.id, preset.options)}
            disabled={disabled}
            style={{
              borderColor: baseColor,
              backgroundColor: isActive ? activeBg : "transparent",
              color: isActive ? "#fff" : baseColor,
            }}
            className={`
              px-4 py-1.5 text-[13px] rounded-full font-semibold transition-all duration-200 border-[1.5px]
              ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}
            `}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
