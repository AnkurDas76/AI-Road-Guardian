const h3 = require("h3-js");

const H3_RESOLUTION = 8;

/**
 * Calculates the aging stage of a hazard.
 * Stage 1: New / Severe / Construction (0-14 days for severe, perpetual for construction)
 * Stage 2: Aging hazard (14-30 days, or minor hazard 0-30 days)
 * Stage 3: Old hazard (>30 days)
 */
function calculate_stage(created_at_iso, hazard_type, initial_severity) {
  if (hazard_type === "construction") {
    return 1; // Construction is perpetually Stage 1 until explicitly withdrawn
  }

  const created_dt = new Date(created_at_iso);
  const now = new Date();
  const diffTime = Math.abs(now - created_dt);
  const days_old = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (days_old <= 14) {
    // Minor hazards skip Stage 1 and go directly to Stage 2
    if (initial_severity === "minor") {
      return 2;
    }
    return 1;
  } else if (days_old <= 30) {
    return 2; // 2 to 4 weeks old
  } else {
    return 3; // Over 1 month old
  }
}

/**
 * Evaluates rider action: FORCE_ALARM, SPEED_GATED_ALARM, or IGNORE
 */
function evaluate_rider_action(hazard, is_first_timer = true, current_hour = null) {
  if (current_hour === null || current_hour === undefined) {
    current_hour = new Date().getHours();
  }

  const hazard_type = hazard.type;
  const is_lit = hazard.is_lit === 1 || hazard.is_lit === true;
  const stage = calculate_stage(hazard.created_at, hazard_type, hazard.initial_severity || "severe");

  // RULE 1: First-timers get warned for EVERYTHING
  if (is_first_timer) {
    return "FORCE_ALARM";
  }

  // ALL LOGIC BELOW APPLIES TO LOCALS (NON FIRST TIMERS)
  // RULE 2: Stage 1 (Severe New / Construction) is ALWAYS forced
  if (stage === 1) {
    return "FORCE_ALARM";
  }

  // RULE 3: Night time (11 PM - 5 AM) AND Unlit is ALWAYS forced
  if (!is_lit && (current_hour >= 23 || current_hour < 5)) {
    return "FORCE_ALARM";
  }

  // RULE 4: Stage 2/3 during Daytime OR Lit Night-time
  return "SPEED_GATED_ALARM";
}

function getH3Index(lat, lon, res = H3_RESOLUTION) {
  if (typeof h3.latLngToCell === "function") {
    return h3.latLngToCell(lat, lon, res);
  } else if (typeof h3.latlngToCell === "function") {
    return h3.latlngToCell(lat, lon, res);
  } else {
    return h3.geoToH3(lat, lon, res);
  }
}

function getNeighborH3Cells(lat, lon, ring = 1, res = H3_RESOLUTION) {
  const centerH3 = getH3Index(lat, lon, res);
  if (typeof h3.gridDisk === "function") {
    return h3.gridDisk(centerH3, ring);
  } else {
    return h3.kRing(centerH3, ring);
  }
}

module.exports = {
  H3_RESOLUTION,
  calculate_stage,
  evaluate_rider_action,
  getH3Index,
  getNeighborH3Cells
};
