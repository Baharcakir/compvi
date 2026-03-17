# =============================================================================
# Backend — FastAPI + YOLOv8
# =============================================================================
FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV (libGL, libglib) — slim image strips these
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install torch CPU-only FIRST as its own layer.
# This is the heaviest download (~200MB). Splitting it out means Docker
# caches it separately — if only your app code changes, this layer is
# reused and the rebuild takes seconds instead of 10 minutes.
# CPU-only build is intentional: Railway free/hobby tier has no GPU.
RUN pip install --no-cache-dir \
    torch==2.2.2+cpu \
    torchvision==0.17.2+cpu \
    --extra-index-url https://download.pytorch.org/whl/cpu

# Install remaining deps (cached separately from torch)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
