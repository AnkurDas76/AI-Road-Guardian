import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import math
import time
import pygame
import numpy as np
import requests
import logging
import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

BACKEND_ALERT_URL = "http://127.0.0.1:5000/alert"
DRIVER_ID = "driver_1"
DEFAULT_LAT = 22.5726
DEFAULT_LON = 88.3639
ALERT_COOLDOWN_SECONDS = 15.0

last_alert_sent_time = 0.0

def send_backend_alert(driver_id, lat, lon):
    global last_alert_sent_time
    current_time = time.time()

    if current_time - last_alert_sent_time < ALERT_COOLDOWN_SECONDS:
        return

    last_alert_sent_time = current_time
    payload = {
        "driver_id": driver_id,
        "lat": lat,
        "lon": lon
    }
    
    logging.info(f"🚨 DISPATCHING ALERT TO BACKEND: {payload}")
    try:
        response = requests.post(BACKEND_ALERT_URL, json=payload, timeout=3.0)
        if response.status_code == 200:
            logging.info(f"✅ Backend Alert Dispatched Successfully: {response.json()}")
        else:
            logging.warning(f"⚠️ Backend status {response.status_code}: {response.text}")
    except requests.exceptions.RequestException as e:
        logging.error(f"❌ Could not reach backend server ({BACKEND_ALERT_URL}): {e}")

# Pygame Audio Initialization
pygame.mixer.init()
alarm_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'alarm.wav')
try:
    alarm_sound = pygame.mixer.Sound(alarm_path)
except Exception:
    try:
        alarm_sound = pygame.mixer.Sound('alarm.wav')
    except Exception:
        alarm_sound = None

# MediaPipe Landmarker Model Path
model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'face_landmarker.task')
if not os.path.exists(model_path):
    model_path = 'face_landmarker.task'

base_options = python.BaseOptions(model_asset_path=model_path)
options = vision.FaceLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.VIDEO,
    num_faces=1,
    min_face_detection_confidence=0.5, 
    min_face_presence_confidence=0.5,
    min_tracking_confidence=0.5,
    output_face_blendshapes=True 
)
detector = vision.FaceLandmarker.create_from_options(options)

LEFT_EYE_MATH = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_MATH = [33, 160, 158, 133, 153, 144]

EAR_THRESHOLD = 0.21 
SLEEP_TIME_THRESHOLD = 6.0 
HEAD_DOWN_TIME_THRESHOLD = 10.0
DISTRACTION_TIME_THRESHOLD = 6.0

FACE_3D_MODEL = np.array([
    [0.0, 0.0, 0.0],            
    [0.0, -330.0, -65.0],       
    [-225.0, 170.0, -135.0],    
    [225.0, 170.0, -135.0],     
    [-150.0, -150.0, -125.0],   
    [150.0, -150.0, -125.0]     
], dtype=np.float64)

sleep_start_time = None
head_down_start_time = None
face_missing_start_time = None
is_sleeping = False

def euclidean_distance(p1, p2):
    return math.hypot(p2[0] - p1[0], p2[1] - p1[1])

def calculate_stable_ear(eye_points, face_landmarks, img_w, img_h):
    coords = [(int(face_landmarks[p].x * img_w), int(face_landmarks[p].y * img_h)) for p in eye_points]
    v1 = euclidean_distance(coords[1], coords[5])
    v2 = euclidean_distance(coords[2], coords[4])
    h1 = euclidean_distance(coords[0], coords[3])
    if h1 == 0.0:
        return 0.0
    return (v1 + v2) / (2.0 * h1)

def enhance_lighting(frame):
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l_channel, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    cl = clahe.apply(l_channel)
    return cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2BGR)

def get_head_pose(face_landmarks, img_w, img_h):
    key_indices = [1, 152, 226, 446, 57, 287] 
    face_2d = []
    
    for idx in key_indices:
        face_2d.append([int(face_landmarks[idx].x * img_w), int(face_landmarks[idx].y * img_h)])
    face_2d = np.array(face_2d, dtype=np.float64)

    focal_length = 1 * img_w
    cam_matrix = np.array([
        [focal_length, 0, img_h / 2],
        [0, focal_length, img_w / 2],
        [0, 0, 1]
    ])
    dist_matrix = np.zeros((4, 1), dtype=np.float64)

    success, rot_vec, trans_vec = cv2.solvePnP(FACE_3D_MODEL, face_2d, cam_matrix, dist_matrix)
    rmat, _ = cv2.Rodrigues(rot_vec)
    angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
    
    return angles[0]

def main():
    global sleep_start_time, head_down_start_time, face_missing_start_time, is_sleeping
    
    cap = cv2.VideoCapture(0)
    logging.info("Starting AI Drowsiness Detection System... Press 'q' to quit.")

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        frame = cv2.flip(frame, 1)
        enhanced_frame = enhance_lighting(frame)
        img_h, img_w, _ = enhanced_frame.shape
        
        rgb_frame = cv2.cvtColor(enhanced_frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        timestamp_ms = int(time.time() * 1000)
        
        results = detector.detect_for_video(mp_image, timestamp_ms)

        if results.face_landmarks:
            face_missing_start_time = None
            face_landmarks = results.face_landmarks[0]
            
            pitch = get_head_pose(face_landmarks, img_w, img_h)
            
            if pitch > -140 and pitch < 140:
                if head_down_start_time is None:
                    head_down_start_time = time.time()
                elapsed_head_down = time.time() - head_down_start_time
                
                cv2.putText(frame, f"Head Down: {elapsed_head_down:.1f}s / {HEAD_DOWN_TIME_THRESHOLD}s", (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
                
                if elapsed_head_down >= HEAD_DOWN_TIME_THRESHOLD:
                    cv2.putText(frame, "LOOK FORWARD!", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 165, 255), 3)
                    if alarm_sound and not pygame.mixer.get_busy():
                        alarm_sound.play()
            else:
                head_down_start_time = None
                if alarm_sound and not is_sleeping:
                    alarm_sound.stop()

            left_ear = calculate_stable_ear(LEFT_EYE_MATH, face_landmarks, img_w, img_h)
            right_ear = calculate_stable_ear(RIGHT_EYE_MATH, face_landmarks, img_w, img_h)
            avg_ear = (left_ear + right_ear) / 2.0

            if avg_ear < EAR_THRESHOLD:
                if sleep_start_time is None:
                    sleep_start_time = time.time()
                elapsed_time = time.time() - sleep_start_time
                cv2.putText(frame, f"Eyes Closed: {elapsed_time:.1f}s / {SLEEP_TIME_THRESHOLD}s", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 165, 255), 2)
                
                if elapsed_time >= SLEEP_TIME_THRESHOLD:
                    is_sleeping = True
                    cv2.rectangle(frame, (0, 0), (img_w, img_h), (0, 0, 255), 5)
                    cv2.putText(frame, "CRITICAL ALARM! SLEEP DETECTED!", (50, 250), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
                    
                    if alarm_sound and not pygame.mixer.get_busy():
                        alarm_sound.play()

                    send_backend_alert(DRIVER_ID, DEFAULT_LAT, DEFAULT_LON)
            else:
                sleep_start_time = None
                is_sleeping = False
                if alarm_sound and head_down_start_time is None:
                    alarm_sound.stop()

            cv2.putText(frame, f"Pitch: {pitch:.1f} deg", (50, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.putText(frame, f"EAR: {avg_ear:.3f}", (50, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        else:
            if face_missing_start_time is None:
                face_missing_start_time = time.time()
            
            elapsed_missing = time.time() - face_missing_start_time
            cv2.putText(frame, f"Tracking Lost: {elapsed_missing:.1f}s", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            
            if elapsed_missing >= DISTRACTION_TIME_THRESHOLD:
                cv2.putText(frame, "DISTRACTION DETECTED!", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)
                if alarm_sound and not pygame.mixer.get_busy():
                    alarm_sound.play()

        cv2.imshow("AI Driving Safety System - Live Detection", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
