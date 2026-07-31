# 🚨 AI DRIVING SAFETY SYSTEM

An end-to-end production-grade AI Driving Safety System that continuously monitors driver alertness using computer vision, detects drowsiness or sleep state (> 6 seconds eyes closed), triggers immediate local alarms, dispatches GPS coordinates to a Flask backend, filters nearby users within **300 meters** and police stations within **3 km** using Haversine distance, and displays live safety alerts on a **React Native Expo Mobile App** with **100% Free OpenStreetMap**.

---

## 📌 Features

### 1. 🐍 Python AI Drowsiness Detection (`Python/detection.py`)
* **Computer Vision**: Powered by OpenCV & MediaPipe Face Landmarker.
* **Eye Aspect Ratio (EAR)**: Precise mathematical calculation of eye closure.
* **Head Pose Estimation (PnP)**: Detects head tilting down or looking away.
* **Local Audio Alarm**: Plays immediate audio warning using Pygame.
* **Backend Alert Dispatch**: Automatically posts `POST /alert` with driver ID and GPS coordinates (`lat`, `lon`) when eyes remain closed for **> 6 seconds**.
* **Spam Prevention / Debouncing**: Implements a 15-second alert cooldown timer so HTTP POST requests aren't spammed every frame.

### 2. ⚡ Flask REST API Backend (`backend/`)
* **Modular Architecture**: Clean separation into `config.py`, `database.py`, `distance.py`, `notification.py`, `routes.py`, and `app.py`.
* **SQLite Spatial Database**: Auto-creates tables (`users`, `police_stations`, `alerts_log`, `fcm_tokens`) and auto-seeds demo users & police stations on first startup.
* **Haversine Distance Engine**:
  * **Nearby Users Search**: Filters users within **300 meters**.
  * **Nearby Police Search**: Filters police stations within **3 km**.
* **Alert Logging**: Logs every drowsiness event into `alerts_log` with driver ID, lat, lon, timestamp, notified users count, and notified police count.
* **Firebase Cloud Messaging (FCM)**: Push notification dispatch with transparent mock fallback for local development.

### 3. 📱 Expo React Native Mobile App (`mobile/`)
* **100% Free OpenStreetMap**: Uses Leaflet.js inside React Native WebView. **NO Google Maps API Key or paid subscriptions required!**
* **Live GPS Location Sync**: Periodically updates user location every **5 seconds** via `POST /update_location`.
* **Dashboard**: Displays real-time backend status, system parameters (300m user radius, 3km police net), and emergency test SOS button.
* **Interactive Map**: Highlights current user position, drowsy driver alert pin, 300m danger circle overlay, and nearby police stations.
* **Alert History**: Lists historical alerts from `GET /history` with status badges and details.
* **FCM Push Notification Hub**: Register tokens and manage live emergency notification feeds.

---

## 📁 Project Structure

```
AI_driving/
├── backend/
│   ├── app.py                # Main Flask application entrypoint
│   ├── config.py             # Server config & search radii (300m users, 3km police)
│   ├── database.py           # SQLite connection, table auto-creation & demo seeding
│   ├── distance.py           # Haversine distance formula & spatial filters
│   ├── notification.py       # Firebase Cloud Messaging & emergency dispatch logger
│   ├── routes.py             # Flask Blueprint (/alert, /update_location, /history, etc.)
│   ├── requirements.txt      # Python dependencies for backend
│   └── test_alert.py         # Backend alert endpoint simulator
├── mobile/
│   ├── app.json              # Expo configuration
│   ├── package.json          # React Native & Expo dependencies
│   └── src/
│       ├── api/
│       │   └── config.ts     # Backend API base URL & fetch helpers
│       ├── components/
│       │   └── OSMMapView.tsx # Free OpenStreetMap Leaflet component
│       └── app/
│           ├── _layout.tsx   # Expo Router tab layout
│           ├── index.tsx     # Main Dashboard & SOS alert button
│           ├── location.tsx  # Continuous 5s location sync & simulation presets
│           ├── map.tsx       # Live OpenStreetMap alert screen
│           ├── history.tsx   # Historical alert log screen
│           └── notifications.tsx # FCM token manager & push notification feed
├── Python/
│   └── detection.py          # OpenCV + MediaPipe face landmarker drowsiness detector
├── detection.py              # Root copy of drowsiness detection script
├── test_alert.py             # Root alert simulator test script
├── alarm.wav                 # Local alarm audio file
├── face_landmarker.task      # MediaPipe 3D face landmarker task model
└── README.md                 # System documentation & execution guide
```

---

## 🚀 How to Run the Project

### Step 1: Start the Flask Backend Server

Navigate to the project root and run:

```bash
python backend/app.py
```

*Output:*
```
Starting AI Driving Safety System Backend on http://127.0.0.1:5000
SQLite database initialized and demo data seeded.
```

---

### Step 2: Run the Alert Simulator Test

In a separate terminal, test the `POST /alert` endpoint:

```bash
python test_alert.py
```

*Expected JSON Output:*
```json
{
  "success": true,
  "alert_id": 1,
  "driver": "driver_1",
  "lat": 22.5726,
  "lon": 88.3639,
  "nearby_users": [
    {
      "id": "user_1",
      "name": "Amit Sharma",
      "phone": "9830000001",
      "distance": 48.32
    },
    {
      "id": "user_3",
      "name": "Priya Das",
      "phone": "9830000003",
      "distance": 141.12
    }
  ],
  "nearby_police": [
    {
      "id": "ps_1",
      "name": "Lalbazar Central Police Station",
      "phone": "033-22143000",
      "distance": 112.50
    }
  ]
}
```

---

### Step 3: Run Python AI Drowsiness Detection

Launch the webcam face tracking system:

```bash
python Python/detection.py
```

* **Controls**: Close your eyes for > 6 seconds to trigger local audio alarm and automatically send `POST /alert` to the Flask backend. Press `q` to exit webcam feed.

---

### Step 4: Start the Mobile App (Expo)

Navigate to the `mobile/` directory:

```bash
cd mobile
npm install
npx expo start
```

* Press **`w`** for Web Browser view.
* Press **`a`** for Android Emulator (uses `http://10.0.2.2:5000`).
* Scan QR code with Expo Go on physical mobile device.

---

## 🌐 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/alert` | Receives drowsiness alert (`driver_id`, `lat`, `lon`), finds users (<300m) & police (<3km), logs to DB, dispatches notifications. |
| `POST` | `/update_location` | Updates continuous user location every 5s (`user_id`, `lat`, `lon`, `name`, `phone`). |
| `POST` | `/register_token` | Registers user FCM token for push notifications (`user_id`, `fcm_token`). |
| `GET` | `/history` | Fetches historical alert logs from SQLite `alerts_log`. |
| `GET` | `/users` | Returns list of all active users in database. |
| `GET` | `/police` | Returns list of police stations. |
| `GET` | `/health` | Health check endpoint. |

---

## 🛠️ Verification & Testing

1. **DB Auto-seeding**: Verified SQLite automatically creates tables and populates demo users & police stations on first run.
2. **Haversine Math**: Verified users within 300m and police stations within 3km are filtered correctly.
3. **Anti-Spam Cooldown**: Verified Python client and backend enforce 15-second cooldown to prevent duplicate alert spamming.
4. **OpenStreetMap**: Verified map view renders tiles and spatial markers for free without Google Maps API keys.

---
*Developed for AI Driving Safety System Final-Year Engineering Project.*
