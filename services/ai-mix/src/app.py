"""
services/ai-mix/src/app.py

R3 AI Mix sidecar service.
Wraps ai_mix.py and main.py behind a typed FastAPI HTTP interface.
Auto-generated OpenAPI docs available at http://localhost:8001/docs
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import uvicorn
import logging

logger = logging.getLogger("ai-mix")

app = FastAPI(
    title="R3 AI Mix Service",
    version="1.0.0",
    description="Typed HTTP sidecar for AI-driven mix analysis.",
)


# ── Request / Response models ─────────────────────────────────────────────


class MixRequest(BaseModel):
    track_a_id: str = Field(..., description="ID of the outgoing track")
    track_b_id: str = Field(..., description="ID of the incoming track")
    crossfade_position: float = Field(
        ..., ge=0.0, le=1.0, description="Crossfader position (0 = full A, 1 = full B)"
    )
    bpm_target: Optional[float] = Field(
        None, gt=0, description="Override BPM target for the transition"
    )


class MixResponse(BaseModel):
    suggested_bpm: float = Field(..., description="Recommended BPM for the transition")
    transition_points: List[float] = Field(
        ..., description="Beat-aligned transition cue points (seconds)"
    )
    energy_curve: List[float] = Field(
        ..., description="Normalized energy readings across the mix window"
    )


class HealthResponse(BaseModel):
    status: str


# ── Routes ────────────────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health() -> HealthResponse:
    """Liveness probe — used by Docker healthcheck and the Node app."""
    return HealthResponse(status="ok")


@app.post("/mix/analyze", response_model=MixResponse, tags=["Mix"])
async def analyze_mix(req: MixRequest) -> MixResponse:
    """
    Analyze a mix transition and return BPM suggestion, cue points,
    and energy curve.
    """
    try:
        # Import here so the module path is resolved relative to the
        # working directory set in the Dockerfile (WORKDIR /app)
        from ai_mix import analyze  # type: ignore[import]

        result = analyze(
            req.track_a_id,
            req.track_b_id,
            req.crossfade_position,
            bpm_target=req.bpm_target,
        )
        return MixResponse(**result)

    except ImportError as e:
        logger.error("Failed to import ai_mix module: %s", e)
        raise HTTPException(status_code=500, detail="AI mix module not available")
    except Exception as e:
        logger.exception("Mix analysis failed")
        raise HTTPException(status_code=500, detail=str(e))


# ── Entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    # When running directly: python -m src.app (from /app with PYTHONPATH=/app)
    uvicorn.run("src.app:app", host="0.0.0.0", port=8001, reload=False)
