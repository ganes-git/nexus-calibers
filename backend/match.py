"""
Identity-Fusion Trajectory Matching Engine.
Fuses plate text similarity, visual appearance embedding cosine similarity,
and travel-time plausibility into an explainable per-hop confidence score.
Survives occluded/unconfirmed plates via adaptive fallback to appearance + transit signals.
"""

import math
import difflib
from datetime import datetime
from embed import cosine_similarity

def calculate_haversine_km(lat1, lon1, lat2, lon2):
    """Computes great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def calculate_bearing(lat1, lon1, lat2, lon2):
    """
    Computes initial Great-Circle bearing in degrees (0-360) and cardinal direction.
    Returns: (bearing_deg: float, cardinal: str, arrow: str)
    """
    if lat1 == lat2 and lon1 == lon2:
        return 0.0, "N", "↑"
        
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    
    y = math.sin(dlambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    
    bearing = (math.degrees(math.atan2(y, x)) + 360.0) % 360.0
    
    # Map bearing to 8 cardinal directions and arrows
    directions = [
        (22.5, 67.5, "NE", "↗"),
        (67.5, 112.5, "E", "→"),
        (112.5, 157.5, "SE", "↘"),
        (157.5, 202.5, "S", "↓"),
        (202.5, 247.5, "SW", "↙"),
        (247.5, 292.5, "W", "←"),
        (292.5, 337.5, "NW", "↖"),
    ]
    for low, high, card, arrow in directions:
        if low <= bearing < high:
            return round(bearing, 1), card, arrow
            
    return round(bearing, 1), "N", "↑"

def compute_plate_similarity(plate1, plate2):
    """Normalized string similarity in [0, 1]."""
    if not plate1 or not plate2:
        return 0.0
    p1 = str(plate1).strip().upper()
    p2 = str(plate2).strip().upper()
    if p1 == p2:
        return 1.0
    return difflib.SequenceMatcher(None, p1, p2).ratio()

def compute_transit_plausibility(distance_km, transit_seconds, corridor_mean=None, corridor_std=None):
    """
    Computes transit plausibility score in [0, 1].
    - Physical impossibility (>150 km/h or <= 0s): 0.0
    - Normal city traffic (15-60 km/h): 0.85 - 1.0
    - Congested / stopover: 0.40 - 0.70
    """
    if transit_seconds <= 0:
        return 0.0, 0.0, 0.0
    
    speed_kmh = distance_km / (transit_seconds / 3600.0)
    
    # Physical speed cap for city road network
    if speed_kmh > 150.0:
        # Impossible speed
        transit_score = max(0.0, 1.0 - (speed_kmh - 150.0) / 50.0)
    elif 15.0 <= speed_kmh <= 80.0:
        transit_score = 0.95
    elif speed_kmh > 80.0:
        # High speed for city
        transit_score = max(0.2, 0.95 - (speed_kmh - 80.0) / 100.0)
    else:
        # Slow / stopover / traffic jam
        transit_score = max(0.40, 0.95 - (15.0 - speed_kmh) * 0.04)

    # Statistical timing anomaly z-score against corridor baseline if available
    anomaly_z = 0.0
    if corridor_mean is not None and corridor_std is not None and corridor_std > 0:
        anomaly_z = abs(transit_seconds - corridor_mean) / corridor_std

    return round(transit_score, 3), round(speed_kmh, 1), round(anomaly_z, 2)

def fuse_sighting_pair(sighting_a, sighting_b, baseline_dict=None):
    """
    Computes fusion scores between two consecutive sightings of a vehicle trail.
    
    Returns:
      dict with:
        plate_score: float
        visual_score: float
        transit_score: float
        composite_score: float
        speed_kmh: float
        timing_anomaly_score: float
        is_path_rare: bool
        plate_unconfirmed: bool
        explanation: str
    """
    p1 = sighting_a.get("plate_text")
    p2 = sighting_b.get("plate_text")
    
    # 1. Plate score
    if p1 and p2:
        plate_score = compute_plate_similarity(p1, p2)
        plate_unconfirmed = False
    else:
        plate_score = 0.0
        plate_unconfirmed = True

    # 2. Visual score
    emb1 = sighting_a.get("embedding", "[]")
    emb2 = sighting_b.get("embedding", "[]")
    visual_score = cosine_similarity(emb1, emb2)

    # 3. Transit score
    lat1, lon1 = sighting_a["lat"], sighting_a["lon"]
    lat2, lon2 = sighting_b["lat"], sighting_b["lon"]
    dist_km = calculate_haversine_km(lat1, lon1, lat2, lon2)
    
    t1 = sighting_a["timestamp"]
    t2 = sighting_b["timestamp"]
    if isinstance(t1, str):
        t1 = datetime.fromisoformat(t1)
    if isinstance(t2, str):
        t2 = datetime.fromisoformat(t2)
        
    dt_seconds = abs((t2 - t1).total_seconds())

    # Check baseline if corridor exists
    cam_from = sighting_a.get("camera_id")
    cam_to = sighting_b.get("camera_id")
    corridor_key = (cam_from, cam_to)
    
    b_mean, b_std, sample_count = None, None, 0
    if baseline_dict and corridor_key in baseline_dict:
        b_mean = baseline_dict[corridor_key]["mean_transit_seconds"]
        b_std = baseline_dict[corridor_key]["stddev_transit_seconds"]
        sample_count = baseline_dict[corridor_key].get("sample_count", 0)

    transit_score, speed_kmh, anomaly_z = compute_transit_plausibility(
        dist_km, dt_seconds, corridor_mean=b_mean, corridor_std=b_std
    )
    
    is_rare = (sample_count < 10)

    # 4. Composite score calculation
    if not plate_unconfirmed:
        # Standard weighted combination
        # w_plate = 0.50, w_vis = 0.30, w_transit = 0.20
        composite = 0.50 * plate_score + 0.30 * visual_score + 0.20 * transit_score
        explanation = f"Plate match {plate_score*100:.1f}%, visual similarity {visual_score*100:.1f}%, transit speed {speed_kmh} km/h"
    else:
        # Plate unconfirmed fallback: adaptive reallocation to visual and transit signals
        # w_vis = 0.65, w_transit = 0.35
        composite = 0.65 * visual_score + 0.35 * transit_score
        explanation = f"Plate unconfirmed — visual similarity fallback {visual_score*100:.1f}%, transit plausibility {transit_score*100:.1f}% ({speed_kmh} km/h)"

    bearing_deg, heading_card, heading_arrow = calculate_bearing(lat1, lon1, lat2, lon2)
    heading_str = f"{heading_arrow} {heading_card} ({bearing_deg}°)"

    return {
        "plate_score": round(plate_score, 3),
        "visual_score": round(visual_score, 3),
        "transit_score": round(transit_score, 3),
        "composite_score": round(composite, 3),
        "speed_kmh": speed_kmh,
        "distance_km": round(dist_km, 2),
        "bearing_deg": bearing_deg,
        "heading": heading_str,
        "heading_arrow": heading_arrow,
        "heading_card": heading_card,
        "transit_seconds": round(dt_seconds, 1),
        "timing_anomaly_score": round(anomaly_z, 2),
        "is_path_rare": is_rare,
        "plate_unconfirmed": plate_unconfirmed,
        "explanation": explanation
    }
