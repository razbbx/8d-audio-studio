# 8D Audio Studio

Browser-based 8D spatial audio converter using Web Audio API. 100% client-side.

## Tech Stack

- **Framework:** Next.js 15 (App Router), TypeScript
- **Styling:** Tailwind CSS v4, CSS custom properties (cream/charcoal theme)
- **UI:** shadcn/ui (base-nova style), lucide-react icons
- **Audio:** Web Audio API (`OfflineAudioContext` for processing, `AudioContext` for live preview)
- **Encoding:** `@breezystack/lamejs` (MP3), custom WAV encoder
- **Export:** JSZip + file-saver for batch downloads

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — ESLint
- `npm run pages:build` — Build for Cloudflare Pages (via `@cloudflare/next-on-pages`)
- `npm run pages:deploy` — Build + deploy to Cloudflare Pages

## Architecture

- `src/app/page.tsx` — Main page (upload, controls, preview, results)
- `src/lib/audio-processor.ts` — Core audio engine: DSP graph builder, offline renderer, WAV encoder, live player
- `src/components/` — UI components (knobs, presets, uploader, scrubber, info panel)
- `src/components/ui/` — shadcn primitives (button, card, slider, knob, progress, etc.)

### Audio Processing Graph

Source → Crossover (LR4 @ 110Hz) → Reverb Send + Spatializer (HRTF 3D or Stereo) → M/S Width Processor → Limiter → Output

### Key Files

| File | Purpose |
|---|---|
| `SPEC.md` | Full product specification and implementation checklist |
| `src/lib/audio-processor.ts` | `processAudio()` (offline render), `LiveAudioPlayer` (live preview), `buildDSPGraph()` (Web Audio node wiring) |
| `src/app/page.tsx` | Main page state machine: file select → preview → process → play/download |

## Architecture Notes

- **OfflineAudioContext** renders faster than real-time (10–50× speedup)
- **HRTF mode** uses `PannerNode` with oscillator-driven XYZ orbit (no scheduled automation)
- **Stereo mode** uses `StereoPannerNode` + ITD/head shadowing
- **Presets:** Subtle, Standard, Intense
- **Theming:** CSS custom properties with light/dark mode via `.dark` class

## Project Status

See `SPEC.md` for the implementation checklist. Major items still open:
- Fix `audio-processor.ts`: confirmed using OfflineAudioContext + WAV encoder (done)
- Visual design is cream/charcoal theme (not the dark glassmorphism from SPEC)
