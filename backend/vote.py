"""
Multi-frame voting and plate consensus aggregation module.
Improves ANPR accuracy across multiple frames of a sighting clip.
"""

from collections import defaultdict
import difflib

def calculate_string_similarity(s1, s2):
    """Normalized string similarity in [0, 1]."""
    if not s1 or not s2:
        return 0.0
    return difflib.SequenceMatcher(None, s1, s2).ratio()

def multi_frame_vote(frame_predictions, consensus_threshold=0.60):
    """
    frame_predictions: list of dicts:
      [{ "plate_text": str or None, "confidence": float, "frame_index": int }, ...]
    
    Returns:
      final_plate: str or None ("unconfirmed" if None),
      aggregated_confidence: float,
      voting_summary: dict
    """
    valid_predictions = [p for p in frame_predictions if p.get("plate_text")]

    if not valid_predictions:
        return None, 0.0, {
            "total_frames": len(frame_predictions),
            "valid_votes": 0,
            "consensus": "unconfirmed",
            "reason": "All frames yielded unreadable or low-confidence characters"
        }

    # Weight votes by individual frame confidence
    score_by_plate = defaultdict(float)
    count_by_plate = defaultdict(int)

    for p in valid_predictions:
        plate = p["plate_text"]
        conf = p["confidence"]
        score_by_plate[plate] += conf
        count_by_plate[plate] += 1

    # Find highest weighted candidate
    sorted_candidates = sorted(score_by_plate.items(), key=lambda x: x[1], reverse=True)
    top_plate, top_score = sorted_candidates[0]
    total_valid = len(valid_predictions)
    
    # Average confidence among frames that produced the top plate
    top_avg_conf = top_score / count_by_plate[top_plate]
    
    # Check if consensus ratio meets threshold
    vote_ratio = count_by_plate[top_plate] / total_valid

    summary = {
        "total_frames": len(frame_predictions),
        "valid_votes": total_valid,
        "vote_ratio": round(vote_ratio, 3),
        "top_plate": top_plate,
        "avg_confidence": round(top_avg_conf, 3),
        "candidates": {k: {"count": count_by_plate[k], "weight": round(score_by_plate[k], 2)} for k, _ in sorted_candidates[:3]}
    }

    if top_avg_conf >= consensus_threshold:
        return top_plate, top_avg_conf, summary
    else:
        return None, top_avg_conf, summary
