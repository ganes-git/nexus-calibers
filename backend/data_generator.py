"""
Demo data generator for City-Wide ANPR Trajectory & Route-Anomaly Engine.
Generates:
1. Ground truth metadata (ground_truth.json)
2. Camera definitions anchored to real Chennai junction cluster
3. Synthetic video clips and representative snapshots:
   - 6 clean clips (various vehicles and plates)
   - 1 blurred/occluded adversarial clip (TN01AZ7788)
   - 1 low-contrast adversarial clip (TN05BK6655)
"""

import os
import json
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CLIPS_DIR = os.path.join(DATA_DIR, "clips")
SNAPSHOTS_DIR = os.path.join(DATA_DIR, "snapshots")
os.makedirs(CLIPS_DIR, exist_ok=True)
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

# 8 Chennai junction cameras
CAMERAS = {
    "CAM_01": {"name": "Gemini Flyover (Anna Salai)", "lat": 13.0528, "lon": 80.2512},
    "CAM_02": {"name": "Thousand Lights (Anna Salai)", "lat": 13.0610, "lon": 80.2580},
    "CAM_03": {"name": "Spencers Plaza (Anna Salai)", "lat": 13.0674, "lon": 80.2642},
    "CAM_04": {"name": "Panagal Park (T. Nagar)", "lat": 13.0405, "lon": 80.2337},
    "CAM_05": {"name": "Kathipara Junction (Guindy)", "lat": 13.0076, "lon": 80.2036},
    "CAM_06": {"name": "Maraimalai Adigal Bridge (Saidapet)", "lat": 13.0232, "lon": 80.2228},
    "CAM_07": {"name": "Marina Beach (Kamarajar Salai)", "lat": 13.0544, "lon": 80.2825},
    "CAM_08": {"name": "Madhya Kailash (Adyar)", "lat": 13.0067, "lon": 80.2443}
}

# Vehicles and ground truth
VEHICLES = [
    {
        "clip_id": "clip_01",
        "camera_id": "CAM_01",
        "plate_text": "TN09CB1234",
        "condition": "clean",
        "vehicle_type": "white sedan",
        "vehicle_color": (230, 230, 235),
        "plate_bg": (255, 255, 255),
        "adversarial": False
    },
    {
        "clip_id": "clip_02",
        "camera_id": "CAM_02",
        "plate_text": "TN07AX4521",
        "condition": "clean",
        "vehicle_type": "black suv",
        "vehicle_color": (35, 35, 40),
        "plate_bg": (255, 255, 255),
        "adversarial": False
    },
    {
        "clip_id": "clip_03",
        "camera_id": "CAM_03",
        "plate_text": "TN10BE9876",
        "condition": "clean",
        "vehicle_type": "silver hatchback",
        "vehicle_color": (180, 185, 190),
        "plate_bg": (255, 255, 255),
        "adversarial": False
    },
    {
        "clip_id": "clip_04",
        "camera_id": "CAM_04",
        "plate_text": "KA03MD5522",
        "condition": "clean",
        "vehicle_type": "yellow auto-taxi",
        "vehicle_color": (210, 175, 40),
        "plate_bg": (245, 210, 40), # Yellow commercial plate
        "adversarial": False
    },
    {
        "clip_id": "clip_05",
        "camera_id": "CAM_05",
        "plate_text": "TN22CY3311",
        "condition": "clean",
        "vehicle_type": "red hatchback",
        "vehicle_color": (170, 30, 35),
        "plate_bg": (255, 255, 255),
        "adversarial": False
    },
    {
        "clip_id": "clip_06",
        "camera_id": "CAM_06",
        "plate_text": "MH02EZ9012",
        "condition": "clean",
        "vehicle_type": "dark blue truck",
        "vehicle_color": (40, 50, 75),
        "plate_bg": (255, 255, 255),
        "adversarial": False
    },
    {
        "clip_id": "clip_07",
        "camera_id": "CAM_07",
        "plate_text": "TN01AZ7788",
        "condition": "blurred_occluded",
        "vehicle_type": "green sedan",
        "vehicle_color": (45, 80, 55),
        "plate_bg": (240, 240, 240),
        "adversarial": True
    },
    {
        "clip_id": "clip_08",
        "camera_id": "CAM_08",
        "plate_text": "TN05BK6655",
        "condition": "low_contrast",
        "vehicle_type": "grey sedan",
        "vehicle_color": (70, 75, 80),
        "plate_bg": (120, 120, 120),
        "adversarial": True
    }
]

def render_frame(vehicle, frame_idx, total_frames=20):
    # Base road scene 640x480
    w, h = 640, 480
    img = np.zeros((h, w, 3), dtype=np.uint8)
    # Road background
    img[:h//3, :] = [100, 105, 110] # Horizon / buildings
    img[h//3:, :] = [60, 65, 70]    # Asphalt road
    
    # Road lanes
    cv2.line(img, (w//2, h//3), (w//2, h), (200, 200, 200), 2)
    cv2.line(img, (w//4, h//3), (w//6, h), (200, 200, 200), 2)
    cv2.line(img, (3*w//4, h//3), (5*w//6, h), (200, 200, 200), 2)

    # Scale vehicle approaching from distance (frame 0 -> small, frame 19 -> large)
    progress = frame_idx / float(total_frames)
    scale = 0.55 + 0.45 * progress
    
    vh_w = int(240 * scale)
    vh_h = int(170 * scale)
    cx = w // 2 + int((frame_idx % 3 - 1) * 2)
    cy = int(220 + 70 * progress)
    
    x1, y1 = cx - vh_w // 2, cy - vh_h // 2
    x2, y2 = cx + vh_w // 2, cy + vh_h // 2
    
    # Draw vehicle body
    v_color = vehicle["vehicle_color"]
    # BGR format for opencv
    bgr_color = (v_color[2], v_color[1], v_color[0])
    cv2.rectangle(img, (x1, y1), (x2, y2), bgr_color, -1)
    cv2.rectangle(img, (x1, y1), (x2, y2), (20, 20, 20), 2)
    
    # Windshield / rear window
    win_y1 = y1 + int(10 * scale)
    win_y2 = y1 + int(60 * scale)
    win_x1 = x1 + int(20 * scale)
    win_x2 = x2 - int(20 * scale)
    cv2.rectangle(img, (win_x1, win_y1), (win_x2, win_y2), (40, 45, 50), -1)

    # License plate area at lower center of vehicle
    pw = int(170 * scale)
    ph = int(46 * scale)
    px1 = cx - pw // 2
    py1 = y2 - int(52 * scale)
    px2 = px1 + pw
    py2 = py1 + ph

    # Draw plate background
    p_bg = vehicle["plate_bg"]
    plate_bgr = (p_bg[2], p_bg[1], p_bg[0])
    cv2.rectangle(img, (px1, py1), (px2, py2), plate_bgr, -1)
    cv2.rectangle(img, (px1, py1), (px2, py2), (10, 10, 10), 1)

    # Use PIL to render high-contrast crisp text on the plate
    plate_crop = img[py1:py2, px1:px2]
    if plate_crop.shape[0] > 0 and plate_crop.shape[1] > 0:
        pil_plate = Image.fromarray(cv2.cvtColor(plate_crop, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil_plate)
        font_size = max(14, int(20 * scale))
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()
        
        text = vehicle["plate_text"]
        # Format as "TN 09 CB 1234"
        formatted_text = f"{text[:2]} {text[2:4]} {text[4:6]} {text[6:]}" if len(text) == 10 else text
        
        # Center text
        bbox = draw.textbbox((0, 0), formatted_text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = max(4, (pw - tw) // 2)
        ty = max(2, (ph - th) // 2 - 1)
        
        text_color = (15, 15, 15)
        if vehicle["condition"] == "low_contrast":
            text_color = (95, 95, 95) # low contrast
            
        draw.text((tx, ty), formatted_text, fill=text_color, font=font)
        
        # Put back into img
        np_plate = cv2.cvtColor(np.array(pil_plate), cv2.COLOR_RGB2BGR)
        img[py1:py2, px1:px2] = np_plate

    # Adversarial manipulations
    if vehicle["condition"] == "blurred_occluded":
        # Heavy blur on plate region
        blur_k = 15
        sub = img[py1:py2, px1:px2]
        if sub.shape[0] > 0 and sub.shape[1] > 0:
            blurred = cv2.GaussianBlur(sub, (blur_k, blur_k), 0)
            # Occlude right half with mud/dirt patch
            half_w = (px2 - px1) // 2
            dirt_color = np.array([45, 60, 75], dtype=np.uint8)
            blurred[:, half_w:] = cv2.addWeighted(blurred[:, half_w:], 0.3, np.full_like(blurred[:, half_w:], dirt_color), 0.7, 0)
            img[py1:py2, px1:px2] = blurred

    elif vehicle["condition"] == "low_contrast":
        # Simulate night time / low contrast
        img = (img * 0.45).astype(np.uint8)
        # Add slight sensor noise
        noise = np.random.normal(0, 5, img.shape).astype(np.uint8)
        img = cv2.add(img, noise)

    return img, (px1, py1, px2, py2), (x1, y1, x2, y2)

def generate_all_data():
    ground_truth = []
    print("Generating demo clips and ground truth...")
    
    for v in VEHICLES:
        clip_name = f"{v['clip_id']}.mp4"
        clip_path = os.path.join(CLIPS_DIR, clip_name)
        snapshot_name = f"{v['clip_id']}_snap.jpg"
        snapshot_path = os.path.join(SNAPSHOTS_DIR, snapshot_name)
        
        total_frames = 20
        fps = 10
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(clip_path, fourcc, fps, (640, 480))
        
        frames_info = []
        best_frame = None
        
        for f_idx in range(total_frames):
            frame_img, plate_box, vehicle_box = render_frame(v, f_idx, total_frames)
            out.write(frame_img)
            frames_info.append({
                "frame_index": f_idx,
                "plate_box": plate_box,
                "vehicle_box": vehicle_box
            })
            if f_idx == total_frames - 2: # High resolution clear frame
                best_frame = frame_img.copy()
                
        out.release()
        
        # Save representative snapshot
        if best_frame is not None:
            cv2.imwrite(snapshot_path, best_frame)
            
        cam_info = CAMERAS[v["camera_id"]]
        ground_truth.append({
            "clip_id": v["clip_id"],
            "clip_path": f"backend/data/clips/{clip_name}",
            "snapshot_path": f"data/snapshots/{snapshot_name}",
            "camera_id": v["camera_id"],
            "camera_name": cam_info["name"],
            "lat": cam_info["lat"],
            "lon": cam_info["lon"],
            "true_plate": v["plate_text"],
            "condition": v["condition"],
            "vehicle_type": v["vehicle_type"],
            "is_adversarial": v["adversarial"]
        })
        print(f"Generated {clip_name} for {v['plate_text']} ({v['condition']}) at {v['camera_id']}")

    # Save cameras and ground truth json
    with open(os.path.join(DATA_DIR, "cameras.json"), "w") as f:
        json.dump(CAMERAS, f, indent=2)
        
    with open(os.path.join(DATA_DIR, "ground_truth.json"), "w") as f:
        json.dump(ground_truth, f, indent=2)
        
    print("Demo clips and ground_truth.json successfully generated.")

if __name__ == "__main__":
    generate_all_data()
