import { SlidersHorizontal } from "lucide-react";
import styles from "./ConfidenceSlider.module.css";

export default function ConfidenceSlider({ value, onChange }) {
  const pct = ((value - 0.1) / (0.9 - 0.1)) * 100;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.label}>
          <span className={styles.labelIcon}>
            <SlidersHorizontal size={15} strokeWidth={2} />
          </span>
          Confidence
        </span>
        <span className={styles.value}>{(value * 100).toFixed(0)}%</span>
      </div>

      <div className={styles.sliderWrapper}>
        <div className={styles.sliderTrack}>
          <div className={styles.sliderFill} style={{ width: `${pct}%` }} />
          <input
            className={styles.slider}
            type="range"
            min="0.1"
            max="0.9"
            step="0.05"
            value={value}
            onChange={onChange}
            aria-label="Confidence threshold"
            aria-valuemin={10}
            aria-valuemax={90}
            aria-valuenow={Math.round(value * 100)}
          />
        </div>
        <div className={styles.ticks}>
          <span className={styles.tick}>10%</span>
          <span className={styles.tick}>50%</span>
          <span className={styles.tick}>90%</span>
        </div>
      </div>
    </div>
  );
}
