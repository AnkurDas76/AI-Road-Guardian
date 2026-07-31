import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  HazardItem,
  fetchNearbyHazardsApi,
  reportHazardApi,
  registerConstructionApi,
  withdrawConstructionApi,
} from '../api/config';
import { initLocalDatabase, saveLocalHazards, getLocalHazards } from '../services/db';

export default function HazardsScreen() {
  const [hazards, setHazards] = useState<HazardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'view' | 'report' | 'contractor'>('view');

  // Report Form state
  const [lat, setLat] = useState('22.5726');
  const [lon, setLon] = useState('88.3639');
  const [hazardType, setHazardType] = useState<string>('pothole');
  const [initialSeverity, setInitialSeverity] = useState<'minor' | 'severe'>('severe');
  const [isLit, setIsLit] = useState(true);

  // Contractor Form state
  const [companyName, setCompanyName] = useState('Metro Rail Construction');

  useEffect(() => {
    initLocalDatabase().then(() => {
      loadNearbyHazards();
    });
  }, []);

  const loadNearbyHazards = async () => {
    setLoading(true);
    try {
      const userLat = parseFloat(lat) || 22.5726;
      const userLon = parseFloat(lon) || 88.3639;
      const res = await fetchNearbyHazardsApi(userLat, userLon, true);
      
      if (res.hazards && res.hazards.length > 0) {
        setHazards(res.hazards);
        await saveLocalHazards(res.hazards);
      } else {
        const cached = await getLocalHazards();
        setHazards(cached);
      }
    } catch (e) {
      console.warn('Network error, falling back to local SQLite hazards cache');
      const cached = await getLocalHazards();
      setHazards(cached);
    } finally {
      setLoading(false);
    }
  };

  const handleReportHazard = async () => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      showNotice('Invalid Input', 'Please enter valid coordinates');
      return;
    }

    setReporting(true);
    try {
      const res = await reportHazardApi({
        latitude,
        longitude,
        type: hazardType,
        initial_severity: initialSeverity,
        is_lit: isLit,
      });

      if (res.status === 'success') {
        showNotice('Hazard Reported', `Successfully reported ${hazardType.replace('_', ' ')}!`);
        setActiveTab('view');
        loadNearbyHazards();
      } else {
        showNotice('Report Failed', res.error || 'Failed to submit hazard');
      }
    } catch (e) {
      showNotice('Error', String(e));
    } finally {
      setReporting(false);
    }
  };

  const handleRegisterConstruction = async () => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude) || !companyName.trim()) {
      showNotice('Invalid Input', 'Please fill in coordinates and company name');
      return;
    }

    setReporting(true);
    try {
      const res = await registerConstructionApi({
        latitude,
        longitude,
        company_name: companyName.trim(),
        is_lit: isLit,
      });

      if (res.status === 'registered') {
        showNotice('Construction Registered', `Work registered with ID: ${res.hazard_id}`);
        setActiveTab('view');
        loadNearbyHazards();
      } else {
        showNotice('Registration Failed', res.error || 'Failed to register');
      }
    } catch (e) {
      showNotice('Error', String(e));
    } finally {
      setReporting(false);
    }
  };

  const handleWithdrawConstruction = async (hazardId: string) => {
    try {
      const res = await withdrawConstructionApi(hazardId);
      if (res.status === 'withdrawn') {
        showNotice('Deactivated', 'Construction hazard warning deactivated.');
        loadNearbyHazards();
      } else {
        showNotice('Error', res.error || 'Failed to withdraw');
      }
    } catch (e) {
      showNotice('Error', String(e));
    }
  };

  const showNotice = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const getHazardIcon = (type: string) => {
    switch (type) {
      case 'pothole':
        return { name: 'alert-circle', color: '#f97316' };
      case 'speed_breaker':
        return { name: 'remove-circle', color: '#eab308' };
      case 'construction':
        return { name: 'construct', color: '#a855f7' };
      case 'accident':
        return { name: 'car', color: '#ef4444' };
      case 'blocked_road':
        return { name: 'barrier', color: '#64748b' };
      case 'danger_zone':
        return { name: 'skull', color: '#b91c1c' };
      default:
        return { name: 'warning', color: '#f59e0b' };
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Top Banner & Header */}
      <View var-header style={styles.headerBox}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="shield-half" size={28} color="#38bdf8" style={{ marginRight: 10 }} />
          <View>
            <Text style={styles.headerTitle}>MotoSense Spatial Hazards</Text>
            <Text style={styles.headerSubtitle}>Uber H3 Grid Resolution 8 · Context Evaluation Engine</Text>
          </View>
        </View>
      </View>

      {/* Navigation Segment Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'view' && styles.activeTabButton]}
          onPress={() => setActiveTab('view')}>
          <Ionicons name="list" size={16} color={activeTab === 'view' ? '#0f172a' : '#94a3b8'} />
          <Text style={[styles.tabText, activeTab === 'view' && styles.activeTabText]}>Active ({hazards.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'report' && styles.activeTabButton]}
          onPress={() => setActiveTab('report')}>
          <Ionicons name="add-circle" size={16} color={activeTab === 'report' ? '#0f172a' : '#94a3b8'} />
          <Text style={[styles.tabText, activeTab === 'report' && styles.activeTabText]}>Report Hazard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'contractor' && styles.activeTabButton]}
          onPress={() => setActiveTab('contractor')}>
          <Ionicons name="briefcase" size={16} color={activeTab === 'contractor' ? '#0f172a' : '#94a3b8'} />
          <Text style={[styles.tabText, activeTab === 'contractor' && styles.activeTabText]}>Contractor</Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: VIEW ACTIVE HAZARDS */}
      {activeTab === 'view' && (
        <View>
          <View style={styles.refreshBar}>
            <Text style={styles.sectionTitle}>Nearby Road Hazards</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadNearbyHazards}>
              <Ionicons name="refresh" size={16} color="#38bdf8" />
              <Text style={styles.refreshText}>Sync API</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 30 }} />
          ) : hazards.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#10b981" />
              <Text style={styles.emptyText}>No Active Hazards Nearby</Text>
              <Text style={styles.emptySubtext}>Your upcoming road segment is safe & clear.</Text>
            </View>
          ) : (
            hazards.map((item) => {
              const icon = getHazardIcon(item.type);
              const isForce = item.frontend_action === 'FORCE_ALARM';

              return (
                <View key={item.id} style={styles.hazardCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.typeBadgeContainer}>
                      <Ionicons name={icon.name as any} size={20} color={icon.color} style={{ marginRight: 6 }} />
                      <Text style={styles.hazardTypeTitle}>{item.type.toUpperCase().replace('_', ' ')}</Text>
                    </View>

                    <View style={[styles.actionBadge, { backgroundColor: isForce ? '#ef4444' : '#f59e0b' }]}>
                      <Text style={styles.actionBadgeText}>{item.frontend_action || 'FORCE_ALARM'}</Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardDetailText}>📍 Lat: {item.latitude}, Lon: {item.longitude}</Text>
                    <Text style={styles.cardDetailText}>
                      🏷️ Stage: <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>Stage {item.calculated_stage || 1}</Text>
                      {'  '} | {'  '}
                      ⚡ Severity: <Text style={{ color: item.initial_severity === 'severe' ? '#ef4444' : '#eab308' }}>{item.initial_severity || 'severe'}</Text>
                    </Text>
                    <Text style={styles.cardDetailText}>
                      💡 Lighting: {item.is_lit ? 'Well-Lit ☀️' : 'Unlit / Night Risk 🌙'}
                    </Text>
                    {item.company_name && (
                      <Text style={styles.cardDetailText}>🏢 Contractor: {item.company_name}</Text>
                    )}
                  </View>

                  {item.type === 'construction' && (
                    <TouchableOpacity
                      style={styles.withdrawBtn}
                      onPress={() => handleWithdrawConstruction(item.id)}>
                      <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                      <Text style={styles.withdrawBtnText}>Withdraw Roadwork Warning</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* TAB 2: CROWDSOURCE REPORT */}
      {activeTab === 'report' && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Report Crowdsourced Road Hazard</Text>

          <Text style={styles.label}>Select Hazard Type:</Text>
          <View style={styles.typeSelectorRow}>
            {['pothole', 'speed_breaker', 'accident', 'blocked_road', 'danger_zone'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typePill, hazardType === t && styles.activeTypePill]}
                onPress={() => setHazardType(t)}>
                <Text style={[styles.typePillText, hazardType === t && styles.activeTypePillText]}>
                  {t.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Initial Severity:</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.severityBtn, initialSeverity === 'severe' && styles.activeSeverityBtn]}
              onPress={() => setInitialSeverity('severe')}>
              <Text style={[styles.severityBtnText, initialSeverity === 'severe' && styles.activeSeverityText]}>
                Severe (Stage 1)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.severityBtn, initialSeverity === 'minor' && styles.activeSeverityBtnMinor]}
              onPress={() => setInitialSeverity('minor')}>
              <Text style={[styles.severityBtnText, initialSeverity === 'minor' && styles.activeSeverityText]}>
                Minor (Stage 2)
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Street Lighting Available?</Text>
            <Switch value={isLit} onValueChange={setIsLit} trackColor={{ false: '#475569', true: '#38bdf8' }} />
          </View>

          <Text style={styles.label}>Latitude:</Text>
          <TextInput style={styles.input} value={lat} onChangeText={setLat} keyboardType="numeric" />

          <Text style={styles.label}>Longitude:</Text>
          <TextInput style={styles.input} value={lon} onChangeText={setLon} keyboardType="numeric" />

          {reporting ? (
            <ActivityIndicator size="small" color="#38bdf8" style={{ marginTop: 15 }} />
          ) : (
            <TouchableOpacity style={styles.submitBtn} onPress={handleReportHazard}>
              <Ionicons name="send" size={18} color="#0f172a" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>Submit Hazard Warning</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* TAB 3: CONTRACTOR REGISTER */}
      {activeTab === 'contractor' && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Register Road Construction Work</Text>
          <Text style={styles.formSubtext}>Perpetual Stage 1 hazard warning until contractor withdrawal.</Text>

          <Text style={styles.label}>Contractor / Infrastructure Company:</Text>
          <TextInput
            style={styles.input}
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="e.g. Metro Rail Infra Corp"
            placeholderTextColor="#64748b"
          />

          <View style={styles.switchRow}>
            <Text style={styles.label}>Is Safety Barricade Lit?</Text>
            <Switch value={isLit} onValueChange={setIsLit} trackColor={{ false: '#475569', true: '#38bdf8' }} />
          </View>

          <Text style={styles.label}>Latitude:</Text>
          <TextInput style={styles.input} value={lat} onChangeText={setLat} keyboardType="numeric" />

          <Text style={styles.label}>Longitude:</Text>
          <TextInput style={styles.input} value={lon} onChangeText={setLon} keyboardType="numeric" />

          {reporting ? (
            <ActivityIndicator size="small" color="#38bdf8" style={{ marginTop: 15 }} />
          ) : (
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#a855f7' }]} onPress={handleRegisterConstruction}>
              <Ionicons name="construct" size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={[styles.submitBtnText, { color: '#ffffff' }]}>Register Construction Zone</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  contentContainer: {
    padding: 16,
  },
  headerBox: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#38bdf8',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#38bdf8',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#0f172a',
    fontWeight: 'bold',
  },
  refreshBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  refreshText: {
    color: '#38bdf8',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  emptySubtext: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  hazardCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hazardTypeTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardBody: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
  },
  cardDetailText: {
    color: '#cbd5e1',
    fontSize: 12,
    marginVertical: 2,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#450a0a',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  withdrawBtnText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  formCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  formSubtext: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 12,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typePill: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeTypePill: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  typePillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  activeTypePillText: {
    color: '#0f172a',
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  severityBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeSeverityBtn: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  activeSeverityBtnMinor: {
    backgroundColor: '#eab308',
    borderColor: '#eab308',
  },
  severityBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  activeSeverityText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitBtnText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
