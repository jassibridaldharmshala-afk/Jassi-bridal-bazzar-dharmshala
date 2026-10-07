import secrets

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from .config import settings
from .pipeline import process_reel
from .storage_client import StorageError
from .video_normalizer import VideoValidationError


app = FastAPI(title="Samira Reel Processing Worker", docs_url=None, redoc_url=None)


@app.post("/internal/images/remove-background")
async def image_background(request: Request, authorization: str = Header(default="")):
    require_service_token(authorization)
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > 3 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image too large.")
    try:
        from .image_background import remove_background
        output = await run_in_threadpool(remove_background, bytes(data))
        return Response(output, media_type="image/png", headers={"Cache-Control": "no-store"})
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=503, detail="Image processor unavailable. Retry or keep the original.") from error


class VideoSource(BaseModel):
    provider: str = Field(pattern="^(r2|cloudinary)$")
    storageKey: str = Field(min_length=1, max_length=1024)
    url: str | None = Field(default=None, max_length=4096)


class ProcessingRequest(BaseModel):
    jobId: str = Field(pattern="^[a-fA-F0-9]{24}$")
    videoSource: VideoSource
    processingConfig: dict = Field(default_factory=dict)


def require_service_token(authorization: str = Header(default="")):
    provided = authorization.removeprefix("Bearer ").strip()
    if not settings.service_token or not secrets.compare_digest(settings.service_token, provided):
        raise HTTPException(status_code=401, detail={"code": "SERVICE_AUTH_FAILED", "message": "Service authentication failed."})


@app.get("/internal/health")
def health():
    return {
        "status": "ready" if settings.ffmpeg_ready else "not_ready",
        "ffmpeg": settings.ffmpeg_ready,
        "device": settings.model_device,
        "detectionModel": settings.detection_model,
        "embeddingModel": settings.embedding_model,
    }


@app.post("/internal/reel-processing/jobs", dependencies=[Depends(require_service_token)])
def process_job(request: ProcessingRequest):
    if not settings.ffmpeg_ready:
        raise HTTPException(
            status_code=503,
            detail={"code": "FFMPEG_UNAVAILABLE", "message": "FFmpeg and FFprobe are required by the worker."},
        )
    try:
        return process_reel(
            request.jobId,
            request.videoSource.model_dump(),
            request.processingConfig,
        )
    except VideoValidationError as error:
        raise HTTPException(status_code=400, detail={"code": error.code, "message": str(error)}) from error
    except StorageError as error:
        raise HTTPException(status_code=503, detail={"code": error.code, "message": str(error)}) from error
    except TimeoutError as error:
        raise HTTPException(status_code=504, detail={"code": "REEL_WORKER_TIMEOUT", "message": str(error)}) from error
    except RuntimeError as error:
        raise HTTPException(
            status_code=422,
            detail={"code": getattr(error, "code", "REEL_PROCESSING_FAILED"), "message": str(error)},
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail={"code": "REEL_PROCESSING_FAILED", "message": "The reel could not be processed."},
        ) from error
