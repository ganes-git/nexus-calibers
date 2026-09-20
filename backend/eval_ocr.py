"""
OCR Evaluation Script for ANPR Pipeline.
Measures recognition accuracy against recorded ground-truth plates across all 5 PS degradation conditions:
1. clean
2. lighting (low contrast / night)
3. weather (rain / fog streaks)
4. angle (steep perspective tilt)
5. blur (motion blur)
6. damage (dirt / scrape occlusion)

Outputs exact numbers per category, clean vs adversarial split, and overall accuracy.
"""

import os
import json
import difflib
from detect import extract_frames, detect_vehicle_and_plate
from ocr import recognize_plate
from vote import multi_frame_vote

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
GROUND_TRUTH_FILE = os.path.join(DATA_DIR, "ground_truth.json")

def evaluate_pipeline():
    if not os.path.exists(GROUND_TRUTH_FILE):
        print(f"Ground truth file not found: {GROUND_TRUTH_FILE}")
        return None

    with open(GROUND_TRUTH_FILE, "r") as f:
        ground_truth = json.load(f)

    results = []
    total_clips = len(ground_truth)
    category_stats = {}
    
    clean_exact_matches = 0
    clean_total = 0
    adversarial_total = 0
    total_exact_matches = 0
    similarity_scores = []

    print(f"Starting OCR evaluation across {total_clips} clips...")
    print("-" * 85)
    print(f"{'Clip ID':<10} | {'True Plate':<12} | {'Category':<10} | {'Detected':<12} | {'Conf':<6} | {'Sim':<6} | {'Status'}")
    print("-" * 85)

    for item in ground_truth:
        clip_rel = item["clip_path"].replace("backend/", "")
        clip_path = os.path.join(os.path.dirname(__file__), clip_rel)
        true_plate = item["true_plate"]
        is_adv = item.get("is_adversarial", False)
        condition = item.get("condition", "clean")
        category = item.get("category", "clean")

        if category not in category_stats:
            category_stats[category] = {"total": 0, "exact_matches": 0, "similarities": []}

        category_stats[category]["total"] += 1

        if is_adv:
            adversarial_total += 1
        else:
            clean_total += 1

        # Process clip
        frames = extract_frames(clip_path, max_frames=20)
        frame_preds = []

        for idx, frame in enumerate(frames):
            _, plate_crop, _ = detect_vehicle_and_plate(frame)
            text, conf, _ = recognize_plate(plate_crop)
            frame_preds.append({
                "plate_text": text,
                "confidence": conf,
                "frame_index": idx
            })

        predicted_plate, avg_conf, summary = multi_frame_vote(frame_preds)

        # Match metrics
        pred_display = predicted_plate if predicted_plate else "(unconfirmed)"
        sim = difflib.SequenceMatcher(None, true_plate, predicted_plate or "").ratio()
        similarity_scores.append(sim)
        category_stats[category]["similarities"].append(sim)
        
        is_exact = (predicted_plate == true_plate)
        if is_exact:
            total_exact_matches += 1
            category_stats[category]["exact_matches"] += 1
            if not is_adv:
                clean_exact_matches += 1
            status = "EXACT MATCH"
        elif predicted_plate is None:
            status = f"FALLBACK ({condition})"
        else:
            status = f"PARTIAL ({condition})"

        results.append({
            "clip_id": item["clip_id"],
            "camera_id": item["camera_id"],
            "true_plate": true_plate,
            "category": category,
            "detected_plate": predicted_plate,
            "confidence": round(avg_conf, 3),
            "similarity": round(sim, 3),
            "exact_match": is_exact,
            "is_adversarial": is_adv,
            "condition": condition,
            "status": status
        })

        print(f"{item['clip_id']:<10} | {true_plate:<12} | {category:<10} | {pred_display:<12} | {avg_conf:<6.2f} | {sim:<6.2f} | {status}")

    print("-" * 85)
    clean_accuracy = (clean_exact_matches / clean_total * 100) if clean_total > 0 else 0.0
    overall_exact = (total_exact_matches / total_clips * 100)
    mean_similarity = (sum(similarity_scores) / total_clips * 100)

    # Category breakout
    category_breakdown = {}
    for cat, stats in category_stats.items():
        cat_acc = (stats["exact_matches"] / stats["total"] * 100) if stats["total"] > 0 else 0.0
        cat_sim = (sum(stats["similarities"]) / stats["total"] * 100) if stats["total"] > 0 else 0.0
        category_breakdown[cat] = {
            "total_clips": stats["total"],
            "exact_matches": stats["exact_matches"],
            "exact_accuracy_pct": round(cat_acc, 2),
            "mean_similarity_pct": round(cat_sim, 2)
        }

    summary_metrics = {
        "total_clips": total_clips,
        "clean_clips": clean_total,
        "clean_exact_accuracy_pct": round(clean_accuracy, 2),
        "adversarial_clips": adversarial_total,
        "overall_exact_accuracy_pct": round(overall_exact, 2),
        "mean_character_similarity_pct": round(mean_similarity, 2),
        "category_breakdown": category_breakdown,
        "clip_details": results
    }

    eval_out_path = os.path.join(DATA_DIR, "eval_results.json")
    with open(eval_out_path, "w") as f:
        json.dump(summary_metrics, f, indent=2)

    print("\n=== ACCURACY BREAKOUT BY CONDITION CATEGORY ===")
    for cat, info in category_breakdown.items():
        print(f"- {cat.upper():<10}: Exact Accuracy = {info['exact_accuracy_pct']}% ({info['exact_matches']}/{info['total_clips']}), Mean Sim = {info['mean_similarity_pct']}%")

    print("\n=== SUMMARY METRICS ===")
    print(f"Clean Condition Accuracy: {clean_accuracy:.1f}% ({clean_exact_matches}/{clean_total})")
    print(f"Overall Exact Match (including all 5 degradation conditions): {overall_exact:.1f}% ({total_exact_matches}/{total_clips})")
    print(f"Mean Character-Level Similarity: {mean_similarity:.1f}%")
    print(f"Detailed results written to: {eval_out_path}")

    return summary_metrics

if __name__ == "__main__":
    evaluate_pipeline()
