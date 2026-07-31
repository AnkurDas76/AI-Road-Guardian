import sqlite3
import logging
from datetime import datetime
from config import Config

logger = logging.getLogger(__name__)

def get_db_connection():
    """Establishes and returns a database connection with Row factory."""
    conn = sqlite3.connect(Config.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """
    Initializes the SQLite database tables and seeds demo users and police stations
    if they do not already exist.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            fcm_token TEXT,
            last_updated TEXT NOT NULL
        )
    """)

    # Create police_stations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS police_stations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            city TEXT DEFAULT 'Kolkata'
        )
    """)

    # Create alerts_log table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alerts_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            driver_id TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            timestamp TEXT NOT NULL,
            notified_users INTEGER NOT NULL,
            notified_police INTEGER NOT NULL,
            status TEXT DEFAULT 'TRIGGERED'
        )
    """)

    # Create fcm_tokens table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS fcm_tokens (
            user_id TEXT PRIMARY KEY,
            token TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    conn.commit()

    # Seed Demo Users if table is empty
    cursor.execute("SELECT COUNT(*) FROM users")
    user_count = cursor.fetchone()[0]
    if user_count == 0:
        now_str = datetime.now().isoformat()
        demo_users = [
            # Drivers / App Users within 300m of (22.5726, 88.3639)
            ("user_1", "Amit Sharma", "9830000001", 22.5730, 88.3641, "demo_token_user_1", now_str), # ~50m away
            ("user_2", "Riya Sen", "9830000002", 22.5738, 88.3650, "demo_token_user_2", now_str),    # ~170m away
            ("user_3", "Priya Das", "9830000003", 22.5718, 88.3628, "demo_token_user_3", now_str),   # ~140m away
            # User outside 300m radius
            ("user_4", "Samrat Roy", "9830000004", 22.6000, 88.4000, "demo_token_user_4", now_str),  # > 4km away
            ("user_5", "Rahul Verma", "9830000005", 22.5745, 88.3658, "demo_token_user_5", now_str)  # ~290m away
        ]
        cursor.executemany("""
            INSERT INTO users (id, name, phone, lat, lon, fcm_token, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, demo_users)
        logger.info("Successfully seeded demo users into database.")

    # Seed Demo Police Stations if table is empty
    cursor.execute("SELECT COUNT(*) FROM police_stations")
    station_count = cursor.fetchone()[0]
    if station_count == 0:
        demo_stations = [
            ("ps_1", "Lalbazar Central Police Station", "033-22143000", 22.5720, 88.3630, "Kolkata"), # ~110m away
            ("ps_2", "Jorasanko Police Station", "033-22696000", 22.5840, 88.3580, "Kolkata"),        # ~1.4km away
            ("ps_3", "Park Street Police Station", "033-22262000", 22.5550, 88.3520, "Kolkata"),      # ~2.3km away
            ("ps_4", "Salt Lake Police Station", "033-23340000", 22.5870, 88.4170, "Kolkata")        # ~5.7km (outside 3km)
        ]
        cursor.executemany("""
            INSERT INTO police_stations (id, name, phone, lat, lon, city)
            VALUES (?, ?, ?, ?, ?, ?)
        """, demo_stations)
        logger.info("Successfully seeded demo police stations into database.")

    conn.commit()
    conn.close()

def update_user_location(user_id: str, lat: float, lon: float, name: str = "", phone: str = "") -> dict:
    """Updates or registers a user location timestamped with current time."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()

    cursor.execute("SELECT name, phone, fcm_token FROM users WHERE id = ?", (user_id,))
    existing = cursor.fetchone()

    if existing:
        user_name = name if name else existing["name"]
        user_phone = phone if phone else existing["phone"]
        cursor.execute("""
            UPDATE users
            SET lat = ?, lon = ?, last_updated = ?, name = ?, phone = ?
            WHERE id = ?
        """, (lat, lon, now_str, user_name, user_phone, user_id))
    else:
        user_name = name if name else f"User {user_id}"
        user_phone = phone if phone else "9999999999"
        cursor.execute("""
            INSERT INTO users (id, name, phone, lat, lon, fcm_token, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, user_name, user_phone, lat, lon, "", now_str))

    conn.commit()
    conn.close()
    return {"user_id": user_id, "lat": lat, "lon": lon, "last_updated": now_str}

def get_all_users() -> list:
    """Fetches all users from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_all_police_stations() -> list:
    """Fetches all police stations from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM police_stations")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def save_alert_log(driver_id: str, lat: float, lon: float, notified_users_cnt: int, notified_police_cnt: int) -> int:
    """Saves a drowsiness alert entry into alerts_log table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO alerts_log (driver_id, lat, lon, timestamp, notified_users, notified_police)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (driver_id, lat, lon, now_str, notified_users_cnt, notified_police_cnt))

    alert_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return alert_id

def get_alerts_history(limit: int = 50) -> list:
    """Fetches past drowsiness alerts ordered by timestamp descending."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alerts_log ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def save_fcm_token(user_id: str, token: str) -> bool:
    """Registers or updates user FCM token."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO fcm_tokens (user_id, token, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, updated_at = excluded.updated_at
    """, (user_id, token, now_str))

    cursor.execute("UPDATE users SET fcm_token = ? WHERE id = ?", (token, user_id))

    conn.commit()
    conn.close()
    return True
