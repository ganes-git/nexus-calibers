"""
OCR extraction module for ANPR pipeline.
Uses RapidOCR (ONNX-accelerated PaddleOCR) to recognize characters on license plate crops.
"""

import re
import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR

_ocr_engine = None

def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        _ocr_engine = RapidOCR()
    return _ocr_engine

def clean_plate_string(raw_text):
    """Normalize plate text: remove spaces, punctuation, convert to uppercase."""
    if not raw_text:
        return ""
    # Strip spaces and special chars
    cleaned = re.sub(r'[^A-Za-z0-9]', '', raw_text).upper()
    return cleaned

def recognize_plate(image, min_confidence=0.50):
    """
    Runs OCR on plate crop or frame region.
    Returns (cleaned_text, confidence, raw_text).
    If unreadable or below min_confidence, returns (None, confidence, raw_text).
    """
    if image is None or image.size == 0:
        return None, 0.0, ""

    engine = get_ocr_engine()
    # RapidOCR can run directly on image or enhanced image
    result, elapse = engine(image)
    
    if not result:
        # Try minor contrast enhancement fallback
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        enhanced_bgr = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
        result, _ = engine(enhanced_bgr)

    if not result:
        return None, 0.0, ""

    # Sort results by confidence
    best_candidate = None
    best_conf = 0.0
    raw_accum = []

    for item in result:
        # item structure: [box_points, text, confidence_str]
        box, text, conf = item
        conf = float(conf)
        cleaned = clean_plate_string(text)
        raw_accum.append(text)
        # Indian plates are typically 8 to 10 characters (e.g. TN09CB1234)
        if len(cleaned) >= 6 and conf > best_conf:
            best_candidate = cleaned
            best_conf = conf

    if best_candidate and best_conf >= min_confidence:
        return best_candidate, best_conf, " ".join(raw_accum)
    
    return None, best_conf, " ".join(raw_accum)
