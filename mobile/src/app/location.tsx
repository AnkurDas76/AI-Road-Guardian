import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { updateLocationApi, getApiBaseUrl } from '../api/config';

export default function LocationScreen() {
  const [userId, setUserId] = useState('user_1');
  const [lat, setLat] = useState('22.5730');
  const [lon, setLon] = useState('88.3641');
  const [isSyncActive, setIsSyncActive] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Never');
  const [syncCount, setSyncCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');

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
    } else {
      setStatusMessage(`Failed: ${res.error || 'Network error'}`);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSyncActive) {
      sendLocationUpdate(); // initial update
      interval = setInterval(() => {
        sendLocationUpdate();
      }, 5000); // Send location update every 5 seconds as specified
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSyncActive, lat, lon, userId]);

  // Quick Preset Location buttons to easily test 300m radius
  const setKolkataNear = () => {
    setLat('22.5730');
    setLon('88.3641');
  };

  const setKolkataFar = () => {
    setLat('22.6000');
    setLon('88.4000');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Info */}
      <View style={styles.headerCard}>
        <View style={styles.iconRow}>
          <Ionicons name="navigate-circle-outline" size={32} color="#34d399" />
          <Text style={styles.headerTitle}>Periodic Location Service</Text>
        </View>
        <Text style={styles.headerDescription}>
          Continuously sends your GPS coordinates to the backend every 5 seconds via POST /update_location so nearby drowsiness alerts (&lt;300m) reach you immediately.
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
      </View>

      {/* Coordinate Config & Simulation */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device Identity & Location</Text>

        <Text style={styles.inputLabel}>User ID</Text>
        <TextInput
          style={styles.input}
          value={userId}
          onChangeText={setUserId}
          placeholder="e.g. user_1"
          placeholderTextColor="#64748b"
        />

        <View style={styles.coordRow}>
          <View style={styles.coordCol}>
            <Text style={styles.inputLabel}>Latitude</Text>
            <TextInput
              style={styles.input}
              value={lat}
              onChangeText={setLat}
              keyboardType="numeric"
              placeholder="22.5730"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.coordCol}>
            <Text style={styles.inputLabel}>Longitude</Text>
            <TextInput
              style={styles.input}
              value={lon}
              onChangeText={setLon}
              keyboardType="numeric"
              placeholder="88.3641"
              placeholderTextColor="#64748b"
            />
          </View>
        </View>

        <Text style={styles.presetTitle}>Location Simulation Presets:</Text>
        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetButton} onPress={setKolkataNear}>
            <Text style={styles.presetText}>📍 Near Driver (&lt;50m)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.presetButtonSecondary} onPress={setKolkataFar}>
            <Text style={styles.presetTextSecondary}>📍 Far Away (&gt;4km)</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.manualButton} onPress={sendLocationUpdate}>
          <Ionicons name="refresh" size={18} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.manualButtonText}>Sync Now Manually</Text>
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
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  headerDescription: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  switchLabel: {
    color: '#34d399',
    fontWeight: 'bold',
    fontSize: 14,
  },
  card: {
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
  inputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
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
    marginBottom: 12,
  },
  coordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coordCol: {
    width: '48%',
  },
  presetTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  presetButton: {
    backgroundColor: '#065f46',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '48%',
    alignItems: 'center',
  },
  presetText: {
    color: '#a7f3d0',
    fontSize: 12,
    fontWeight: 'bold',
  },
  presetButtonSecondary: {
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '48%',
    alignItems: 'center',
  },
  presetTextSecondary: {
    color: '#d1d5db',
    fontSize: 12,
    fontWeight: 'bold',
  },
  manualButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
