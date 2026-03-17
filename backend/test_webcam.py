#!/usr/bin/env python3
"""Test YOLO detection directly with your webcam - no frontend needed."""

import cv2
from ultralytics import YOLO

MODEL_PATH = "../models/best.pt"

def main():
    model = YOLO(MODEL_PATH)
    print(f"Model loaded: {MODEL_PATH}")
    print(f"Classes: {model.names}")

    cap = cv2.VideoCapture(0)  # 0 = default webcam
    if not cap.isOpened():
        print("ERROR: Could not open webcam")
        return

    print("\nWebcam opened. Hold a glass in front of the camera.")
    print("Press 'q' to quit, 's' to save current frame.\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Run detection (low confidence to see what model picks up)
        results = model(frame, conf=0.10, verbose=False)

        # Draw boxes on frame
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                label = f"{model.names[cls_id]} {conf:.0%}"

                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, label, (x1, y1-10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                print(f"Detected: {model.names[cls_id]} ({conf:.2%})")

        cv2.imshow("YOLO Webcam Test", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('s'):
            cv2.imwrite("test_frame.jpg", frame)
            print("Saved test_frame.jpg")

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
