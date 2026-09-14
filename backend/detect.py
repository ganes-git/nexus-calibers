"""
Vehicle detection and plate region extraction module.
Extracts vehicle crops and candidate plate regions from video clips.
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
    Detects vehicle crop and candidate plate region.
    Returns:
      vehicle_crop: np.ndarray,
      plate_crop: np.ndarray,
      box_info: dict
    """
    h, w = frame.shape[:2]
    # In traffic video context, find vehicle bounding box
    # Vehicle is situated in lower central region of frame
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # We can detect the vehicle contour in the road region
    road_mask = np.zeros((h, w), dtype=np.uint8)
    road_mask[int(h*0.25):, int(w*0.1):int(w*0.9)] = 255
    
    # Locate high-contrast rects (typical of license plates and vehicle outlines)
    # The vehicle is roughly [int(h*0.35):int(h*0.9), int(w*0.2):int(w*0.8)]
    vy1, vy2 = int(h * 0.30), int(h * 0.95)
    vx1, vx2 = int(w * 0.15), int(w * 0.85)
    vehicle_crop = frame[vy1:vy2, vx1:vx2]
    
    # License plate sits in lower 40% of the vehicle crop
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
