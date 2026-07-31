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
  HAZARDS_NEARBY: '/api/hazards/nearby',
  HAZARDS_CROWDSOURCE: '/api/hazards/crowdsource',
  HAZARDS_CONSTRUCTION_REGISTER: '/api/hazards/construction/register',
  HAZARDS_CONSTRUCTION_WITHDRAW: '/api/hazards/construction/withdraw',
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

export interface HazardItem {
  id: string;
  latitude: number;
  longitude: number;
  h3_index?: string;
  type: 'pothole' | 'speed_breaker' | 'construction' | 'accident' | 'blocked_road' | 'danger_zone' | string;
  initial_severity?: 'minor' | 'severe' | string;
  reporter_type?: string;
  is_lit?: boolean | number;
  active?: boolean | number;
  created_at?: string;
  calculated_stage?: number;
  frontend_action?: 'FORCE_ALARM' | 'SPEED_GATED_ALARM' | 'IGNORE' | string;
  distance_km?: number;
  company_name?: string;
}

export interface CrowdsourceHazardPayload {
  latitude: number;
  longitude: number;
  type: string;
  initial_severity?: 'minor' | 'severe';
  is_lit?: boolean;
}

export interface ConstructionWorkPayload {
  latitude: number;
  longitude: number;
  company_name: string;
  is_lit?: boolean;
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

export const fetchNearbyHazardsApi = async (
  latitude: number,
  longitude: number,
  isFirstTimer = true,
  currentHour?: number
): Promise<{ context: any; hazards: HazardItem[] }> => {
  try {
    let url = `${getApiBaseUrl()}/api/hazards/nearby?latitude=${latitude}&longitude=${longitude}&is_first_timer=${isFirstTimer}`;
    if (currentHour !== undefined) {
      url += `&current_hour=${currentHour}`;
    }
    const res = await fetch(url);
    const json = await res.json();
    return {
      context: json.context || {},
      hazards: json.hazards || [],
    };
  } catch (error) {
    console.error('Error fetching nearby hazards:', error);
    return { context: {}, hazards: [] };
  }
};

export const reportHazardApi = async (payload: CrowdsourceHazardPayload) => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/hazards/crowdsource`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (error) {
    console.error('Error reporting hazard:', error);
    return { status: 'error', error: String(error) };
  }
};

export const registerConstructionApi = async (payload: ConstructionWorkPayload) => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/hazards/construction/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (error) {
    console.error('Error registering construction:', error);
    return { status: 'error', error: String(error) };
  }
};

export const withdrawConstructionApi = async (hazardId: string) => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/hazards/construction/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hazard_id: hazardId }),
    });
    return await res.json();
  } catch (error) {
    console.error('Error withdrawing construction:', error);
    return { status: 'error', error: String(error) };
  }
};
