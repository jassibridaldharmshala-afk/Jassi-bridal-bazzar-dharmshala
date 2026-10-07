import cv2
import numpy as np


class SubjectDetector:
    """CPU-safe pretrained person detector loaded once per worker process."""

    def __init__(self):
        self.hog = cv2.HOGDescriptor()
        self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

    def visibility(self, image: np.ndarray) -> tuple[float, list[int] | None]:
        height, width = image.shape[:2]
        scale = min(1.0, 640.0 / max(width, height))
        resized = cv2.resize(image, None, fx=scale, fy=scale) if scale < 1 else image
        try:
            boxes, weights = self.hog.detectMultiScale(resized, winStride=(8, 8), padding=(8, 8), scale=1.05)
        except cv2.error:
            return 0.35, None
        if not len(boxes):
            return 0.35, None
        best_index = int(np.argmax(weights))
        x, y, box_width, box_height = [int(value / scale) for value in boxes[best_index]]
        coverage = min(1.0, (box_width * box_height) / max(1.0, width * height))
        centered = 1.0 - min(1.0, abs((x + box_width / 2) - width / 2) / (width / 2))
        return float(min(1.0, coverage * 1.8 + centered * 0.25)), [x, y, box_width, box_height]


SUBJECT_DETECTOR = SubjectDetector()


def analyze_quality(image: np.ndarray, run_detection: bool = True) -> dict:
    if image is None or image.size == 0:
        return rejected("corrupt_frame")
    height, width = image.shape[:2]
    if height < 160 or width < 120:
        return rejected("frame_too_small")
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    mean = float(gray.mean())
    sharpness_raw = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    resolution_scale = max(0.65, np.sqrt((width * height) / (720 * 1280)))
    sharpness = float(min(1.0, sharpness_raw / (140.0 * resolution_scale)))
    exposure = float(max(0.0, 1.0 - abs(mean - 128.0) / 128.0))
    dark_ratio = float(np.mean(gray < 18))
    bright_ratio = float(np.mean(gray > 245))
    edge_density = float(np.mean(cv2.Canny(gray, 80, 160) > 0))
    visibility, box = SUBJECT_DETECTOR.visibility(image) if run_detection else (0.5, None)
    reasons: list[str] = []
    if mean < 24 or dark_ratio > 0.82:
        reasons.append("too_dark")
    if mean > 238 or bright_ratio > 0.82:
        reasons.append("overexposed")
    if sharpness < 0.12:
        reasons.append("too_blurry")
    if edge_density < 0.004:
        reasons.append("empty_or_transition")
    if box:
        x, y, box_width, box_height = box
        margin = min(width, height) * 0.01
        if x <= margin or y <= margin or x + box_width >= width - margin or y + box_height >= height - margin:
            reasons.append("subject_cropped")
    quality = float(0.42 * sharpness + 0.28 * exposure + 0.22 * visibility + 0.08 * min(1.0, edge_density * 12))
    return {
        "accepted": not reasons,
        "qualityScore": round(quality, 4),
        "sharpnessScore": round(sharpness, 4),
        "exposureScore": round(exposure, 4),
        "visibilityScore": round(visibility, 4),
        "subjectBox": box,
        "rejectionReasons": reasons,
        "width": width,
        "height": height,
    }


def rejected(reason: str) -> dict:
    return {
        "accepted": False,
        "qualityScore": 0.0,
        "sharpnessScore": 0.0,
        "exposureScore": 0.0,
        "visibilityScore": 0.0,
        "subjectBox": None,
        "rejectionReasons": [reason],
        "width": 0,
        "height": 0,
    }
