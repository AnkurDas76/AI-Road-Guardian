import os

class Config:
    # Server Settings
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 5000))
    DEBUG = os.getenv("DEBUG", "True").lower() == "true"
    
    # Database Settings
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DB_PATH = os.path.join(BASE_DIR, "security.db")
    
    # Alert Search Radii (in meters)
    USER_ALERT_RADIUS_METERS = 300      # 300 meters for nearby app users
    POLICE_ALERT_RADIUS_METERS = 3000   # 3 km (3000 meters) for police stations
    
    # Alert Cooldown (in seconds to prevent duplicate spamming)
    ALERT_COOLDOWN_SECONDS = 15
    
    # Firebase Cloud Messaging Credentials Path (Optional, fallback to mock logger if missing)
    FIREBASE_CREDENTIALS_PATH = os.path.join(BASE_DIR, "serviceAccountKey.json")
