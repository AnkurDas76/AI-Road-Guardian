#!/usr/bin/env python3
"""
Test Alert Simulator - AI Driving Safety System
------------------------------------------------
Simulates sending a POST /alert payload to the Flask backend to test:
1. Spatial Haversine filtering for users (<300m) and police (<3km).
2. SQLite alert logging.
3. Notification dispatch logic.

Run backend server first:
  python backend/app.py

Then execute test:
  python test_alert.py
"""

import sys
import requests
import json
import time

BACKEND_URL = "http://127.0.0.1:5000/alert"

def run_test_alert(driver_id="driver_1", lat=22.5726, lon=88.3639):
    print(f"\n==================================================")
    print(f"🚀 SENDING SIMULATED DROWSINESS ALERT TO BACKEND")
    print(f"==================================================")
    print(f"Target Endpoint: {BACKEND_URL}")
    
    payload = {
        "driver_id": driver_id,
        "lat": lat,
        "lon": lon
    }
    
    print(f"Payload:\n{json.dumps(payload, indent=2)}")
    
    try:
        start_time = time.time()
        response = requests.post(BACKEND_URL, json=payload, timeout=5)
        elapsed = (time.time() - start_time) * 1000
        
        print(f"\nHTTP Status Code: {response.status_code} ({elapsed:.1f}ms)")
        
        if response.status_code == 200:
            res_json = response.json()
            print("Response JSON:")
            print(json.dumps(res_json, indent=2))
            
            print("\n---------------- RESULTS SUMMARY ----------------")
            if res_json.get("status") == "COOLDOWN_ACTIVE":
                print("⏳ Alert was debounced by backend anti-spam cooldown.")
            else:
                users = res_json.get("nearby_users", [])
                police = res_json.get("nearby_police", [])
                print(f"✅ Success: {res_json.get('success')}")
                print(f"📍 Alert ID: {res_json.get('alert_id')}")
                print(f"👥 Nearby Users within 300m: {len(users)}")
                for u in users:
                    print(f"   - {u.get('name')} ({u.get('phone')}): {u.get('distance')}m away")
                print(f"🚓 Nearby Police Stations within 3km: {len(police)}")
                for p in police:
                    print(f"   - {p.get('name')} ({p.get('phone')}): {p.get('distance')}m away")
            print("-------------------------------------------------")
        else:
            print(f"❌ Error: Backend returned non-200 status code: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print(f"❌ CONNECTION ERROR: Could not reach backend server at {BACKEND_URL}.")
        print("   Please ensure Flask backend is running (`python backend/app.py`).")
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {e}")

if __name__ == "__main__":
    driver = sys.argv[1] if len(sys.argv) > 1 else "driver_1"
    run_test_alert(driver_id=driver)
