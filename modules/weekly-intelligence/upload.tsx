import React, { useState, useRef } from "react";
import { UploadCloud, CheckCircle, FileX, Loader2 } from "lucide-react";
import { parseNSECSV, mergeOptionChains } from "./parser";
import { MergedDailyData } from "./types";

interface UploadProps {
  onDataReady: (data: MergedDailyData[]) => void;
}

export const UploadPanel: React.FC<UploadProps> = ({ onDataReady }) => {
  const [ceFile, setCeFile] = useState<File | null>(null);
  const [peFile, setPeFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ceInputRef = useRef<HTMLInputElement>(null);
  const peInputRef = useRef<HTMLInputElement>(null);

  const handleProcess = async () => {
    if (!ceFile || !peFile) {
      setError("Please upload both CE and PE CSV files.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const ceData = await parseNSECSV(ceFile);
      const peData = await parseNSECSV(peFile);
      const merged = mergeOptionChains(ceData, peData);
      
      if (merged.length === 0) {
        throw new Error("No valid data found after merging. Check if files match NSE format.");
      }
      
      onDataReady(merged);
    } catch (err: any) {
      setError(err.message || "Failed to process files");
    } finally {
      setIsProcessing(false);
    }
  };

  const UploadBox = ({ title, file, setFile, inputRef }: any) => (
    <div 
      style={{
        border: file ? '2px solid #22c55e' : '2px dashed #4b5563',
        borderRadius: '12px',
        padding: '2rem',
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: file ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.02)',
        transition: 'all 0.3s ease',
        flex: 1
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input 
        type="file" 
        accept=".csv" 
        ref={inputRef} 
        style={{ display: 'none' }} 
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
          }
        }}
      />
      {file ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={40} color="#22c55e" />
          <h3 style={{ margin: 0, color: '#22c55e' }}>{title} Loaded</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>{file.name}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <UploadCloud size={40} color="#9ca3af" />
          <h3 style={{ margin: 0, color: '#fff' }}>Upload {title} CSV</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>Click or drag file here</p>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', backgroundColor: '#1e2130', borderRadius: '16px', border: '1px solid #2d3142' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: '#fff', marginBottom: '0.5rem' }}>Initialize Weekly Intelligence Lab</h2>
        <p style={{ color: '#9ca3af', margin: 0 }}>Upload historical NSE Option Chain data to generate probability outlooks.</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <UploadBox title="Call Options (CE)" file={ceFile} setFile={setCeFile} inputRef={ceInputRef} />
        <UploadBox title="Put Options (PE)" file={peFile} setFile={setPeFile} inputRef={peInputRef} />
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileX size={20} />
          <span>{error}</span>
        </div>
      )}

      <button 
        onClick={handleProcess}
        disabled={isProcessing || !ceFile || !peFile}
        style={{
          width: '100%',
          padding: '1rem',
          backgroundColor: (!ceFile || !peFile) ? '#374151' : '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '1.1rem',
          fontWeight: 'bold',
          cursor: (!ceFile || !peFile || isProcessing) ? 'not-allowed' : 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          transition: 'all 0.3s ease'
        }}
      >
        {isProcessing ? <Loader2 className="animate-spin" size={24} /> : "Run Analytical Engine"}
      </button>
    </div>
  );
};
