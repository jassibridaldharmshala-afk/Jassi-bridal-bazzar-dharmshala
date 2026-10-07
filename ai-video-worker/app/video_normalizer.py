import json
from pathlib import Path
import subprocess

from .config import settings


class VideoValidationError(RuntimeError):
    code = "INVALID_VIDEO"


def probe_video(video_path: Path) -> dict:
    command = [
        settings.ffprobe_path,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height,duration:format=duration",
        "-of", "json",
        str(video_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=30, check=False)
    if result.returncode != 0:
        raise VideoValidationError("The video is corrupt or uses an unsupported codec.")
    try:
        payload = json.loads(result.stdout)
        stream = payload["streams"][0]
        duration = float(stream.get("duration") or payload.get("format", {}).get("duration") or 0)
        width, height = int(stream["width"]), int(stream["height"])
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise VideoValidationError("The video does not contain a usable video stream.") from exc
    if duration <= 0 or width <= 0 or height <= 0:
        raise VideoValidationError("The video is empty.")
    return {
        "durationSeconds": duration,
        "width": width,
        "height": height,
        "codec": str(stream.get("codec_name") or ""),
    }


def normalize_video(source: Path, destination: Path) -> Path:
    filter_chain = f"scale='min({settings.max_working_width},iw)':-2,fps=4"
    command = [
        settings.ffmpeg_path,
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source),
        "-vf", filter_chain,
        "-an",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(destination),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=settings.max_processing_seconds, check=False)
    if result.returncode != 0 or not destination.exists() or destination.stat().st_size == 0:
        raise VideoValidationError("The video could not be prepared for processing.")
    return destination
