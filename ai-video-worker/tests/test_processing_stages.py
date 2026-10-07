import cv2
import numpy as np

from app.attribute_suggester import suggest_attributes
from app.duplicate_detector import hash_similarity, perceptual_hash, remove_duplicates, visual_descriptor
from app.frame_selector import select_diverse_frames
from app.product_clusterer import cluster_products, dominant_color
from app.quality_analyzer import analyze_quality


def sample_image(color=(40, 40, 180), detailed=True):
    image = np.full((480, 320, 3), color, dtype=np.uint8)
    if detailed:
        cv2.rectangle(image, (70, 30), (250, 450), (220, 220, 230), 4)
        cv2.line(image, (80, 80), (240, 400), (10, 10, 10), 5)
        cv2.circle(image, (160, 200), 55, color, -1)
    return image


def frame_at(timestamp, color=(40, 40, 180), quality=0.8):
    image = sample_image(color)
    return {
        "timestampSeconds": timestamp,
        "sceneScore": 0.0,
        "image": image,
        "quality": {"qualityScore": quality, "visibilityScore": 0.7},
        "descriptor": visual_descriptor(image),
    }


def test_dark_frame_is_rejected():
    result = analyze_quality(np.zeros((480, 320, 3), dtype=np.uint8), run_detection=False)
    assert not result["accepted"]
    assert "too_dark" in result["rejectionReasons"]


def test_sharp_frame_scores_above_blurred_frame():
    sharp = sample_image()
    blurred = cv2.GaussianBlur(sharp, (41, 41), 0)
    assert analyze_quality(sharp, False)["sharpnessScore"] > analyze_quality(blurred, False)["sharpnessScore"]


def test_perceptual_hash_matches_identical_frame():
    image = sample_image()
    assert hash_similarity(perceptual_hash(image), perceptual_hash(image.copy())) == 1.0


def test_duplicate_removal_keeps_higher_quality():
    low = frame_at(0, quality=0.4)
    high = frame_at(0.3, quality=0.9)
    unique, duplicate_count = remove_duplicates([low, high], 0.96)
    assert duplicate_count == 1
    assert unique[0]["quality"]["qualityScore"] == 0.9


def test_temporal_clustering_splits_large_gap():
    groups = cluster_products([frame_at(0), frame_at(1), frame_at(8, (180, 20, 20))], 0.65)
    assert len(groups) == 2


def test_selector_limits_frames_and_preserves_diversity():
    frames = [frame_at(index * 0.6, (20 + index * 30, 30, 180), 0.9 - index * 0.04) for index in range(7)]
    selected = select_diverse_frames(frames, 4)
    assert len(selected) == 4
    assert len({item["timestampSeconds"] for item in selected}) == 4


def test_suggestions_never_invent_commerce_fields():
    frames = [frame_at(0), frame_at(1)]
    for frame in frames:
        frame["dominantColor"] = dominant_color(frame["image"])
    suggestions, confidence = suggest_attributes(frames, 1)
    assert "price" not in suggestions
    assert "stock" not in suggestions
    assert "fabric" not in suggestions
    assert confidence["category"] == 0.0
