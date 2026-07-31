import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { updateLocationApi, fetchNearbyHazardsApi, HazardItem } from '../api/config';

export default function LocationScreen() {
  const [userId, setUserId] = useState('user_1');
  const [lat, setLat] = useState('22.5730');
  const [lon, setLon] = useState('88.3641');
  const [speedKmH, setSpeedKmH] = useState<number>(40);
  const [headingDeg, setHeadingDeg] = useState<number>(90); // 90° East
  const [isSyncActive, setIsSyncActive] = useState(true);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSimulationActive, setIsSimulationActive] = useState(false);

  const [lastSyncTime, setLastSyncTime] = useState<string>('Never');
  const [syncCount, setSyncCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [detectedHazards, setDetectedHazards] = useState<HazardItem[]>([]);
  const [activeAlertText, setActiveAlertText] = useState<string | null>(null);

  const lastSpokenHazardRef = useRef<string | null>(null);

  // Dynamic Warning Buffer (meters) based on speed
  const warningBufferMeters = Math.max(30, Math.round(speedKmH * 3.5));

  // Calculate bearing from (lat1, lon1) to (lat2, lon2) in degrees (0-360)
  const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;

    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaLambda = toRad(lon2 - lon1);

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

    const brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
  };

  // Directional Flashlight Cone Math (±30° tolerance angle)
  const isHazardInDirectionCone = (
    userLat: number,
    userLon: number,
    userHeading: number,
    hazardLat: number,
    hazardLon: number
  ) => {
    const bearingToHazard = calculateBearing(userLat, userLon, hazardLat, hazardLon);
    const diff = Math.abs(((bearingToHazard - userHeading + 540) % 360) - 180);
    return diff <= 30; // within 30 degree cone ahead
  };

  const evaluateProximityEngine = async (parsedLat: number, parsedLon: number) => {
    try {
      const res = await fetchNearbyHazardsApi(parsedLat, parsedLon, true);
      const hazards = res.hazards || [];
      setDetectedHazards(hazards);

      for (const h of hazards) {
        const inCone = isHazardInDirectionCone(parsedLat, parsedLon, headingDeg, h.latitude, h.longitude);
        const distKm = h.distance_km || 0.05;
        const distMeters = distKm * 1000;

        if (inCone && distMeters <= warningBufferMeters) {
          const alertMsg = `Warning! ${h.type.replace('_', ' ')} ahead in ${Math.round(distMeters)} meters!`;
          setActiveAlertText(alertMsg);

          if (isVoiceEnabled && lastSpokenHazardRef.current !== h.id) {
            lastSpokenHazardRef.current = h.id;
            Speech.speak(alertMsg, { rate: 1.0, pitch: 1.0 });
          }
          break;
        }
      }
    } catch (e) {
      console.warn('Proximity evaluation error:', e);
    }
  };

  const sendLocationUpdate = async () => {
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      setStatusMessage('Invalid coordinates');
      return;
    }

    const res = await updateLocationApi(userId, parsedLat, parsedLon);
    if (res.success || res.status === 'location updated') {
      const now = new Date().toLocaleTimeString();
      setLastSyncTime(now);
      setSyncCount((prev) => prev + 1);
      setStatusMessage(`Synced at ${now}`);
      await evaluateProximityEngine(parsedLat, parsedLon);
    } else {
      setStatusMessage(`Failed: ${res.error || 'Network error'}`);
    }
  };

  // Simulation Route Walk / Drive loop
  useEffect(() => {
    let simInterval: any;
    if (isSimulationActive) {
      simInterval = setInterval(() => {
        setLat((prevLat) => (parseFloat(prevLat) + 0.0001).toFixed(4));
        setLon((prevLon) => (parseFloat(prevLon) + 0.0001).toFixed(4));
      }, 2000);
    }
    return () => {
      if (simInterval) clearInterval(simInterval);
    };
  }, [isSimulationActive]);

  useEffect(() => {
    let interval: any;
    if (isSyncActive) {
      sendLocationUpdate();
      interval = setInterval(() => {
        sendLocationUpdate();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSyncActive, lat, lon, speedKmH, headingDeg, userId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Info */}
      <View style={styles.headerCard}>
        <View style={styles.iconRow}>
          <Ionicons name="speedometer" size={32} color="#38bdf8" />
          <Text style={styles.headerTitle}>Live Proximity & Voice Warning Engine</Text>
        </View>
        <Text style={styles.headerDescription}>
          Combines dynamic speed-gated warning buffers with directional cone math (±30°) and Expo Text-To-Speech.
        </Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Auto GPS Sync (5s)</Text>
          <Switch
            value={isSyncActive}
            onValueChange={setIsSyncActive}
            trackColor={{ false: '#475569', true: '#059669' }}
            thumbColor={isSyncActive ? '#34d399' : '#94a3b8'}
          />
        </View>

        <View style={[styles.switchRow, { marginTop: 8 }]}>
          <Text style={styles.switchLabel}>Voice Alerts (TTS)</Text>
          <Switch
            value={isVoiceEnabled}
            onValueChange={setIsVoiceEnabled}
            trackColor={{ false: '#475569', true: '#38bdf8' }}
            thumbColor={isVoiceEnabled ? '#38bdf8' : '#94a3b8'}
          />
        </View>
      </View>

      {/* Active Voice Warning Banner */}
      {activeAlertText && (
        <View style={styles.alertBanner}>
          <Ionicons name="volume-high" size={24} color="#ffffff" style={{ marginRight: 10 }} />
          <Text style={styles.alertBannerText}>{activeAlertText}</Text>
        </View>
      )}

      {/* Speedometer & Dynamic Buffer Display */}
      <View style={styles.speedCard}>
        <Text style={styles.cardTitle}>Rider Telemetry & Dynamic Buffer</Text>

        <View style={styles.telemetryRow}>
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryVal}>{speedKmH} <Text style={{ fontSize: 14 }}>km/h</Text></Text>
            <Text style={styles.telemetryLabel}>Current Speed</Text>
          </View>

          <View style={styles.telemetryBox}>
            <Text style={[styles.telemetryVal, { color: '#f59e0b' }]}>{warningBufferMeters} <Text style={{ fontSize: 14 }}>m</Text></Text>
            <Text style={styles.telemetryLabel}>Warning Buffer</Text>
          </View>

          <View style={styles.telemetryBox}>
            <Text style={[styles.telemetryVal, { color: '#a855f7' }]}>{headingDeg}°</Text>
            <Text style={styles.telemetryLabel}>Bearing (East)</Text>
          </View>
        </View>

        <Text style={styles.inputLabel}>Adjust Speed Simulation (km/h):</Text>
        <View style={styles.speedBtnRow}>
          {[20, 40, 60, 80].map((spd) => (
            <TouchableOpacity
              key={spd}
              style={[styles.speedBtn, speedKmH === spd && styles.activeSpeedBtn]}
              onPress={() => setSpeedKmH(spd)}>
              <Text style={[styles.speedBtnText, speedKmH === spd && styles.activeSpeedText]}>{spd} km/h</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Device Identity & Coordinate Inputs */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.cardTitle}>GPS Position & Simulation</Text>
          <TouchableOpacity
            style={[styles.simBtn, isSimulationActive && styles.simBtnActive]}
            onPress={() => setIsSimulationActive(!isSimulationActive)}>
            <Ionicons name={isSimulationActive ? 'pause' : 'play'} size={14} color="#ffffff" />
            <Text style={styles.simBtnText}>{isSimulationActive ? 'Pause Auto-Drive' : 'Route Simulation'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.inputLabel}>User ID</Text>
        <TextInput
          style={styles.input}
          value={userId}
          onChangeText={setUserId}
        />

        <View style={styles.coordRow}>
          <View style={styles.coordCol}>
            <Text style={styles.inputLabel}>Latitude</Text>
            <TextInput
              style={styles.input}
              value={lat}
              onChangeText={setLat}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.coordCol}>
            <Text style={styles.inputLabel}>Longitude</Text>
            <TextInput
              style={styles.input}
              value={lon}
              onChangeText={setLon}
              keyboardType="numeric"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.manualButton} onPress={sendLocationUpdate}>
          <Ionicons name="refresh" size={18} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.manualButtonText}>Sync Location & Run Engine</Text>
        </TouchableOpacity>
      </View>

      {/* Realtime Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{syncCount}</Text>
          <Text style={styles.statSub}>Total Syncs</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statVal}>{lastSyncTime}</Text>
          <Text style={styles.statSub}>Last Updated</Text>
        </View>
      </View>

      <View style={styles.statusBox}>
        <Text style={styles.statusBoxText}>Status: {statusMessage}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  headerDescription: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  switchLabel: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 13,
  },
  alertBanner: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertBannerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  speedCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  telemetryBox: {
    backgroundColor: '#0f172a',
    flex: 1,
    marginHorizontal: 3,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  telemetryVal: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  telemetryLabel: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  speedBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  speedBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeSpeedBtn: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  speedBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  activeSpeedText: {
    color: '#0f172a',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  simBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  simBtnActive: {
    backgroundColor: '#dc2626',
  },
  simBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
    marginTop: 10,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  coordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coordCol: {
    width: '48%',
  },
  manualButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  manualButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statBox: {
    backgroundColor: '#1e293b',
    width: '48%',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statVal: {
    color: '#34d399',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  statusBox: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusBoxText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
});
