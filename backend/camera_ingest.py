"""
camera_ingest.py — Live RTSP Camera Ingest Worker

Reads frames from real IP cameras via RTSP (OpenCV VideoCapture),
runs plate OCR via EasyOCR, and writes detections to the sightings table.

Architecture:
  - CameraWorker: one daemon thread per enabled camera
  - PlateOCR: shared EasyOCR instance (GPU if available)
  - Writes to anpr.db using the same schema as the demo pipeline

Usage:
  # Run via ingest_service.py (recommended):
  py -3.13 backend/ingest_service.py

  # Or run a single camera directly for testing:
  py -3.13 backend/camera_ingest.py --camera CAM_01

Requirements:
  pip install opencv-python easyocr pyyaml

Live feed notes:
  - RTSP URL format: rtsp://user:password@IP:PORT/stream_path
  - For cameras that support ONVIF, use the ONVIF RTSP endpoint.
  - For HLS cameras (web-based), replace rtsp:// with the HLS URL (http://IP/stream.m3u8).
  - Tested with: Hikvision, Dahua, CP Plus, Bosch FLEXIDOME (all use RTSP/H.264).
"""

import os
import sys
import time
import json
import logging
import threading
import argparse
from datetime import datetime
from pathlib import Path

# Ensure backend/ is importable
sys.path.insert(0, os.path.dirname(__file__))

logger = logging.getLogger("camera_ingest")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

# ──────────────────────────────────────────────────────────────
# Optional imports — graceful degradation if not installed
# ──────────────────────────────────────────────────────────────
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("opencv-python not installed. RTSP capture disabled. Run: pip install opencv-python")

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False
    logger.warning("easyocr not installed. OCR disabled. Run: pip install easyocr")

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False
    logger.warning("pyyaml not installed. Config loading disabled. Run: pip install pyyaml")

from database import get_db_connection
from embed import compute_embedding

# ──────────────────────────────────────────────────────────────
# Shared OCR Engine (initialized once, reused by all workers)
# ──────────────────────────────────────────────────────────────
_ocr_lock = threading.Lock()
_ocr_reader = None

def get_ocr_reader():
    """Lazy-initialize EasyOCR reader (GPU if available, else CPU)."""
    global _ocr_reader
    if _ocr_reader is None:
        with _ocr_lock:
            if _ocr_reader is None:
                logger.info("Initializing EasyOCR reader (first call may take ~30s for model download)...")
                _ocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
                logger.info("EasyOCR reader ready.")
    return _ocr_reader


import re

# ──────────────────────────────────────────────────────────────
# Plate Extraction & Advanced Preprocessing
# ──────────────────────────────────────────────────────────────
PLATE_REGEXES = [
    # Standard format: TN09AB1234, DL01CA9999, MH12A1234
    re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$"),
    # Bharat Series: 22BH1234AA
    re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$"),
    # Generic format: DL041234, KA534444
    re.compile(r"^[A-Z]{2}[0-9]{4,8}$"),
]

def is_valid_plate_format(text: str) -> bool:
    """Validate plate string against Indian standard and BH series formats."""
    clean = text.strip().upper().replace(" ", "").replace("-", "").replace(".", "")
    return any(p.match(clean) for p in PLATE_REGEXES)

def preprocess_plate_frame(frame):
    """
    Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    and mild denoising to maximize OCR readability in low-light/nighttime feeds.
    """
    if not CV2_AVAILABLE or frame is None:
        return frame
    try:
        import cv2
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        return enhanced
    except Exception:
        return frame

def extract_plate_from_frame(frame, min_confidence: float = 0.50):
    """
    Run EasyOCR on a frame (with CLAHE enhancement) and return (plate_text, confidence)
    for the highest-confidence matching license plate string.
    Returns (None, 0.0) if no plate detected above threshold.
    """
    if not EASYOCR_AVAILABLE or frame is None:
        return None, 0.0

    reader = get_ocr_reader()
    processed_frame = preprocess_plate_frame(frame)
    results = reader.readtext(processed_frame)

    best_plate = None
    best_conf = 0.0

    for (bbox, text, conf) in results:
        if conf < min_confidence:
            continue
        clean = text.strip().upper().replace(" ", "").replace("-", "").replace(".", "")
        if is_valid_plate_format(clean) or (7 <= len(clean) <= 11 and clean[:2].isalpha() and clean[2:4].isdigit()):
            if conf > best_conf:
                best_plate = clean
                best_conf = conf

    return best_plate, best_conf


# ──────────────────────────────────────────────────────────────
# Snapshot Saving
# ──────────────────────────────────────────────────────────────
SNAPSHOTS_DIR = Path(__file__).parent / "data" / "snapshots"

def save_snapshot(frame, camera_id: str, plate_text: str, ts: str) -> str:
    """Save a frame crop as a JPEG snapshot and return the relative path."""
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    safe_ts = ts.replace(":", "").replace("-", "").replace(" ", "_")[:15]
    filename = f"{camera_id}_{plate_text}_{safe_ts}.jpg"
    path = SNAPSHOTS_DIR / filename
    try:
        import cv2
        cv2.imwrite(str(path), frame)
    except Exception as e:
        logger.warning(f"Could not save snapshot: {e}")
        return None
    return f"data/snapshots/{filename}"


# ──────────────────────────────────────────────────────────────
# DB Writer & Instant Anomaly Trigger
# ──────────────────────────────────────────────────────────────
def check_instant_blacklist_alert(cursor, sighting_id: int, plate_text: str, camera_id: str, ts: str):
    """Check if sighting matches a blacklisted plate and trigger CRITICAL alert."""
    cursor.execute("SELECT reason FROM blacklist WHERE plate_text = ?", (plate_text,))
    row = cursor.fetchone()
    if row:
        detail = f"BLACK-FLAGGED VEHICLE DETECTED: Plate '{plate_text}' registered at Camera {camera_id}. Reason: {row['reason']}"
        cursor.execute("""
            INSERT INTO alerts (alert_type, sighting_id_a, detail_text, created_at, severity, acknowledged)
            VALUES ('blacklist', ?, ?, ?, 'CRITICAL', 0)
        """, (sighting_id, detail, ts))
        logger.warning(f"[ALERT] Blacklisted plate detected: {plate_text} at {camera_id}")

def write_sighting(camera_id: str, lat: float, lon: float, plate_text: str,
                   plate_confidence: float, snapshot_path: str = None, vehicle_type: str = "SEDAN"):
    """Insert a real-time sighting into the DB and run instant security checks."""
    ts = datetime.now().isoformat()
    embedding_json = json.dumps([0.0] * 128)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sightings
            (camera_id, lat, lon, timestamp, plate_text, plate_confidence, embedding, snapshot_path, vehicle_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (camera_id, lat, lon, ts, plate_text, plate_confidence, embedding_json, snapshot_path, vehicle_type))
        sighting_id = cursor.lastrowid

        # Update camera health
        cursor.execute(
            "UPDATE cameras SET last_seen = ?, status = 'ONLINE', sightings_today = sightings_today + 1 WHERE camera_id = ?",
            (ts, camera_id)
        )

        # Trigger instant checks
        check_instant_blacklist_alert(cursor, sighting_id, plate_text, camera_id, ts)

        conn.commit()
        conn.close()
        logger.info(f"[{camera_id}] Sighting #{sighting_id} recorded: {plate_text} (conf={plate_confidence:.2f})")
    except Exception as e:
        logger.error(f"[{camera_id}] DB write error: {e}")


# ──────────────────────────────────────────────────────────────
# Camera Worker Thread
# ──────────────────────────────────────────────────────────────
class CameraWorker(threading.Thread):
    """
    Daemon thread that continuously reads frames from one RTSP camera,
    runs OCR, and writes sightings to the database.
    """

    def __init__(self, config: dict, min_confidence: float = 0.55,
                 sample_interval: float = 2.0, save_snapshots: bool = True):
        super().__init__(daemon=True)
        self.camera_id = config["camera_id"]
        self.name_str = config.get("name", self.camera_id)
        self.rtsp_url = config["rtsp_url"]
        self.lat = float(config["lat"])
        self.lon = float(config["lon"])
        self.min_confidence = min_confidence
        self.sample_interval = sample_interval
        self.save_snapshots = save_snapshots
        self._stop_event = threading.Event()
        self._consecutive_errors = 0

    def stop(self):
        self._stop_event.set()

    def _mark_offline(self):
        try:
            conn = get_db_connection()
            conn.execute(
                "UPDATE cameras SET status = 'OFFLINE' WHERE camera_id = ?",
                (self.camera_id,)
            )
            conn.commit()
            conn.close()
        except Exception:
            pass

    def run(self):
        if not CV2_AVAILABLE:
            logger.error(f"[{self.camera_id}] Cannot start: opencv-python not installed.")
            return
        if not EASYOCR_AVAILABLE:
            logger.error(f"[{self.camera_id}] Cannot start: easyocr not installed.")
            return

        logger.info(f"[{self.camera_id}] Starting worker → {self.rtsp_url}")

        while not self._stop_event.is_set():
            cap = None
            try:
                # OpenCV RTSP with hardware-friendly settings
                cap = cv2.VideoCapture(self.rtsp_url)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                if not cap.isOpened():
                    raise ConnectionError(f"Cannot open RTSP stream: {self.rtsp_url}")

                logger.info(f"[{self.camera_id}] Stream connected ✓")
                self._consecutive_errors = 0

                while not self._stop_event.is_set():
                    ret, frame = cap.read()
                    if not ret:
                        raise ConnectionError("Frame read failed")

                    # Run OCR
                    plate_text, confidence = extract_plate_from_frame(
                        frame, self.min_confidence
                    )

                    if plate_text:
                        snapshot_path = None
                        if self.save_snapshots:
                            ts_str = datetime.now().isoformat()
                            snapshot_path = save_snapshot(frame, self.camera_id, plate_text, ts_str)
                        write_sighting(
                            camera_id=self.camera_id,
                            lat=self.lat,
                            lon=self.lon,
                            plate_text=plate_text,
                            plate_confidence=confidence,
                            snapshot_path=snapshot_path
                        )

                    time.sleep(self.sample_interval)

            except Exception as e:
                self._consecutive_errors += 1
                logger.warning(
                    f"[{self.camera_id}] Error (attempt {self._consecutive_errors}): {e}. "
                    f"Retrying in 10s…"
                )
                self._mark_offline()
                time.sleep(10)
            finally:
                if cap is not None:
                    cap.release()

        logger.info(f"[{self.camera_id}] Worker stopped.")


# ──────────────────────────────────────────────────────────────
# CLI — Single Camera Test Mode
# ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run a single camera worker for testing."
    )
    parser.add_argument("--camera", required=True, help="camera_id to test (e.g. CAM_01)")
    parser.add_argument("--config", default="backend/camera_config.yaml", help="Path to camera_config.yaml")
    args = parser.parse_args()

    if not YAML_AVAILABLE:
        print("ERROR: pyyaml not installed. Run: pip install pyyaml")
        sys.exit(1)

    with open(args.config, "r") as f:
        cfg = yaml.safe_load(f)

    cam_cfg = next((c for c in cfg["cameras"] if c["camera_id"] == args.camera), None)
    if not cam_cfg:
        print(f"ERROR: Camera '{args.camera}' not found in {args.config}")
        sys.exit(1)

    ingest_cfg = cfg.get("ingest", {})
    worker = CameraWorker(
        config=cam_cfg,
        min_confidence=ingest_cfg.get("min_plate_confidence", 0.55),
        sample_interval=ingest_cfg.get("sample_interval_seconds", 2.0),
        save_snapshots=ingest_cfg.get("save_snapshots", True)
    )
    print(f"Starting single-camera test for {args.camera}. Press Ctrl+C to stop.")
    worker.start()
    try:
        worker.join()
    except KeyboardInterrupt:
        worker.stop()
        print("Stopped.")
