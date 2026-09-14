"""
Complete Ingestion Orchestration for ANPR Trajectory & Route-Anomaly Engine.
Ingests camera clips and creates realistic multi-camera trajectory scenarios:
1. Normal clean trajectory (TN09CB1234 across Anna Salai corridor)
2. Blacklist hit (TN07AX4521)
3. Impossible transit speed alert (TN22CY3311: 222.9 km/h)
4. Route anomaly alert (KA03MD5522: 41 min transit vs 9.7 min normal baseline, +25.07σ)
5. Plate clone alert (TN10BE9876: simultaneous distant sighting conflict)
6. Restricted zone violation (MH02EZ9012 entering Marina Pedestrian Heritage Zone)
7. Occluded / unconfirmed plate survival (TN01AZ7788: visual Re-ID fallback)
"""

import os
import json
import sqlite3
from datetime import datetime, timedelta
import cv2

from database import get_db_connection, init_db, seed_static_metadata
from detect import extract_frames, detect_vehicle_and_plate
from ocr import recognize_plate
from vote import multi_frame_vote
from embed import extract_visual_embedding
from baseline import recompute_corridor_baselines, scan_all_alerts

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
CAMERAS_FILE = os.path.join(DATA_DIR, "cameras.json")
GROUND_TRUTH_FILE = os.path.join(DATA_DIR, "ground_truth.json")

def ingest_dataset():
    print("Step 1: Initializing database and static metadata...")
    init_db()
    seed_static_metadata()

    with open(CAMERAS_FILE, "r") as f:
        cameras = json.load(f)

    with open(GROUND_TRUTH_FILE, "r") as f:
        ground_truth = json.load(f)

    # Process all clips and extract real visual embeddings and OCR votes
    clip_models = {}
    print("Step 2: Processing video clips through detection, OCR voting, and visual embedding...")
    for item in ground_truth:
        clip_rel = item["clip_path"].replace("backend/", "")
        clip_path = os.path.join(BASE_DIR, clip_rel)
        frames = extract_frames(clip_path, max_frames=20)
        
        frame_preds = []
        best_crop = None
        for idx, frame in enumerate(frames):
            v_crop, p_crop, _ = detect_vehicle_and_plate(frame)
            text, conf, _ = recognize_plate(p_crop)
            frame_preds.append({"plate_text": text, "confidence": conf, "frame_index": idx})
            if idx == len(frames) - 2:
                best_crop = v_crop

        plate_text, avg_conf, _ = multi_frame_vote(frame_preds)
        embedding_json = extract_visual_embedding(best_crop)
        
        clip_models[item["clip_id"]] = {
            "plate_text": plate_text, # None for unconfirmed adversarial clip
            "plate_confidence": avg_conf,
            "embedding": embedding_json,
            "snapshot_path": item["snapshot_path"],
            "true_plate": item["true_plate"]
        }
        print(f"Processed {item['clip_id']}: plate={plate_text or 'UNCONFIRMED'}, conf={avg_conf:.2f}")

    # Build end-to-end multi-hop trajectory scenarios
    print("Step 3: Generating multi-hop spatial-temporal sighting records...")
    base_time = datetime(2026, 3, 14, 9, 0, 0)
    sightings = []

    # Helper to create sighting record
    def add_sighting(cam_id, dt_offset_seconds, clip_id, override_plate=None, override_conf=None, override_emb=None):
        cam = cameras[cam_id]
        t = (base_time + timedelta(seconds=dt_offset_seconds)).isoformat()
        clip_data = clip_models.get(clip_id, {})
        plate = override_plate if override_plate is not None else clip_data.get("plate_text")
        conf = override_conf if override_conf is not None else clip_data.get("plate_confidence")
        emb = override_emb if override_emb is not None else clip_data.get("embedding")
        snap = clip_data.get("snapshot_path")
        sightings.append((cam_id, cam["lat"], cam["lon"], t, plate, conf, emb, snap))

    # Scenario 1: Clean multi-hop trajectory along Anna Salai corridor (TN09CB1234)
    # CAM_05 (Guindy) -> CAM_06 (Saidapet) -> CAM_01 (Gemini) -> CAM_02 (Thousand Lights) -> CAM_03 (Spencers)
    add_sighting("CAM_05", 0, "clip_01")
    add_sighting("CAM_06", 360, "clip_01")
    add_sighting("CAM_01", 940, "clip_01")
    add_sighting("CAM_02", 1090, "clip_01")
    add_sighting("CAM_03", 1230, "clip_01")

    # Scenario 2: Blacklist vehicle match (TN07AX4521)
    add_sighting("CAM_04", 1800, "clip_02")
    add_sighting("CAM_01", 2180, "clip_02") # Panagal Park to Gemini

    # Scenario 3: Impossible transit speed (TN22CY3311)
    # CAM_05 to CAM_06 is 2.6 km; transit in 42 seconds = 222.9 km/h!
    add_sighting("CAM_05", 3600, "clip_05")
    add_sighting("CAM_06", 3642, "clip_05")

    # Scenario 4: Statistical route anomaly (KA03MD5522)
    # CAM_06 to CAM_01 normal transit is 580±75s; here it takes 2460s (41 mins, +25.07σ)
    add_sighting("CAM_06", 4500, "clip_04")
    add_sighting("CAM_01", 6960, "clip_04")

    # Scenario 5: Plate Clone conflict (TN10BE9876)
    # Sighting at CAM_01 and then CAM_07 only 120s later (7.5 km away = 225 km/h, different camera)
    add_sighting("CAM_01", 7200, "clip_03")
    add_sighting("CAM_07", 7320, "clip_03")

    # Scenario 6: Restricted zone entry (MH02EZ9012)
    # Sighting at CAM_07 located directly within the Marina Pedestrian Heritage Zone (42m from center)
    add_sighting("CAM_08", 8000, "clip_06")
    add_sighting("CAM_07", 8900, "clip_06")

    # Scenario 7: Occluded / unconfirmed plate trajectory survival (TN01AZ7788)
    # Hop 1: Clear sighting at CAM_08 (plate confirmed)
    # Hop 2: Blurred plate at CAM_07 (plate unconfirmed None, survives via visual Re-ID + transit score)
    clean_emb = clip_models["clip_07"]["embedding"]
    add_sighting("CAM_08", 9600, "clip_07", override_plate="TN01AZ7788", override_conf=0.92)
    add_sighting("CAM_07", 10500, "clip_07", override_plate=None, override_conf=0.0) # Unconfirmed hop

    # Additional traffic sightings across hours to populate Traffic Trends (hourly distribution)
    # Distribute throughout the day 08:00 to 18:00
    hourly_clips = ["clip_01", "clip_02", "clip_03", "clip_04", "clip_05", "clip_06", "clip_08"]
    cams_list = list(cameras.keys())
    for h_idx in range(11): # Hours 08 to 18
        sec_h = (h_idx - 1) * 3600
        for i_cam, cam_id in enumerate(cams_list):
            c_id = hourly_clips[(h_idx + i_cam) % len(hourly_clips)]
            t_offset = sec_h + i_cam * 240 + (h_idx * 73) % 500
            add_sighting(cam_id, t_offset, c_id)

    # Insert all into database
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sightings;")
    cursor.execute("DELETE FROM alerts;")
    cursor.execute("DELETE FROM audit_log;")

    cursor.executemany("""
        INSERT INTO sightings (camera_id, lat, lon, timestamp, plate_text, plate_confidence, embedding, snapshot_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, sightings)
    conn.commit()
    print(f"Inserted {len(sightings)} sightings into database.")

    # Step 4: Recompute corridor baselines and scan alerts
    print("Step 4: Recomputing corridor baselines and scanning for all 5 alert types...")
    recompute_corridor_baselines()
    alerts_count = scan_all_alerts()
    print(f"Alert scan completed. Total alerts generated: {alerts_count}")

    # Verify counts
    cursor.execute("SELECT alert_type, COUNT(*) as cnt FROM alerts GROUP BY alert_type;")
    alert_summary = cursor.fetchall()
    print("Alert breakdown by type:")
    for row in alert_summary:
        print(f" - {row['alert_type']}: {row['cnt']}")

    conn.close()
    print("Complete dataset ingestion and alert generation finished successfully!")

if __name__ == "__main__":
    ingest_dataset()
