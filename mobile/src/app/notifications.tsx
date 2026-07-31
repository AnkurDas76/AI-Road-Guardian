import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerFcmTokenApi } from '../api/config';

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  type: string;
}

export default function NotificationsScreen() {
  const [userId, setUserId] = useState('user_1');
  const [fcmToken, setFcmToken] = useState('sample_fcm_push_token_device_abc123');
  const [registered, setRegistered] = useState(false);
  const [notifications, setNotifications] = useState<NotificationLog[]>([
    {
      id: '1',
      title: '🚨 DROWSY DRIVER ALERT',
      body: 'Drowsy driver detected within 300 meters. Drive carefully.',
      timestamp: new Date().toLocaleTimeString(),
      type: 'USER_ALERT',
    },
    {
      id: '2',
      title: '🚨 POLICE DISPATCH - DROWSY DRIVER',
      body: 'ALERT: Drowsy driver driver_1 detected at (22.5726, 88.3639), 112m from Lalbazar Central Police Station.',
      timestamp: new Date(Date.now() - 300000).toLocaleTimeString(),
      type: 'POLICE_ALERT',
    },
  ]);

  const handleRegisterToken = async () => {
    if (!fcmToken.trim()) {
      Alert.alert('Error', 'Please enter a valid FCM token.');
      return;
    }
    const res = await registerFcmTokenApi(userId, fcmToken);
    if (res.success) {
      setRegistered(true);
      Alert.alert('✅ FCM Registered', `Token for user '${userId}' registered successfully on backend.`);
    } else {
      Alert.alert('Error', res.error || 'Failed to register token');
    }
  };

  const renderNotification = ({ item }: { item: NotificationLog }) => (
    <View
      style={[
        styles.notifCard,
        item.type === 'USER_ALERT' ? styles.borderRed : styles.borderBlue,
      ]}>
      <View style={styles.notifHeader}>
        <Ionicons
          name={item.type === 'USER_ALERT' ? 'warning' : 'shield'}
          size={20}
          color={item.type === 'USER_ALERT' ? '#ef4444' : '#818cf8'}
        />
        <Text style={styles.notifTitle}>{item.title}</Text>
        <Text style={styles.notifTime}>{item.timestamp}</Text>
      </View>
      <Text style={styles.notifBody}>{item.body}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* FCM Registration Box */}
      <View style={styles.tokenCard}>
        <Text style={styles.cardTitle}>Firebase Cloud Messaging (FCM)</Text>
        <Text style={styles.cardSub}>
          Register device push token to receive background & foreground notifications when a drowsy driver is within 300m.
        </Text>

        <Text style={styles.label}>User ID</Text>
        <TextInput
          style={styles.input}
          value={userId}
          onChangeText={setUserId}
          placeholder="user_1"
          placeholderTextColor="#64748b"
        />

        <Text style={styles.label}>FCM Push Token</Text>
        <TextInput
          style={styles.input}
          value={fcmToken}
          onChangeText={setFcmToken}
          placeholder="fcm_token_..."
          placeholderTextColor="#64748b"
        />

        <TouchableOpacity style={styles.registerButton} onPress={handleRegisterToken}>
          <Ionicons name="cloud-upload" size={18} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.registerButtonText}>
            {registered ? 'Update FCM Token' : 'Register FCM Token'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notification Stream */}
      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Notification Feed</Text>
        <Text style={styles.countText}>{notifications.length} Messages</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  tokenCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 16,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  registerButton: {
    backgroundColor: '#0284c7',
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  registerButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  countText: {
    color: '#64748b',
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  notifCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  borderRed: {
    borderColor: '#ef4444',
  },
  borderBlue: {
    borderColor: '#6366f1',
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  notifTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  notifTime: {
    color: '#64748b',
    fontSize: 10,
  },
  notifBody: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16,
  },
});
