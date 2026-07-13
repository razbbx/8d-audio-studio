"use client";

import { useCallback, useRef, useState } from "react";

interface AudioUploaderProps {
  onFileSelect: (file: File) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
  "audio/x-m4a",
];

const MAX_SIZE_MB = 200;

export function AudioUploader({
  onFileSelect,
  onError,
  disabled,
}: AudioUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        onError?.(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
        return;
      }
      const isAudio =
        file.type.startsWith("audio/") ||
        ACCEPTED_TYPES.includes(file.type) ||
        /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file.name);
      if (!isAudio) {
        onError?.("Please upload an audio file (MP3, WAV, OGG, FLAC, M4A).");
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect, onError],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile],
  );

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`
        lovable-card relative p-12 text-center cursor-pointer transition-colors duration-200
        ${dragging ? "border-gray-400 bg-[rgba(28,28,28,0.03)]" : "hover:border-gray-300"}
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}
      style={{ borderStyle: "dashed" }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac"
        onChange={handleChange}
        className="hidden"
        aria-label="Upload audio file"
      />

      <div className="flex flex-col items-center gap-2">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--charcoal-40)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <div className="font-semibold text-[16px] text-[var(--charcoal)]">
          {dragging ? "Drop file here" : "Upload audio file"}
        </div>
        <div className="text-[14px] text-[var(--muted-gray)]">
          Click to browse or drag & drop (MP3, WAV, FLAC, OGG).
        </div>
      </div>
    </div>
  );
}
