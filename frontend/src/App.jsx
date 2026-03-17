import { useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import Webcam from "./components/Webcam";
import Canvas from "./components/Canvas";
import VideoUpload from "./components/VideoUpload";
import Header from "./components/Header";
import DetectionPanel from "./components/DetectionPanel";
import ConfidenceSlider from "./components/ConfidenceSlider";
import { useDetection } from "./hooks/useDetection";
import styles from "./App.module.css";

function App() {
  const webcamRef = useRef(null);
  const [videoElement, setVideoElement] = useState(null);
  const [mode, setMode] = useState("webcam");

  // FIX: pass webcamRef into useDetection so it can call webcamRef.current.setReady()
  // when a detection response arrives — this is the backpressure signal that tells
  // Webcam.jsx it's safe to capture and send the next frame.
  const { isConnected, detections, frameSize, confidence, error, sendFrame, setThreshold } =
    useDetection(webcamRef);

  const handleWebcamRef = (ref) => {
    webcamRef.current = ref;
    if (ref) {
      setTimeout(() => {
        setVideoElement(ref.getVideoElement());
      }, 500);
    }
  };

  const handleThresholdChange = (e) => {
    setThreshold(parseFloat(e.target.value));
  };

  return (
    <div className={styles.app}>
      <Header
        mode={mode}
        onModeChange={setMode}
        isConnected={isConnected}
        showStatus={mode === "webcam"}
      />
      <main className={styles.main}>
        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={16} strokeWidth={2} />
            {error}
          </div>
        )}
        {mode === "webcam" ? (
          <div className={styles.webcamLayout}>
            <div className={`${styles.videoWrapper} ${isConnected ? styles.connected : ""}`}>
              <Webcam ref={handleWebcamRef} onFrame={sendFrame} />
              {videoElement && (
                <Canvas
                  detections={detections}
                  frameSize={frameSize}
                  videoElement={videoElement}
                />
              )}
            </div>
            <div className={styles.sidebar}>
              <ConfidenceSlider value={confidence} onChange={handleThresholdChange} />
              <DetectionPanel detections={detections} />
            </div>
          </div>
        ) : (
          <div className={styles.uploadLayout}>
            <VideoUpload />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;