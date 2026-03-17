import { useEffect, useRef } from "react";

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
];

function getColor(label) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Canvas({ detections, frameSize, videoElement }) {
  const canvasRef = useRef(null);

  // FIX: Keep a stable ref to detections so the rAF loop always reads the
  // latest value WITHOUT needing detections in the useEffect dependency array.
  // Previously, detections was in the dep array, so every new detection result
  // spawned a brand-new rAF loop without cancelling the previous one —
  // after a few seconds there were dozens of competing loops thrashing the DOM.
  const detectionsRef = useRef(detections);
  useEffect(() => {
    detectionsRef.current = detections;
  }, [detections]);

  // FIX: frameSize ref — same pattern, keeps the draw loop stable
  const frameSizeRef = useRef(frameSize);
  useEffect(() => {
    frameSizeRef.current = frameSize;
  }, [frameSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoElement) return;

    const ctx = canvas.getContext("2d");
    let rafId = null;

    const draw = () => {
      // Always queue the next frame first so the loop continues even if we
      // bail out early (e.g. video not ready yet).
      rafId = requestAnimationFrame(draw);

      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      if (!videoWidth || !videoHeight) return;

      // Match canvas size to the video element's rendered size on screen
      const rect = videoElement.getBoundingClientRect();
      if (canvas.width !== rect.width)  canvas.width  = rect.width;
      if (canvas.height !== rect.height) canvas.height = rect.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentDetections = detectionsRef.current;
      if (!currentDetections?.length) return;

      // FIX: use the frame dimensions from the backend response when available.
      // The backend runs YOLO on the raw frame, so its bbox pixel coordinates
      // are relative to that frame's size. If we scale to videoWidth/videoHeight
      // instead, we get a mismatch on devices where the browser reports the
      // native camera resolution rather than the constrained capture size.
      const fs = frameSizeRef.current;
      const srcW = fs?.width  ?? videoWidth;
      const srcH = fs?.height ?? videoHeight;

      const scaleX = rect.width  / srcW;
      const scaleY = rect.height / srcH;

      currentDetections.forEach((det) => {
        const [x1, y1, x2, y2] = det.bbox;
        const color = getColor(det.label);

        const sx1 = x1 * scaleX;
        const sy1 = y1 * scaleY;
        const sw  = (x2 - x1) * scaleX;
        const sh  = (y2 - y1) * scaleY;

        // Bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx1, sy1, sw, sh);

        // Label background
        const label = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
        ctx.font = "14px sans-serif";
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = color;
        ctx.fillRect(sx1, sy1 - 20, textWidth + 8, 20);

        // Label text
        ctx.fillStyle = "#000";
        ctx.fillText(label, sx1 + 4, sy1 - 5);
      });
    };

    // FIX: single rAF loop started once. The detectionsRef / frameSizeRef
    // pattern above keeps it up-to-date without restarting the loop.
    draw();

    // FIX: always cancel the current loop when the effect re-runs or unmounts.
    // Without this cancellation, each re-render stacks another loop on top.
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };

    // Intentionally NOT including detections or frameSize here — they are
    // read through refs. Only restart the loop if the canvas or video element
    // itself changes (e.g. switching cameras).
  }, [videoElement]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    />
  );
}