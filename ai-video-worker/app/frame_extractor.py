from pathlib import Path
import subprocess

import cv2

from .config import settings
from .scene_detector import detect_scene_frames


def extract_candidate_frames(video_path: Path, output_dir: Path, fps: float, scene_threshold: float) -> list[dict]:
    fixed_dir = output_dir / "fixed"
    scene_dir = output_dir / "scene"
    fixed_dir.mkdir(parents=True, exist_ok=True)
    command = [
        settings.ffmpeg_path,
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(video_path),
        "-vf", f"fps={fps}",
        "-q:v", "2",
        str(fixed_dir / "fixed_%06d.jpg"),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=settings.max_processing_seconds, check=False)
    if result.returncode != 0:
        raise RuntimeError("FFmpeg could not extract video frames.")
    fixed = [
        {
            "path": frame,
            "timestampSeconds": index / fps,
            "sceneScore": 0.0,
            "source": "fixed",
        }
        for index, frame in enumerate(sorted(fixed_dir.glob("fixed_*.jpg")))
    ]
    scenes = detect_scene_frames(video_path, scene_dir, scene_threshold)
    combined = fixed + scenes
    combined.sort(key=lambda item: item["timestampSeconds"])
    return dedupe_timestamps(combined)


def dedupe_timestamps(frames: list[dict], tolerance: float = 0.08) -> list[dict]:
    kept: list[dict] = []
    for frame in frames:
        if kept and abs(frame["timestampSeconds"] - kept[-1]["timestampSeconds"]) <= tolerance:
            if frame.get("sceneScore", 0) > kept[-1].get("sceneScore", 0):
                kept[-1] = frame
            continue
        kept.append(frame)
    return kept


def read_frame(frame: dict):
    return cv2.imread(str(frame["path"]), cv2.IMREAD_COLOR)
