import cv2
import numpy as np


COLOR_NAMES = [
    (0, "Red"), (8, "Orange"), (18, "Gold"), (30, "Yellow"), (45, "Green"),
    (75, "Teal"), (95, "Blue"), (125, "Purple"), (150, "Pink"), (175, "Maroon"),
]


def color_name(hsv: np.ndarray) -> tuple[str, float]:
    hue, saturation, value = [float(item) for item in hsv]
    if value < 48:
        return "Black", 0.92
    if saturation < 28 and value > 205:
        return "White", 0.90
    if saturation < 35:
        return "Grey", 0.78
    nearest = min(COLOR_NAMES, key=lambda item: min(abs(hue - item[0]), 180 - abs(hue - item[0])))
    distance = min(abs(hue - nearest[0]), 180 - abs(hue - nearest[0]))
    return nearest[1], float(max(0.65, 0.96 - distance / 50))


def suggest_attributes(frames: list[dict], group_number: int) -> tuple[dict, dict]:
    colors = [color_name(frame["dominantColor"]) for frame in frames]
    names = [name for name, _ in colors]
    primary = max(set(names), key=names.count)
    color_confidence = float(np.mean([confidence for name, confidence in colors if name == primary]))
    edge_density = float(np.mean([
        np.mean(cv2.Canny(cv2.cvtColor(frame["image"], cv2.COLOR_BGR2GRAY), 70, 150) > 0)
        for frame in frames
    ]))
    pattern = "Embroidered" if edge_density > 0.16 else "Solid" if edge_density < 0.07 else ""
    pattern_confidence = 0.61 if pattern else 0.30
    suggestions = {
        "name": f"{primary} outfit" if color_confidence >= 0.75 else "",
        "category": "",
        "subcategory": "",
        "primaryColor": primary if color_confidence >= 0.70 else "",
        "secondaryColors": [],
        "pattern": pattern if pattern_confidence >= 0.60 else "",
        "occasion": [],
        "tags": [primary.lower(), "outfit"] if color_confidence >= 0.75 else [],
        "altText": f"{primary} outfit candidate {group_number}" if color_confidence >= 0.75 else "",
    }
    confidence = {
        "category": 0.0,
        "primaryColor": round(color_confidence, 3),
        "pattern": pattern_confidence,
        "occasion": 0.0,
        "overall": round(0.70 * color_confidence + 0.30 * pattern_confidence, 3),
    }
    return suggestions, confidence
