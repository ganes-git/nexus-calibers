"""
ingest_service.py — Camera Ingest Supervisor

Reads camera_config.yaml, starts one CameraWorker thread per enabled camera,
monitors health, and exposes a simple status endpoint on port 8001.

Usage:
  py -3.13 backend/ingest_service.py

The FastAPI backend (main.py) does NOT need to be restarted when cameras
go online or offline. Workers write directly to anpr.db which the API reads.

To add a new camera:
  1. Edit backend/camera_config.yaml — add a new block
  2. Restart ingest_service.py

To connect a real camera:
  1. Set enabled: true in camera_config.yaml
  2. Fill in the correct rtsp_url (format: rtsp://user:password@IP:PORT/stream_path)
  3. Ensure the camera and this server are on the same LAN or VPN
"""

import os
import sys
import time
import signal
import logging
import threading
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

sys.path.insert(0, os.path.dirname(__file__))

logger = logging.getLogger("ingest_service")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False
    logger.error("pyyaml not installed. Run: pip install pyyaml")

from camera_ingest import CameraWorker

CONFIG_PATH = Path(__file__).parent / "camera_config.yaml"
workers = {}  # camera_id -> CameraWorker


def load_config():
    if not YAML_AVAILABLE:
        raise RuntimeError("pyyaml required. Run: pip install pyyaml")
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


def start_workers(cfg: dict):
    ingest_cfg = cfg.get("ingest", {})
    min_conf = ingest_cfg.get("min_plate_confidence", 0.55)
    interval = ingest_cfg.get("sample_interval_seconds", 2.0)
    save_snaps = ingest_cfg.get("save_snapshots", True)

    enabled_cameras = [c for c in cfg.get("cameras", []) if c.get("enabled", False)]
    if not enabled_cameras:
        logger.warning(
            "No cameras enabled in camera_config.yaml. "
            "Set 'enabled: true' and provide real rtsp_url for each camera to connect."
        )
        return

    for cam_cfg in enabled_cameras:
        cam_id = cam_cfg["camera_id"]
        if cam_id in workers and workers[cam_id].is_alive():
            logger.info(f"[{cam_id}] Already running, skipping.")
            continue
        worker = CameraWorker(
            config=cam_cfg,
            min_confidence=min_conf,
            sample_interval=interval,
            save_snapshots=save_snaps
        )
        workers[cam_id] = worker
        worker.start()
        logger.info(f"[{cam_id}] Worker started — {cam_cfg.get('name', '')}")


# ──────────────────────────────────────────────────────────────
# Minimal Health Endpoint on port 8001
# ──────────────────────────────────────────────────────────────
class StatusHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/status":
            status = {
                "service": "ingest_service",
                "timestamp": datetime.now().isoformat(),
                "workers": {
                    cam_id: {
                        "alive": w.is_alive(),
                        "errors": getattr(w, "_consecutive_errors", 0)
                    }
                    for cam_id, w in workers.items()
                }
            }
            body = json.dumps(status, indent=2).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress HTTP log noise


def run_status_server():
    server = HTTPServer(("127.0.0.1", 8001), StatusHandler)
    logger.info("Ingest status endpoint: http://127.0.0.1:8001/status")
    server.serve_forever()


# ──────────────────────────────────────────────────────────────
# Main Entry Point
# ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("ANPR City Camera Ingest Service")
    logger.info(f"Config: {CONFIG_PATH}")
    logger.info("=" * 60)

    if not CONFIG_PATH.exists():
        logger.error(f"camera_config.yaml not found at {CONFIG_PATH}")
        sys.exit(1)

    cfg = load_config()
    start_workers(cfg)

    # Start status endpoint in background
    status_thread = threading.Thread(target=run_status_server, daemon=True)
    status_thread.start()

    # Graceful shutdown on Ctrl+C or SIGTERM
    def _shutdown(signum, frame):
        logger.info("Shutting down all camera workers…")
        for cam_id, w in workers.items():
            w.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    # Keep alive — watchdog checks workers every 30s and restarts dead ones
    logger.info("Watchdog active. Press Ctrl+C to stop.")
    while True:
        time.sleep(30)
        cfg = load_config()
        enabled_ids = {c["camera_id"] for c in cfg.get("cameras", []) if c.get("enabled", False)}
        for cam_id, w in list(workers.items()):
            if cam_id in enabled_ids and not w.is_alive():
                logger.warning(f"[{cam_id}] Worker died. Restarting…")
                cam_cfg = next(c for c in cfg["cameras"] if c["camera_id"] == cam_id)
                ingest_cfg = cfg.get("ingest", {})
                new_worker = CameraWorker(
                    config=cam_cfg,
                    min_confidence=ingest_cfg.get("min_plate_confidence", 0.55),
                    sample_interval=ingest_cfg.get("sample_interval_seconds", 2.0),
                    save_snapshots=ingest_cfg.get("save_snapshots", True)
                )
                workers[cam_id] = new_worker
                new_worker.start()
