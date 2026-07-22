import React, { useRef } from "react";
import { Upload, RotateCcw } from "lucide-react";

interface DataUploaderProps {
  onUpload: (files: FileList) => void;
  onReset: () => void;
  isProcessing: boolean;
}

export default function DataUploader({ onUpload, onReset, isProcessing }: DataUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
    }
  };

  return (
    <div className="flex gap-4">
      <input
        type="file"
        multiple
        accept=".csv"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="flex items-center gap-2 px-4 py-2 bg-[#1e2333] hover:bg-[#252b3d] text-white rounded-lg transition-colors border border-[var(--border-color)] disabled:opacity-50"
      >
        <Upload size={18} />
        {isProcessing ? "Processing..." : "Upload CSVs"}
      </button>

      <button
        onClick={onReset}
        disabled={isProcessing}
        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors border border-red-500/20 disabled:opacity-50"
      >
        <RotateCcw size={18} />
        Reset
      </button>
    </div>
  );
}
