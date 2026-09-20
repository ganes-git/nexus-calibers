"""
Demo data generator for City-Wide ANPR Trajectory & Route-Anomaly Engine.
Generates:
1. Ground truth metadata (ground_truth.json) with all 5 named PS degradation conditions:
   - lighting (low-contrast / night)
   - weather (rain streaks & fog)
   - angle (steep perspective tilt)
   - blur (motion blur kernel)
   - damage (dirt / scrape occlusion)
2. Multi-lane clip featuring two vehicles side-by-side.
3. Clean condition clips across multiple vehicle types.
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

# Vehicles and ground truth across all 5 conditions + clean + multilane
VEHICLES = [
    # 6 Clean Condition Clips
    {
        "clip_id": "clip_01",
        "camera_id": "CAM_01",
        "plate_text": "TN09CB1234",
        "condition": "clean",
        "category": "clean",
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
        "category": "clean",
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
        "category": "clean",
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
        "category": "clean",
        "vehicle_type": "yellow auto-taxi",
        "vehicle_color": (210, 175, 40),
        "plate_bg": (245, 210, 40),
        "adversarial": False
    },
    {
        "clip_id": "clip_05",
        "camera_id": "CAM_05",
        "plate_text": "TN22CY3311",
        "condition": "clean",
        "category": "clean",
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
        "category": "clean",
        "vehicle_type": "dark blue truck",
        "vehicle_color": (40, 50, 75),
        "plate_bg": (255, 255, 255),
        "adversarial": False
    },
    # Condition 1: Blur (Motion Blur)
    {
        "clip_id": "clip_07",
        "camera_id": "CAM_07",
        "plate_text": "TN01AZ7788",
        "condition": "motion_blur",
        "category": "blur",
        "vehicle_type": "green sedan",
        "vehicle_color": (45, 80, 55),
        "plate_bg": (240, 240, 240),
        "adversarial": True
    },
    # Condition 2: Lighting (Low Contrast / Twilight)
    {
        "clip_id": "clip_08",
        "camera_id": "CAM_08",
        "plate_text": "TN05BK6655",
        "condition": "low_contrast_lighting",
        "category": "lighting",
        "vehicle_type": "grey sedan",
        "vehicle_color": (70, 75, 80),
        "plate_bg": (120, 120, 120),
        "adversarial": True
    },
    # Condition 3: Weather (Rain / Fog Streaks)
    {
        "clip_id": "clip_09",
        "camera_id": "CAM_01",
        "plate_text": "TN11DX4499",
        "condition": "poor_weather_rain",
        "category": "weather",
        "vehicle_type": "white suv",
        "vehicle_color": (210, 215, 220),
        "plate_bg": (250, 250, 250),
        "adversarial": True
    },
    # Condition 4: Angled Shot (Steep 35-deg perspective yaw)
    {
        "clip_id": "clip_10",
        "camera_id": "CAM_02",
        "plate_text": "KA05MN8833",
        "condition": "angled_shot_skew",
        "category": "angle",
        "vehicle_type": "blue sedan",
        "vehicle_color": (30, 60, 120),
        "plate_bg": (250, 250, 250),
        "adversarial": True
    },
    # Condition 5: Dirty / Damaged / Occluded Plate
    {
        "clip_id": "clip_11",
        "camera_id": "CAM_03",
        "plate_text": "DL04CA1122",
        "condition": "damaged_dirty_occlusion",
        "category": "damage",
        "vehicle_type": "silver sedan",
        "vehicle_color": (160, 165, 170),
        "plate_bg": (240, 240, 240),
        "adversarial": True
    }
]

def render_frame(vehicle, frame_idx, total_frames=20):
    w, h = 640, 480
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[:h//3, :] = [100, 105, 110]
    img[h//3:, :] = [60, 65, 70]
    
    cv2.line(img, (w//2, h//3), (w//2, h), (200, 200, 200), 2)
    cv2.line(img, (w//4, h//3), (w//6, h), (200, 200, 200), 2)
    cv2.line(img, (3*w//4, h//3), (5*w//6, h), (200, 200, 200), 2)

    progress = frame_idx / float(total_frames)
    scale = 0.55 + 0.45 * progress
    
    vh_w = int(240 * scale)
    vh_h = int(170 * scale)
    cx = w // 2 + int((frame_idx % 3 - 1) * 2)
    cy = int(220 + 70 * progress)
    
    x1, y1 = cx - vh_w // 2, cy - vh_h // 2
    x2, y2 = cx + vh_w // 2, cy + vh_h // 2
    
    v_color = vehicle["vehicle_color"]
    bgr_color = (v_color[2], v_color[1], v_color[0])
    cv2.rectangle(img, (x1, y1), (x2, y2), bgr_color, -1)
    cv2.rectangle(img, (x1, y1), (x2, y2), (20, 20, 20), 2)
    
    win_y1 = y1 + int(10 * scale)
    win_y2 = y1 + int(60 * scale)
    win_x1 = x1 + int(20 * scale)
    win_x2 = x2 - int(20 * scale)
    cv2.rectangle(img, (win_x1, win_y1), (win_x2, win_y2), (40, 45, 50), -1)

    pw = int(170 * scale)
    ph = int(46 * scale)
    px1 = cx - pw // 2
    py1 = y2 - int(52 * scale)
    px2 = px1 + pw
    py2 = py1 + ph

    p_bg = vehicle["plate_bg"]
    plate_bgr = (p_bg[2], p_bg[1], p_bg[0])
    cv2.rectangle(img, (px1, py1), (px2, py2), plate_bgr, -1)
    cv2.rectangle(img, (px1, py1), (px2, py2), (10, 10, 10), 1)

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
        formatted_text = f"{text[:2]} {text[2:4]} {text[4:6]} {text[6:]}" if len(text) == 10 else text
        
        bbox = draw.textbbox((0, 0), formatted_text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = max(4, (pw - tw) // 2)
        ty = max(2, (ph - th) // 2 - 1)
        
        text_color = (15, 15, 15)
        if "lighting" in vehicle["condition"] or vehicle["condition"] == "low_contrast":
            text_color = (95, 95, 95)
            
        draw.text((tx, ty), formatted_text, fill=text_color, font=font)
        np_plate = cv2.cvtColor(np.array(pil_plate), cv2.COLOR_RGB2BGR)
        img[py1:py2, px1:px2] = np_plate

    # Apply specific degradation filters
    cond = vehicle["condition"]
    if "blur" in cond:
        # Motion blur kernel
        size = 15
        kernel_motion_blur = np.zeros((size, size))
        kernel_motion_blur[int((size-1)/2), :] = np.ones(size)
        kernel_motion_blur = kernel_motion_blur / size
        sub = img[py1:py2, px1:px2]
        if sub.shape[0] > 0 and sub.shape[1] > 0:
            img[py1:py2, px1:px2] = cv2.filter2D(sub, -1, kernel_motion_blur)

    elif "lighting" in cond or cond == "low_contrast":
        img = (img * 0.40).astype(np.uint8)
        noise = np.random.normal(0, 4, img.shape).astype(np.uint8)
        img = cv2.add(img, noise)

    elif "weather" in cond:
        # Rain streaks & foggy overlay
        fog = np.full_like(img, (200, 205, 210), dtype=np.uint8)
        img = cv2.addWeighted(img, 0.65, fog, 0.35, 0)
        # Add rain lines
        for _ in range(35):
            rx = np.random.randint(0, w-20)
            ry = np.random.randint(0, h-40)
            cv2.line(img, (rx, ry), (rx + 6, ry + 25), (230, 235, 245), 1)

    elif "angle" in cond:
        # Perspective warp on plate region to simulate steep 35-degree off-axis camera
        sub = img[py1:py2, px1:px2]
        if sub.shape[0] > 10 and sub.shape[1] > 10:
            sh, sw = sub.shape[:2]
            pts1 = np.float32([[0, 0], [sw, 0], [0, sh], [sw, sh]])
            pts2 = np.float32([[sw*0.2, sh*0.1], [sw*0.85, 0], [0, sh*0.9], [sw*0.95, sh]])
            matrix = cv2.getPerspectiveTransform(pts1, pts2)
            warped = cv2.warpPerspective(sub, matrix, (sw, sh), borderMode=cv2.BORDER_REPLICATE)
            img[py1:py2, px1:px2] = warped

    elif "damage" in cond:
        # Mud & scrape occlusion across characters
        sub = img[py1:py2, px1:px2]
        if sub.shape[0] > 0 and sub.shape[1] > 0:
            mud_patch = np.zeros_like(sub)
            cv2.ellipse(mud_patch, (sub.shape[1]//2, sub.shape[0]//2), (sub.shape[1]//3, sub.shape[0]//2), 20, 0, 360, (30, 45, 60), -1)
            img[py1:py2, px1:px2] = cv2.addWeighted(sub, 0.4, mud_patch, 0.6, 0)

    return img, (px1, py1, px2, py2), (x1, y1, x2, y2)

def generate_all_data():
    ground_truth = []
    print("Generating demo clips and ground truth for all 5 degradation conditions...")
    
    for v in VEHICLES:
        clip_name = f"{v['clip_id']}.mp4"
        clip_path = os.path.join(CLIPS_DIR, clip_name)
        snapshot_name = f"{v['clip_id']}_snap.jpg"
        snapshot_path = os.path.join(SNAPSHOTS_DIR, snapshot_name)
        
        total_frames = 20
        fps = 10
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(clip_path, fourcc, fps, (640, 480))
        
        best_frame = None
        
        for f_idx in range(total_frames):
            frame_img, plate_box, vehicle_box = render_frame(v, f_idx, total_frames)
            out.write(frame_img)
            if f_idx == total_frames - 2:
                best_frame = frame_img.copy()
                
        out.release()
        
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
            "category": v["category"],
            "vehicle_type": v["vehicle_type"],
            "is_adversarial": v["adversarial"]
        })
        print(f"Generated {clip_name} for {v['plate_text']} ({v['condition']}) at {v['camera_id']}")

    # Save cameras and ground truth json
    with open(os.path.join(DATA_DIR, "cameras.json"), "w") as f:
        json.dump(CAMERAS, f, indent=2)
        
    with open(os.path.join(DATA_DIR, "ground_truth.json"), "w") as f:
        json.dump(ground_truth, f, indent=2)
        
    print(f"All {len(ground_truth)} clips and ground_truth.json successfully generated.")

if __name__ == "__main__":
    generate_all_data()
