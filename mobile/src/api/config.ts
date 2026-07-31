import { Platform } from 'react-native';

// Standard local API backend URLs:
// - Android Emulator: http://10.0.2.2:5000
// - iOS Simulator / Web / Local Desktop: http://127.0.0.1:5000
export const DEFAULT_API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://127.0.0.1:5000';

let currentBaseUrl = DEFAULT_API_BASE_URL;

export const setApiBaseUrl = (url: string) => {
  currentBaseUrl = url.replace(/\/$/, '');
};

export const getApiBaseUrl = () => currentBaseUrl;

export const ENDPOINTS = {
  ALERT: '/alert',
  UPDATE_LOCATION: '/update_location',
  HISTORY: '/history',
  REGISTER_TOKEN: '/register_token',
  USERS: '/users',
  POLICE: '/police',
  HEALTH: '/health',
};

export interface AlertItem {
  id: number;
  driver_id: string;
  lat: number;
  lon: number;
  timestamp: string;
  notified_users: number;
  notified_police: number;
  status: string;
}

export interface UserItem {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lon: number;
  distance?: number;
  last_updated?: string;
}

export interface PoliceStationItem {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lon: number;
  distance?: number;
  city?: string;
}

export interface AlertResponse {
  success: boolean;
  alert_id?: number;
  driver?: string;
  lat?: number;
  lon?: number;
  nearby_users?: UserItem[];
  nearby_police?: PoliceStationItem[];
  error?: string;
  status?: string;
}

export const fetchHistory = async (): Promise<AlertItem[]> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}${ENDPOINTS.HISTORY}`);
    const json = await res.json();
    if (json.success) {
      return json.alerts || [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching history:', error);
    return [];
  }
};

export const updateLocationApi = async (
  userId: string,
  lat: number,
  lon: number,
  name = 'App User',
  phone = '9800000000'
) => {
  try {
    const res = await fetch(`${getApiBaseUrl()}${ENDPOINTS.UPDATE_LOCATION}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, lat, lon, name, phone }),
    });
    return await res.json();
  } catch (error) {
    console.error('Error updating location:', error);
    return { success: false, error: String(error) };
  }
};

export const registerFcmTokenApi = async (userId: string, token: string) => {
  try {
    const res = await fetch(`${getApiBaseUrl()}${ENDPOINTS.REGISTER_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, fcm_token: token }),
    });
    return await res.json();
  } catch (error) {
    console.error('Error registering token:', error);
    return { success: false, error: String(error) };
  }
};

export const triggerManualAlertApi = async (driverId: string, lat: number, lon: number): Promise<AlertResponse> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}${ENDPOINTS.ALERT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_id: driverId, lat, lon }),
    });
    return await res.json();
  } catch (error) {
    console.error('Error triggering manual alert:', error);
    return { success: false, error: String(error) };
  }
};
