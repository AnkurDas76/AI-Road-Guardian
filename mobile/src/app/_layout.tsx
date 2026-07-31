import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'react-native';

export default function AppLayout() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1e293b',
            shadowColor: 'transparent',
            elevation: 0,
          },
          headerTitleStyle: {
            color: '#f8fafc',
            fontWeight: 'bold',
            fontSize: 18,
          },
          tabBarStyle: {
            backgroundColor: '#1e293b',
            borderTopColor: '#334155',
            height: 60,
            paddingBottom: 6,
            paddingTop: 6,
          },
          tabBarActiveTintColor: '#38bdf8',
          tabBarInactiveTintColor: '#94a3b8',
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            headerTitle: 'AI Driving Safety System',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="shield-checkmark" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="location"
          options={{
            title: 'Live GPS',
            headerTitle: 'Real-time GPS Sync (5s)',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="location" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'OpenStreetMap',
            headerTitle: 'Live Alert Map (OSM)',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="map" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Alert History',
            headerTitle: 'Drowsiness Alert Logs',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            headerTitle: 'FCM Push Notifications',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
