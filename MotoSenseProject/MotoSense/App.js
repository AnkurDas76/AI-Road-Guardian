import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Circle, Polyline } from 'react-native-maps';
import * as Speech from 'expo-speech';
import { initLocalDatabase, syncHazardsFromBackend, getLocalHazards } from './services/db';

// Add this right above export default function App() { ... }

const customDarkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];


export default function App() {
  const [status, setStatus] = useState('Initializing system...');
  const [isReady, setIsReady] = useState(false);
  
  // Rider State
  const [currentLoc, setCurrentLoc] = useState(null); 
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [warningBuffer, setWarningBuffer] = useState(30);
  
  // Hazard State
  const [loadedHazards, setLoadedHazards] = useState([]);
  const [activeWarning, setActiveWarning] = useState(null);

  // App Modes
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Demo Simulation State
  const [demoRoute, setDemoRoute] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Refs (Background Memory)
  const isDemoModeRef = useRef(false); 
  const lastSyncedCoords = useRef(null);
  const locationSubscription = useRef(null);
  const lastSpokenHazardId = useRef(null); 
  const simInterval = useRef(null);

  useEffect(() => {
    startupSequence();
    return () => {
      if (locationSubscription.current) locationSubscription.current.remove();
      if (simInterval.current) clearInterval(simInterval.current);
    };
  }, []);

  const startupSequence = async () => {
    try {
      setStatus('Booting offline SQLite database...');
      initLocalDatabase();

      setStatus('Requesting GPS hardware access...');
      let { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (locationStatus !== 'granted') {
        setStatus('CRITICAL: GPS Permission Denied.');
        return;
      }

      setStatus('Acquiring high-accuracy GPS fix...');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCurrentLoc({ lat: loc.coords.latitude, lon: loc.coords.longitude });

      setStatus('Fetching 1km H3 Hexagon data...');
      await triggerH3Sync(loc.coords.latitude, loc.coords.longitude);

      startLiveTracking();
      setStatus('System Active & Monitoring');
      setIsReady(true);
    } catch (error) {
      setStatus(`Startup Error: ${error.message}`);
    }
  };

  const triggerH3Sync = async (lat, lon) => {
    refreshLocalHazards(); 
    const success = await syncHazardsFromBackend(lat, lon, true);
    if (success) {
      refreshLocalHazards(); 
      lastSyncedCoords.current = { lat, lon };
    }
  };

  const refreshLocalHazards = () => {
    setLoadedHazards(getLocalHazards());
  };

  // ==========================================
  // VOICE ALERT ENGINE
  // ==========================================
  useEffect(() => {
    if (activeWarning) {
      if (lastSpokenHazardId.current !== activeWarning.id) {
        const cleanType = activeWarning.type.replace('_', ' ');
        Speech.speak(`Warning, ${cleanType} ahead`, { language: 'en', rate: 0.9, pitch: 1.0 });
        lastSpokenHazardId.current = activeWarning.id;
      }
    } else {
      lastSpokenHazardId.current = null;
    }
  }, [activeWarning]);

  // ==========================================
  // VECTOR MATH & PROXIMITY ENGINE
  // ==========================================
  
  // Calculates Distance between two lat/lon points
  const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + 
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  // Calculates exact compass angle (Azimuth) from Rider to Hazard
  const getBearing = (startLat, startLon, destLat, destLon) => {
    const startLatRad = (startLat * Math.PI) / 180;
    const startLonRad = (startLon * Math.PI) / 180;
    const destLatRad = (destLat * Math.PI) / 180;
    const destLonRad = (destLon * Math.PI) / 180;

    const y = Math.sin(destLonRad - startLonRad) * Math.cos(destLatRad);
    const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
              Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLonRad - startLonRad);
    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
  };

  const evaluatePosition = (lat, lon, speedKmH, currentHeading) => {
    if (lastSyncedCoords.current) {
      if (getDistanceMeters(lat, lon, lastSyncedCoords.current.lat, lastSyncedCoords.current.lon) > 300) {
        triggerH3Sync(lat, lon);
      }
    }

    const dynamicBuffer = Math.max(30, (speedKmH / 3.6) * 3.5);
    setWarningBuffer(dynamicBuffer);

    let nearestHazard = null;
    let minDistance = Infinity;
    const hazards = getLocalHazards();

    hazards.forEach((h) => {
      const dist = getDistanceMeters(lat, lon, h.latitude, h.longitude);
      
      if (dist <= dynamicBuffer) {
        // VECTOR CONE LOGIC
        let inCone = true;
        
        // Only apply the cone if we are moving (> 5km/h). If stopped, check all 360 degrees.
        if (speedKmH >= 5 && currentHeading !== null && currentHeading !== undefined) {
          const hazardBearing = getBearing(lat, lon, h.latitude, h.longitude);
          let angleDiff = Math.abs(currentHeading - hazardBearing);
          if (angleDiff > 180) angleDiff = 360 - angleDiff;
          
          // Flashlight Cone Tolerance: ±30 degrees from the front of the bike
          inCone = angleDiff <= 30; 
        }

        if (inCone && dist < minDistance) {
          minDistance = dist;
          nearestHazard = { ...h, distanceMeters: Math.round(dist) };
        }
      }
    });

    setActiveWarning(nearestHazard);
  };

  // ==========================================
  // CORE TRACKING ENGINE
  // ==========================================
  const startLiveTracking = async () => {
    if (locationSubscription.current) locationSubscription.current.remove();

    locationSubscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 5 },
      (location) => {
        if (isDemoModeRef.current) return;

        // Note: Hardware provides 'heading' automatically!
        const { latitude, longitude, speed, heading } = location.coords;
        const speedKmH = speed ? Math.round(speed * 3.6) : 0;
        
        setCurrentLoc({ lat: latitude, lon: longitude });
        setCurrentSpeed(speedKmH);
        evaluatePosition(latitude, longitude, speedKmH, heading);
      }
    );
  };

  // ==========================================
  // DEMO MODE & AUTO-DRIVE ENGINE
  // ==========================================
  const toggleDemoMode = async () => {
    const newMode = !isDemoMode;
    setIsDemoMode(newMode);
    isDemoModeRef.current = newMode;
    setIsMenuOpen(false);

    if (newMode) {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      setDemoRoute([]);
      Alert.alert("Route Builder ON", "Tap the map to draw a path. Then press Start to drive.");
    } else {
      if (simInterval.current) clearInterval(simInterval.current);
      setIsSimulating(false);
      setDemoRoute([]);
      setCurrentSpeed(0);
      
      Alert.alert("Live Mode ON", "Snapping back to actual location...");
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCurrentLoc({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      evaluatePosition(loc.coords.latitude, loc.coords.longitude, 0, 0);

      startLiveTracking(); 
    }
  };

  const handleMapPress = (e) => {
    if (!isDemoMode || isSimulating) return;
    const { coordinate } = e.nativeEvent;
    const newPt = { lat: coordinate.latitude, lon: coordinate.longitude };
    
    if (demoRoute.length === 0) {
      setCurrentLoc(newPt); // Snap to first tap immediately
    }
    setDemoRoute([...demoRoute, newPt]);
  };

  const startSimulation = () => {
    if (demoRoute.length < 2) return Alert.alert("Error", "Draw at least 2 points!");
    setIsSimulating(true);
    setCurrentSpeed(40); // Lock speed at 40km/h

    let currentDistanceTravelled = 0;
    const speedMetersPerSec = 40 * (1000 / 3600); // 11.1 m/s

    simInterval.current = setInterval(() => {
      currentDistanceTravelled += speedMetersPerSec;
      
      // Interpolate position along the route
      let accumulated = 0;
      let newPos = null;
      let currentHeading = 0;

      for (let i = 0; i < demoRoute.length - 1; i++) {
        const p1 = demoRoute[i];
        const p2 = demoRoute[i+1];
        const segDist = getDistanceMeters(p1.lat, p1.lon, p2.lat, p2.lon);
        
        if (accumulated + segDist >= currentDistanceTravelled) {
          const ratio = (currentDistanceTravelled - accumulated) / segDist;
          newPos = {
            lat: p1.lat + (p2.lat - p1.lat) * ratio,
            lon: p1.lon + (p2.lon - p1.lon) * ratio
          };
          currentHeading = getBearing(p1.lat, p1.lon, p2.lat, p2.lon);
          break;
        }
        accumulated += segDist;
      }

      if (newPos) {
        setCurrentLoc(newPos);
        // Feed the math engine the fake coordinates, speed, and heading
        evaluatePosition(newPos.lat, newPos.lon, 40, currentHeading);
      } else {
        // Reached the end of the route
        clearInterval(simInterval.current);
        setIsSimulating(false);
        setCurrentSpeed(0);
        Alert.alert("Arrived", "Simulation complete.");
      }
    }, 1000); // Update every 1 second
  };

  // ==========================================
  // UI RENDER
  // ==========================================
  return (
    <View style={styles.container}>
      
      {currentLoc && (
        <MapView
          style={StyleSheet.absoluteFillObject}
          customMapStyle={customDarkMapStyle}
          initialRegion={{ latitude: currentLoc.lat, longitude: currentLoc.lon, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
          showsUserLocation={!isDemoMode}
          onPress={handleMapPress}
        >
          {isDemoMode && <Marker coordinate={{ latitude: currentLoc.lat, longitude: currentLoc.lon }} pinColor="blue" title="Rider" />}

          {/* Draw the user's demo route */}
          {demoRoute.length > 0 && (
            <Polyline coordinates={demoRoute.map(p => ({ latitude: p.lat, longitude: p.lon }))} strokeColor="#007AFF" strokeWidth={5} />
          )}

          <Circle center={{ latitude: currentLoc.lat, longitude: currentLoc.lon }} radius={warningBuffer} fillColor="rgba(255, 0, 0, 0.2)" strokeColor="rgba(255, 0, 0, 0.5)" />

          {loadedHazards.map((h, i) => (
            <Marker key={i} coordinate={{ latitude: h.latitude, longitude: h.longitude }} pinColor="red" title={h.type.toUpperCase()} />
          ))}
        </MapView>
      )}

      <View style={styles.overlayContainer} pointerEvents="box-none">
        
        {/* Top Controls */}
        <View style={styles.topBar} pointerEvents="box-none">
          <TouchableOpacity style={styles.hamburger} onPress={() => setIsMenuOpen(!isMenuOpen)}>
            <Text style={styles.hamburgerText}>☰</Text>
          </TouchableOpacity>
          
          {/* Demo Controls */}
          {isDemoMode && !isSimulating && demoRoute.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {demoRoute.length > 1 && (
                <TouchableOpacity style={styles.playButton} onPress={startSimulation}>
                  <Text style={styles.playButtonText}>▶️ Start</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.playButton, { backgroundColor: '#ff3b30' }]} onPress={() => setDemoRoute([])}>
                <Text style={styles.playButtonText}>🗑️ Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.speedometerBox}>
            <Text style={styles.speedText}>{currentSpeed}</Text>
            <Text style={styles.speedUnit}>KM/H</Text>
          </View>
        </View>

        {/* Bottom Bar: Warnings */}
        <View style={styles.bottomBar} pointerEvents="box-none">
          {activeWarning ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>⚠️ HAZARD AHEAD</Text>
              <Text style={styles.warningDetails}>Type: {activeWarning.type.toUpperCase()}</Text>
              <Text style={styles.warningDetails}>Distance: {activeWarning.distanceMeters}m</Text>
            </View>
          ) : (
            <View style={styles.safeCard}>
              <Text style={styles.safeText}>ROAD CLEAR</Text>
            </View>
          )}
        </View>
      </View>

      {/* SIDE MENU */}
      {isMenuOpen && (
        <View style={styles.sideMenu}>
          <Text style={styles.menuTitle}>Developer Menu</Text>
          <TouchableOpacity style={styles.menuButton} onPress={toggleDemoMode}>
            <Text style={styles.menuButtonText}>{isDemoMode ? '📡 Switch to Live GPS' : '🎮 Route Builder Mode'}</Text>
          </TouchableOpacity>
          {/* Restored Cache Count Button */}
          <TouchableOpacity 
            style={[styles.menuButton, { backgroundColor: '#333' }]} 
            onPress={() => {
              Alert.alert("Database", `Tracking ${loadedHazards.length} offline hazards.`);
              setIsMenuOpen(false);
            }}
          >
            <Text style={styles.menuButtonText}>🛠️ Check Cache Count</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  overlayContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingVertical: 50, paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hamburger: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, borderRadius: 8 },
  hamburgerText: { color: '#fff', fontSize: 24 },
  playButton: { backgroundColor: '#34c759', padding: 15, borderRadius: 30, elevation: 5 },
  playButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  speedometerBox: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  speedText: { fontSize: 48, fontWeight: '900', color: '#00ff00' },
  speedUnit: { fontSize: 14, color: '#888', fontWeight: 'bold' },
  bottomBar: { width: '100%', alignItems: 'center' },
  warningCard: { width: '100%', backgroundColor: 'rgba(255, 23, 68, 0.95)', padding: 20, borderRadius: 12, alignItems: 'center' },
  warningTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  warningDetails: { fontSize: 16, color: '#fff', fontWeight: '600', marginTop: 4 },
  safeCard: { width: '100%', backgroundColor: 'rgba(30, 30, 30, 0.9)', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  safeText: { color: '#00ff00', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  sideMenu: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 250, backgroundColor: 'rgba(20, 20, 20, 0.95)', paddingTop: 60, paddingHorizontal: 20, borderRightWidth: 1, borderColor: '#333', zIndex: 100 },
  menuTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 30 },
  menuButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, marginBottom: 15 },
  menuButtonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' }
});