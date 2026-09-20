"""
seed_diverse_vehicles.py
Populates multi-hop trajectories for 10+ distinct vehicle types:
- CAR (Sedan / Hatchback)
- SUV (Patrol / Private)
- BUS (MTC Transit)
- TRUCK / LORRY (Heavy Goods Commercial)
- MOTORCYCLE / BIKE (Two-Wheeler)
- AUTO_RICKSHAW (Three-Wheeler)
- AMBULANCE (Emergency Services)
- VAN (Logistics / Delivery)
"""

import os
import json
import sqlite3
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, "anpr.db")

CAMERAS = {
    "CAM_01": {"name": "Gemini Flyover (Anna Salai)", "lat": 13.0522, "lon": 80.2467},
    "CAM_02": {"name": "Thousand Lights (Anna Salai)", "lat": 13.0577, "lon": 80.2497},
    "CAM_03": {"name": "Spencers Plaza (Anna Salai)", "lat": 13.0620, "lon": 80.2601},
    "CAM_04": {"name": "Panagal Park (T. Nagar)", "lat": 13.0397, "lon": 80.2325},
    "CAM_05": {"name": "Guindy Junction (GST Rd)", "lat": 13.0070, "lon": 80.2093},
    "CAM_06": {"name": "Saidapet (Maraimalai Rd)", "lat": 13.0227, "lon": 80.2210},
    "CAM_07": {"name": "Marina Beach (Kamarajar Salai)", "lat": 13.0540, "lon": 80.2820},
    "CAM_08": {"name": "Madhya Kailash (Adyar)", "lat": 13.0102, "lon": 80.2457}
}

VEHICLE_SCENARIOS = [
    {
        "plate": "TN09CB1234",
        "type": "CAR",
        "route": ["CAM_05", "CAM_06", "CAM_01", "CAM_02", "CAM_03", "CAM_07"],
        "intervals": [0, 360, 940, 1090, 1230, 1680],
        "conf": 0.98,
        "snap": "snapshots/snap_clip_01.jpg"
    },
    {
        "plate": "TN02BZ9876",
        "type": "SUV",
        "route": ["CAM_08", "CAM_06", "CAM_04", "CAM_01", "CAM_02"],
        "intervals": [0, 420, 780, 1140, 1300],
        "conf": 0.97,
        "snap": "snapshots/snap_clip_02.jpg"
    },
    {
        "plate": "TN04AB5501",
        "type": "BUS",
        "route": ["CAM_05", "CAM_06", "CAM_04", "CAM_01", "CAM_02", "CAM_03"],
        "intervals": [0, 480, 960, 1420, 1650, 1880],
        "conf": 0.99,
        "snap": "snapshots/snap_clip_03.jpg"
    },
    {
        "plate": "TN22TR8844",
        "type": "TRUCK",
        "route": ["CAM_05", "CAM_06", "CAM_01", "CAM_02", "CAM_03"],
        "intervals": [0, 520, 1200, 1420, 1640],
        "conf": 0.95,
        "snap": "snapshots/snap_clip_04.jpg"
    },
    {
        "plate": "TN07BK3322",
        "type": "MOTORCYCLE",
        "route": ["CAM_08", "CAM_07", "CAM_03", "CAM_02", "CAM_01"],
        "intervals": [0, 580, 890, 1020, 1150],
        "conf": 0.94,
        "snap": "snapshots/snap_clip_05.jpg"
    },
    {
        "plate": "TN01AT4411",
        "type": "AUTO_RICKSHAW",
        "route": ["CAM_04", "CAM_01", "CAM_02", "CAM_03", "CAM_07"],
        "intervals": [0, 420, 600, 780, 1250],
        "conf": 0.96,
        "snap": "snapshots/snap_clip_06.jpg"
    },
    {
        "plate": "TN10AM6677",
        "type": "AMBULANCE",
        "route": ["CAM_05", "CAM_06", "CAM_01", "CAM_02", "CAM_07"],
        "intervals": [0, 180, 460, 540, 780],
        "conf": 0.99,
        "snap": "snapshots/snap_clip_01.jpg"
    },
    {
        "plate": "TN05VN2299",
        "type": "VAN",
        "route": ["CAM_08", "CAM_06", "CAM_01", "CAM_04"],
        "intervals": [0, 440, 1010, 1380],
        "conf": 0.97,
        "snap": "snapshots/snap_clip_02.jpg"
    },
    {
        "plate": "KA03MD5522",
        "type": "LORRY",
        "route": ["CAM_05", "CAM_06", "CAM_01", "CAM_02", "CAM_03"],
        "intervals": [0, 360, 3400, 3550, 3700], # 41 min delay anomaly
        "conf": 0.96,
        "snap": "snapshots/snap_clip_04.jpg"
    },
    {
        "plate": "TN07AX4521",
        "type": "SUV",
        "route": ["CAM_08", "CAM_06", "CAM_01", "CAM_02", "CAM_07"],
        "intervals": [0, 380, 920, 1070, 1450],
        "conf": 0.98,
        "snap": "snapshots/snap_clip_02.jpg"
    },
    {
        "plate": "TN22CY3311",
        "type": "CAR",
        "route": ["CAM_05", "CAM_06", "CAM_01", "CAM_02"],
        "intervals": [0, 68, 140, 175], # 222 km/h extreme speed anomaly
        "conf": 0.99,
        "snap": "snapshots/snap_clip_05.jpg"
    },
    {
        "plate": "TN01AZ7788",
        "type": "HATCHBACK",
        "route": ["CAM_01", "CAM_02", "CAM_03", "CAM_07"],
        "intervals": [0, 150, 300, 720],
        "conf": 0.88,
        "snap": "snapshots/snap_clip_03.jpg"
    }
]

def seed_vehicles():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    base_time = datetime(2026, 3, 14, 9, 30, 0)

    print("Seeding multi-hop sightings for 12 distinct vehicle types...")

    for v in VEHICLE_SCENARIOS:
        plate = v["plate"]
        vtype = v["type"]
        conf = v["conf"]
        snap = v["snap"]

        # Delete any existing sightings for this plate to avoid duplication
        cursor.execute("DELETE FROM sightings WHERE plate_text = ?", (plate,))

        for cam_id, dt in zip(v["route"], v["intervals"]):
            cam = CAMERAS[cam_id]
            ts = (base_time + timedelta(seconds=dt)).isoformat()
            emb = json.dumps([0.12, 0.45, 0.78, 0.23, 0.56, 0.89, 0.34, 0.67])

            cursor.execute("""
                INSERT INTO sightings (camera_id, lat, lon, timestamp, plate_text, plate_confidence, embedding, snapshot_path, vehicle_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (cam_id, cam["lat"], cam["lon"], ts, plate, conf, emb, snap, vtype))

    conn.commit()
    conn.close()
    print("Successfully seeded all 12 vehicle types.")

if __name__ == "__main__":
    seed_vehicles()
