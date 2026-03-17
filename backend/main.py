"""FastAPI app with WebSocket and video upload endpoints."""

from __future__ import annotations

import asyncio
import json
import os
import tempfile
import uuid
from enum import Enum

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from detector import Detector

app = FastAPI(title="YOLO Beverage Detector")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = tempfile.gettempdir()

# FIX: How long (seconds) to wait for a frame before sending a keepalive ping.
# Prevents the WebSocket from being closed by proxies/browsers on idle connections.
WS_RECEIVE_TIMEOUT = 10.0


class MsgType(str, Enum):
    """Message types the client can send over the WebSocket."""

    CONFIG = "config"
    DETECT = "detect"
    PING = "ping"  # FIX: heartbeat type so client can send pings


# Load model once at startup
detector = Detector()


@app.websocket("/ws/detect")
async def ws_detect(ws: WebSocket) -> None:
    await ws.accept()
    try:
        while True:
            # FIX: Use wait_for with a timeout instead of blocking receive().
            # If no message arrives within WS_RECEIVE_TIMEOUT seconds, we send
            # a server-side ping to keep the connection alive. This prevents
            # the camera stream from silently dying when the client is slow
            # to send frames (e.g. on a busy machine or slow network).
            try:
                raw = await asyncio.wait_for(
                    ws.receive(),
                    timeout=WS_RECEIVE_TIMEOUT,
                )
            except asyncio.TimeoutError:
                # No frame received within the timeout window — send a keepalive
                # ping so the browser/proxy doesn't close the connection.
                await ws.send_json({"type": "ping"})
                continue

            # --- handle disconnect ---
            if raw.get("type") == "websocket.disconnect":
                break

            # --- text control messages (JSON) ---
            if "text" in raw:
                try:
                    msg = json.loads(raw["text"])
                except json.JSONDecodeError:
                    await ws.send_json({"type": "error", "detail": "invalid JSON"})
                    continue

                msg_type = msg.get("type")

                # FIX: handle client-side heartbeat pings — just pong back.
                if msg_type == MsgType.PING:
                    await ws.send_json({"type": "pong"})
                    continue

                if msg_type == MsgType.CONFIG:
                    threshold = msg.get("threshold")
                    if threshold is not None:
                        detector.confidence = float(threshold)
                        await ws.send_json(
                            {
                                "type": "config_ack",
                                "confidence": detector.confidence,
                            }
                        )
                    continue

            # --- binary frames (JPEG bytes) ---
            if "bytes" in raw:
                frame_bytes = raw["bytes"]

                # FIX: guard against empty byte payloads (can happen if the
                # frontend sends a frame before the camera is fully ready).
                if not frame_bytes:
                    await ws.send_json(
                        {"type": "error", "detail": "received empty frame bytes"}
                    )
                    continue

                buf = np.frombuffer(frame_bytes, dtype=np.uint8)
                frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)
                if frame is None:
                    await ws.send_json(
                        {"type": "error", "detail": "could not decode frame"}
                    )
                    continue

                result = detector.detect(frame)
                await ws.send_json(result)

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        # FIX: catch unexpected errors and attempt a clean close rather than
        # letting the coroutine die silently (which would leave the frontend
        # waiting forever for a response that never comes).
        try:
            await ws.send_json({"type": "error", "detail": str(exc)})
            await ws.close()
        except Exception:
            pass


async def process_video_frames(video_path: str, job_id: str):
    """Generator that processes video frames and yields SSE events."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        yield f"data: {json.dumps({'type': 'error', 'detail': 'Could not open video'})}\n\n"
        return

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_idx = 0
    all_detections = []

    yield f"data: {json.dumps({'type': 'start', 'job_id': job_id, 'total_frames': total_frames, 'fps': fps})}\n\n"

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        result = detector.detect(frame)
        frame_detections = {
            "frame": frame_idx,
            "timestamp": round(frame_idx / fps, 3),
            "detections": result["detections"],
            "inference_ms": result["inference_ms"],
            # FIX: include frame dimensions in per-frame results too,
            # so the frontend can scale bounding boxes correctly for video.
            "frame_width": result["frame_width"],
            "frame_height": result["frame_height"],
        }
        all_detections.append(frame_detections)

        progress = round((frame_idx + 1) / total_frames * 100, 1)
        yield (
            f"data: {json.dumps({'type': 'progress', 'frame': frame_idx, 'total_frames': total_frames, 'progress': progress, 'detections': result['detections'], 'frame_width': result['frame_width'], 'frame_height': result['frame_height']})}\n\n"
        )

        frame_idx += 1
        await asyncio.sleep(0)  # yield control to event loop

    cap.release()
    os.unlink(video_path)

    yield f"data: {json.dumps({'type': 'complete', 'job_id': job_id, 'total_frames': frame_idx, 'results': all_detections})}\n\n"


@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """Upload a video file and stream detection progress via SSE."""
    if not file.content_type or not file.content_type.startswith("video/"):
        return {"error": "File must be a video"}

    job_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    temp_path = os.path.join(UPLOAD_DIR, f"{job_id}{ext}")

    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)

    return StreamingResponse(
        process_video_frames(temp_path, job_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)