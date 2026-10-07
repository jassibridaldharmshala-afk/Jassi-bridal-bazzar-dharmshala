import cv2
import numpy as np

from .scene_detector import histogram_descriptor, histogram_similarity


def perceptual_hash(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(cv2.resize(image, (32, 32)), cv2.COLOR_BGR2GRAY).astype("float32")
    dct = cv2.dct(gray)
    low = dct[:8, :8]
    median = float(np.median(low[1:]))
    return (low > median).flatten()


def hash_similarity(left: np.ndarray, right: np.ndarray) -> float:
    return float(1.0 - np.mean(left != right))


def visual_descriptor(image: np.ndarray) -> np.ndarray:
    hist = histogram_descriptor(image)
    gray = cv2.cvtColor(cv2.resize(image, (64, 64)), cv2.COLOR_BGR2GRAY)
    texture = cv2.resize(cv2.Laplacian(gray, cv2.CV_32F), (8, 8)).flatten()
    texture /= np.linalg.norm(texture) + 1e-8
    descriptor = np.concatenate([hist, texture]).astype("float32")
    descriptor /= np.linalg.norm(descriptor) + 1e-8
    return descriptor


def cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    return float(np.clip(np.dot(left, right) / ((np.linalg.norm(left) + 1e-8) * (np.linalg.norm(right) + 1e-8)), -1, 1))


def remove_duplicates(frames: list[dict], threshold: float = 0.96) -> tuple[list[dict], int]:
    kept: list[dict] = []
    duplicates = 0
    for frame in sorted(frames, key=lambda item: item["timestampSeconds"]):
        image = frame["image"]
        frame["phash"] = perceptual_hash(image)
        frame["descriptor"] = visual_descriptor(image)
        match_index = None
        for index in range(max(0, len(kept) - 12), len(kept)):
            candidate = kept[index]
            phash_score = hash_similarity(frame["phash"], candidate["phash"])
            hist_score = histogram_similarity(histogram_descriptor(image), histogram_descriptor(candidate["image"]))
            if phash_score >= threshold and hist_score >= max(0.90, threshold - 0.04):
                match_index = index
                break
        if match_index is None:
            kept.append(frame)
            continue
        duplicates += 1
        if frame["quality"]["qualityScore"] > kept[match_index]["quality"]["qualityScore"]:
            kept[match_index] = frame
    return kept, duplicates
