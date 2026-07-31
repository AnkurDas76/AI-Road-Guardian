import * as SQLite from 'expo-sqlite';
import axios from 'axios';

const db = SQLite.openDatabaseSync('motosense.db');

// Replace this with your computer's local Wi-Fi IP Address (e.g., '192.168.1.10')
// Do not use 'localhost' or '127.0.0.1' because the phone will look inside itself!
const BACKEND_IP = '192.168.0.106'; 

export const initLocalDatabase = () => {
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS local_hazards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL,
        longitude REAL,
        h3_index TEXT,
        type TEXT,
        frontend_action TEXT,
        calculated_stage INTEGER
      );
    `);
    console.log("Local SQLite database initialized successfully.");
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
};

export const syncHazardsFromBackend = async (latitude, longitude, isFirstTimer) => {
  try {
    console.log(`Fetching hazards from http://${BACKEND_IP}:8000...`);
    
    // Call your Python FastAPI backend
    const response = await axios.get(`http://${BACKEND_IP}:8000/api/hazards/nearby`, {
      params: {
        latitude: latitude,
        longitude: longitude,
        is_first_timer: isFirstTimer
      }
    });

    const hazards = response.data.hazards;

    if (hazards && hazards.length > 0) {
      // Clear the old cache
      db.execSync('DELETE FROM local_hazards;');

      // Insert the new evaluated hazards into the phone's storage
      db.withTransactionSync(() => {
        hazards.forEach((h) => {
          db.runSync(
            'INSERT INTO local_hazards (latitude, longitude, h3_index, type, frontend_action, calculated_stage) VALUES (?, ?, ?, ?, ?, ?);',
            [h.latitude, h.longitude, h.h3_index, h.type, h.frontend_action, h.calculated_stage]
          );
        });
      });

      console.log(`✅ Successfully synced ${hazards.length} hazards to local storage.`);
      return true;
    } else {
      console.log("No active hazards found in this area.");
      return false;
    }
  } catch (error) {
    console.error("Failed to sync hazards:", error.message);
    return false;
  }
};
// Add this at the bottom of services/db.js
export const getLocalHazards = () => {
  try {
    return db.getAllSync('SELECT * FROM local_hazards;');
  } catch (error) {
    console.error("Error reading local hazards:", error);
    return [];
  }
};

// Add to bottom of services/db.js
export const injectTestHazard = (lat, lon) => {
  try {
    db.runSync(
      'INSERT INTO local_hazards (latitude, longitude, h3_index, type, frontend_action, calculated_stage) VALUES (?, ?, ?, ?, ?, ?);',
      [lat, lon, 'test_index', 'pothole', 'FORCE_ALARM', 1]
    );
    console.log("Injected test hazard 20m away!");
  } catch (error) {
    console.error(error);
  }
};