from pathlib import Path
import cv2
import numpy as np


def histogram_descriptor(image: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [24, 16], [0, 180, 0, 256])
    cv2.normalize(hist, hist)
    return hist.flatten()


def histogram_similarity(left: np.ndarray, right: np.ndarray) -> float:
    return float(max(0.0, min(1.0, cv2.compareHist(left.astype("float32"), right.astype("float32"), cv2.HISTCMP_CORREL))))


def detect_scene_frames(video_path: Path, output_dir: Path, threshold: float = 0.30) -> list[dict]:
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        return []
    output_dir.mkdir(parents=True, exist_ok=True)
    previous = None
    frames: list[dict] = []
    index = 0
    try:
        while True:
            ok, image = capture.read()
            if not ok:
                break
            descriptor = histogram_descriptor(image)
            difference = 1.0 if previous is None else 1.0 - histogram_similarity(previous, descriptor)
            if previous is None or difference >= threshold:
                timestamp = max(0.0, capture.get(cv2.CAP_PROP_POS_MSEC) / 1000.0)
                target = output_dir / f"scene_{index:06d}.jpg"
                if cv2.imwrite(str(target), image, [cv2.IMWRITE_JPEG_QUALITY, 92]):
                    frames.append({"path": target, "timestampSeconds": timestamp, "sceneScore": difference, "source": "scene"})
                    index += 1
            previous = descriptor
    finally:
        capture.release()
    return frames
