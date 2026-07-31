import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { UserItem, PoliceStationItem } from '../api/config';

interface OSMMapViewProps {
  userLocation: { lat: number; lon: number };
  alertLocation?: { lat: number; lon: number; driverId: string } | null;
  nearbyUsers?: UserItem[];
  nearbyPolice?: PoliceStationItem[];
}

export const OSMMapView: React.FC<OSMMapViewProps> = ({
  userLocation,
  alertLocation,
  nearbyUsers = [],
  nearbyPolice = [],
}) => {
  const centerLat = alertLocation ? alertLocation.lat : userLocation.lat;
  const centerLon = alertLocation ? alertLocation.lon : userLocation.lon;

  // HTML + Leaflet + OpenStreetMap string template
  const leafletHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>OpenStreetMap Safety View</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map {
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .custom-popup .leaflet-popup-content-wrapper {
      background: #1e293b;
      color: #f8fafc;
      border-radius: 8px;
      padding: 4px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
    }
    .custom-popup .leaflet-popup-tip {
      background: #1e293b;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
      margin-top: 4px;
    }
    .badge-red { background-color: #ef4444; color: white; }
    .badge-blue { background-color: #3b82f6; color: white; }
    .badge-green { background-color: #10b981; color: white; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false
    }).setView([${centerLat}, ${centerLon}], 15);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // OpenStreetMap Free Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Custom Icon Creators
    function createIcon(color, text, size) {
      size = size || 24;
      return L.divIcon({
        className: 'custom-div-icon',
        html: '<div style="background-color:' + color + ';width:' + size + 'px;height:' + size + 'px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 0 10px ' + color + ';display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;">' + text + '</div>',
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      });
    }

    // 1. User Location Marker
    var userMarker = L.marker([${userLocation.lat}, ${userLocation.lon}], {
      icon: createIcon('#3b82f6', 'YOU', 28)
    }).addTo(map);
    userMarker.bindPopup('<div class="custom-popup"><strong>📍 Your Location</strong><br><span class="badge badge-blue">Active GPS</span></div>');

    // 2. Alert Location (if active) + 300m Danger Circle
    ${
      alertLocation
        ? `
      var alertMarker = L.marker([${alertLocation.lat}, ${alertLocation.lon}], {
        icon: createIcon('#ef4444', '🚨', 34)
      }).addTo(map);
      
      alertMarker.bindPopup('<div class="custom-popup"><strong style="color:#ef4444;">🚨 DROWSY DRIVER DETECTED!</strong><br>Driver ID: ${alertLocation.driverId}<br><span class="badge badge-red">CRITICAL HAZARD</span></div>').openPopup();

      // 300 Meter Danger Zone Circle
      var userDangerCircle = L.circle([${alertLocation.lat}, ${alertLocation.lon}], {
        color: '#ef4444',
        fillColor: '#f87171',
        fillOpacity: 0.25,
        radius: 300
      }).addTo(map);

      // 3000 Meter Police Net Circle
      var policeCircle = L.circle([${alertLocation.lat}, ${alertLocation.lon}], {
        color: '#3b82f6',
        fillColor: '#60a5fa',
        fillOpacity: 0.08,
        dashArray: '6, 6',
        radius: 3000
      }).addTo(map);
    `
        : ''
    }

    // 3. Nearby Users Pins
    var usersData = ${JSON.stringify(nearbyUsers)};
    usersData.forEach(function(u) {
      if (u.lat && u.lon) {
        var m = L.marker([u.lat, u.lon], {
          icon: createIcon('#10b981', '👤', 22)
        }).addTo(map);
        var distStr = u.distance ? u.distance + 'm away' : 'Nearby';
        m.bindPopup('<div class="custom-popup"><strong>👤 ' + u.name + '</strong><br>Phone: ' + u.phone + '<br><span class="badge badge-green">' + distStr + '</span></div>');
      }
    });

    // 4. Nearby Police Stations Pins
    var policeData = ${JSON.stringify(nearbyPolice)};
    policeData.forEach(function(p) {
      if (p.lat && p.lon) {
        var pm = L.marker([p.lat, p.lon], {
          icon: createIcon('#6366f1', '🚓', 26)
        }).addTo(map);
        var pDist = p.distance ? p.distance + 'm away' : 'Police Station';
        pm.bindPopup('<div class="custom-popup"><strong style="color:#818cf8;">🚓 ' + p.name + '</strong><br>Phone: ' + p.phone + '<br><span class="badge badge-blue">' + pDist + '</span></div>');
      }
    });
  </script>
</body>
</html>
  `;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {/* @ts-ignore */}
        <iframe
          srcDoc={leafletHTML}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="OpenStreetMap"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: leafletHTML }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
});
