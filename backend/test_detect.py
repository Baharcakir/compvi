#!/usr/bin/env python3
"""Phase 1 test — run detector on a static image and print results + latency.

Usage
-----
    # uses a sample image bundled with ultralytics
    python test_detect.py

    # or supply your own
    python test_detect.py path/to/image.jpg
"""

from __future__ import annotations

import json
import sys

import cv2
import numpy as np

from detector import Detector


def make_sample_image() -> np.ndarray:
    """Create a simple 640x480 test image (solid colour — no detections
    expected, but proves the pipeline runs without errors)."""
    return np.zeros((480, 640, 3), dtype=np.uint8)


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else None

    if path:
        frame = cv2.imread(path)
        if frame is None:
            print(f"ERROR: could not read {path}")
            sys.exit(1)
        print(f"Loaded image: {path}  ({frame.shape[1]}x{frame.shape[0]})")
    else:
        frame = make_sample_image()
        print("Using blank 640x480 sample image (pass an image path for real detections)")

    det = Detector()

    # Warm up — first inference is always slower (model graph compilation)
    print("\n--- warm-up run ---")
    warmup = det.detect(frame)
    print(json.dumps(warmup, indent=2))

    # Benchmark 30 frames
    print("\n--- benchmark (30 frames) ---")
    for i in range(30):
        result = det.detect(frame)

    print(json.dumps(result, indent=2))
    print(
        f"\nRolling stats  →  avg={result['avg_ms']} ms  "
        f"p95={result['p95_ms']} ms  p99={result['p99_ms']} ms"
    )


if __name__ == "__main__":
    main()
