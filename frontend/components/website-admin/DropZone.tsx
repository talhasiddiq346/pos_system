"use client";
import { useRef, useState, DragEvent } from "react";

const MAX_SIZE_MB = 8;

export default function DropZone({
  file,
  onFile,
  label,
  uploading,
  uploadLabel,
  onUpload,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  label: string;
  uploading: boolean;
  uploadLabel: string;
  onUpload: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [sizeError, setSizeError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function acceptFile(candidate: File | null | undefined) {
    if (!candidate) return;
    if (!candidate.type.startsWith("image/")) {
      setSizeError("Only image files are allowed");
      return;
    }
    if (candidate.size > MAX_SIZE_MB * 1024 * 1024) {
      setSizeError(`Image is too large — max ${MAX_SIZE_MB}MB (this file is ${(candidate.size / (1024 * 1024)).toFixed(1)}MB)`);
      return;
    }
    setSizeError("");
    onFile(candidate);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? "border-[#2F7D6B] bg-[#E6F2EF]" : "border-[#D0D3CB] hover:border-[#B9BEB5] bg-[#FAFAF8]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => acceptFile(e.target.files?.[0])}
          className="hidden"
        />
        <p className="text-2xl mb-1">📁</p>
        <p className="text-sm text-[#494D46]">
          {file ? (
            <span className="font-medium text-[#1B1D1E]">{file.name}</span>
          ) : (
            <>
              <span className="font-medium text-[#2F7D6B]">Click to browse</span> or drag an image here — {label}
            </>
          )}
        </p>
      </div>

      {sizeError && <p className="text-xs text-[#B3402F]">⚠ {sizeError}</p>}

      <button
        onClick={onUpload}
        disabled={!file || uploading}
        className="text-sm px-4 py-1.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? "Uploading..." : uploadLabel}
      </button>
    </div>
  );
}
