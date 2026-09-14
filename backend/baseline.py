"""
Corridor baseline calculation and route-anomaly alert engine.
Directly implements corridor_baseline maintenance and all five alert types:
- clone
- impossible_transit
- blacklist
- zone_deviation
- route_anomaly
"""

import sqlite3
import math
from datetime import datetime
from database import get_db_connection
from match import calculate_haversine_km, compute_plate_similarity, compute_transit_plausibility
from embed import cosine_similarity

def haversine_meters(lat1, lon1, lat2, lon2):
    return calculate_haversine_km(lat1, lon1, lat2, lon2) * 1000.0

def recompute_corridor_baselines():
    """
    Recomputes mean and stddev transit times across camera pairs from observed sightings.
    Updates corridor_baseline table.
    Ensures stddev is floored to at least 15.0 seconds to prevent division-by-zero.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Find consecutive sightings of the same plate
    cursor.execute("""
        SELECT s1.camera_id AS cam_from, s2.camera_id AS cam_to,
               s1.lat AS lat1, s1.lon AS lon1, s2.lat AS lat2, s2.lon AS lon2,
               s1.timestamp AS t1, s2.timestamp AS t2, s1.plate_text
        FROM sightings s1
        JOIN sightings s2 ON s1.plate_text = s2.plate_text 
                         AND s1.sighting_id < s2.sighting_id
                         AND s1.camera_id != s2.camera_id
                         AND s1.plate_text IS NOT NULL
        ORDER BY s1.timestamp ASC
    """)
    rows = cursor.fetchall()

    corridor_transits = {}
    for r in rows:
        key = (r["cam_from"], r["cam_to"])
        t1 = datetime.fromisoformat(r["t1"])
        t2 = datetime.fromisoformat(r["t2"])
        dt = (t2 - t1).total_seconds()
        if 10.0 <= dt <= 7200.0: # Filter sensible observation window
            dist_km = calculate_haversine_km(r["lat1"], r["lon1"], r["lat2"], r["lon2"])
            if key not in corridor_transits:
                corridor_transits[key] = {"times": [], "dist_km": dist_km}
            corridor_transits[key]["times"].append(dt)

    now = datetime.now().isoformat()
    for (cam_from, cam_to), data in corridor_transits.items():
        times = data["times"]
        dist_km = data["dist_km"]
        count = len(times)
        mean_t = sum(times) / count
        if count > 1:
            variance = sum((x - mean_t) ** 2 for x in times) / (count - 1)
            stddev_t = max(15.0, math.sqrt(variance))
        else:
            stddev_t = 30.0 # Default positive floor
        
        avg_speed = dist_km / (mean_t / 3600.0) if mean_t > 0 else 0.0

        # Check existing row
        cursor.execute("SELECT id, source, sample_count FROM corridor_baseline WHERE camera_from = ? AND camera_to = ?", (cam_from, cam_to))
        existing = cursor.fetchone()
        if existing:
            new_source = 'mixed' if existing['source'] == 'seed' else 'observed'
            new_count = existing['sample_count'] + count
            cursor.execute("""
                UPDATE corridor_baseline
                SET mean_transit_seconds = ?, stddev_transit_seconds = ?, sample_count = ?,
                    avg_speed_kmh = ?, source = ?, updated_at = ?
                WHERE id = ?
            """, (round(mean_t, 1), round(stddev_t, 1), new_count, round(avg_speed, 2), new_source, now, existing['id']))
        else:
            cursor.execute("""
                INSERT INTO corridor_baseline
                (camera_from, camera_to, distance_km, mean_transit_seconds, stddev_transit_seconds, sample_count, avg_speed_kmh, source, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'observed', ?)
            """, (cam_from, cam_to, round(dist_km, 2), round(mean_t, 1), round(stddev_t, 1), count, round(avg_speed, 2), now))

    conn.commit()
    conn.close()

def scan_all_alerts():
    """
    Executes a comprehensive scan across all sightings and generates all 5 alert types:
    1. blacklist
    2. zone_deviation
    3. impossible_transit
    4. clone
    5. route_anomaly
    
    Returns total new alerts created.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Load sightings
    cursor.execute("SELECT * FROM sightings ORDER BY timestamp ASC")
    sightings = [dict(r) for r in cursor.fetchall()]

    # Load blacklist
    cursor.execute("SELECT * FROM blacklist")
    blacklist_map = {r["plate_text"].strip().upper(): r["reason"] for r in cursor.fetchall()}

    # Load restricted zones
    cursor.execute("SELECT * FROM restricted_zones")
    zones = [dict(r) for r in cursor.fetchall()]

    # Load corridor baselines
    cursor.execute("SELECT * FROM corridor_baseline")
    baselines = {(r["camera_from"], r["camera_to"]): dict(r) for r in cursor.fetchall()}

    alerts_to_insert = []
    now = datetime.now().isoformat()

    # 1. Blacklist alerts
    for s in sightings:
        plate = (s.get("plate_text") or "").strip().upper()
        if plate and plate in blacklist_map:
            reason = blacklist_map[plate]
            detail = f"Blacklist hit: Vehicle '{plate}' detected at {s['camera_id']} ({s['lat']:.4f}, {s['lon']:.4f}). Reason on file: {reason}"
            alerts_to_insert.append(('blacklist', s['sighting_id'], None, detail, now))

    # 2. Zone deviation alerts
    for s in sightings:
        s_lat, s_lon = s["lat"], s["lon"]
        for z in zones:
            dist_m = haversine_meters(s_lat, s_lon, z["center_lat"], z["center_lon"])
            if dist_m <= z["radius_meters"]:
                detail = (f"Restricted zone entry: Sighting {s['sighting_id']} ({s.get('plate_text') or 'unconfirmed'}) "
                          f"entered '{z['name']}' (offset {dist_m:.1f}m <= {z['radius_meters']:.0f}m radius). "
                          f"Restriction: {z.get('reason', 'High security area')}")
                alerts_to_insert.append(('zone_deviation', s['sighting_id'], None, detail, now))

    # 3. Inter-sighting pairs: Impossible Transit, Clone, Route Anomaly
    for i in range(len(sightings)):
        s1 = sightings[i]
        for j in range(i + 1, len(sightings)):
            s2 = sightings[j]

            t1 = datetime.fromisoformat(s1["timestamp"])
            t2 = datetime.fromisoformat(s2["timestamp"])
            dt_sec = (t2 - t1).total_seconds()
            if dt_sec < 0 or dt_sec > 14400: # Only analyze hops within 4 hours
                continue

            dist_km = calculate_haversine_km(s1["lat"], s1["lon"], s2["lat"], s2["lon"])
            speed_kmh = (dist_km / (dt_sec / 3600.0)) if dt_sec > 0 else 999.0

            p1 = (s1.get("plate_text") or "").strip().upper()
            p2 = (s2.get("plate_text") or "").strip().upper()
            vis_sim = cosine_similarity(s1.get("embedding", "[]"), s2.get("embedding", "[]"))

            # Check 3a: Clone Alert
            # Triggered on contradictory visual identity for same plate, OR simultaneous distant cameras (<180s, >4km)
            if p1 and p2 and p1 == p2 and s1["camera_id"] != s2["camera_id"]:
                if vis_sim < 0.45:
                    detail = (f"Plate clone detected: Plate '{p1}' matches at {s1['camera_id']} and {s2['camera_id']}, "
                              f"but visual appearance similarity is only {vis_sim*100:.1f}% (<45.0% threshold). "
                              f"Conflicting vehicle body attributes indicate cloned plate.")
                    alerts_to_insert.append(('clone', s1['sighting_id'], s2['sighting_id'], detail, now))
                elif dt_sec < 180.0 and dist_km > 4.0:
                    detail = (f"Plate clone detected: Plate '{p1}' sighted at {s1['camera_id']} and {s2['camera_id']} "
                              f"within {dt_sec:.0f}s across {dist_km:.2f} km (required speed {speed_kmh:.1f} km/h). "
                              f"Physical impossibility of single vehicle traversing distance confirms duplicate cloned plate.")
                    alerts_to_insert.append(('clone', s1['sighting_id'], s2['sighting_id'], detail, now))

            # Check 3b: Impossible Transit Alert (Urban physics speed violation)
            if s1["camera_id"] != s2["camera_id"] and p1 and p2 and p1 == p2:
                if speed_kmh > 140.0:
                    detail = (f"Impossible transit speed: Vehicle '{p1}' moved from {s1['camera_id']} to {s2['camera_id']} "
                              f"({dist_km:.2f} km in {dt_sec:.0f}s) at {speed_kmh:.1f} km/h, exceeding the maximum 140.0 km/h urban safety limit.")
                    alerts_to_insert.append(('impossible_transit', s1['sighting_id'], s2['sighting_id'], detail, now))

            # Check 3c: Route Anomaly Alert
            # Evaluated against corridor baseline statistics
            corridor_key = (s1["camera_id"], s2["camera_id"])
            if corridor_key in baselines and p1 and p2 and p1 == p2:
                base = baselines[corridor_key]
                mean_t = base["mean_transit_seconds"]
                std_t = max(15.0, base["stddev_transit_seconds"])
                z_score = (dt_sec - mean_t) / std_t
                if z_score > 3.0:
                    detail = (f"Statistical route anomaly: Transit from {s1['camera_id']} to {s2['camera_id']} took {dt_sec:.0f}s ({dt_sec/60.0:.1f} min). "
                              f"Normal corridor baseline is {mean_t:.0f}±{std_t:.0f}s ({mean_t/60.0:.1f} min). "
                              f"Deviation is +{z_score:.2f}σ, exceeding the 3.00σ threshold.")
                    alerts_to_insert.append(('route_anomaly', s1['sighting_id'], s2['sighting_id'], detail, now))

    # Deduplicate and insert into alerts table
    alerts_created = 0
    for alert_type, s_a, s_b, detail, created in alerts_to_insert:
        # Check if identical alert already exists
        cursor.execute("""
            SELECT alert_id FROM alerts 
            WHERE alert_type = ? AND sighting_id_a = ? AND (sighting_id_b = ? OR (sighting_id_b IS NULL AND ? IS NULL))
        """, (alert_type, s_a, s_b, s_b))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO alerts (alert_type, sighting_id_a, sighting_id_b, detail_text, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (alert_type, s_a, s_b, detail, created))
            alerts_created += 1

    conn.commit()
    conn.close()
    return alerts_created

if __name__ == "__main__":
    recompute_corridor_baselines()
    created = scan_all_alerts()
    print(f"Corridor baselines recomputed. Alerts created: {created}")
