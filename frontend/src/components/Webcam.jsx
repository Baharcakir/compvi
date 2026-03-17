import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

const Webcam = forwardRef(function Webcam({ onFrame, width = 640, height = 480 }, ref) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  // FIX: backpressure flag — only send a new frame once the previous one has
  // been acknowledged by the backend (useDetection sets this back to true via
  // the onFrameAck callback). Without this, frames pile up in the WebSocket
  // send buffer faster than inference can drain it. When the buffer fills the
  // browser silently drops the connection — this is why the camera "closes".
  const readyRef = useRef(true);

  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
    // Expose a method so useDetection can signal that a response arrived
    setReady: () => { readyRef.current = true; },
  }));

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width, height, facingMode: "environment" },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to access camera:", err);
      }
    }
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [width, height]);

  useEffect(() => {
    if (!onFrame) return;

    const captureFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== 4) return;

      // FIX: backpressure check — skip this frame if the last one hasn't been
      // processed yet. This keeps the WS buffer empty and the connection alive.
      if (!readyRef.current) return;

      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // Mark as busy before sending — setReady() unblocks us when the response arrives
      readyRef.current = false;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            onFrame(blob);
          } else {
            // If blob creation fails, unblock immediately so we don't stall forever
            readyRef.current = true;
          }
        },
        "image/jpeg",
        // FIX: raise from 0.8 to 0.95 — JPEG at 80% smears the sharp transparent
        // edges and specular highlights that YOLO uses to identify glass objects.
        // test_webcam.py feeds raw frames; the app must match that quality as closely
        // as possible to get the same detections.
        0.95
      );
    };

    // 10 FPS cap — but effective rate is throttled by backpressure above
    intervalRef.current = setInterval(captureFrame, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [onFrame]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", maxWidth: width }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </>
  );
});

export default Webcam;