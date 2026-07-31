let admin = null;
try {
  admin = require("firebase-admin");
} catch (e) {
  console.log("ℹ️ firebase-admin module not loaded, fallback mode active.");
}

/**
 * Dispatch Push Notification for Drowsiness Alert
 */
async function sendDrowsinessPushNotification(tokens, alertData) {
  if (!tokens || tokens.length === 0) {
    return { success: false, count: 0, reason: "No active FCM tokens available" };
  }

  const payload = {
    notification: {
      title: "🚨 DROWSY DRIVER ALERT NEARBY!",
      body: `Drowsy driver detected near (${alertData.driver_id}). Exercise caution!`
    },
    data: {
      type: "DROWSINESS_ALERT",
      driver_id: String(alertData.driver_id || ""),
      lat: String(alertData.lat || alertData.latitude || ""),
      lon: String(alertData.lon || alertData.longitude || ""),
      timestamp: new Date().toISOString()
    }
  };

  console.log(`[FCM SERVICE] Dispatching Drowsiness Alert to ${tokens.length} target devices.`);
  
  if (admin && admin.apps && admin.apps.length > 0) {
    try {
      const response = await admin.messaging().sendMulticast({
        tokens: tokens,
        ...payload
      });
      return { success: true, count: response.successCount };
    } catch (err) {
      console.warn("⚠️ FCM dispatch error:", err.message);
      return { success: false, error: err.message };
    }
  }

  return { success: true, count: tokens.length, mock: true };
}

/**
 * Dispatch Push Notification for Road Hazard Warning
 */
async function sendHazardPushNotification(tokens, hazardData) {
  if (!tokens || tokens.length === 0) {
    return { success: false, count: 0, reason: "No active FCM tokens available" };
  }

  const payload = {
    notification: {
      title: `⚠️ ROAD HAZARD AHEAD: ${hazardData.type.toUpperCase().replace('_', ' ')}`,
      body: `Caution! ${hazardData.type} reported in your upcoming travel zone.`
    },
    data: {
      type: "HAZARD_ALERT",
      hazard_id: String(hazardData.id || ""),
      hazard_type: String(hazardData.type || ""),
      lat: String(hazardData.latitude || ""),
      lon: String(hazardData.longitude || ""),
      action: String(hazardData.frontend_action || "FORCE_ALARM")
    }
  };

  console.log(`[FCM SERVICE] Dispatching Hazard Warning to ${tokens.length} target devices.`);

  if (admin && admin.apps && admin.apps.length > 0) {
    try {
      const response = await admin.messaging().sendMulticast({
        tokens: tokens,
        ...payload
      });
      return { success: true, count: response.successCount };
    } catch (err) {
      console.warn("⚠️ FCM dispatch error:", err.message);
      return { success: false, error: err.message };
    }
  }

  return { success: true, count: tokens.length, mock: true };
}

module.exports = {
  sendDrowsinessPushNotification,
  sendHazardPushNotification
};
