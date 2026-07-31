import { Platform } from 'react-native';
import { HazardItem } from '../api/config';

let db: any = null;
let inMemoryCache: HazardItem[] = [];

const getNativeSqlite = () => {
  if (Platform.OS !== 'web') {
    try {
      return require('expo-sqlite');
    } catch (e) {
      console.warn('expo-sqlite import error on native:', e);
    }
  }
  return null;
};

export const initLocalDatabase = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    console.log('ℹ️ Local SQLite db running in web in-memory mode');
    return true;
  }

  const SQLite = getNativeSqlite();
  if (!SQLite) return true;

  try {
    if (!db) {
      db = await SQLite.openDatabaseAsync('motosense.db');
    }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS local_hazards (
        id TEXT PRIMARY KEY,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        type TEXT NOT NULL,
        initial_severity TEXT,
        reporter_type TEXT,
        is_lit INTEGER,
        calculated_stage INTEGER,
        frontend_action TEXT,
        created_at TEXT,
        distance_km REAL,
        company_name TEXT
      );
    `);
    console.log('✅ Mobile SQLite Database (motosense.db) initialized.');
    return true;
  } catch (error) {
    console.warn('⚠️ Error initializing local SQLite db:', error);
    return false;
  }
};

export const saveLocalHazards = async (hazards: HazardItem[]): Promise<void> => {
  inMemoryCache = hazards;

  if (Platform.OS === 'web' || !db) {
    return;
  }

  try {
    await db.execAsync('DELETE FROM local_hazards;');
    for (const h of hazards) {
      await db.runAsync(
        `INSERT OR REPLACE INTO local_hazards 
         (id, latitude, longitude, type, initial_severity, reporter_type, is_lit, calculated_stage, frontend_action, created_at, distance_km, company_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          h.id,
          h.latitude,
          h.longitude,
          h.type,
          h.initial_severity || 'severe',
          h.reporter_type || 'crowdsourced',
          h.is_lit ? 1 : 0,
          h.calculated_stage || 1,
          h.frontend_action || 'FORCE_ALARM',
          h.created_at || new Date().toISOString(),
          h.distance_km || 0,
          h.company_name || null,
        ]
      );
    }
  } catch (error) {
    console.warn('⚠️ Error caching hazards locally:', error);
  }
};

export const getLocalHazards = async (): Promise<HazardItem[]> => {
  if (Platform.OS === 'web' || !db) {
    return inMemoryCache;
  }

  try {
    const rows = await db.getAllAsync('SELECT * FROM local_hazards;');
    return rows.map((r: any) => ({
      id: r.id,
      latitude: r.latitude,
      longitude: r.longitude,
      h3_index: '',
      type: r.type,
      initial_severity: r.initial_severity,
      reporter_type: r.reporter_type,
      is_lit: r.is_lit === 1,
      calculated_stage: r.calculated_stage,
      frontend_action: r.frontend_action,
      created_at: r.created_at,
      distance_km: r.distance_km,
      company_name: r.company_name,
    }));
  } catch (error) {
    console.warn('⚠️ Error reading local SQLite hazards:', error);
    return inMemoryCache;
  }
};
