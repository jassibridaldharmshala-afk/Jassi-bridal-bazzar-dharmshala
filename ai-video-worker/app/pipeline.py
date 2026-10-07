from pathlib import Path
import tempfile
import time

from .attribute_suggester import suggest_attributes
from .config import settings
from .duplicate_detector import remove_duplicates
from .frame_extractor import extract_candidate_frames, read_frame
from .frame_selector import select_diverse_frames
from .product_clusterer import cluster_products
from .quality_analyzer import analyze_quality
from .storage_client import StorageClient
from .video_normalizer import normalize_video, probe_video


def process_reel(job_id: str, video_source: dict, processing_config: dict | None = None) -> dict:
    started = time.monotonic()
    config = processing_config or {}
    fps = min(6.0, max(0.5, float(config.get("framesPerSecond") or settings.fixed_fps)))
    scene_threshold = min(0.9, max(0.05, float(config.get("sceneThreshold") or settings.scene_threshold)))
    duplicate_threshold = min(1.0, max(0.75, float(config.get("duplicateThreshold") or settings.duplicate_similarity)))
    clustering_threshold = normalize_cluster_threshold(float(config.get("clusteringThreshold") or settings.same_product_similarity))
    storage = StorageClient()
    statistics = {
        "extractedFrames": 0,
        "rejectedFrames": 0,
        "duplicateFrames": 0,
        "candidateFrames": 0,
        "detectedProducts": 0,
    }

    with tempfile.TemporaryDirectory(
        prefix=f"samira-reel-{job_id[:8]}-",
        dir=settings.temp_directory,
    ) as temporary_directory:
        workspace = Path(temporary_directory)
        source = storage.download(video_source, workspace / "source-video")
        metadata = probe_video(source)
        normalized = normalize_video(source, workspace / "normalized.mp4")
        extracted = extract_candidate_frames(
            normalized,
            workspace / "frames",
            fps,
            scene_threshold,
        )
        statistics["extractedFrames"] = len(extracted)
        accepted: list[dict] = []
        last_visibility = 0.5
        for index, frame in enumerate(extracted):
            ensure_time_limit(started)
            image = read_frame(frame)
            quality = analyze_quality(image, run_detection=index % 3 == 0)
            if index % 3 != 0:
                quality["visibilityScore"] = last_visibility
                quality["qualityScore"] = round(
                    0.48 * quality["sharpnessScore"]
                    + 0.34 * quality["exposureScore"]
                    + 0.18 * last_visibility,
                    4,
                )
            else:
                last_visibility = quality["visibilityScore"]
            if not quality["accepted"]:
                statistics["rejectedFrames"] += 1
                continue
            accepted.append({**frame, "image": image, "quality": quality})

        unique, duplicate_count = remove_duplicates(accepted, duplicate_threshold)
        statistics["duplicateFrames"] = duplicate_count
        statistics["candidateFrames"] = len(unique)
        if not unique:
            error = RuntimeError("No usable product frames were detected.")
            error.code = "NO_USABLE_FRAMES"
            raise error

        groups = cluster_products(unique, clustering_threshold)
        candidates = []
        for group_number, group in enumerate(groups, start=1):
            ensure_time_limit(started)
            recommended = select_diverse_frames(group, 4)
            recommended_ids = {id(frame) for frame in recommended}
            extra = [
                frame
                for frame in sorted(group, key=lambda item: item["quality"]["qualityScore"], reverse=True)
                if id(frame) not in recommended_ids
            ][:4]
            persisted = []
            for frame in recommended + extra:
                stored = storage.upload_candidate(
                    frame["path"],
                    job_id,
                    group_number,
                    frame["timestampSeconds"],
                )
                persisted.append({
                    **stored,
                    "timestampSeconds": round(frame["timestampSeconds"], 3),
                    "qualityScore": frame["quality"]["qualityScore"],
                    "sharpnessScore": frame["quality"]["sharpnessScore"],
                    "exposureScore": frame["quality"]["exposureScore"],
                    "visibilityScore": frame["quality"]["visibilityScore"],
                    "selected": id(frame) in recommended_ids,
                })
            suggestions, confidence = suggest_attributes(group, group_number)
            candidates.append({
                "groupNumber": group_number,
                "sourceRange": {
                    "startSeconds": round(min(frame["timestampSeconds"] for frame in group), 3),
                    "endSeconds": round(max(frame["timestampSeconds"] for frame in group), 3),
                },
                "frames": persisted,
                "suggestions": suggestions,
                "confidence": confidence,
            })

        statistics["detectedProducts"] = len(candidates)
        return {
            "jobId": job_id,
            "status": "review_required",
            "metadata": metadata,
            "statistics": statistics,
            "candidates": candidates,
        }


def ensure_time_limit(started: float):
    if time.monotonic() - started > settings.max_processing_seconds:
        raise TimeoutError("Video processing exceeded the configured time limit.")


def normalize_cluster_threshold(value: float) -> float:
    return max(0.58, min(0.84, value - 0.12 if value > 0.84 else value))
