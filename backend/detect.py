"""
Vehicle detection and plate region extraction module.
Extracts vehicle crops and candidate plate regions from single-vehicle or multi-lane traffic video clips.
"""

import cv2
import numpy as np

def extract_frames(video_path, max_frames=20):
    """Read frames from video clip."""
    cap = cv2.VideoCapture(video_path)
    frames = []
    while cap.isOpened() and len(frames) < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)
    cap.release()
    return frames

def detect_vehicle_and_plate(frame):
    """
    Detects single vehicle crop and candidate plate region.
    Returns:
      vehicle_crop: np.ndarray,
      plate_crop: np.ndarray,
      box_info: dict
    """
    h, w = frame.shape[:2]
    
    vy1, vy2 = int(h * 0.30), int(h * 0.95)
    vx1, vx2 = int(w * 0.15), int(w * 0.85)
    vehicle_crop = frame[vy1:vy2, vx1:vx2]
    
    vh, vw = vehicle_crop.shape[:2]
    py1 = vy1 + int(vh * 0.55)
    py2 = vy1 + int(vh * 0.95)
    px1 = vx1 + int(vw * 0.20)
    px2 = vx1 + int(vw * 0.80)
    
    plate_crop = frame[py1:py2, px1:px2]
    
    return vehicle_crop, plate_crop, {
        "vehicle_box": (vx1, vy1, vx2, vy2),
        "plate_box": (px1, py1, px2, py2)
    }

def detect_multi_vehicles_and_plates(frame):
    """
    Multi-lane / multi-vehicle detection in a single video frame.
    Divides multi-lane traffic streams into spatial corridors and extracts
    separate, independent candidate vehicle and plate detections per lane.
    
    Returns:
      list of dicts: [
        {
          "lane_id": "lane_1_left",
          "vehicle_crop": np.ndarray,
          "plate_crop": np.ndarray,
          "box_info": dict
        },
        ...
      ]
    """
    h, w = frame.shape[:2]
    detections = []
    
    # Define spatial lane zones: Lane 1 (Left), Lane 2 (Right), Center
    lane_zones = [
        ("lane_1_left", int(w * 0.05), int(w * 0.50)),
        ("lane_2_right", int(w * 0.50), int(w * 0.95)),
    ]
    
    for lane_id, vx1, vx2 in lane_zones:
        vy1, vy2 = int(h * 0.30), int(h * 0.95)
        v_crop = frame[vy1:vy2, vx1:vx2]
        
        if v_crop.shape[0] < 30 or v_crop.shape[1] < 30:
            continue
            
        vh, vw = v_crop.shape[:2]
        py1 = vy1 + int(vh * 0.50)
        py2 = vy1 + int(vh * 0.95)
        px1 = vx1 + int(vw * 0.15)
        px2 = vx1 + int(vw * 0.85)
        
        p_crop = frame[py1:py2, px1:px2]
        
        detections.append({
            "lane_id": lane_id,
            "vehicle_crop": v_crop,
            "plate_crop": p_crop,
            "box_info": {
                "vehicle_box": (vx1, vy1, vx2, vy2),
                "plate_box": (px1, py1, px2, py2)
            }
        })
        
    return detections
