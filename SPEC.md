# 8D Audio Converter — Full App Specification

## What This App Does

A **browser-only** web app that lets users upload any MP3 (or WAV/OGG/FLAC) file, apply real-time 8D spatial audio effects using the Web Audio API, **preview the result live in the browser**, and download the processed file.

> **8D audio** is an audio effect where sound appears to rotate around your head in 3D space. It is achieved by combining:
> - **Auto-panning** — sine-wave LFO that continuously moves audio from left ear to right ear
> - **Convolution reverb** — adds a sense of physical space / room ambience
> - **Stereo widening** — inter-channel delay/haas effect to push channels apart

All processing happens **100% client-side** using the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API). No server, no upload.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Already set up in the project |
| Language | **TypeScript** | Already configured |
| Styling | **Tailwind CSS v4** | Already in `package.json` |
| UI Kit | **shadcn/ui** (via `components.json`) | Already installed |
| Audio Engine | **Web Audio API** (browser native) | Zero dependencies needed |
| Encoding | **MediaRecorder API** | Used to capture processed audio |
| Icons | **lucide-react** | Already in `package.json` |
| Font | **Inter** from Google Fonts | Clean, modern, readable |

---

## Project File Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout, font, metadata
│   ├── globals.css         # Tailwind base + custom CSS variables
│   ├── page.tsx            # Main page — wires together all components
│   └── favicon.ico
├── components/
│   ├── ui/                 # shadcn components (button, card, slider, label, progress)
│   ├── audio-uploader.tsx  # Drag-and-drop / click-to-upload zone
│   ├── audio-controls.tsx  # Effect sliders (pan speed, depth, reverb, width)
│   ├── audio-player.tsx    # Live preview audio player with waveform visualization
│   └── preset-selector.tsx # One-click effect presets (Subtle / Standard / Intense)
└── lib/
    ├── audio-processor.ts  # Core Web Audio API processing logic
    └── utils.ts            # cn() helper
```

---

## Core Feature: Audio Processing (`src/lib/audio-processor.ts`)

### What it must do

1. Accept a `File` object (MP3/WAV/OGG/FLAC)
2. Decode it with `AudioContext.decodeAudioData()`
3. Build a Web Audio processing graph (see below)
4. **Render offline** using `OfflineAudioContext` for speed (not real-time `MediaRecorder`)
5. Encode the rendered `AudioBuffer` to WAV using a custom PCM encoder
6. Return a `Blob` for download

### Why OfflineAudioContext (not MediaRecorder)

The current implementation uses `MediaRecorder` which:
- Processes audio in **real-time** (a 4-minute song takes 4 minutes)
- Exports to `audio/webm` (not `wav` despite the filename)
- Cannot show accurate progress percentage
- Loses quality due to lossy codec

`OfflineAudioContext` renders audio **faster than real-time** (typically 10–50× faster), gives you raw PCM samples, and allows encoding to proper WAV.

### Audio Processing Graph

```
[BufferSourceNode]
        │
        ├──────────────────────────────────────────────────┐
        │                                                  │
        ▼                                                  ▼
[DryGainNode]                                    [StereoPannerNode]  ◄── [LFO Oscillator]
        │                                                  │               (sine wave, panSpeed Hz)
        │                                                  │               [LfoGainNode] (panDepth)
        │                                          ┌───────┴────────┐
        │                                          │                │
        │                                   [ConvolverNode]   [WetGainNode]
        │                                   (reverb IR)            │
        │                                          │                │
        └──────────────────────────────────────────┴────────────────┘
                                                   │
                                            [MasterGainNode]
                                                   │
                                      [OfflineAudioContext.destination]
```

#### LFO (Auto-pan)
- `OscillatorNode` type `"sine"`, frequency = `panSpeed` (0.05–2.0 Hz)
- Connected via `GainNode` (value = `panDepth` 0.0–1.0) to `StereoPannerNode.pan`
- This makes pan oscillate between -1 and +1 at the chosen speed

#### Reverb (Convolution)
- Generate a synthetic impulse response: `N = sampleRate × reverbDecay` samples
- Each sample: `noise × exp(-t × decayRate)` where `decayRate` controls tail length
- `ConvolverNode.buffer` = this IR
- Mix: `dryGain = 1 - reverbAmount/100`, `wetGain = reverbAmount/100`

#### Stereo Widening (Haas Effect)
- Split signal into L/R via `ChannelSplitterNode`
- Delay R channel by `spatialWidth/100 × 0.035` seconds (0 – 35ms)
- Recombine via `ChannelMergerNode`
- This pushes the stereo image wider

### AudioOptions Interface

```typescript
export interface AudioOptions {
  panSpeed: number;    // 0.05 – 2.0 Hz (how fast sound rotates)
  panDepth: number;    // 0.0 – 1.0 (how wide the panning sweeps)
  reverbAmount: number; // 0 – 100 (% wet reverb)
  reverbDecay: number;  // 0.5 – 5.0 seconds (reverb tail length)
  spatialWidth: number; // 0 – 100 (stereo widening %)
}

export const DEFAULTS: AudioOptions = {
  panSpeed: 0.25,
  panDepth: 0.9,
  reverbAmount: 35,
  reverbDecay: 2.5,
  spatialWidth: 70,
};
```

### WAV Encoder

After `OfflineAudioContext.startRendering()` returns an `AudioBuffer`:

```typescript
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  // 1. Get PCM data from each channel
  // 2. Interleave L/R samples
  // 3. Clamp to [-1, 1] and convert to Int16
  // 4. Write WAV header (RIFF, fmt, data chunks)
  // 5. Return ArrayBuffer
}
```

The WAV header format:
- `RIFF` chunk: 4 bytes "RIFF" + 4-byte file size + 4 bytes "WAVE"
- `fmt ` chunk: PCM format (1), 2 channels, sampleRate, byteRate, blockAlign, 16-bit depth
- `data` chunk: 4 bytes "data" + 4-byte data length + raw Int16 samples

### Progress Reporting

`OfflineAudioContext` does not natively support progress. Use a workaround:
- Schedule a `setInterval` that polls `offlineCtx.currentTime / totalDuration * 100`
- Clear interval when rendering resolves

---

## Component Specifications

### `src/app/page.tsx` — Main Page

**State:**
- `file: File | null` — uploaded audio file
- `options: AudioOptions` — current effect settings
- `isProcessing: boolean` — conversion in progress
- `progress: number` — 0–100
- `resultUrl: string | null` — object URL of processed blob
- `resultBlob: Blob | null` — processed WAV blob
- `error: string` — error message
- `activePreset: string | null` — which preset is selected

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Header: Logo + title + "Privacy: 100% local"│
├─────────────────────────────────────────────┤
│                                             │
│  Hero: "Turn any track into 8D audio"       │
│  Subtitle: short description                │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  AudioUploader (drag & drop zone)   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [if file selected]                         │
│  File info row (icon + name + size + Remove)│
│                                             │
│  PresetSelector (Subtle | Standard | Intense)│
│                                             │
│  AudioControls (5 sliders)                  │
│                                             │
│  [Convert to 8D Audio] button               │
│                                             │
│  [if processing] Progress bar               │
│                                             │
│  [if resultUrl]                             │
│  ┌─────────────────────────────────────┐    │
│  │  AudioPlayer (native <audio> tag)   │    │
│  │  [Download WAV] button              │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

**Key behaviors:**
- After successful processing, **do NOT auto-download**. Show the audio player first.
- Provide a separate "Download" button.
- If user changes settings after a result exists, clear `resultUrl` to avoid confusion.
- Show `error` in a red banner below the controls.

---

### `src/components/audio-uploader.tsx`

**Accepts:** `MP3, WAV, OGG, FLAC, M4A` (`audio/*`)

**UI states:**
1. **Idle:** Dashed border box with upload icon, "Drag & drop your audio file here" text, "or click to browse" subtext
2. **Drag-over:** Border turns solid accent color, background tints
3. **File selected:** Shows file icon, filename, file size — but this info is shown in the parent, so the uploader resets to idle after selection

**Implementation:**
```tsx
// Events to handle:
onDragEnter, onDragOver, onDragLeave, onDrop  // for drag-and-drop
onClick -> inputRef.current.click()            // for click-to-browse
onChange (on hidden <input type="file">)       // file selected via dialog

// Validation:
// Reject files larger than 200MB
// Reject non-audio MIME types
// Call onError(message) prop for validation errors
```

**Props:**
```typescript
interface AudioUploaderProps {
  onFileSelect: (file: File) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}
```

---

### `src/components/audio-controls.tsx`

Five sliders using shadcn `<Slider>` component. Each slider row:
```
Label (bold)      [current value display]
Description (muted, smaller)
[────────────────●──────────────] (slider)
```

**Sliders:**

| Label | Key | Min | Max | Step | Display |
|---|---|---|---|---|---|
| Pan Speed | `panSpeed` | 0.05 | 2.0 | 0.05 | `0.25 Hz` |
| Pan Depth | `panDepth` | 0.0 | 1.0 | 0.05 | `90%` |
| Reverb Amount | `reverbAmount` | 0 | 100 | 1 | `35%` |
| Reverb Decay | `reverbDecay` | 0.5 | 5.0 | 0.1 | `2.5s` |
| Spatial Width | `spatialWidth` | 0 | 100 | 1 | `70%` |

**Props:**
```typescript
interface AudioControlsProps {
  options: AudioOptions;
  onChange: (options: AudioOptions) => void;
  disabled?: boolean;
}
```

---

### `src/components/preset-selector.tsx`

Three clickable preset buttons that set all 5 sliders at once:

| Preset | panSpeed | panDepth | reverbAmount | reverbDecay | spatialWidth |
|---|---|---|---|---|---|
| **Subtle** | 0.15 | 0.6 | 20 | 1.5 | 40 |
| **Standard** | 0.25 | 0.9 | 35 | 2.5 | 70 |
| **Intense** | 0.5 | 1.0 | 60 | 4.0 | 90 |

**UI:** Pill-style buttons in a row, active preset has filled background.

**Props:**
```typescript
interface PresetSelectorProps {
  activePreset: string | null;
  onSelect: (preset: string, options: AudioOptions) => void;
  disabled?: boolean;
}
```

---

### Audio Player (inside `page.tsx` result section)

Use the native HTML `<audio>` element with `controls`:
```tsx
<audio src={resultUrl} controls className="w-full" />
```

Style the container:
- Section heading "Your 8D Audio is Ready 🎧"
- The `<audio>` player
- File size info (e.g., "12.4 MB WAV")
- "Download WAV" button (primary style)
- "Process Again" / "Try Different Settings" button (secondary)

---

## Design System

### Visual Theme: Dark Glassmorphism

The app should look **premium and immersive** — matching the 8D audio aesthetic of depth and spatiality.

**Color Palette:**
```css
/* Background: deep dark purple-black gradient */
--bg-from: hsl(240, 30%, 6%);
--bg-to: hsl(270, 25%, 10%);

/* Card surfaces: translucent glass */
--card-bg: hsla(240, 20%, 15%, 0.6);
--card-border: hsla(240, 50%, 60%, 0.15);

/* Primary accent: vibrant purple-violet */
--accent: hsl(265, 85%, 65%);
--accent-hover: hsl(265, 85%, 70%);

/* Text */
--text-primary: hsl(240, 20%, 95%);
--text-muted: hsl(240, 10%, 60%);

/* Success / result */
--success: hsl(150, 60%, 50%);
```

**Glassmorphism card style:**
```css
background: var(--card-bg);
backdrop-filter: blur(16px);
border: 1px solid var(--card-border);
border-radius: 16px;
```

**Typography:** Use `Inter` from Google Fonts

**Animations:**
- Upload zone: subtle pulsing glow on drag-over
- Processing: animated gradient progress bar, rotating icon
- Result appear: fade-in + slide-up transition
- Sliders: smooth thumb movement

---

## App Layout (`src/app/layout.tsx`)

```tsx
// SEO metadata
export const metadata = {
  title: "8D Audio Converter — Free Browser-Based Spatial Audio Tool",
  description: "Convert any MP3 to immersive 8D audio with auto-panning, reverb, and spatial widening. 100% free, no upload required — processes entirely in your browser.",
};

// Body: full-height dark gradient background
// Import Inter from next/font/google
```

---

## Globals CSS (`src/app/globals.css`)

```css
@import "tailwindcss";

/* Dark background gradient on <html> and <body> */
html, body {
  min-height: 100%;
  background: linear-gradient(135deg, hsl(240, 30%, 6%) 0%, hsl(270, 25%, 10%) 100%);
  background-attachment: fixed;
  color: hsl(240, 20%, 95%);
  font-family: 'Inter', sans-serif;
}

/* Glassmorphism card utility */
.glass-card {
  background: hsla(240, 20%, 15%, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid hsla(240, 50%, 60%, 0.15);
  border-radius: 16px;
}

/* Animated gradient for progress bar */
.progress-gradient {
  background: linear-gradient(90deg, hsl(265, 85%, 50%), hsl(300, 80%, 60%), hsl(265, 85%, 50%));
  background-size: 200% 100%;
  animation: shimmer 1.5s linear infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Upload zone pulse */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 hsla(265, 85%, 65%, 0); }
  50% { box-shadow: 0 0 20px 4px hsla(265, 85%, 65%, 0.3); }
}
.upload-drag-active {
  animation: pulse-glow 1s ease-in-out infinite;
}
```

---

## Error Handling

| Scenario | Error Message |
|---|---|
| File > 200MB | "File too large. Maximum size is 200MB." |
| Non-audio file | "Please upload an audio file (MP3, WAV, OGG, FLAC)." |
| Decode failure | "Could not decode audio. The file may be corrupted or an unsupported format." |
| Browser no support | "Your browser doesn't support the Web Audio API. Please use Chrome, Firefox, or Edge." |
| Processing crash | "An unexpected error occurred during processing. Please try again." |

---

## What the Current App Gets Wrong

These are the known issues in the existing implementation that **must be fixed**:

1. **Uses `MediaRecorder` instead of `OfflineAudioContext`**
   - Real-time processing is too slow (4-min song = 4-min wait)
   - Fix: Use `OfflineAudioContext` for offline rendering

2. **Output is WebM not WAV**
   - The file is named `.wav` but is actually `audio/webm` inside
   - Fix: Encode raw PCM samples to proper WAV format after `OfflineAudioContext.startRendering()`

3. **Auto-downloads on convert**
   - `a.click()` fires immediately without user consent
   - Fix: Show audio player first, provide separate "Download" button

4. **No preview**
   - User can't hear the result before downloading
   - Fix: Use `URL.createObjectURL(blob)` and feed it to `<audio src=...>`

5. **No presets**
   - Users have no easy starting point
   - Fix: Add Subtle / Standard / Intense preset buttons

6. **Basic visual design**
   - Looks like a default shadcn/ui scaffold
   - Fix: Apply dark glassmorphism theme with animations and proper typography

7. **Progress bar is inaccurate**
   - `audioCtx.currentTime` during `MediaRecorder` session is unreliable
   - Fix: With `OfflineAudioContext`, hook into the `oncomplete` event and simulate progress via `setInterval` polling `offlineCtx.currentTime`

---

## Implementation Checklist

- [ ] Fix `audio-processor.ts`: replace `AudioContext + MediaRecorder` with `OfflineAudioContext + WAV encoder`
- [ ] Add WAV encoder function (pure TypeScript, no library needed)
- [ ] Fix stereo widening to use `ChannelSplitter` + `ChannelMerger` + `DelayNode`
- [ ] Update `page.tsx`: remove auto-download, add audio player in result section
- [ ] Create `preset-selector.tsx` with 3 presets
- [ ] Update `audio-uploader.tsx`: add drag-over glow animation, support more formats, add file size validation
- [ ] Update `globals.css`: dark gradient background, glassmorphism card styles, animations
- [ ] Update `layout.tsx`: add Inter font, update SEO metadata
- [ ] Update `page.tsx`: apply glass-card styling, add fade-in animations
- [ ] Test with Chrome and Firefox (MediaRecorder codec fallbacks differ)

---

## Acceptance Criteria

The app is complete when:

1. ✅ User can drag-and-drop or click-browse to upload an MP3
2. ✅ User can select a preset or tune sliders manually
3. ✅ "Convert to 8D" processes the audio and shows a real progress bar
4. ✅ Processing is faster than real-time (use OfflineAudioContext)
5. ✅ After processing, user can **play the 8D result** in the browser
6. ✅ User can download the result as a proper **WAV file**
7. ✅ The downloaded file is actually playable and sounds different (panning effect is audible)
8. ✅ The UI looks premium with dark glassmorphism design
9. ✅ All processing is local — no network requests for audio data
10. ✅ Error messages are shown for invalid files
