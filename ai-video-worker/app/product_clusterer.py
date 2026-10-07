import cv2
import numpy as np

from .duplicate_detector import cosine_similarity


def dominant_color(image: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(cv2.resize(image, (48, 48)), cv2.COLOR_BGR2HSV)
    pixels = hsv.reshape(-1, 3).astype("float32")
    useful = pixels[(pixels[:, 1] > 28) & (pixels[:, 2] > 28) & (pixels[:, 2] < 245)]
    return np.median(useful if len(useful) else pixels, axis=0)


def color_similarity(left: np.ndarray, right: np.ndarray) -> float:
    hue_delta = min(abs(float(left[0] - right[0])), 180 - abs(float(left[0] - right[0]))) / 90
    saturation_delta = abs(float(left[1] - right[1])) / 255
    value_delta = abs(float(left[2] - right[2])) / 255
    return float(max(0.0, 1.0 - (0.55 * hue_delta + 0.25 * saturation_delta + 0.20 * value_delta)))


def same_product_score(previous: dict, current: dict) -> float:
    gap = max(0.0, current["timestampSeconds"] - previous["timestampSeconds"])
    temporal = max(0.0, 1.0 - gap / 4.0)
    embedding = max(0.0, cosine_similarity(previous["descriptor"], current["descriptor"]))
    color = color_similarity(previous["dominantColor"], current["dominantColor"])
    scene_consistency = 1.0 - min(1.0, current.get("sceneScore", 0.0))
    visibility = min(previous["quality"]["visibilityScore"], current["quality"]["visibilityScore"])
    return float(0.48 * embedding + 0.20 * temporal + 0.16 * color + 0.10 * scene_consistency + 0.06 * visibility)


def cluster_products(frames: list[dict], threshold: float = 0.72) -> list[list[dict]]:
    if not frames:
        return []
    ordered = sorted(frames, key=lambda item: item["timestampSeconds"])
    for frame in ordered:
        frame["dominantColor"] = dominant_color(frame["image"])
    groups: list[list[dict]] = [[ordered[0]]]
    for frame in ordered[1:]:
        previous = groups[-1][-1]
        gap = frame["timestampSeconds"] - previous["timestampSeconds"]
        score = same_product_score(previous, frame)
        hard_cut = frame.get("sceneScore", 0.0) >= 0.55 and score < 0.86
        if gap > 4.5 or hard_cut or score < threshold:
            groups.append([frame])
        else:
            groups[-1].append(frame)
    return _join_short_groups(groups)


def _join_short_groups(groups: list[list[dict]]) -> list[list[dict]]:
    result: list[list[dict]] = []
    for group in groups:
        if len(group) > 1 or not result:
            result.append(group)
        elif group[0]["timestampSeconds"] - result[-1][-1]["timestampSeconds"] < 1.2:
            result[-1].extend(group)
        else:
            result.append(group)
    return result
