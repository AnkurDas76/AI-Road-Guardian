import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchHistory, AlertItem } from '../api/config';

export default function HistoryScreen() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const data = await fetchHistory();
    setAlerts(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderAlertItem = ({ item }: { item: AlertItem }) => {
    const dateFormatted = new Date(item.timestamp).toLocaleString();

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.badgeRow}>
            <Ionicons name="warning" size={18} color="#ef4444" style={{ marginRight: 6 }} />
            <Text style={styles.driverText}>{item.driver_id}</Text>
          </View>
          <Text style={styles.timeText}>{dateFormatted}</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.coordText}>
            📍 Location: ({item.lat.toFixed(4)}, {item.lon.toFixed(4)})
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statPillGreen}>
              <Ionicons name="people" size={14} color="#34d399" />
              <Text style={styles.statPillGreenText}>
                {item.notified_users} Users (&lt;300m)
              </Text>
            </View>

            <View style={styles.statPillBlue}>
              <Ionicons name="shield" size={14} color="#818cf8" />
              <Text style={styles.statPillBlueText}>
                {item.notified_police} Police (&lt;3km)
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Fetching Alert History...</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderAlertItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#38bdf8"
              colors={['#38bdf8']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="shield-checkmark-outline" size={48} color="#64748b" />
              <Text style={styles.emptyTitle}>No Drowsiness Alerts Yet</Text>
              <Text style={styles.emptySub}>
                Alerts logged when driver eyes stay closed &gt; 6 seconds will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  cardBody: {
    marginTop: 2,
  },
  coordText: {
    color: '#cbd5e1',
    fontSize: 13,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statPillGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#065f46',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: '48%',
    justifyContent: 'center',
  },
  statPillGreenText: {
    color: '#a7f3d0',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  statPillBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1b4b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: '48%',
    justifyContent: 'center',
  },
  statPillBlueText: {
    color: '#c7d2fe',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  emptyBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 14,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 30,
  },
});
