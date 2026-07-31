import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiBaseUrl, triggerManualAlertApi, fetchHistory } from '../api/config';
import { router } from 'expo-router';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(false);
  const [totalAlerts, setTotalAlerts] = useState<number>(0);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);

  const checkBackendStatus = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/health`);
      const data = await res.json();
      setBackendConnected(data.status === 'ONLINE');
    } catch {
      setBackendConnected(false);
    }
  };

  const loadStats = async () => {
    const alerts = await fetchHistory();
    setTotalAlerts(alerts.length);
  };

  useEffect(() => {
    checkBackendStatus();
    loadStats();
    const interval = setInterval(() => {
      checkBackendStatus();
      loadStats();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTestEmergencyAlert = async () => {
    setLoading(true);
    // Trigger alert for driver_1 near Kolkata default coordinates (22.5726, 88.3639)
    const result = await triggerManualAlertApi('driver_1', 22.5726, 88.3639);
    setLoading(false);

    if (result.success) {
      if (result.status === 'COOLDOWN_ACTIVE') {
        Alert.alert('⏳ Cooldown Active', 'Alert debounced to prevent spamming backend.');
      } else {
        const uCount = result.nearby_users ? result.nearby_users.length : 0;
        const pCount = result.nearby_police ? result.nearby_police.length : 0;
        Alert.alert(
          '🚨 ALERT DISPATCHED',
          `Drowsiness Alert Triggered!\n\n👥 Notified Users (<300m): ${uCount}\n🚓 Notified Police (<3km): ${pCount}`,
          [
            { text: 'View on OpenStreetMap', onPress: () => router.push('/map') },
            { text: 'OK' },
          ]
        );
        loadStats();
      }
    } else {
      Alert.alert('❌ Connection Error', `Failed to contact backend at ${getApiBaseUrl()}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={styles.statusBadgeRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: backendConnected ? '#10b981' : '#ef4444' },
              ]}
            />
            <Text style={styles.statusBadgeText}>
              {backendConnected === null
                ? 'CHECKING BACKEND...'
                : backendConnected
                ? 'BACKEND ONLINE'
                : 'BACKEND OFFLINE'}
            </Text>
          </View>
          <Text style={styles.apiUrlText}>{getApiBaseUrl()}</Text>
        </View>

        <Text style={styles.statusTitle}>AI Drowsiness Monitor</Text>
        <Text style={styles.statusSubtitle}>
          Real-time MediaPipe & OpenCV Python Detection Active
        </Text>
      </View>

      {/* Emergency Trigger Section */}
      <TouchableOpacity
        style={styles.sosButton}
        activeOpacity={0.8}
        onPress={handleTestEmergencyAlert}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#ffffff" size="large" />
        ) : (
          <>
            <Ionicons name="warning" size={42} color="#ffffff" />
            <Text style={styles.sosButtonText}>TEST SOS ALERT</Text>
            <Text style={styles.sosButtonSubtext}>
              Simulate Drowsy Driver Detection (&gt;6s eyes closed)
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Quick Statistics Grid */}
      <Text style={styles.sectionTitle}>System Parameters</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="radio-outline" size={28} color="#38bdf8" />
          <Text style={styles.statNumber}>300m</Text>
          <Text style={styles.statLabel}>Nearby User Radius</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="shield-outline" size={28} color="#818cf8" />
          <Text style={styles.statNumber}>3 km</Text>
          <Text style={styles.statLabel}>Police Net Radius</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="alert-circle-outline" size={28} color="#f43f5e" />
          <Text style={styles.statNumber}>{totalAlerts}</Text>
          <Text style={styles.statLabel}>Alerts Logged</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="map-outline" size={28} color="#34d399" />
          <Text style={styles.statNumber}>OSM</Text>
          <Text style={styles.statLabel}>100% Free Maps</Text>
        </View>
      </View>

      {/* Action Navigation */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/map')}>
          <Ionicons name="map" size={32} color="#38bdf8" />
          <Text style={styles.actionText}>OpenStreetMap</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/location')}>
          <Ionicons name="navigate-circle" size={32} color="#34d399" />
          <Text style={styles.actionText}>Live GPS Sync</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/history')}>
          <Ionicons name="time" size={32} color="#f43f5e" />
          <Text style={styles.actionText}>Alert History</Text>
        </TouchableOpacity>
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
  statusCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusBadgeText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  apiUrlText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  statusTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: 'bold',
  },
  statusSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  sosButton: {
    backgroundColor: '#dc2626',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 8,
    letterSpacing: 1,
  },
  sosButtonSubtext: {
    color: '#fca5a5',
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#1e293b',
    width: '48%',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  statNumber: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: '#1e293b',
    width: '31%',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
});
