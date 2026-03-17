import { useCallback, useState } from "react";

// Use environment variable or construct from current host
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Fallback: use current origin (works with nginx proxy)
  return window.location.origin;
};

const API_URL = getApiUrl();

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [frameDetections, setFrameDetections] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const upload = useCallback(async (file) => {
    setIsUploading(true);
    setProgress(0);
    setCurrentFrame(0);
    setTotalFrames(0);
    setFrameDetections([]);
    setResults(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            console.log("[Upload] SSE:", data);

            switch (data.type) {
              case "start":
                setTotalFrames(data.total_frames);
                break;
              case "progress":
                setProgress(data.progress);
                setCurrentFrame(data.frame);
                setFrameDetections(data.detections);
                break;
              case "complete":
                setResults(data.results);
                setProgress(100);
                break;
              case "error":
                setError(data.detail);
                break;
            }
          } catch (e) {
            console.error("[Upload] Parse error:", e);
          }
        }
      }
    } catch (err) {
      console.error("[Upload] Error:", err);
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    setCurrentFrame(0);
    setTotalFrames(0);
    setFrameDetections([]);
    setResults(null);
    setError(null);
  }, []);

  return {
    upload,
    reset,
    isUploading,
    progress,
    currentFrame,
    totalFrames,
    frameDetections,
    results,
    error,
  };
}
