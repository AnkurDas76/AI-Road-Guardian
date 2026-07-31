import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OSMMapView } from '../components/OSMMapView';
import {
  triggerManualAlertApi,
  UserItem,
  PoliceStationItem,
  fetchHistory,
  AlertItem,
} from '../api/config';

export default function MapScreen() {
  const [userLocation, setUserLocation] = useState({ lat: 22.5730, lon: 88.3641 });
  const [alertLocation, setAlertLocation] = useState<{
    lat: number;
    lon: number;
    driverId: string;
  } | null>({
    lat: 22.5726,
    lon: 88.3639,
    driverId: 'driver_1',
  });

  const [nearbyUsers, setNearbyUsers] = useState<UserItem[]>([
    { id: 'user_1', name: 'Amit Sharma', phone: '9830000001', lat: 22.5730, lon: 88.3641, distance: 48 },
    { id: 'user_2', name: 'Riya Sen', phone: '9830000002', lat: 22.5738, lon: 88.3650, distance: 172 },
    { id: 'user_3', name: 'Priya Das', phone: '9830000003', lat: 22.5718, lon: 88.3628, distance: 141 },
  ]);

  const [nearbyPolice, setNearbyPolice] = useState<PoliceStationItem[]>([
    { id: 'ps_1', name: 'Lalbazar Central Police Station', phone: '033-22143000', lat: 22.5720, lon: 88.3630, distance: 112 },
    { id: 'ps_2', name: 'Jorasanko Police Station', phone: '033-22696000', lat: 22.5840, lon: 88.3580, distance: 1410 },
    { id: 'ps_3', name: 'Park Street Police Station', phone: '033-22262000', lat: 22.5550, lon: 88.3520, distance: 2320 },
  ]);

  const [loading, setLoading] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<AlertItem[]>([]);

  const handleRefreshAlert = async () => {
    setLoading(true);
    const result = await triggerManualAlertApi('driver_1', 22.5726, 88.3639);
    setLoading(false);

    if (result.success && result.lat && result.lon) {
      setAlertLocation({
        lat: result.lat,
        lon: result.lon,
        driverId: result.driver || 'driver_1',
      });
      if (result.nearby_users) setNearbyUsers(result.nearby_users);
      if (result.nearby_police) setNearbyPolice(result.nearby_police);
    }
  };

  useEffect(() => {
    fetchHistory().then(setRecentAlerts);
  }, []);

  return (
    <View style={styles.container}>
      {/* OpenStreetMap Component */}
      <View style={styles.mapContainer}>
        <OSMMapView
          userLocation={userLocation}
          alertLocation={alertLocation}
          nearbyUsers={nearbyUsers}
          nearbyPolice={nearbyPolice}
        />
      </View>

      {/* Control overlay */}
      <View style={styles.controlRow}>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefreshAlert}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <Ionicons name="refresh" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.refreshText}>Fetch Live Drowsiness Alert</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Spatial Info Sheets */}
      <ScrollView style={styles.bottomSheet} contentContainerStyle={styles.bottomContent}>
        {alertLocation && (
          <View style={styles.alertCard}>
            <View style={styles.alertCardHeader}>
              <Ionicons name="alert-circle" size={24} color="#ef4444" />
              <Text style={styles.alertCardTitle}>Active Drowsiness Alert</Text>
              <View style={styles.badgeRed}>
                <Text style={styles.badgeRedText}>CRITICAL</Text>
              </View>
            </View>
            <Text style={styles.alertCardText}>
              Driver ID: <Text style={styles.bold}>{alertLocation.driverId}</Text>
            </Text>
            <Text style={styles.alertCardText}>
              Coordinates: ({alertLocation.lat.toFixed(4)}, {alertLocation.lon.toFixed(4)})
            </Text>
          </View>
        )}

        {/* Nearby Users list */}
        <Text style={styles.sectionHeader}>👥 Nearby Users (Within 300m)</Text>
        {nearbyUsers.length === 0 ? (
          <Text style={styles.emptyText}>No users within 300 meters.</Text>
        ) : (
          nearbyUsers.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Ionicons name="person-circle" size={24} color="#34d399" />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>{item.phone}</Text>
              </View>
              <View style={styles.distBadge}>
                <Text style={styles.distText}>{item.distance}m</Text>
              </View>
            </View>
          ))
        )}

        {/* Nearby Police Stations list */}
        <Text style={styles.sectionHeader}>🚓 Nearby Police Stations (Within 3km)</Text>
        {nearbyPolice.length === 0 ? (
          <Text style={styles.emptyText}>No police stations within 3km.</Text>
        ) : (
          nearbyPolice.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Ionicons name="shield" size={24} color="#818cf8" />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>{item.phone}</Text>
              </View>
              <View style={styles.distBadgeBlue}>
                <Text style={styles.distTextBlue}>
                  {item.distance ? (item.distance / 1000).toFixed(2) + ' km' : '3km'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  mapContainer: {
    height: '52%',
    padding: 8,
  },
  controlRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
  },
  bottomContent: {
    paddingVertical: 16,
    paddingBottom: 30,
  },
  alertCard: {
    backgroundColor: '#450a0a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#991b1b',
  },
  alertCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertCardTitle: {
    color: '#fca5a5',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  badgeRed: {
    backgroundColor: '#ef4444',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeRedText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  alertCardText: {
    color: '#fecaca',
    fontSize: 12,
    marginTop: 2,
  },
  bold: {
    fontWeight: 'bold',
    color: '#ffffff',
  },
  sectionHeader: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 10,
  },
  itemName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
  },
  itemSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  distBadge: {
    backgroundColor: '#065f46',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  distText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: 'bold',
  },
  distBadgeBlue: {
    backgroundColor: '#1e1b4b',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  distTextBlue: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
