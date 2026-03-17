import { ScanSearch, Webcam, FileVideo } from "lucide-react";
import styles from "./Header.module.css";

export default function Header({ mode, onModeChange, isConnected, showStatus }) {
  return (
    <header className={styles.header}>
      {/* Brand */}
      <div className={styles.brand}>
        <span className={styles.brandIcon}>
          <ScanSearch size={22} strokeWidth={1.8} />
        </span>
        <div className={styles.brandText}>
          <span className={styles.brandName}>YOLO Vision</span>
          <span className={styles.brandSub}>Object Detection</span>
        </div>
      </div>

      {/* Mode tabs */}
      <nav className={styles.tabs} aria-label="Mode">
        <button
          className={`${styles.tab} ${mode === "webcam" ? styles.active : ""}`}
          onClick={() => onModeChange("webcam")}
          aria-pressed={mode === "webcam"}
        >
          <span className={styles.tabIcon}>
            <Webcam size={15} strokeWidth={2} />
          </span>
          <span>Live Webcam</span>
        </button>
        <button
          className={`${styles.tab} ${mode === "upload" ? styles.active : ""}`}
          onClick={() => onModeChange("upload")}
          aria-pressed={mode === "upload"}
        >
          <span className={styles.tabIcon}>
            <FileVideo size={15} strokeWidth={2} />
          </span>
          <span>Upload Video</span>
        </button>
      </nav>

      {/* Status badge */}
      {showStatus ? (
        <div
          className={`${styles.statusPill} ${isConnected ? styles.connected : styles.disconnected}`}
          aria-label={isConnected ? "Connected to detection server" : "Disconnected"}
        >
          <span className={`${styles.dot} ${isConnected ? styles.dotConnected : styles.dotDisconnected}`} />
          {isConnected ? "Live" : "Offline"}
        </div>
      ) : (
        <div style={{ width: 72 }} />
      )}
    </header>
  );
}
