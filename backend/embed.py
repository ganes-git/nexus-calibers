"""
Visual embedding module for vehicle Re-ID and identity fusion.
Produces a normalized visual appearance embedding vector from a vehicle crop.
Computes cosine similarity between two visual embeddings.
"""

import json
import numpy as np
import cv2

def extract_visual_embedding(vehicle_crop):
    """
    Computes a 64-dimensional normalized visual feature vector for a vehicle crop.
    Captures:
    1. HSV color distribution across vertical vehicle segments (roof, body, lower).
    2. Spatial gradient / texture distribution.
    Normalized to unit L2 norm so dot product = cosine similarity.
    """
    if vehicle_crop is None or vehicle_crop.size == 0:
        # Return zero vector if empty
        vec = np.zeros(64, dtype=np.float32)
        return json.dumps(vec.tolist())

    # Resize to canonical 128x128
    resized = cv2.resize(vehicle_crop, (128, 128))
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    
    # Split into 3 vertical zones: Upper (windshield/roof), Middle (hood/doors), Lower (bumper/plate)
    zones = [
        hsv[0:42, :, :],
        hsv[42:85, :, :],
        hsv[85:128, :, :]
    ]
    
    features = []
    for zone in zones:
        # 8-bin Hue histogram
        h_hist = cv2.calcHist([zone], [0], None, [8], [0, 180])
        # 4-bin Saturation histogram
        s_hist = cv2.calcHist([zone], [1], None, [4], [0, 256])
        # 4-bin Value histogram
        v_hist = cv2.calcHist([zone], [2], None, [4], [0, 256])
        
        features.extend(h_hist.flatten())
        features.extend(s_hist.flatten())
        features.extend(v_hist.flatten())
    # 3 zones * 16 bins = 48 features

    # Add 16 features from spatial gradients (Sobel x and y)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    sobelx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag, ang = cv2.cartToPolar(sobelx, sobely)
    grad_hist = cv2.calcHist([ang], [0], None, [16], [0, 2 * np.pi])
    features.extend(grad_hist.flatten())
    # Total = 64 features

    vec = np.array(features, dtype=np.float32)
    norm = np.linalg.norm(vec)
    if norm > 1e-6:
        vec = vec / norm
    else:
        vec = np.zeros_like(vec)

    return json.dumps(vec.tolist())

def cosine_similarity(emb_json_1, emb_json_2):
    """Computes cosine similarity in [0, 1] between two JSON serialized embeddings."""
    try:
        v1 = np.array(json.loads(emb_json_1), dtype=np.float32)
        v2 = np.array(json.loads(emb_json_2), dtype=np.float32)
        
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 < 1e-6 or norm2 < 1e-6:
            return 0.0
        
        sim = float(np.dot(v1, v2) / (norm1 * norm2))
        # Clamp to [0, 1]
        return max(0.0, min(1.0, sim))
    except Exception:
        return 0.0

# Backward compatibility alias
compute_embedding = extract_visual_embedding

