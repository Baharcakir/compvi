import { useCallback, useEffect, useRef, useState } from "react";

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return `${import.meta.env.VITE_WS_URL}/ws/detect`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/detect`;
};

const WS_URL = getWsUrl();
const PING_INTERVAL_MS = 8_000;

// FIX: lower default confidence to 0.15 to match the 0.10 used in test_webcam.py.
// The app was defaulting to 0.5 — the model would find the glass but discard it
// as below threshold, making it look like detection wasn't working at all.
const DEFAULT_CONFIDENCE = 0.15;

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export function useDetection(webcamRef) {
  const wsRef = useRef(null);
  const pingRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectDelayRef = useRef(RECONNECT_BASE_MS);
  const mountedRef = useRef(true);

  const [isConnected, setIsConnected] = useState(false);
  const [detections, setDetections] = useState([]);
  const [frameSize, setFrameSize] = useState(null);
  const [confidence, setConfidenceState] = useState(DEFAULT_CONFIDENCE);
  const [error, setError] = useState(null);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      console.log("[WS] Connected");
      setIsConnected(true);
      setError(null);
      reconnectDelayRef.current = RECONNECT_BASE_MS;

      // Sync confidence with backend immediately on connect
      ws.send(JSON.stringify({ type: "config", threshold: DEFAULT_CONFIDENCE }));

      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      console.log("[WS] Disconnected — reconnecting in", reconnectDelayRef.current, "ms");
      setIsConnected(false);
      clearInterval(pingRef.current);

      // FIX: unblock the webcam so it doesn't stall waiting for an ack
      // that will never come from the now-closed socket.
      webcamRef?.current?.setReady?.();

      // FIX: reconnect with exponential backoff — this is why the camera
      // stays dead in the original code. onclose fired and nothing reconnected.
      reconnectTimerRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * 2,
          RECONNECT_MAX_MS
        );
        connect();
      }, reconnectDelayRef.current);
    };

    ws.onerror = (e) => {
      console.error("[WS] Error:", e);
      setError("WebSocket connection failed — retrying…");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "error") {
          setError(data.detail);
          // Unblock even on errors so frames keep flowing
          webcamRef?.current?.setReady?.();
          return;
        }

        if (data.type === "ping" || data.type === "pong") {
          return;
        }

        if (data.type === "config_ack") {
          setConfidenceState(data.confidence);
          return;
        }

        if (data.type === "detection") {
          // FIX: this is the backpressure release. Webcam.jsx sets readyRef=false
          // before sending a frame and waits here. Only when we receive a detection
          // response do we allow the next frame to be captured and sent.
          // This keeps the WS buffer empty regardless of inference speed.
          webcamRef?.current?.setReady?.();

          if (data.frame_width && data.frame_height) {
            setFrameSize({ width: data.frame_width, height: data.frame_height });
          }

          setDetections((prev) => {
            const next = data.detections ?? [];
            if (prev.length === 0 && next.length === 0) return prev;
            return next;
          });
        }
      } catch (err) {
        console.error("[WS] Parse error:", err);
        webcamRef?.current?.setReady?.();
      }
    };
  }, [webcamRef]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearInterval(pingRef.current);
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendFrame = useCallback((blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(blob);
    }
  }, []);

  const setThreshold = useCallback((threshold) => {
    setConfidenceState(threshold);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "config", threshold }));
    }
  }, []);

  return {
    isConnected,
    detections,
    frameSize,
    confidence,
    error,
    sendFrame,
    setThreshold,
  };
}