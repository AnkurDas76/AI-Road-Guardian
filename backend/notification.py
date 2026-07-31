import os
import logging
from config import Config

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK if credentials exist
firebase_initialized = False
try:
    if os.path.exists(Config.FIREBASE_CREDENTIALS_PATH):
        import firebase_admin
        from firebase_admin import credentials, messaging
        
        cred = credentials.Certificate(Config.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
        firebase_initialized = True
        logger.info("Firebase Admin SDK initialized successfully.")
    else:
        logger.info("Firebase credentials file not found. Running notification module in LOG mode.")
except Exception as e:
    logger.warning(f"Could not initialize Firebase Admin SDK: {e}. Falling back to LOG mode.")

def send_push_notification(fcm_token: str, title: str, body: str, data_payload: dict = None) -> bool:
    """
    Dispatches push notification via Firebase Cloud Messaging if configured,
    otherwise logs the notification payload locally.
    """
    if firebase_initialized and fcm_token:
        try:
            from firebase_admin import messaging
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data_payload or {},
                token=fcm_token,
            )
            response = messaging.send(message)
            logger.info(f"FCM Notification sent successfully ID: {response}")
            return True
        except Exception as e:
            logger.error(f"Failed to send FCM push notification: {e}")
            return False
    else:
        logger.info(f"[LOG NOTIFICATION] To Token: {fcm_token or 'BROADCAST'} | Title: {title} | Body: {body}")
        return True

def notify_nearby_users(nearby_users: list, driver_id: str, lat: float, lon: float) -> int:
    """
    Notifies all registered users within 300 meters of the drowsy driver.
    """
    notified_count = 0
    title = "🚨 DROWSY DRIVER ALERT"
    
    for user in nearby_users:
        name = user.get("name", "Driver")
        phone = user.get("phone", "N/A")
        distance = user.get("distance", 0)
        token = user.get("fcm_token", "")
        
        body = f"Drowsy driver '{driver_id}' detected {distance:.0f}m away. Drive carefully!"
        
        logger.info(f"[USER NOTIFICATION] Sent to {name} ({phone}) | {distance:.0f}m away")
        
        data_payload = {
            "type": "DROWSINESS_ALERT",
            "driver_id": str(driver_id),
            "lat": str(lat),
            "lon": str(lon),
            "distance": str(distance)
        }
        
        success = send_push_notification(token, title, body, data_payload)
        if success:
            notified_count += 1
            
    return notified_count

def notify_nearby_police(nearby_police: list, driver_id: str, lat: float, lon: float) -> int:
    """
    Notifies nearby police stations within 3km of the drowsy driver.
    """
    notified_count = 0
    title = "🚨 POLICE DISPATCH - DROWSY DRIVER"
    
    for station in nearby_police:
        name = station.get("name", "Police Station")
        phone = station.get("phone", "N/A")
        distance = station.get("distance", 0)
        
        body = f"ALERT: Drowsy driver '{driver_id}' detected at ({lat:.4f}, {lon:.4f}), {distance:.0f}m from {name}."
        
        logger.info(f"[POLICE NOTIFICATION] Sent to {name} ({phone}) | {distance:.0f}m away")
        
        # Simulating emergency call/SMS dispatch line
        send_push_notification("", title, body, {
            "type": "POLICE_ALERT",
            "station_id": str(station.get("id")),
            "driver_id": str(driver_id),
            "lat": str(lat),
            "lon": str(lon)
        })
        notified_count += 1
        
    return notified_count
