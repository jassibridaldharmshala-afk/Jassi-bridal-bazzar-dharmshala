from dataclasses import dataclass
import os
import shutil


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    service_token: str = os.getenv("AI_VIDEO_WORKER_SERVICE_TOKEN", "")
    model_device: str = os.getenv("MODEL_DEVICE", "cpu")
    detection_model: str = os.getenv("DETECTION_MODEL", "opencv-hog-person")
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "opencv-visual-descriptor")
    temp_directory: str | None = os.getenv("TEMP_DIRECTORY") or None
    max_processing_seconds: int = _int("MAX_PROCESSING_SECONDS", 1200)
    ffmpeg_path: str = os.getenv("FFMPEG_PATH", "ffmpeg")
    ffprobe_path: str = os.getenv("FFPROBE_PATH", "ffprobe")
    max_working_width: int = _int("MAX_WORKING_WIDTH", 1280)
    fixed_fps: float = _float("REEL_FRAMES_PER_SECOND", 3.0)
    scene_threshold: float = _float("REEL_SCENE_THRESHOLD", 0.30)
    duplicate_similarity: float = _float("REEL_EXACT_DUPLICATE_SIMILARITY", 0.96)
    same_product_similarity: float = _float("REEL_SAME_PRODUCT_SIMILARITY", 0.88)
    different_product_similarity: float = _float("REEL_DIFFERENT_PRODUCT_SIMILARITY", 0.80)

    @property
    def ffmpeg_ready(self) -> bool:
        return bool(shutil.which(self.ffmpeg_path) and shutil.which(self.ffprobe_path))


settings = Settings()
