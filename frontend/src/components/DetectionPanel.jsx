import { Focus } from "lucide-react";
import styles from "./DetectionPanel.module.css";

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

export default function DetectionPanel({ detections }) {
  return (
    <div className={styles.panel} role="region" aria-label="Live detections">
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <span className={styles.titleIcon}>
            <Focus size={15} strokeWidth={2} />
          </span>
          Detections
        </div>
        <span className={styles.countBadge}>{detections.length}</span>
      </div>

      <div className={styles.list}>
        {detections.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <Focus size={28} strokeWidth={1.5} />
            </span>
            No objects detected
          </div>
        ) : (
          detections.map((det, i) => {
            const color = getLabelColor(det.label);
            return (
              <div key={i} className={styles.detectionItem}>
                <div className={styles.labelRow}>
                  <span
                    className={styles.colorDot}
                    style={{ background: color, boxShadow: `0 0 6px ${color}60` }}
                  />
                  <span className={styles.labelText}>{det.label}</span>
                </div>
                <span className={styles.confidence}>
                  {(det.confidence * 100).toFixed(0)}%
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
