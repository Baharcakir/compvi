import { useRef, useState } from "react";
import { Upload, CheckCircle, AlertCircle, RotateCcw } from "lucide-react";
import { useUpload } from "../hooks/useUpload";
import styles from "./VideoUpload.module.css";

const LABEL_COLORS = [
  "#22D3EE", "#818CF8", "#34D399", "#FB923C",
  "#F472B6", "#A78BFA", "#4ADE80", "#FACC15",
];

function getLabelColor(label) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
}

function summarizeResults(results) {
  const counts = {};
  for (const frame of results) {
    for (const det of frame.detections) {
      counts[det.label] = (counts[det.label] || 0) + 1;
    }
  }
  return counts;
}

export default function VideoUpload() {
  const fileInputRef = useRef(null);
  const [isDragover, setIsDragover] = useState(false);
  const {
    upload, reset, isUploading, progress,
    currentFrame, totalFrames, frameDetections,
    results, error,
  } = useUpload();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragover(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) upload(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragover(true); };
  const handleDragLeave = () => setIsDragover(false);

  return (
    <div className={styles.container}>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {/* Dropzone */}
      {!isUploading && !results && (
        <div
          className={`${styles.dropzone} ${isDragover ? styles.dragover : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          aria-label="Upload a video file"
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        >
          <span className={styles.dropzoneIcon}>
            <Upload size={44} strokeWidth={1.5} />
          </span>
          <p className={styles.dropzoneTitle}>Click or drag a video file here</p>
          <p className={styles.dropzoneHint}>Drop your video to start detection</p>
          <div className={styles.supportedFormats}>
            {["MP4", "WebM", "MOV"].map((f) => (
              <span key={f} className={styles.formatTag}>{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Processing */}
      {isUploading && (
        <div className={styles.progress}>
          <h2 className={styles.progressTitle}>Processing Video…</h2>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.progressStats}>
            <span>Frame</span>
            <span className={styles.progressPct}>{currentFrame}</span>
            <span>/</span>
            <span>{totalFrames || "—"}</span>
            <span>·</span>
            <span className={styles.progressPct}>{progress.toFixed(1)}%</span>
          </div>
          {frameDetections.length > 0 && (
            <span className={styles.currentDetections}>
              {frameDetections.map((d) => d.label).join(", ")}
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={styles.errorBox}>
          <AlertCircle size={16} strokeWidth={2} />
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <h2 className={styles.resultsTitle}>
              <span className={styles.successIcon}>
                <CheckCircle size={22} strokeWidth={2} />
              </span>
              Processing Complete
            </h2>
            <span className={styles.frameMeta}>
              <span className={styles.frameCount}>{results.length}</span> frames analyzed
            </span>
          </div>

          <div className={styles.resultsList}>
            {(() => {
              const counts = summarizeResults(results);
              const entries = Object.entries(counts);
              if (entries.length === 0) {
                return <p className={styles.noDetections}>No objects detected</p>;
              }
              return entries
                .sort((a, b) => b[1] - a[1])
                .map(([label, count]) => {
                  const color = getLabelColor(label);
                  return (
                    <div key={label} className={styles.resultRow}>
                      <div className={styles.resultLabel}>
                        <span
                          className={styles.resultDot}
                          style={{ background: color, boxShadow: `0 0 6px ${color}60` }}
                        />
                        <span className={styles.resultName}>{label}</span>
                      </div>
                      <span className={styles.resultCount}>{count} frames</span>
                    </div>
                  );
                });
            })()}
          </div>

          <div className={styles.resultsFooter}>
            <button className={styles.resetBtn} onClick={reset}>
              <RotateCcw size={15} strokeWidth={2} />
              Upload Another Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
