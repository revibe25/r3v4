# ── AI Mix sidecar ────────────────────────────────────────────────────────
FROM python:3.12-slim AS base

# System deps for librosa / numpy
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libsndfile1 \
    ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps in a layer-cached step
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY src/ ./src/

# uvicorn resolves "src.app:app" relative to PYTHONPATH=/app → /app/src/app.py ✓
ENV PYTHONPATH=/app

EXPOSE 8001

# Healthcheck baked in — also used by docker-compose
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

CMD ["python", "-m", "uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8001"]
