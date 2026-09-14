"""
Export static database queries to JSON files for STATIC_MODE (GitHub Pages).
Exports:
- /static_data/trajectory_TN09CB1234.json
- /static_data/trajectory_TN07AX4521.json
- /static_data/trajectory_TN22CY3311.json
- /static_data/trajectory_KA03MD5522.json
- /static_data/trajectory_TN10BE9876.json
- /static_data/trajectory_TN01AZ7788.json
- /static_data/heatmap.json
- /static_data/zones.json
- /static_data/corridor_baseline.json
- /static_data/traffic_trend.json
- /static_data/blacklist.json
- /static_data/alerts.json
- /static_data/audit_log.json
"""

import os
import json
import sqlite3
from database import get_db_connection
from match import fuse_sighting_pair

BASE_DIR = os.path.dirname(__file__)
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")
STATIC_DATA_DIR = os.path.join(FRONTEND_DIR, "static_data")

def export_static_json():
    os.makedirs(STATIC_DATA_DIR, exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()

    print("Exporting static snapshots to", STATIC_DATA_DIR)

    # 1. Heatmap
    cursor.execute("SELECT camera_id, lat, lon, COUNT(*) as count FROM sightings GROUP BY camera_id, lat, lon ORDER BY count DESC")
    heatmap = [dict(r) for r in cursor.fetchall()]
    with open(os.path.join(STATIC_DATA_DIR, "heatmap.json"), "w") as f:
        json.dump(heatmap, f, indent=2)

    # 2. Zones
    cursor.execute("SELECT zone_id, name, center_lat, center_lon, radius_meters, reason FROM restricted_zones")
    zones = [dict(r) for r in cursor.fetchall()]
    with open(os.path.join(STATIC_DATA_DIR, "zones.json"), "w") as f:
        json.dump(zones, f, indent=2)

    # 3. Corridor Baseline
    cursor.execute("SELECT camera_from, camera_to, distance_km, mean_transit_seconds, stddev_transit_seconds, sample_count, avg_speed_kmh, source FROM corridor_baseline ORDER BY sample_count DESC")
    baselines = [dict(r) for r in cursor.fetchall()]
    with open(os.path.join(STATIC_DATA_DIR, "corridor_baseline.json"), "w") as f:
        json.dump(baselines, f, indent=2)

    # 4. Traffic Trend
    cursor.execute("SELECT strftime('%H', timestamp) as hr, COUNT(*) as cnt FROM sightings GROUP BY hr ORDER BY hr ASC")
    rows = cursor.fetchall()
    trend_dict = {int(r["hr"]): r["cnt"] for r in rows if r["hr"] is not None}
    trends = []
    for h in range(8, 20):
        trends.append({"hour": f"{h:02d}:00", "count": trend_dict.get(h, 0)})
    with open(os.path.join(STATIC_DATA_DIR, "traffic_trend.json"), "w") as f:
        json.dump(trends, f, indent=2)

    # 5. Blacklist
    cursor.execute("SELECT plate_text, reason, added_on FROM blacklist")
    blacklist_rows = [dict(r) for r in cursor.fetchall()]
    with open(os.path.join(STATIC_DATA_DIR, "blacklist.json"), "w") as f:
        json.dump(blacklist_rows, f, indent=2)

    # 6. Alerts
    cursor.execute("SELECT alert_id, alert_type, sighting_id_a, sighting_id_b, detail_text, created_at FROM alerts ORDER BY alert_id DESC")
    alerts = [dict(r) for r in cursor.fetchall()]
    with open(os.path.join(STATIC_DATA_DIR, "alerts.json"), "w") as f:
        json.dump(alerts, f, indent=2)

    # 7. Audit Log
    cursor.execute("SELECT log_id, searched_by, searched_query, searched_at FROM audit_log ORDER BY log_id DESC")
    audit_log = [dict(r) for r in cursor.fetchall()]
    with open(os.path.join(STATIC_DATA_DIR, "audit_log.json"), "w") as f:
        json.dump(audit_log, f, indent=2)

    # 8. Trajectories for key demo plates
    demo_plates = ["TN09CB1234", "TN07AX4521", "TN22CY3311", "KA03MD5522", "TN10BE9876", "TN01AZ7788", "MH02EZ9012"]
    base_dict = {(r["camera_from"], r["camera_to"]): r for r in baselines}

    for plate in demo_plates:
        if plate == "TN01AZ7788":
            cursor.execute("SELECT * FROM sightings WHERE plate_text = 'TN01AZ7788' OR (camera_id = 'CAM_07' AND plate_text IS NULL) ORDER BY timestamp ASC")
        else:
            cursor.execute("SELECT * FROM sightings WHERE UPPER(plate_text) = ? ORDER BY timestamp ASC", (plate,))
        s_rows = [dict(r) for r in cursor.fetchall()]
        
        traj = []
        for i, s in enumerate(s_rows):
            if i == 0:
                hop = {
                    "sighting_id": s["sighting_id"],
                    "camera_id": s["camera_id"],
                    "lat": s["lat"],
                    "lon": s["lon"],
                    "timestamp": s["timestamp"],
                    "plate_text": s["plate_text"],
                    "snapshot_path": s["snapshot_path"],
                    "plate_score": 1.0 if s["plate_text"] else 0.0,
                    "visual_score": 1.0,
                    "transit_score": 1.0,
                    "composite_score": 1.0,
                    "timing_anomaly_score": 0.0,
                    "is_path_rare": False,
                    "speed_kmh": 0.0,
                    "distance_km": 0.0,
                    "plate_unconfirmed": s["plate_text"] is None,
                    "explanation": "Initial origin sighting"
                }
            else:
                prev = s_rows[i - 1]
                fusion = fuse_sighting_pair(prev, s, baseline_dict=base_dict)
                hop = {
                    "sighting_id": s["sighting_id"],
                    "camera_id": s["camera_id"],
                    "lat": s["lat"],
                    "lon": s["lon"],
                    "timestamp": s["timestamp"],
                    "plate_text": s["plate_text"],
                    "snapshot_path": s["snapshot_path"],
                    "plate_score": fusion["plate_score"],
                    "visual_score": fusion["visual_score"],
                    "transit_score": fusion["transit_score"],
                    "composite_score": fusion["composite_score"],
                    "timing_anomaly_score": fusion["timing_anomaly_score"],
                    "is_path_rare": fusion["is_path_rare"],
                    "speed_kmh": fusion["speed_kmh"],
                    "distance_km": fusion["distance_km"],
                    "plate_unconfirmed": fusion["plate_unconfirmed"],
                    "explanation": fusion["explanation"]
                }
            
            # Anomaly badge
            anom = []
            for a in alerts:
                if a["sighting_id_a"] == s["sighting_id"] or a["sighting_id_b"] == s["sighting_id"]:
                    anom.append(f"[{a['alert_type'].upper()}] {a['detail_text']}")
            hop["anomaly_badge"] = bool(anom)
            hop["anomaly_detail"] = " | ".join(anom) if anom else None
            traj.append(hop)

        with open(os.path.join(STATIC_DATA_DIR, f"trajectory_{plate}.json"), "w") as f:
            json.dump(traj, f, indent=2)

    conn.close()
    print("Static JSON files exported successfully.")

if __name__ == "__main__":
    export_static_json()
