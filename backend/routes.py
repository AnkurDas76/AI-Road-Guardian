import time
import logging
from flask import Blueprint, request, jsonify
from config import Config
from database import (
    get_all_users,
    get_all_police_stations,
    save_alert_log,
    get_alerts_history,
    update_user_location,
    save_fcm_token
)
from distance import find_nearby_entities
from notification import notify_nearby_users, notify_nearby_police

logger = logging.getLogger(__name__)

api_bp = Blueprint("api", __name__)

# In-memory cooldown tracking: driver_id -> timestamp of last processed alert
last_alert_times = {}

@api_bp.route("/alert", methods=["POST"])
def handle_alert():
    """
    Primary Drowsiness Alert Handler.
    Receives driver_id, lat, lon from Python CV detection module.
    Filters nearby users (<= 300m) and police (<= 3km), triggers notifications,
    logs the event in SQLite, and returns JSON.
    """
    try:
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({"success": False, "error": "Invalid or missing JSON payload"}), 400

        driver_id = data.get("driver_id")
        lat_raw = data.get("lat")
        lon_raw = data.get("lon")

        if not driver_id or lat_raw is None or lon_raw is None:
            return jsonify({"success": False, "error": "Missing required fields: driver_id, lat, lon"}), 400

        lat = float(lat_raw)
        lon = float(lon_raw)

        # Anti-Spam / Cooldown Check
        current_time = time.time()
        if driver_id in last_alert_times:
            elapsed = current_time - last_alert_times[driver_id]
            if elapsed < Config.ALERT_COOLDOWN_SECONDS:
                logger.info(f"Alert ignored for '{driver_id}' due to active cooldown ({elapsed:.1f}s / {Config.ALERT_COOLDOWN_SECONDS}s)")
                return jsonify({
                    "success": True,
                    "status": "COOLDOWN_ACTIVE",
                    "message": f"Alert received but debounced (cooldown {Config.ALERT_COOLDOWN_SECONDS}s)",
                    "driver": driver_id
                }), 200

        # Update last alert timestamp
        last_alert_times[driver_id] = current_time

        # 1. Search nearby users within 300 meters
        all_users = get_all_users()
        nearby_users = find_nearby_entities(lat, lon, all_users, Config.USER_ALERT_RADIUS_METERS)

        # 2. Search nearby police stations within 3 km (3000 meters)
        all_police = get_all_police_stations()
        nearby_police = find_nearby_entities(lat, lon, all_police, Config.POLICE_ALERT_RADIUS_METERS)

        # 3. Send Notifications
        notified_users_cnt = notify_nearby_users(nearby_users, driver_id, lat, lon)
        notified_police_cnt = notify_nearby_police(nearby_police, driver_id, lat, lon)

        # 4. Save Alert in SQLite Database Log
        alert_id = save_alert_log(
            driver_id=driver_id,
            lat=lat,
            lon=lon,
            notified_users_cnt=len(nearby_users),
            notified_police_cnt=len(nearby_police)
        )

        logger.info(f"Alert #{alert_id} processed for driver '{driver_id}' at ({lat}, {lon}). "
                    f"Notified Users: {len(nearby_users)}, Notified Police: {len(nearby_police)}")

        # Return required standard JSON format
        return jsonify({
            "success": True,
            "alert_id": alert_id,
            "driver": driver_id,
            "lat": lat,
            "lon": lon,
            "nearby_users": nearby_users,
            "nearby_police": nearby_police
        }), 200

    except Exception as e:
        logger.error(f"Error handling /alert request: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

@api_bp.route("/update_location", methods=["POST"])
def handle_update_location():
    """
    Receives periodic user location updates (every 5 seconds from mobile app).
    """
    try:
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({"success": False, "error": "Invalid or missing JSON payload"}), 400

        user_id = data.get("user_id")
        lat_raw = data.get("lat")
        lon_raw = data.get("lon")

        if not user_id or lat_raw is None or lon_raw is None:
            return jsonify({"success": False, "error": "Fields user_id, lat, lon are required"}), 400

        lat = float(lat_raw)
        lon = float(lon_raw)
        name = data.get("name", "")
        phone = data.get("phone", "")

        result = update_user_location(user_id, lat, lon, name, phone)
        return jsonify({"success": True, "status": "location updated", "data": result}), 200

    except Exception as e:
        logger.error(f"Error handling /update_location: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

@api_bp.route("/register_token", methods=["POST"])
def handle_register_token():
    """Registers mobile FCM token for push notifications."""
    try:
        data = request.get_json(force=True, silent=True)
        if not data or not data.get("user_id") or not data.get("fcm_token"):
            return jsonify({"success": False, "error": "user_id and fcm_token required"}), 400

        user_id = data.get("user_id")
        fcm_token = data.get("fcm_token")

        save_fcm_token(user_id, fcm_token)
        return jsonify({"success": True, "status": "token registered"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@api_bp.route("/history", methods=["GET"])
def handle_history():
    """Returns past drowsiness alert log history."""
    try:
        history = get_alerts_history()
        return jsonify({"success": True, "alerts": history, "count": len(history)}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@api_bp.route("/users", methods=["GET"])
def handle_get_users():
    """Returns active users list."""
    try:
        users = get_all_users()
        return jsonify({"success": True, "users": users, "count": len(users)}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@api_bp.route("/police", methods=["GET"])
def handle_get_police():
    """Returns police stations list."""
    try:
        stations = get_all_police_stations()
        return jsonify({"success": True, "police_stations": stations, "count": len(stations)}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@api_bp.route("/health", methods=["GET"])
def health_check():
    """Server health check endpoint."""
    return jsonify({"status": "ONLINE", "service": "AI Driving Safety System Backend"}), 200
