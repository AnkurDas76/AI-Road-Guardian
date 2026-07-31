const express = require("express");
const router = express.Router();
const { dbRun, dbAll, dbGet } = require("../db/database");
const {
  calculate_stage,
  evaluate_rider_action,
  getH3Index,
  getNeighborH3Cells
} = require("../services/hazardService");
const {
  sendDrowsinessPushNotification,
  sendHazardPushNotification
} = require("../services/notificationService");

// Helper distance calculation (Haversine in km)
function calculateDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ----------------------------------------------------
// SYSTEM HEALTH
// ----------------------------------------------------
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    system: "MotoSense & AI Driving Unified Backend",
    timestamp: new Date().toISOString()
  });
});

// ----------------------------------------------------
// DROWSINESS ALERT ENDPOINTS
// ----------------------------------------------------

// POST /alert (Triggered by Python AI or manual mobile app trigger)
router.post("/alert", async (req, res) => {
  try {
    const driver_id = req.body.driver_id || "driver_1";
    const lat = parseFloat(req.body.latitude || req.body.lat);
    const lon = parseFloat(req.body.longitude || req.body.lon);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        error: "latitude and longitude are required and must be valid numbers."
      });
    }

    // Get active users and police stations
    const users = (await dbAll("SELECT * FROM users")) || [];
    const policeStations = (await dbAll("SELECT * FROM police_stations")) || [];

    // Filter nearby within thresholds (300m for users, 3km for police)
    const nearbyUsers = users
      .map((u) => ({
        ...u,
        distance: calculateDistanceInKm(lat, lon, u.lat, u.lon)
      }))
      .filter((u) => u.distance <= 0.5 || users.length <= 5); // include closest demo users

    const nearbyPolice = policeStations
      .map((p) => ({
        ...p,
        distance: calculateDistanceInKm(lat, lon, p.lat, p.lon)
      }))
      .filter((p) => p.distance <= 5.0 || policeStations.length <= 4);

    const nowIso = new Date().toISOString();

    // Log alert into SQLite
    const result = await dbRun(
      `INSERT INTO alerts_log (driver_id, lat, lon, timestamp, notified_users, notified_police, status)
       VALUES (?, ?, ?, ?, ?, ?, 'TRIGGERED')`,
      [driver_id, lat, lon, nowIso, nearbyUsers.length, nearbyPolice.length]
    );

    // Extract FCM tokens
    const fcmTokens = nearbyUsers
      .map((u) => u.fcm_token)
      .filter((t) => t && t.length > 0);

    // Send push notification
    sendDrowsinessPushNotification(fcmTokens, { driver_id, lat, lon });

    res.json({
      success: true,
      alert_id: result.lastID,
      driver_id,
      lat,
      lon,
      timestamp: nowIso,
      notified_users: nearbyUsers.length,
      notified_police: nearbyPolice.length,
      nearby_users: nearbyUsers,
      nearby_police: nearbyPolice
    });
  } catch (err) {
    console.error("❌ Error processing alert:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /update_location
router.post("/update_location", async (req, res) => {
  try {
    const userId = req.body.user_id || req.body.id || "user_demo";
    const name = req.body.name || "App User";
    const phone = req.body.phone || "9800000000";
    const lat = parseFloat(req.body.lat || req.body.latitude);
    const lon = parseFloat(req.body.lon || req.body.longitude);
    const fcmToken = req.body.fcm_token || null;

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ success: false, error: "Invalid lat/lon" });
    }

    const nowIso = new Date().toISOString();

    await dbRun(
      `INSERT INTO users (id, name, phone, lat, lon, fcm_token, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         lat = excluded.lat,
         lon = excluded.lon,
         name = COALESCE(excluded.name, users.name),
         phone = COALESCE(excluded.phone, users.phone),
         fcm_token = COALESCE(excluded.fcm_token, users.fcm_token),
         last_updated = excluded.last_updated`,
      [userId, name, phone, lat, lon, fcmToken, nowIso]
    );

    res.json({ success: true, message: "Location updated successfully" });
  } catch (err) {
    console.error("❌ Error updating location:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /register_token
router.post("/register_token", async (req, res) => {
  try {
    const userId = req.body.user_id;
    const token = req.body.token || req.body.fcm_token;

    if (!userId || !token) {
      return res.status(400).json({ success: false, error: "user_id and token required" });
    }

    const nowIso = new Date().toISOString();
    await dbRun(
      `INSERT INTO fcm_tokens (user_id, token, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, updated_at = excluded.updated_at`,
      [userId, token, nowIso]
    );

    await dbRun(`UPDATE users SET fcm_token = ? WHERE id = ?`, [token, userId]);

    res.json({ success: true, message: "FCM token registered" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /history
router.get("/history", async (req, res) => {
  try {
    const alerts = await dbAll("SELECT * FROM alerts_log ORDER BY id DESC LIMIT 50");
    res.json({ success: true, alerts: alerts || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /users
router.get("/users", async (req, res) => {
  try {
    const users = await dbAll("SELECT * FROM users");
    res.json({ success: true, users: users || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /police
router.get("/police", async (req, res) => {
  try {
    const police = await dbAll("SELECT * FROM police_stations");
    res.json({ success: true, police_stations: police || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// MOTOSENSE ROAD HAZARD ENDPOINTS
// ----------------------------------------------------

// POST /api/hazards/crowdsource
router.post("/api/hazards/crowdsource", async (req, res) => {
  try {
    const { latitude, longitude, type } = req.body;
    let initial_severity = req.body.initial_severity || "severe";
    const is_lit = req.body.is_lit === false || req.body.is_lit === 0 ? 0 : 1;

    if (!latitude || !longitude || !type) {
      return res.status(400).json({
        success: false,
        error: "latitude, longitude, and type are required"
      });
    }

    if (!["minor", "severe"].includes(initial_severity)) {
      initial_severity = "severe";
    }

    const h3Idx = getH3Index(latitude, longitude, 8);
    const id = `hz_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();

    await dbRun(
      `INSERT INTO hazards (id, latitude, longitude, h3_index, type, initial_severity, reporter_type, is_lit, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'crowdsourced', ?, 1, ?)`,
      [id, latitude, longitude, h3Idx, type, initial_severity, is_lit, nowIso]
    );

    const record = {
      id,
      latitude,
      longitude,
      h3_index: h3Idx,
      type,
      initial_severity,
      reporter_type: "crowdsourced",
      is_lit,
      active: 1,
      created_at: nowIso
    };

    res.json({ status: "success", data: record });
  } catch (err) {
    console.error("❌ Error adding crowdsourced hazard:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/hazards/construction/register
router.post("/api/hazards/construction/register", async (req, res) => {
  try {
    const { latitude, longitude, company_name } = req.body;
    const is_lit = req.body.is_lit === false || req.body.is_lit === 0 ? 0 : 1;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, error: "latitude and longitude required" });
    }

    const h3Idx = getH3Index(latitude, longitude, 8);
    const id = `hz_const_${Date.now()}`;
    const nowIso = new Date().toISOString();

    await dbRun(
      `INSERT INTO hazards (id, latitude, longitude, h3_index, type, initial_severity, reporter_type, is_lit, active, created_at, company_name)
       VALUES (?, ?, ?, ?, 'construction', 'severe', 'contractor', ?, 1, ?, ?)`,
      [id, latitude, longitude, h3Idx, is_lit, nowIso, company_name || "Road Work Contractor"]
    );

    res.json({ status: "registered", hazard_id: id });
  } catch (err) {
    console.error("❌ Error registering construction:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/hazards/construction/withdraw
router.post("/api/hazards/construction/withdraw", async (req, res) => {
  try {
    const hazard_id = req.body.hazard_id || req.body.id;

    if (!hazard_id) {
      return res.status(400).json({ success: false, error: "hazard_id required" });
    }

    const nowIso = new Date().toISOString();
    const result = await dbRun(
      `UPDATE hazards SET active = 0, resolved_at = ? WHERE id = ?`,
      [nowIso, hazard_id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: "Hazard ID not found" });
    }

    res.json({ status: "withdrawn", message: "Safety warning deactivated." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/hazards/nearby
router.get("/api/hazards/nearby", async (req, res) => {
  try {
    const latitude = parseFloat(req.query.latitude);
    const longitude = parseFloat(req.query.longitude);
    const is_first_timer = req.query.is_first_timer === "false" || req.query.is_first_timer === false ? false : true;
    const current_hour = req.query.current_hour !== undefined && req.query.current_hour !== ""
      ? parseInt(req.query.current_hour, 10)
      : new Date().getHours();

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ success: false, error: "Valid latitude and longitude are required" });
    }

    const neighborH3s = getNeighborH3Cells(latitude, longitude, 1, 8);
    const activeHazards = await dbAll("SELECT * FROM hazards WHERE active = 1");

    const evaluatedHazards = [];

    for (const h of activeHazards) {
      // Check spatial match (either H3 index neighbor or within 5km radius)
      const isNeighborCell = neighborH3s.includes(h.h3_index);
      const distKm = calculateDistanceInKm(latitude, longitude, h.latitude, h.longitude);

      if (isNeighborCell || distKm <= 5.0) {
        const action = evaluate_rider_action(h, is_first_timer, current_hour);

        if (action !== "IGNORE") {
          const stage = calculate_stage(h.created_at, h.type, h.initial_severity || "severe");
          evaluatedHazards.append
            ? null
            : evaluatedHazards.push({
                ...h,
                calculated_stage: stage,
                frontend_action: action,
                distance_km: Math.round(distKm * 100) / 100
              });
        }
      }
    }

    res.json({
      context: {
        is_first_timer,
        evaluated_hour: current_hour
      },
      hazards: evaluatedHazards
    });
  } catch (err) {
    console.error("❌ Error fetching nearby hazards:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
