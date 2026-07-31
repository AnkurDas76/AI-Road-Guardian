const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const h3 = require("h3-js");

const DB_PATH = path.join(__dirname, "..", "security.db");

let db = null;

function getDbConnection() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error("❌ Failed to connect to SQLite database:", err.message);
      } else {
        console.log("✅ Connected to SQLite database:", DB_PATH);
      }
    });
  }
  return db;
}

// Promisified helper methods for clean async/await
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDbConnection().run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDbConnection().all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDbConnection().get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function initDb() {
  const connection = getDbConnection();

  return new Promise((resolve, reject) => {
    connection.serialize(async () => {
      try {
        // 1. Users Table
        await dbRun(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            fcm_token TEXT,
            last_updated TEXT NOT NULL
          )
        `);

        // 2. Police Stations Table
        await dbRun(`
          CREATE TABLE IF NOT EXISTS police_stations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            city TEXT DEFAULT 'Kolkata'
          )
        `);

        // 3. Drowsiness Alerts Log Table
        await dbRun(`
          CREATE TABLE IF NOT EXISTS alerts_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            driver_id TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            timestamp TEXT NOT NULL,
            notified_users INTEGER NOT NULL,
            notified_police INTEGER NOT NULL,
            status TEXT DEFAULT 'TRIGGERED'
          )
        `);

        // 4. FCM Tokens Table
        await dbRun(`
          CREATE TABLE IF NOT EXISTS fcm_tokens (
            user_id TEXT PRIMARY KEY,
            token TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);

        // 5. Road Hazards Table (Potholes, Speed Breakers, Construction, Accidents, Danger Zones, Blocked Roads)
        await dbRun(`
          CREATE TABLE IF NOT EXISTS hazards (
            id TEXT PRIMARY KEY,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            h3_index TEXT NOT NULL,
            type TEXT NOT NULL,
            initial_severity TEXT DEFAULT 'severe',
            reporter_type TEXT DEFAULT 'crowdsourced',
            is_lit INTEGER DEFAULT 1,
            active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            resolved_at TEXT,
            company_name TEXT
          )
        `);

        const nowIso = new Date().toISOString();

        // Seed Demo Users if empty
        const userRow = await dbGet("SELECT COUNT(*) as cnt FROM users");
        if (userRow.cnt === 0) {
          const demoUsers = [
            ["user_1", "Amit Sharma", "9830000001", 22.5730, 88.3641, "demo_token_user_1", nowIso],
            ["user_2", "Riya Sen", "9830000002", 22.5738, 88.3650, "demo_token_user_2", nowIso],
            ["user_3", "Priya Das", "9830000003", 22.5718, 88.3628, "demo_token_user_3", nowIso],
            ["user_4", "Samrat Roy", "9830000004", 22.6000, 88.4000, "demo_token_user_4", nowIso],
            ["user_5", "Rahul Verma", "9830000005", 22.5745, 88.3658, "demo_token_user_5", nowIso]
          ];
          for (const u of demoUsers) {
            await dbRun(
              "INSERT INTO users (id, name, phone, lat, lon, fcm_token, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
              u
            );
          }
          console.log("🌱 Seeded demo users into SQLite.");
        }

        // Seed Demo Police Stations if empty
        const psRow = await dbGet("SELECT COUNT(*) as cnt FROM police_stations");
        if (psRow.cnt === 0) {
          const demoPolice = [
            ["ps_1", "Lalbazar Central Police Station", "033-22143000", 22.5720, 88.3630, "Kolkata"],
            ["ps_2", "Jorasanko Police Station", "033-22696000", 22.5840, 88.3580, "Kolkata"],
            ["ps_3", "Park Street Police Station", "033-22262000", 22.5550, 88.3520, "Kolkata"],
            ["ps_4", "Salt Lake Police Station", "033-23340000", 22.5870, 88.4170, "Kolkata"]
          ];
          for (const p of demoPolice) {
            await dbRun(
              "INSERT INTO police_stations (id, name, phone, lat, lon, city) VALUES (?, ?, ?, ?, ?, ?)",
              p
            );
          }
          console.log("🌱 Seeded demo police stations into SQLite.");
        }

        // Seed Demo Hazards if empty
        const hazardRow = await dbGet("SELECT COUNT(*) as cnt FROM hazards");
        if (hazardRow.cnt === 0) {
          const demoHazards = [
            {
              id: "hz_1",
              lat: 22.5732,
              lon: 88.3645,
              type: "pothole",
              severity: "severe",
              reporter: "crowdsourced",
              is_lit: 1,
              company: null
            },
            {
              id: "hz_2",
              lat: 22.5721,
              lon: 88.3632,
              type: "speed_breaker",
              severity: "minor",
              reporter: "crowdsourced",
              is_lit: 1,
              company: null
            },
            {
              id: "hz_3",
              lat: 22.5740,
              lon: 88.3655,
              type: "construction",
              severity: "severe",
              reporter: "contractor",
              is_lit: 0,
              company: "Metro Rail Infra"
            },
            {
              id: "hz_4",
              lat: 22.5710,
              lon: 88.3620,
              type: "accident",
              severity: "severe",
              reporter: "crowdsourced",
              is_lit: 1,
              company: null
            },
            {
              id: "hz_5",
              lat: 22.5750,
              lon: 88.3610,
              type: "blocked_road",
              severity: "severe",
              reporter: "crowdsourced",
              is_lit: 0,
              company: null
            },
            {
              id: "hz_6",
              lat: 22.5705,
              lon: 88.3660,
              type: "danger_zone",
              severity: "severe",
              reporter: "system",
              is_lit: 0,
              company: null
            }
          ];

          for (const h of demoHazards) {
            const h3Idx = typeof h3.latLngToCell === 'function' ? h3.latLngToCell(h.lat, h.lon, 8) : h3.latlngToCell(h.lat, h.lon, 8);
            await dbRun(
              `INSERT INTO hazards (id, latitude, longitude, h3_index, type, initial_severity, reporter_type, is_lit, active, created_at, company_name)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
              [h.id, h.lat, h.lon, h3Idx, h.type, h.severity, h.reporter, h.is_lit, nowIso, h.company]
            );
          }
          console.log("🌱 Seeded demo road hazards into SQLite.");
        }

        resolve(true);
      } catch (err) {
        console.error("❌ Database initialization error:", err);
        reject(err);
      }
    });
  });
}

module.exports = {
  getDbConnection,
  dbRun,
  dbAll,
  dbGet,
  initDb
};
