import { Mp3Encoder } from "@breezystack/lamejs";

export type ExportFormat = "wav" | "mp3";

// SpatialMode: 0 = Stereo (legacy L/R StereoPanner), 1 = HRTF 3D (full orbit)
export const SPATIAL_STEREO = 0;
export const SPATIAL_HRTF = 1;

export interface AudioOptions {
  panSpeed: number;
  panDepth: number;
  panCurve: number; // "Reality" — pinna/elevation notch intensity
  reverbAmount: number;
  reverbDecay: number;
  reverbPreDelay: number;
  spatialWidth: number;
  variationAmount: number;
  bassCenterAmount: number;
  airAmount: number;
  spatialMode: number; // 0 = Stereo, 1 = HRTF 3D
  elevationDepth: number; // 0-100 — vertical (top/bottom) tilt of the HRTF orbit
}

export const DEFAULTS: AudioOptions = {
  panSpeed: 0.25,
  panDepth: 0.9,
  panCurve: 100,
  reverbAmount: 35,
  reverbDecay: 2.5,
  reverbPreDelay: 18,
  spatialWidth: 70,
  variationAmount: 50,
  bassCenterAmount: 100,
  airAmount: 35,
  spatialMode: SPATIAL_HRTF,
  elevationDepth: 35,
};

const LR4_Q = 0.7071;
const CROSSOVER_HZ = 110;
const MAX_ITD = 0.00065;

const EARLY_L = [
  { ms: 0, g: 0.8 },
  { ms: 5.2, g: -0.64 },
  { ms: 10.1, g: 0.51 },
  { ms: 15.7, g: 0.41 },
  { ms: 22.3, g: -0.33 },
  { ms: 31.1, g: 0.26 },
];

const EARLY_R = [
  { ms: 1.1, g: -0.75 },
  { ms: 6.7, g: 0.6 },
  { ms: 12.3, g: -0.48 },
  { ms: 18.1, g: 0.38 },
  { ms: 25.4, g: 0.3 },
  { ms: 33.9, g: -0.24 },
];

const FDN_DELAYS_MS = [17.0, 29.0, 41.0, 53.0, 67.0, 79.0, 97.0, 113.0];

export function createRoomIR(
  sampleRate: number,
  decaySeconds: number,
  preDelayMs: number,
): AudioBuffer {
  const preDelaySamples = Math.floor((sampleRate * preDelayMs) / 1000);
  const diffuseSamples = Math.floor(sampleRate * decaySeconds);
  const total = preDelaySamples + diffuseSamples;

  const buffer = new AudioBuffer({ length: total, sampleRate, numberOfChannels: 2 });
  const leftData = buffer.getChannelData(0);
  const rightData = buffer.getChannelData(1);

  for (const tap of EARLY_L) {
    const si = preDelaySamples + Math.floor((sampleRate * tap.ms) / 1000);
    if (si < total) leftData[si] += tap.g;
  }
  for (const tap of EARLY_R) {
    const si = preDelaySamples + Math.floor((sampleRate * tap.ms) / 1000);
    if (si < total) rightData[si] += tap.g;
  }

  const N = 8;
  const delays = FDN_DELAYS_MS.map((ms) => Math.floor((sampleRate * ms) / 1000));
  const fdnBuffers = delays.map((d) => new Float32Array(d));
  const pointers = new Array(N).fill(0);

  const lpfCutoff = decaySeconds < 1.5 ? 4500 : 8000;
  const wc = (2 * Math.PI * lpfCutoff) / sampleRate;
  const lpfAlpha = 1 - Math.exp(-wc);
  const lpfStates = new Float32Array(N);

  const gBase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    gBase[i] = Math.pow(10, (-3 * delays[i]) / (sampleRate * decaySeconds));
  }

  const diffuseOnset = preDelaySamples + Math.floor(sampleRate * 0.05);

  for (let i = 0; i < total; i++) {
    const inSample = i === diffuseOnset ? 1.0 : 0.0;

    const dOut = new Float32Array(N);
    let sum = 0;
    for (let d = 0; d < N; d++) {
      dOut[d] = fdnBuffers[d][pointers[d]];
      sum += dOut[d];
    }

    const hSum = sum * (2 / N);

    let fdnOutL = 0;
    let fdnOutR = 0;

    for (let d = 0; d < N; d++) {
      let mixed = dOut[d] - hSum;
      mixed += inSample;

      lpfStates[d] = lpfStates[d] + lpfAlpha * (mixed - lpfStates[d]);
      fdnBuffers[d][pointers[d]] = lpfStates[d] * gBase[d];
      pointers[d] = (pointers[d] + 1) % delays[d];

      if (d % 2 === 0) fdnOutL += dOut[d];
      else fdnOutR += dOut[d];
    }

    leftData[i] += fdnOutL * 0.15;
    rightData[i] += fdnOutR * 0.15;
  }

  return buffer;
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const numSamples = buffer.length;
  const dataLen = numSamples * numChannels * (bitDepth / 8);
  const ab = new ArrayBuffer(44 + dataLen);
  const v = new DataView(ab);
  const ws = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };

  ws(0, "RIFF");
  v.setUint32(4, 36 + dataLen, true);
  ws(8, "WAVE");
  ws(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, numChannels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  v.setUint16(32, numChannels * (bitDepth / 8), true);
  v.setUint16(34, bitDepth, true);
  ws(36, "data");
  v.setUint32(40, dataLen, true);

  let offset = 44;
  const ch = Array.from({ length: numChannels }, (_, c) => buffer.getChannelData(c));
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, ch[c][i]));
      v.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return ab;
}

async function audioBufferToMp3(
  buffer: AudioBuffer,
  onProgress?: (pct: number) => void
): Promise<Uint8Array> {
  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  // Mp3Encoder(channels, sampleRate, kbps)
  const mp3encoder = new Mp3Encoder(numChannels, sampleRate, 192);
  const mp3Data: Uint8Array[] = [];

  const left = buffer.getChannelData(0);
  const right = numChannels > 1 ? buffer.getChannelData(1) : left;
  const BLOCK = 1152;
  const totalSamples = left.length;

  let lastReportedPct = 0;
  for (let i = 0; i < totalSamples; i += BLOCK) {
    const chunkSize = Math.min(BLOCK, totalSamples - i);
    const lChunk = new Int16Array(chunkSize);
    const rChunk = new Int16Array(chunkSize);

    for (let j = 0; j < chunkSize; j++) {
      const idx = i + j;
      lChunk[j] = Math.max(-0x8000, Math.min(0x7fff, left[idx] * 0x7fff));
      rChunk[j] = Math.max(-0x8000, Math.min(0x7fff, right[idx] * 0x7fff));
    }

    const buf: Uint8Array = mp3encoder.encodeBuffer(lChunk, rChunk);
    if (buf.length > 0) mp3Data.push(buf);

    const pct = Math.floor((i / totalSamples) * 100);
    if (pct > lastReportedPct) {
      lastReportedPct = pct;
      if (onProgress) {
        onProgress(pct);
      }
      if (pct % 3 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  const tail: Uint8Array = mp3encoder.flush();
  if (tail.length > 0) mp3Data.push(tail);

  const total = mp3Data.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const chunk of mp3Data) { out.set(chunk, off); off += chunk.length; }
  return out;
}

function createShadowCurve(): Float32Array {
  const n = 512;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    if (x <= 0) curve[i] = 0;
    else curve[i] = Math.pow(x, 2);
  }
  return curve;
}

// ─────────────────────────────────────────────────────────────────────────────
// HRTF 3D ORBIT — OSCILLATOR-DRIVEN (zero scheduled events)
// Drives a PannerNode (HRTF) positionX/Y/Z continuously with oscillators +
// WaveShapers so there are NO linearRamp automation events to schedule or
// reschedule. Knob changes are instant setTargetAtTime calls — fully
// responsive. Azimuth θ = panDepth·π·sin(ωt) covers front→right→back→left
// (full 360° at panDepth=1). elevationDepth tilts the orbital plane so the
// source also sweeps top↔bottom. variationAmount adds organic wobble.
// ─────────────────────────────────────────────────────────────────────────────

// WaveShaper curve: maps normalized input x∈[-1,1] → sin(π·x).
// Fed by (panDepth·sin(ωt) + wobble), this yields sin(π·panDepth·sin(ωt)).
const N_CURVE = 2048;
let _sineCurve: Float32Array | null = null;
let _cosineCurve: Float32Array | null = null;
function sineShaperCurve(): Float32Array {
  if (_sineCurve) return _sineCurve;
  const c = new Float32Array(N_CURVE);
  for (let i = 0; i < N_CURVE; i++) {
    const x = (i / (N_CURVE - 1)) * 2 - 1;
    c[i] = Math.sin(Math.PI * x);
  }
  _sineCurve = c;
  return c;
}
function cosineShaperCurve(): Float32Array {
  if (_cosineCurve) return _cosineCurve;
  const c = new Float32Array(N_CURVE);
  for (let i = 0; i < N_CURVE; i++) {
    const x = (i / (N_CURVE - 1)) * 2 - 1;
    c[i] = Math.cos(Math.PI * x);
  }
  _cosineCurve = c;
  return c;
}

function ensureListenerAtOrigin(ctx: BaseAudioContext) {
  const listener = ctx.listener;
  try {
    if (listener.positionX) {
      listener.positionX.value = 0;
      listener.positionY.value = 0;
      listener.positionZ.value = 0;
    } else {
      // Older API (Safari/older Chrome)
      (listener as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(0, 0, 0);
    }
  } catch {}
  try {
    if (listener.forwardX) {
      listener.forwardX.value = 0;
      listener.forwardY.value = 0;
      listener.forwardZ.value = -1;
      if (listener.upX) {
        listener.upX.value = 0;
        listener.upY.value = 1;
        listener.upZ.value = 0;
      }
    } else {
      (listener as unknown as { setOrientation: (fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) => void }).setOrientation(0, 0, -1, 0, 1, 0);
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// DSP GRAPH BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export interface DSPGraph {
  input: AudioNode;
  output: AudioNode;
  lfos: OscillatorNode[];
  convolver: ConvolverNode;
  spatialMode: number;
  updateOptions: (newOpts: AudioOptions, time: number) => void;
}

export function buildDSPGraph(
  ctx: BaseAudioContext,
  opts: AudioOptions,
  impulseBuffer: AudioBuffer,
): DSPGraph {
  const useHRTF = opts.spatialMode === SPATIAL_HRTF;
  const inputGain = ctx.createGain();

  // ── 2. LR4 CROSSOVER @ 110Hz (Bass Mono)
  const bassLP1 = ctx.createBiquadFilter();
  bassLP1.type = "lowpass"; bassLP1.frequency.value = CROSSOVER_HZ; bassLP1.Q.value = LR4_Q;
  const bassLP2 = ctx.createBiquadFilter();
  bassLP2.type = "lowpass"; bassLP2.frequency.value = CROSSOVER_HZ; bassLP2.Q.value = LR4_Q;

  const highHP1 = ctx.createBiquadFilter();
  highHP1.type = "highpass"; highHP1.frequency.value = CROSSOVER_HZ; highHP1.Q.value = LR4_Q;
  const highHP2 = ctx.createBiquadFilter();
  highHP2.type = "highpass"; highHP2.frequency.value = CROSSOVER_HZ; highHP2.Q.value = LR4_Q;

  inputGain.connect(bassLP1); bassLP1.connect(bassLP2);
  inputGain.connect(highHP1); highHP1.connect(highHP2);

  const bassCenterFrac = opts.bassCenterAmount / 100;
  const bassCenterGain = ctx.createGain(); bassCenterGain.gain.value = bassCenterFrac;
  const bassViaGain = ctx.createGain(); bassViaGain.gain.value = 1 - bassCenterFrac;
  bassLP2.connect(bassCenterGain);
  bassLP2.connect(bassViaGain);

  const dryHighBus = ctx.createGain();
  highHP2.connect(dryHighBus);
  bassViaGain.connect(dryHighBus);

  // ── 3. REVERB ENGINE (STATIC ROOM)
  const convolver = ctx.createConvolver();
  convolver.buffer = impulseBuffer;

  const airShelf = ctx.createBiquadFilter();
  airShelf.type = "highshelf";
  airShelf.frequency.value = 8000;
  airShelf.gain.value = (opts.airAmount / 100) * 10;

  const reverbSend = ctx.createGain();
  reverbSend.gain.value = opts.reverbAmount / 100;

  dryHighBus.connect(reverbSend);
  reverbSend.connect(convolver);
  convolver.connect(airShelf);

  // ── 4. SPATIALIZER (branches on HRTF vs Stereo) ─────────────────────────
  const realityIntensity = opts.panCurve / 100;
  const varFactor = opts.variationAmount / 100;

  // Elevation notch (pinna cue) — shared by both modes; in HRTF it adds a
  // subtle extra pinna coloration on top of the browser's HRTF.
  const elevLFO = ctx.createOscillator();
  elevLFO.type = "sine";
  elevLFO.frequency.value = opts.panSpeed * 0.23;

  const elevNotch = ctx.createBiquadFilter();
  elevNotch.type = "notch";
  elevNotch.Q.value = 2.0;
  const elevNotchMod = ctx.createGain();
  elevNotchMod.gain.value = 2000 * realityIntensity;
  elevNotch.frequency.value = 3000;
  elevLFO.connect(elevNotchMod);
  elevNotchMod.connect(elevNotch.frequency);

  dryHighBus.connect(elevNotch);

  // dryGain (dry/wet vs reverb) — fed by the spatializer output
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1 - opts.reverbAmount / 100;

  // ── 4a. HRTF 3D PATH — oscillator-driven orbit (zero scheduled events) ────
  // Azimuth signal:  panDepth·sin(ωt) + wobble  ∈ [-1,1]
  //   sineShaper  →  R·sin(π·azimuth)  →  positionX
  //   cosShaper   → -R·cos(π·azimuth)  →  positionZ
  //   cosShaper   →  R·cos(π·azimuth)·sin(elevTilt) → positionY (top/bottom)
  let hrtfPanner: PannerNode | null = null;
  let orbitLFO: OscillatorNode | null = null;
  let orbitWobble: OscillatorNode | null = null;
  let orbitAmpGain: GainNode | null = null;
  let orbitWobbleGain: GainNode | null = null;
  let orbitXGain: GainNode | null = null;
  let orbitZGain: GainNode | null = null;
  let orbitElevGain: GainNode | null = null;

  if (useHRTF) {
    ensureListenerAtOrigin(ctx);

    hrtfPanner = ctx.createPanner();
    hrtfPanner.panningModel = "HRTF";
    hrtfPanner.distanceModel = "inverse";
    hrtfPanner.refDistance = 1;
    hrtfPanner.maxDistance = 10000;
    hrtfPanner.rolloffFactor = 0; // direction-only; no distance attenuation
    hrtfPanner.coneInnerAngle = 360;
    hrtfPanner.coneOuterAngle = 360;
    hrtfPanner.coneOuterGain = 0;

    const R = 1 + opts.panDepth;
    const elevRad = (opts.elevationDepth / 100) * ((75 * Math.PI) / 180);

    // Primary azimuth oscillator: sin(ωt)
    orbitLFO = ctx.createOscillator();
    orbitLFO.type = "sine";
    orbitLFO.frequency.value = opts.panSpeed;
    // Amplitude = panDepth (so signal ∈ [-panDepth, panDepth] ⊆ [-1,1])
    orbitAmpGain = ctx.createGain();
    orbitAmpGain.gain.value = opts.panDepth * 0.85; // leave headroom for wobble
    orbitLFO.connect(orbitAmpGain);

    // Wobble oscillator: organic drift added to the azimuth signal
    orbitWobble = ctx.createOscillator();
    orbitWobble.type = "sine";
    orbitWobble.frequency.value = opts.panSpeed * 0.17;
    orbitWobbleGain = ctx.createGain();
    orbitWobbleGain.gain.value = opts.variationAmount / 100 * 0.15;
    orbitWobble.connect(orbitWobbleGain);

    // Sum junction: azimuth signal = panDepth·sin(ωt) + wobble
    const azimuthSum = ctx.createGain();
    azimuthSum.gain.value = 1;
    orbitAmpGain.connect(azimuthSum);
    orbitWobbleGain.connect(azimuthSum);

    // Sine shaper → positionX = R·sin(π·azimuth)
    const sinShaper = ctx.createWaveShaper();
    sinShaper.curve = sineShaperCurve() as unknown as Float32Array<ArrayBuffer>;
    azimuthSum.connect(sinShaper);
    orbitXGain = ctx.createGain();
    orbitXGain.gain.value = R;
    sinShaper.connect(orbitXGain);
    orbitXGain.connect(hrtfPanner.positionX);

    // Cosine shaper → positionZ = -R·cos(π·azimuth)  AND  positionY = R·cos(π·azimuth)·sin(elevTilt)
    const cosShaper = ctx.createWaveShaper();
    cosShaper.curve = cosineShaperCurve() as unknown as Float32Array<ArrayBuffer>;
    azimuthSum.connect(cosShaper);

    orbitZGain = ctx.createGain();
    orbitZGain.gain.value = -R;
    cosShaper.connect(orbitZGain);
    orbitZGain.connect(hrtfPanner.positionZ);

    orbitElevGain = ctx.createGain();
    orbitElevGain.gain.value = R * Math.sin(elevRad);
    cosShaper.connect(orbitElevGain);
    orbitElevGain.connect(hrtfPanner.positionY);

    elevNotch.connect(hrtfPanner);
    hrtfPanner.connect(dryGain);
  }

  // ── 4b. STEREO PATH (legacy L/R panner + manual ITD/head shadow) ─────────
  let panLFO: OscillatorNode | null = null;
  let lfoGain: GainNode | null = null;
  let wobble: OscillatorNode | null = null;
  let wobbleGain: GainNode | null = null;
  let channelMerger: ChannelMergerNode | null = null;
  let shadowModL: GainNode | null = null;
  let shadowModR: GainNode | null = null;
  let itdModL: GainNode | null = null;
  let itdModR: GainNode | null = null;
  let halfITD = MAX_ITD / 2;

  if (!useHRTF) {
    panLFO = ctx.createOscillator();
    panLFO.type = "sine";
    panLFO.frequency.value = opts.panSpeed;

    lfoGain = ctx.createGain();
    lfoGain.gain.value = opts.panDepth;
    panLFO.connect(lfoGain);

    wobble = ctx.createOscillator();
    wobble.type = "sine";
    wobble.frequency.value = opts.panSpeed * 0.17;
    wobbleGain = ctx.createGain();
    wobbleGain.gain.value = opts.panSpeed * 0.22 * varFactor;
    wobble.connect(wobbleGain);
    wobbleGain.connect(panLFO.frequency);

    const panner = ctx.createStereoPanner();
    lfoGain.connect(panner.pan);
    elevNotch.connect(panner);

    // ITD & HEAD SHADOWING
    halfITD = MAX_ITD / 2;
    const shadowL = ctx.createBiquadFilter(); shadowL.type = "lowpass"; shadowL.Q.value = 0.5; shadowL.frequency.value = 20000;
    const shadowR = ctx.createBiquadFilter(); shadowR.type = "lowpass"; shadowR.Q.value = 0.5; shadowR.frequency.value = 20000;

    const shadowCurve = createShadowCurve() as unknown as Float32Array<ArrayBuffer>;
    const shaperL = ctx.createWaveShaper(); shaperL.curve = shadowCurve;
    const shaperR = ctx.createWaveShaper(); shaperR.curve = shadowCurve;

    const invertR = ctx.createGain(); invertR.gain.value = -1;
    lfoGain.connect(shaperL);
    lfoGain.connect(invertR);
    invertR.connect(shaperR);

    shadowModL = ctx.createGain(); shadowModL.gain.value = -18500 * realityIntensity;
    shadowModR = ctx.createGain(); shadowModR.gain.value = -18500 * realityIntensity;
    shaperL.connect(shadowModL); shadowModL.connect(shadowL.frequency);
    shaperR.connect(shadowModR); shadowModR.connect(shadowR.frequency);

    const delayL = ctx.createDelay(MAX_ITD * 2); delayL.delayTime.value = halfITD;
    const delayR = ctx.createDelay(MAX_ITD * 2); delayR.delayTime.value = halfITD;

    itdModL = ctx.createGain(); itdModL.gain.value = halfITD * realityIntensity;
    itdModR = ctx.createGain(); itdModR.gain.value = -halfITD * realityIntensity;
    lfoGain.connect(itdModL); itdModL.connect(delayL.delayTime);
    lfoGain.connect(itdModR); itdModR.connect(delayR.delayTime);

    const channelSplitter = ctx.createChannelSplitter(2);
    channelMerger = ctx.createChannelMerger(2);

    panner.connect(channelSplitter);
    channelSplitter.connect(shadowL, 0); shadowL.connect(delayL); delayL.connect(channelMerger, 0, 0);
    channelSplitter.connect(shadowR, 1); shadowR.connect(delayR); delayR.connect(channelMerger, 0, 1);

    channelMerger.connect(dryGain);
  }

  // ── 6. MIX BUS & WIDENING
  const stereoMixBus = ctx.createGain();

  dryGain.connect(stereoMixBus);
  airShelf.connect(stereoMixBus);
  bassCenterGain.connect(stereoMixBus);

  const msSplit = ctx.createChannelSplitter(2);
  stereoMixBus.connect(msSplit);

  const midBus = ctx.createGain(); midBus.gain.value = 1.0;
  const midL = ctx.createGain(); midL.gain.value = 0.5;
  const midR = ctx.createGain(); midR.gain.value = 0.5;
  msSplit.connect(midL, 0); msSplit.connect(midR, 1);
  midL.connect(midBus); midR.connect(midBus);

  const sideBus = ctx.createGain(); sideBus.gain.value = 1.0;
  const sideL = ctx.createGain(); sideL.gain.value = 0.5;
  const sideR = ctx.createGain(); sideR.gain.value = -0.5;
  msSplit.connect(sideL, 0); msSplit.connect(sideR, 1);
  sideL.connect(sideBus); sideR.connect(sideBus);

  const sideHP = ctx.createBiquadFilter();
  sideHP.type = "highpass";
  sideHP.frequency.value = 200;
  sideBus.connect(sideHP);

  const sideShelf = ctx.createBiquadFilter();
  sideShelf.type = "highshelf";
  sideShelf.frequency.value = 2000;
  sideShelf.gain.value = (opts.spatialWidth / 100) * 4;
  sideHP.connect(sideShelf);

  const outL = ctx.createGain(); outL.gain.value = 1.0;
  const outR = ctx.createGain(); outR.gain.value = 1.0;

  const sideHighPos = ctx.createGain(); sideHighPos.gain.value = 1.0;
  const sideHighNeg = ctx.createGain(); sideHighNeg.gain.value = -1.0;
  sideShelf.connect(sideHighPos); sideShelf.connect(sideHighNeg);

  midBus.connect(outL); sideHighPos.connect(outL);
  midBus.connect(outR); sideHighNeg.connect(outR);

  const finalMerge = ctx.createChannelMerger(2);
  outL.connect(finalMerge, 0, 0);
  outR.connect(finalMerge, 0, 1);

  // ── 7. MASTER LIMITER
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.70;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.01;

  finalMerge.connect(masterGain);
  masterGain.connect(limiter);

  const outputGain = ctx.createGain();
  limiter.connect(outputGain);

  const updateOptions = (newOpts: AudioOptions, time: number) => {
    const smooth = 0.1; // 100ms smoothing

    const bcf = newOpts.bassCenterAmount / 100;
    bassCenterGain.gain.setTargetAtTime(bcf, time, smooth);
    bassViaGain.gain.setTargetAtTime(1 - bcf, time, smooth);

    reverbSend.gain.setTargetAtTime(newOpts.reverbAmount / 100, time, smooth);
    airShelf.gain.setTargetAtTime((newOpts.airAmount / 100) * 10, time, smooth);
    dryGain.gain.setTargetAtTime(1 - newOpts.reverbAmount / 100, time, smooth);

    const reality = newOpts.panCurve / 100;
    const varF = newOpts.variationAmount / 100;

    elevLFO.frequency.setTargetAtTime(newOpts.panSpeed * 0.23, time, smooth);
    elevNotchMod.gain.setTargetAtTime(2000 * reality, time, smooth);

    sideShelf.gain.setTargetAtTime((newOpts.spatialWidth / 100) * 4, time, smooth);

    if (useHRTF && hrtfPanner) {
      // Oscillator-driven orbit: all param changes are instant setTargetAtTime.
      // No automation events to reschedule — fully responsive to knob dragging.
      const R = 1 + newOpts.panDepth;
      const elevRad = (newOpts.elevationDepth / 100) * ((75 * Math.PI) / 180);
      if (orbitLFO) orbitLFO.frequency.setTargetAtTime(newOpts.panSpeed, time, smooth);
      if (orbitAmpGain) orbitAmpGain.gain.setTargetAtTime(newOpts.panDepth * 0.85, time, smooth);
      if (orbitWobble) orbitWobble.frequency.setTargetAtTime(newOpts.panSpeed * 0.17, time, smooth);
      if (orbitWobbleGain) orbitWobbleGain.gain.setTargetAtTime(varF * 0.15, time, smooth);
      if (orbitXGain) orbitXGain.gain.setTargetAtTime(R, time, smooth);
      if (orbitZGain) orbitZGain.gain.setTargetAtTime(-R, time, smooth);
      if (orbitElevGain) orbitElevGain.gain.setTargetAtTime(R * Math.sin(elevRad), time, smooth);
    } else {
      if (panLFO) panLFO.frequency.setTargetAtTime(newOpts.panSpeed, time, smooth);
      if (lfoGain) lfoGain.gain.setTargetAtTime(newOpts.panDepth, time, smooth);
      if (wobble) wobble.frequency.setTargetAtTime(newOpts.panSpeed * 0.17, time, smooth);
      if (wobbleGain) wobbleGain.gain.setTargetAtTime(newOpts.panSpeed * 0.22 * varF, time, smooth);
      if (shadowModL) shadowModL.gain.setTargetAtTime(-18500 * reality, time, smooth);
      if (shadowModR) shadowModR.gain.setTargetAtTime(-18500 * reality, time, smooth);
      if (itdModL) itdModL.gain.setTargetAtTime(halfITD * reality, time, smooth);
      if (itdModR) itdModR.gain.setTargetAtTime(-halfITD * reality, time, smooth);
    }
  };

  const lfos: OscillatorNode[] = [elevLFO];
  if (panLFO) lfos.push(panLFO);
  if (wobble) lfos.push(wobble);
  if (orbitLFO) lfos.push(orbitLFO);
  if (orbitWobble) lfos.push(orbitWobble);

  return {
    input: inputGain,
    output: outputGain,
    lfos,
    convolver,
    spatialMode: opts.spatialMode,
    updateOptions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE PROCESSOR
// ─────────────────────────────────────────────────────────────────────────────
export async function processAudio(
  file: File,
  options: Partial<AudioOptions> = {},
  format: ExportFormat = "mp3",
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const opts = { ...DEFAULTS, ...options };

  const arrayBuffer = await file.arrayBuffer();
  const decodeCtx = new AudioContext();
  let sourceBuffer: AudioBuffer;
  try {
    sourceBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
  } catch {
    decodeCtx.close();
    throw new Error("Could not decode audio.");
  }
  decodeCtx.close();

  const { sampleRate, length: totalLength } = sourceBuffer;
  const ctx = new OfflineAudioContext(2, totalLength, sampleRate);

  const source = ctx.createBufferSource();
  source.buffer = sourceBuffer;

  const impulseBuffer = createRoomIR(sampleRate, opts.reverbDecay, opts.reverbPreDelay);
  const dsp = buildDSPGraph(ctx, opts, impulseBuffer);
  source.connect(dsp.input);
  dsp.output.connect(ctx.destination);

  dsp.lfos.forEach((lfo) => lfo.start(0));
  source.start(0);

  // 50% progress dedicated to rendering, 50% to encoding
  let progressInterval: ReturnType<typeof setInterval> | null = null;
  if (onProgress) {
    onProgress(0);
    let simulatedProgress = 0;
    progressInterval = setInterval(() => {
      // Smoothly approach 49% using exponential steps
      simulatedProgress += (50 - simulatedProgress) * 0.15;
      onProgress(Math.min(49, simulatedProgress));
    }, 150);
  }

  let renderedBuffer: AudioBuffer;
  try {
    renderedBuffer = await ctx.startRendering();
  } finally {
    if (progressInterval !== null) {
      clearInterval(progressInterval);
    }
  }

  if (format === "wav") {
    if (onProgress) onProgress(100);
    const wavArrayBuffer = audioBufferToWav(renderedBuffer);
    return new Blob([wavArrayBuffer], { type: "audio/wav" });
  } else {
    // MP3
    const mp3Buffer = await audioBufferToMp3(renderedBuffer, (pct) => {
      if (onProgress) onProgress(50 + (pct * 0.5));
    });
    return new Blob([mp3Buffer.buffer as ArrayBuffer], { type: "audio/mpeg" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE AUDIO PLAYER
// ─────────────────────────────────────────────────────────────────────────────
export class LiveAudioPlayer {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private dsp: DSPGraph | null = null;
  private fadeNodes: AudioNode[] = [];
  
  public buffer: AudioBuffer | null = null;
  public currentOptions: AudioOptions;
  public isPlaying = false;
  
  private currentIR: AudioBuffer | null = null;
  private lastDecay = 0;
  private lastPreDelay = 0;
  private irDebounce: ReturnType<typeof setTimeout> | null = null;

  private startTime = 0;
  private pausedOffset = 0;

  constructor(initialOptions: AudioOptions = DEFAULTS) {
    this.currentOptions = initialOptions;
  }

  public async loadFile(file: File) {
    this.stop();
    const arrayBuffer = await file.arrayBuffer();
    const decodeCtx = new AudioContext();
    try {
      this.buffer = await decodeCtx.decodeAudioData(arrayBuffer);
    } catch {
      decodeCtx.close();
      throw new Error("Could not decode audio for live preview.");
    }
    decodeCtx.close();
  }

  public play(offset: number = this.pausedOffset) {
    if (!this.buffer || this.isPlaying) return;
    
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    if (!this.currentIR || this.lastDecay !== this.currentOptions.reverbDecay || this.lastPreDelay !== this.currentOptions.reverbPreDelay) {
      this.currentIR = createRoomIR(this.ctx.sampleRate, this.currentOptions.reverbDecay, this.currentOptions.reverbPreDelay);
      this.lastDecay = this.currentOptions.reverbDecay;
      this.lastPreDelay = this.currentOptions.reverbPreDelay;
    }

    // Rebuild the DSP graph if spatial mode changed while stopped/paused, or
    // if no graph exists yet.
    const needRebuild =
      !this.dsp ||
      this.dsp.spatialMode !== this.currentOptions.spatialMode;
    if (needRebuild) {
      if (this.dsp) {
        this.dsp.output.disconnect();
        this.dsp.input.disconnect();
        this.dsp.lfos.forEach((lfo) => { try { lfo.stop(); } catch {} });
      }
      this.dsp = buildDSPGraph(this.ctx, this.currentOptions, this.currentIR);
      this.dsp.output.connect(this.ctx.destination);
      this.dsp.lfos.forEach((lfo) => lfo.start(0));
    }

    const dsp = this.dsp!;
    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.loop = true;
    
    this.source.connect(dsp.input);
    this.source.start(0, offset);
    
    this.startTime = this.ctx.currentTime - offset;
    this.isPlaying = true;
  }

  public seek(offset: number) {
    this.pausedOffset = offset;
    
    if (!this.isPlaying || !this.buffer || !this.dsp || !this.ctx) {
      return;
    }

    const ctx = this.ctx;
    const FADE_TIME = 0.012; // 12ms crossfade — short enough to feel instant, long enough to kill clicks

    // Route the old source through a fade gain that stays IN the DSP chain so
    // the fade-out tail keeps its reverb/panning (no dry artifact). Disconnect
    // it from the main input first, then through the fade gain back into the
    // DSP input, and stop it after the fade.
    const fadeGain = ctx.createGain();
    fadeGain.gain.setValueAtTime(1, ctx.currentTime);
    fadeGain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_TIME);
    fadeGain.connect(this.dsp.input);

    if (this.source) {
      try { this.source.disconnect(); } catch {}
      this.source.connect(fadeGain);
      try { this.source.stop(ctx.currentTime + FADE_TIME); } catch {}
    }
    // Garbage-collect the fade node after it has fully ramped out.
    const fadeRef = fadeGain;
    const cleanup = setTimeout(() => {
      try { fadeRef.disconnect(); } catch {}
      this.fadeNodes = this.fadeNodes.filter((n) => n !== fadeRef);
    }, (FADE_TIME + 0.05) * 1000);
    this.fadeNodes.push(fadeRef);
    // Keep the timer reachable so it can't be GC'd before firing.
    void cleanup;

    // Start new source after the fade completes — still routed through DSP.
    const newSource = ctx.createBufferSource();
    newSource.buffer = this.buffer;
    newSource.loop = true;
    newSource.connect(this.dsp.input);
    newSource.start(ctx.currentTime + FADE_TIME, offset % this.buffer.duration);

    this.source = newSource;
    this.startTime = ctx.currentTime + FADE_TIME - offset;
  }

  public pause() {
    if (this.source) {
      try { this.source.stop(); } catch {}
      this.source.disconnect();
      this.source = null;
    }
    if (this.ctx && this.buffer) {
      this.pausedOffset = (this.ctx.currentTime - this.startTime) % this.buffer.duration;
    }
    this.isPlaying = false;
  }

  public stop() {
    this.pause();
    this.pausedOffset = 0;
    this.fadeNodes.forEach((n) => { try { n.disconnect(); } catch {} });
    this.fadeNodes = [];
    if (this.dsp) {
      this.dsp.output.disconnect();
      this.dsp.input.disconnect();
      this.dsp.lfos.forEach((lfo) => {
        try { lfo.stop(); } catch {}
      });
      this.dsp = null;
    }
  }

  public getCurrentTime(): number {
    if (!this.isPlaying || !this.ctx || !this.buffer) return this.pausedOffset;
    return (this.ctx.currentTime - this.startTime) % this.buffer.duration;
  }

  public getDuration(): number {
    return this.buffer ? this.buffer.duration : 0;
  }

  public updateOptions(opts: AudioOptions) {
    const prevOptions = this.currentOptions;
    this.currentOptions = opts;

    // Spatial mode switch requires a graph rebuild — defer to next play() if
    // stopped/paused, or rebuild live if currently playing.
    if (opts.spatialMode !== prevOptions.spatialMode) {
      if (this.isPlaying && this.ctx && this.buffer && this.dsp) {
        const resumeOffset = this.getCurrentTime();
        this.stop();
        this.currentOptions = opts;
        this.play(resumeOffset);
      }
      return;
    }

    // Apply param updates whenever a DSP graph exists (playing OR paused) so
    // resumed playback reflects the latest knob values.
    if (this.dsp && this.ctx) {
      this.dsp.updateOptions(opts, this.ctx.currentTime);
      
      if (opts.reverbDecay !== this.lastDecay || opts.reverbPreDelay !== this.lastPreDelay) {
        this.lastDecay = opts.reverbDecay;
        this.lastPreDelay = opts.reverbPreDelay;
        
        if (this.irDebounce) clearTimeout(this.irDebounce);
        this.irDebounce = setTimeout(() => {
          if (this.dsp && this.ctx) {
            this.currentIR = createRoomIR(this.ctx.sampleRate, opts.reverbDecay, opts.reverbPreDelay);
            this.dsp.convolver.buffer = this.currentIR;
          }
        }, 300);
      }
    }
  }

  public destroy() {
    this.stop();
    if (this.irDebounce) clearTimeout(this.irDebounce);
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.buffer = null;
    this.currentIR = null;
  }
}
