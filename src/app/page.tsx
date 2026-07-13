"use client";

import { useCallback, useRef, useState } from "react";
import { useEffect } from "react";
import { AudioControls } from "@/components/audio-controls";
import { CsvEditor } from "@/components/ui/csv-editor";
import { PresetSelector } from "@/components/preset-selector";
import { InfoPanel } from "@/components/info-panel";
import { CDScrubber } from "@/components/ui/cd-scrubber";
import { ProgressBar } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { DEFAULTS, processAudio, LiveAudioPlayer } from "@/lib/audio-processor";
import type { AudioOptions, ExportFormat } from "@/lib/audio-processor";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("mp3");
  const [dragging, setDragging] = useState(false);
  const [options, setOptions] = useState<AudioOptions>(DEFAULTS);
  const [activePreset, setActivePreset] = useState<string | null>("standard");

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [batchResults, setBatchResults] = useState<{name: string, url: string}[]>([]);
  const [error, setError] = useState<string>("");

  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackTimeStr, setPlaybackTimeStr] = useState("0:00");
  
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize live player
  useEffect(() => {
    playerRef.current = new LiveAudioPlayer();
    return () => {
      playerRef.current?.destroy();
    };
  }, []);

  // Handle file loading for preview (only for single file)
  useEffect(() => {
    if (files.length === 1 && playerRef.current) {
      setIsPreviewLoading(true);
      playerRef.current.loadFile(files[0]).then(() => {
        setIsPreviewLoading(false);
        setIsPlayingPreview(false);
      }).catch(() => {
        setIsPreviewLoading(false);
        setError("Could not load file for live preview.");
      });
    } else {
      playerRef.current?.stop();
      setIsPlayingPreview(false);
    }
  }, [files]);

  // Handle animation frame for progress tracking (throttled — only updates
  // state when values meaningfully change to avoid 60 re-renders/sec).
  const lastProgressRef = useRef(-1);
  const lastTimeStrRef = useRef("");
  useEffect(() => {
    const updateProgress = () => {
      if (playerRef.current) {
        const t = playerRef.current.getCurrentTime();
        const d = playerRef.current.getDuration();
        if (d > 0) {
          const p = t / d;
          // Only update progress state if it changed by >0.2% (avoids
          // re-rendering the whole page on every animation frame).
          if (Math.abs(p - lastProgressRef.current) > 0.002) {
            lastProgressRef.current = p;
            setPlaybackProgress(p);
          }
          const m = Math.floor(t / 60);
          const s = Math.floor(t % 60).toString().padStart(2, "0");
          const timeStr = `${m}:${s}`;
          if (timeStr !== lastTimeStrRef.current) {
            lastTimeStrRef.current = timeStr;
            setPlaybackTimeStr(timeStr);
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(updateProgress);
    };
    animFrameRef.current = requestAnimationFrame(updateProgress);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handleSeek = useCallback((p: number) => {
    if (playerRef.current) {
      const d = playerRef.current.getDuration();
      playerRef.current.seek(p * d);
      setPlaybackProgress(p);
      const t = p * d;
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60).toString().padStart(2, "0");
      setPlaybackTimeStr(`${m}:${s}`);
    }
  }, []);

  const togglePreview = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlayingPreview) {
      playerRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      playerRef.current.play();
      setIsPlayingPreview(true);
    }
  }, [isPlayingPreview]);

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFiles = useCallback((incoming: FileList | File[]) => {
    setError("");
    setFiles(Array.from(incoming));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files?.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) handleFiles(e.target.files);
      e.target.value = "";
    },
    [handleFiles],
  );

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleOptionsChange = useCallback((opts: AudioOptions) => {
    setOptions(opts);
    setActivePreset(null);
    playerRef.current?.updateOptions(opts);
  }, []);

  const handlePresetSelect = useCallback(
    (presetId: string, presetOptions: AudioOptions) => {
      setActivePreset(presetId);
      setOptions(presetOptions);
      playerRef.current?.updateOptions(presetOptions);
    },
    [],
  );

  // ── Convert ───────────────────────────────────────────────────────────────
  const handleConvert = useCallback(async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    setError("");
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
      setResultBlob(null);
    }
    batchResults.forEach(r => URL.revokeObjectURL(r.url));
    setBatchResults([]);

    try {
      if (files.length === 1) {
        // Single file processing
        const blob = await processAudio(files[0], options, exportFormat, (pct) => setProgress(pct));
        const url = URL.createObjectURL(blob);
        setResultBlob(blob);
        setResultUrl(url);
      } else {
        // Batch processing
        const zip = new JSZip();
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const blob = await processAudio(f, options, exportFormat, (pct) => {
            // Overall progress formula
            setProgress((i / files.length) * 100 + (pct / files.length));
          });
          const newName = f.name.replace(/\.[^.]+$/, "") + `-8d.${exportFormat}`;
          zip.file(newName, blob);
          const objUrl = URL.createObjectURL(blob);
          setBatchResults(prev => [...prev, { name: newName, url: objUrl }]);
        }
        setProgress(100);
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `8D_Batch_${files.length}_files.zip`);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.",
      );
    } finally {
      setIsProcessing(false);
    }
  }, [files, options, resultUrl, exportFormat, batchResults]);

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!resultUrl || files.length === 0) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = files[0].name.replace(/\.[^.]+$/, "") + `-8d.${exportFormat}`;
    a.click();
  }, [resultUrl, files, exportFormat]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-[var(--charcoal-4)] items-center justify-center sm:p-6 md:p-12">
      <div className="w-full max-w-[1300px] flex flex-col flex-1 sm:flex-none sm:h-[85vh] sm:max-h-[850px] sm:min-h-[600px] shadow-2xl sm:rounded-[16px] border-0 sm:border border-[var(--light-cream)] bg-[var(--cream)] overflow-hidden">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--light-cream)] shrink-0 gap-3">
        <div className="font-semibold text-[15px] tracking-tight text-[var(--charcoal)]">
          8D Audio Studio
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <span className="hidden sm:inline text-[12px] text-[var(--muted-gray)] mr-1">
            Browser · Local · Private
          </span>
          {/* Format Selector */}
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            disabled={isProcessing}
            className="h-[34px] px-2 mr-1 rounded-[6px] text-[12px] font-semibold bg-[var(--light-cream)] border border-[var(--light-cream)] text-[var(--charcoal)] focus:outline-none focus:ring-1 focus:ring-[var(--charcoal)]"
          >
            <option className="bg-[var(--cream)] text-[var(--charcoal)]" value="mp3">MP3</option>
            <option className="bg-[var(--cream)] text-[var(--charcoal)]" value="wav">WAV</option>
          </select>
          {/* Generate button in header */}
          <button
            onClick={handleConvert}
            disabled={files.length === 0 || isProcessing}
            className="h-[34px] px-4 rounded-[6px] text-[13px] font-semibold flex items-center gap-2 transition-all btn-primary disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="hidden sm:inline">Processing</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {files.length > 1 ? `Generate Batch (${files.length})` : "Generate 8D"}
              </>
            )}
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* ── Left: Upload Panel ─────────────────────────────────────────── */}
        <div
          className="md:w-[280px] shrink-0 border-b md:border-b-0 md:border-r border-[var(--light-cream)] flex flex-col"
        >
          {/* Drop zone */}
          <div
            onClick={() => files.length === 0 && inputRef.current?.click()}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={handleDrop}
            className={`
              flex-1 flex flex-col items-center justify-center gap-3 px-6 py-10
              transition-colors duration-200
              ${files.length === 0 ? "cursor-pointer" : ""}
              ${dragging ? "bg-[var(--charcoal-4)]" : ""}
            `}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac"
              onChange={handleInputChange}
              className="hidden"
            />

            {files.length > 0 ? (
              /* File state */
              <div className="w-full flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-[var(--charcoal)] flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--off-white)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-[var(--charcoal)] truncate">
                      {files.length === 1 ? files[0].name : `${files.length} Files Selected`}
                    </div>
                    <div className="text-[12px] text-[var(--muted-gray)] mt-0.5">
                      {files.length === 1 ? formatBytes(files[0].size) : 'Batch Mode'}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFiles([]); }}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--charcoal-4)] transition-colors text-[var(--muted-gray)] hover:text-[var(--charcoal)]"
                    aria-label="Remove files"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div className="flex flex-col items-center gap-4 mt-2 mb-2">
                  {files.length === 1 ? (
                    <>
                      <CDScrubber
                        isPlaying={isPlayingPreview && !isPreviewLoading}
                        progress={playbackProgress}
                        onSeek={handleSeek}
                        onTogglePlay={togglePreview}
                        disabled={isPreviewLoading}
                      />
                      <div className="text-[14px] font-mono font-medium text-[var(--charcoal)] tracking-wider">
                        {playbackTimeStr}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6 px-4 border border-dashed border-[var(--light-cream)] rounded-[8px] bg-[var(--charcoal-4)]">
                      <span className="text-[13px] text-[var(--charcoal)] font-medium block">
                        Batch Processing Mode
                      </span>
                      <span className="text-[11px] text-[var(--muted-gray)] mt-1 block">
                        Audio preview is disabled.
                      </span>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                    className="btn-ghost w-full py-2 rounded-[6px] text-[13px] font-medium mt-2"
                  >
                    Change Audio Files
                  </button>
                </div>
              </div>
            ) : (
              /* Empty state */
              <div className="text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full border border-[var(--light-cream)] flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted-gray)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <div className="text-[14px] font-medium text-[var(--charcoal)]">
                    {dragging ? "Drop to upload" : "Upload audio or folder"}
                  </div>
                  <div className="text-[12px] text-[var(--muted-gray)] mt-1">
                    MP3, WAV, FLAC, OGG
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tip */}
          <div className="px-5 py-3 border-t border-[var(--light-cream)]">
            <p className="text-[11px] text-[var(--muted-gray)] leading-relaxed">
              🎧 Use headphones for the full spatial effect.
            </p>
          </div>
        </div>

        {/* ── Middle: Controls ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-auto md:border-r border-[var(--light-cream)]">
          {/* Knob controls area */}
          <div className="flex-1 px-5 py-6">
            {/* Presets */}
            <div className="mb-6">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-[var(--muted-gray)] mb-3">
                Presets
              </div>
              <PresetSelector
                activePreset={activePreset}
                onSelect={handlePresetSelect}
                disabled={false}
              />
            </div>

            {/* All knobs */}
            <AudioControls
              options={options}
              onChange={handleOptionsChange}
              disabled={false}
            />

            <p className="text-[11px] text-[var(--muted-gray)] mt-5">
              Drag knobs up/down · Double-click to reset · Arrow keys work too
            </p>

            <CsvEditor options={options} onChange={handleOptionsChange} />
          </div>
        </div>

        {/* ── Right: Info Panel ───────────────────────────────────────────── */}
        <div className="md:w-[280px] shrink-0 flex flex-col">
          <InfoPanel />
        </div>
      </main>

      {/* ── Bottom Bar: progress + results only ───────────────────────────── */}
      <footer className="shrink-0 border-t border-[var(--light-cream)]">
        {error && (
          <div className="px-5 py-2 bg-red-50 text-red-700 text-[12px] border-b border-red-100">
            {error}
          </div>
        )}

        {/* Progress bar */}
        {isProcessing && (
          <div className="flex items-center gap-4 px-5 py-3">
            <div className="flex-1 flex flex-col gap-1">
              <ProgressBar value={progress} />
              <div className="text-[11px] text-[var(--muted-gray)]">
                {progress < 1 ? "Initializing…" : progress >= 100 ? "Encoding…" : `${Math.round(progress)}%`}
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {resultUrl && resultBlob && !isProcessing && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-5 py-3">
            <audio src={resultUrl} controls className="flex-1 w-full sm:w-auto min-w-[200px] h-[36px]" />
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={handleDownload}
                className="btn-primary h-[36px] flex-1 sm:flex-none px-4 rounded-[6px] text-[13px] font-medium flex items-center justify-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {exportFormat.toUpperCase()}
              </button>
              <button
                onClick={() => { if (resultUrl) URL.revokeObjectURL(resultUrl); setResultUrl(null); setResultBlob(null); }}
                className="btn-ghost h-[36px] px-3 rounded-[6px] text-[13px] font-medium shrink-0"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Status hint when idle */}
        {!isProcessing && !resultUrl && batchResults.length === 0 && (
          <div className="px-5 py-3">
            <span className="text-[13px] text-[var(--muted-gray)]">
              {files.length === 0 ? "Upload a file to get started" : "Ready — hit Generate above"}
            </span>
          </div>
        )}

        {/* Batch Results Individual Downloads */}
        {!isProcessing && batchResults.length > 0 && (
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--charcoal)]">
                Batch Processed ({batchResults.length} files)
              </span>
              <button
                onClick={() => {
                  batchResults.forEach(r => URL.revokeObjectURL(r.url));
                  setBatchResults([]);
                }}
                className="text-[12px] text-[var(--muted-gray)] hover:text-red-500 font-medium transition-colors"
              >
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 overflow-y-auto max-h-[150px] pr-2 custom-scrollbar">
              {batchResults.map((res, i) => (
                <a
                  key={i}
                  href={res.url}
                  download={res.name}
                  className="flex items-center gap-2 p-2 rounded-[6px] border border-[var(--light-cream)] bg-[var(--charcoal-4)] hover:bg-[var(--light-cream)] transition-colors group text-decoration-none"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--charcoal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span className="text-[12px] font-medium text-[var(--charcoal)] truncate flex-1">
                    {res.name}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </footer>
    </div>
  </div>
  );
}
