# 🎧 8D Audio Studio

8D Audio Studio is a professional, high-performance, and entirely browser-based spatial audio generator. It converts standard stereo tracks into immersive, rotating **8D Spatial Audio** with real-time reactive previews, professional acoustics parameters, batch processing support, and high-quality MP3/WAV export.

Everything is processed **locally inside your browser**—no server uploads, no privacy compromises.

---

## ✨ Features

### 🎛️ Acoustic & Spatial Control
- **Auto-Panning Orbit:** Customize the speed, orbital depth, and path variance (adds natural wobble and velocity drift).
- **Reality Cues (HRTF Shadowing):** Psychoacoustic height (elevation) modeling and high-frequency acoustic shadowing (simulates sound passing behind the head).
- **Sub-Bass Anchoring:** Keep sub-bass frequencies anchored in the center to prevent phase cancellation, woofer pumping, or disorientation on headphones.
- **Dynamic Acoustics (Reverb):** High-fidelity room impulse response simulation. Control Room Size (Decay), Wall Distance (Pre-delay), and High-Frequency brightness (Air).
- **Stereo Image Widening:** Expand the side channels using Mid-Side spatial widening.

### 💿 Responsive & Immersive CD Scrubber
- Rotates dynamically while playing.
- Features intuitive **rotational scrubbing** (clockwise to seek forward, counter-clockwise to seek backward).
- Automatically halts mobile scrolling while interacting to ensure a smooth, uncompromised touch interface.

### 📊 CSV Live Configurations
- A persistent, high-contrast CSV data area representing all parameters (`Speed: 0.20, Depth: 0.85...`).
- Allows power users to quickly copy, paste, or tweak values in bulk.

### 📦 High-Performance Batch Processing
- Drag and drop or upload multiple files at once.
- Deactivates real-time previews in batch mode to allocate 100% of CPU power to background processing.
- Automatically generates a combined `.zip` archive once all tracks finish rendering.
- Displays lightweight individual download buttons for each processed track.

### 🚀 Asynchronous Thread-Safe MP3 Export
- Processes files chunk-by-chunk using a non-blocking event loop.
- Avoids page freezing or browser thread locks during conversion.
- Features a smooth progress bar transitioning accurately from **0-50% (spatial rendering)** to **50-100% (MP3 compilation)**.

---

## 🛠️ Technology Stack

- **Framework:** Next.js (App Router) + React + TypeScript
- **Styling:** Vanilla CSS variables + TailwindCSS compat layers for glassmorphic presets.
- **Audio Processing:** Web Audio API (`OfflineAudioContext` for rendering, `ConvolverNode` for room impulse response, `AudioContext` for live player).
- **MP3 Encoder:** `@breezystack/lamejs` (modern fork optimized for Webpack/NextJS bundling).
- **File Archiving:** `jszip` + `file-saver`.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to experience the studio.

### 3. Build for Production
```bash
npm run build
```

---

## 🎨 Premium Theme Support
- Default theme is configured to boot directly into a sleek **Dark Mode** for maximum focus and visual comfort.
- Features polished glassmorphic selectors, responsive knob controls, and theme-adaptive high-contrast selection dropdowns.
