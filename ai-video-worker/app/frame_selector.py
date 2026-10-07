from .duplicate_detector import cosine_similarity


def select_diverse_frames(frames: list[dict], maximum: int = 4) -> list[dict]:
    if not frames:
        return []
    ranked = sorted(frames, key=lambda item: item["quality"]["qualityScore"], reverse=True)
    selected = [ranked.pop(0)]
    while ranked and len(selected) < maximum:
        def score(frame):
            visual_distance = min(
                1.0 - max(-1.0, cosine_similarity(frame["descriptor"], chosen["descriptor"]))
                for chosen in selected
            )
            time_distance = min(abs(frame["timestampSeconds"] - chosen["timestampSeconds"]) for chosen in selected)
            return (
                0.58 * frame["quality"]["qualityScore"]
                + 0.27 * visual_distance
                + 0.15 * min(1.0, time_distance / 2.0)
            )

        chosen_index = max(range(len(ranked)), key=lambda index: score(ranked[index]))
        chosen = ranked.pop(chosen_index)
        selected.append(chosen)
    return sorted(selected, key=lambda item: item["timestampSeconds"])
