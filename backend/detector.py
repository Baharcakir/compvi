"""YOLOv8 wrapper — loads the model once and exposes a detect() method."""
from __future__ import annotations

import os

import numpy as np
from ultralytics import YOLO

from benchmark import BenchmarkTracker

# Model path from environment variable or default (use custom trained model)
MODEL_PATH = os.getenv("MODEL_PATH", "../models/best.pt")

# Custom trained classes for beverage containers
BEVERAGE_CLASSES: dict[int, str] = {
    0: "bottle-glass",
    1: "bottle-plastic",
    2: "cup-disposable",
    3: "cup-handle",
    4: "glass-mug",
    5: "glass-normal",
    6: "glass-wine",
    7: "gym bottle",
    8: "tin can",
}

# All class IDs from the custom model
TARGET_IDS: set[int] = {0, 1, 2, 3, 4, 5, 6, 7, 8}


class Detector:
    """Thin wrapper around a YOLOv8 model.

    * Model is loaded once at construction time.
    * ``confidence`` is a mutable attribute the frontend can update at
      runtime via a WebSocket control message.
    """

    def __init__(
        self,
        model_path: str = MODEL_PATH,
        confidence: float = 0.20,
    ) -> None:
        self.model = YOLO(model_path)
        self.confidence = confidence
        self.bench = BenchmarkTracker(window_size=30)

    # --------------------------------------------------------------------- #

    def detect(self, frame: np.ndarray) -> dict:
        """Run inference on *frame* (BGR numpy array from OpenCV).

        Returns a JSON-serialisable dict with detections + latency stats.

        BUG FIX: Now includes frame_width and frame_height so the frontend
        can correctly scale bounding boxes to the display canvas size.
        The bbox values are raw pixel coordinates relative to the original
        frame — the frontend must scale them to its canvas dimensions.
        """
        frame_height, frame_width = frame.shape[:2]

        self.bench.start()
        results = self.model(frame, conf=self.confidence, verbose=False)
        elapsed = self.bench.stop()

        detections: list[dict] = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                if cls_id not in TARGET_IDS:
                    continue

                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append(
                    {
                        "class_id": cls_id,
                        "label": BEVERAGE_CLASSES[cls_id],
                        "confidence": round(float(box.conf[0]), 3),
                        # Raw pixel coords in the original frame
                        "bbox": [
                            round(x1, 1),
                            round(y1, 1),
                            round(x2, 1),
                            round(y2, 1),
                        ],
                    }
                )

        return {
            "type": "detection",
            # FIX: include frame dimensions so the frontend can scale boxes
            "frame_width": frame_width,
            "frame_height": frame_height,
            "detections": detections,
            "inference_ms": round(elapsed, 2),
            **self.bench.stats_dict(),
        }