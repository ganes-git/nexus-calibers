"""
Database schema and SQLite access layer for ANPR Trajectory & Route-Anomaly Engine.
Directly implements tables and constraints from SCHEMA.md.
"""

import sqlite3
import os
from datetime import datetime, date

DB_PATH = os.path.join(os.path.dirname(__file__), "anpr.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. sightings
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sightings (
        sighting_id INTEGER PRIMARY KEY AUTOINCREMENT,
        camera_id TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        timestamp DATETIME NOT NULL,
        plate_text TEXT,
        plate_confidence REAL,
        embedding TEXT NOT NULL,
        snapshot_path TEXT,
        vehicle_type TEXT DEFAULT 'UNKNOWN'
    );
    """)
    # Migration: add vehicle_type if missing
    try:
        cursor.execute("ALTER TABLE sightings ADD COLUMN vehicle_type TEXT DEFAULT 'UNKNOWN'")
    except Exception:
        pass

    # 2. blacklist
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS blacklist (
        plate_text TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        added_on DATE NOT NULL
    );
    """)

    # 3. restricted_zones
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS restricted_zones (
        zone_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        center_lat REAL NOT NULL,
        center_lon REAL NOT NULL,
        radius_meters REAL NOT NULL,
        reason TEXT
    );
    """)

    # 4. corridor_baseline
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS corridor_baseline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        camera_from TEXT NOT NULL,
        camera_to TEXT NOT NULL,
        distance_km REAL NOT NULL,
        mean_transit_seconds REAL NOT NULL,
        stddev_transit_seconds REAL NOT NULL,
        sample_count INTEGER NOT NULL,
        avg_speed_kmh REAL NOT NULL,
        source TEXT CHECK(source IN ('seed', 'observed', 'mixed')),
        updated_at DATETIME NOT NULL
    );
    """)

    # 5. audit_log
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_log (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        searched_by TEXT NOT NULL,
        searched_query TEXT NOT NULL,
        searched_at DATETIME NOT NULL
    );
    """)

    # 6. alerts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_type TEXT CHECK(alert_type IN ('clone', 'impossible_transit', 'blacklist', 'zone_deviation', 'route_anomaly', 'convoy')),
        sighting_id_a INTEGER NOT NULL,
        sighting_id_b INTEGER,
        detail_text TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        severity TEXT DEFAULT 'MEDIUM',
        acknowledged INTEGER DEFAULT 0,
        acknowledged_by TEXT,
        acknowledged_at DATETIME,
        FOREIGN KEY (sighting_id_a) REFERENCES sightings(sighting_id),
        FOREIGN KEY (sighting_id_b) REFERENCES sightings(sighting_id)
    );
    """)
    # Migrations for alerts table
    for col_def in [
        ("severity", "TEXT DEFAULT 'MEDIUM'"),
        ("acknowledged", "INTEGER DEFAULT 0"),
        ("acknowledged_by", "TEXT"),
        ("acknowledged_at", "DATETIME"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE alerts ADD COLUMN {col_def[0]} {col_def[1]}")
        except Exception:
            pass

    # 7. cameras — physical camera registry for health tracking
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cameras (
        camera_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        zone_id TEXT,
        rtsp_url TEXT,
        enabled INTEGER DEFAULT 1,
        last_seen DATETIME,
        sightings_today INTEGER DEFAULT 0,
        status TEXT DEFAULT 'OFFLINE'
    );
    """)

    # Indexes per SCHEMA.md
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sightings_cam_time ON sightings(camera_id, timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sightings_plate ON sightings(plate_text);")

    conn.commit()
    conn.close()

# Severity map for alert types — authoritative lookup used by baseline.py and main.py
ALERT_SEVERITY_MAP = {
    'clone':              'CRITICAL',
    'blacklist':          'CRITICAL',
    'impossible_transit': 'HIGH',
    'convoy':             'HIGH',
    'zone_deviation':     'MEDIUM',
    'route_anomaly':      'MEDIUM',
}

def seed_static_metadata():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Seed Blacklist entries
    blacklist_entries = [
        ("TN07AX4521", "Wanted in connection with financial theft investigation (Case FIR 142/26)", "2026-03-01"),
        ("KA01AB9999", "Vehicle impound notice issued for repeated reckless transit", "2026-02-15"),
        ("DL01CY0001", "Counterfeit registration flag reported from regional RTO", "2026-01-20")
    ]
    for plate, reason, added_on in blacklist_entries:
        cursor.execute(
            "INSERT OR REPLACE INTO blacklist (plate_text, reason, added_on) VALUES (?, ?, ?)",
            (plate, reason, added_on)
        )

    # Seed Restricted Zones
    # Chennai high-security / pedestrian corridors:
    # 1. Raj Bhavan / Guindy National Park perimeter
    # 2. Fort St. George Secretariat corridor
    zones = [
        ("Raj Bhavan High-Security Perimeter", 13.0070, 80.2180, 850.0, "VIP Governor residence zone — commercial heavy transit restricted"),
        ("Fort St. George Secretariat Perimeter", 13.0780, 80.2870, 600.0, "State administrative zone — vehicle entry permits mandatory"),
        ("Marina Promenade Pedestrian Heritage Zone", 13.0540, 80.2820, 500.0, "Pedestrian promenade — unpermitted motor vehicles prohibited")
    ]
    cursor.execute("DELETE FROM restricted_zones;")
    for name, lat, lon, radius, reason in zones:
        cursor.execute(
            "INSERT INTO restricted_zones (name, center_lat, center_lon, radius_meters, reason) VALUES (?, ?, ?, ?, ?)",
            (name, lat, lon, radius, reason)
        )

    # Seed Corridor Baselines (Synthetic calibration rows marked source='seed')
    corridors = [
        ("CAM_05", "CAM_06", 2.6, 360.0, 45.0, 85, "seed"),   # Guindy -> Saidapet: ~26 km/h
        ("CAM_06", "CAM_01", 4.2, 580.0, 75.0, 110, "seed"),  # Saidapet -> Gemini: ~26 km/h
        ("CAM_01", "CAM_02", 1.1, 150.0, 30.0, 140, "seed"),  # Gemini -> Thousand Lights: ~26 km/h
        ("CAM_02", "CAM_03", 1.0, 140.0, 25.0, 150, "seed"),  # Thousand Lights -> Spencers: ~25 km/h
        ("CAM_04", "CAM_01", 2.4, 380.0, 50.0, 60, "seed"),   # Panagal Park -> Gemini: ~22 km/h
        ("CAM_08", "CAM_06", 3.1, 450.0, 60.0, 70, "seed"),   # Madhya Kailash -> Saidapet: ~25 km/h
        ("CAM_08", "CAM_07", 6.5, 900.0, 120.0, 95, "seed"),  # Madhya Kailash -> Marina: ~26 km/h
        ("CAM_06", "CAM_04", 2.3, 340.0, 45.0, 65, "seed")    # Saidapet -> Panagal Park: ~24 km/h
    ]
    cursor.execute("DELETE FROM corridor_baseline;")
    now = datetime.now().isoformat()
    for c_from, c_to, dist, mean_t, stddev_t, count, src in corridors:
        avg_speed = dist / (mean_t / 3600.0)
        cursor.execute("""
            INSERT INTO corridor_baseline 
            (camera_from, camera_to, distance_km, mean_transit_seconds, stddev_transit_seconds, sample_count, avg_speed_kmh, source, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (c_from, c_to, dist, mean_t, stddev_t, count, round(avg_speed, 2), src, now))

    # Seed Camera Registry — 8 Chennai ANPR node positions
    camera_rows = [
        ("CAM_01", "Anna Salai / Gemini Flyover",        13.0522, 80.2467, "Z1"),
        ("CAM_02", "Thousand Lights / Museum Rd",        13.0577, 80.2497, "Z1"),
        ("CAM_03", "Spencers Plaza / Anna Salai",        13.0620, 80.2601, "Z2"),
        ("CAM_04", "Panagal Park / T Nagar",             13.0397, 80.2325, "Z3"),
        ("CAM_05", "Guindy Junction / GST Rd",           13.0070, 80.2093, "Z4"),
        ("CAM_06", "Saidapet / Maraimalai Nagar Rd",    13.0227, 80.2210, "Z4"),
        ("CAM_07", "Marina / Kamarajar Salai",           13.0540, 80.2820, "Z2"),
        ("CAM_08", "Madhya Kailash / 200 Ft Rd",        13.0102, 80.2457, "Z3"),
    ]
    for cam_id, name, lat, lon, zone_id in camera_rows:
        cursor.execute("""
            INSERT OR IGNORE INTO cameras (camera_id, name, lat, lon, zone_id, enabled, status)
            VALUES (?, ?, ?, ?, ?, 1, 'DEMO')
        """, (cam_id, name, lat, lon, zone_id))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    seed_static_metadata()
    print("Database initialized and static metadata seeded.")
