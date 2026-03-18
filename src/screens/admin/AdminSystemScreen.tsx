import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { apiAuthGet } from '../../services/api';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type SystemHealth = {
  server: {
    uptime: number;
    uptimeFormatted: string;
    nodeVersion: string;
    memoryMB: { rss: number; heapUsed: number; heapTotal: number };
    env: string;
  };
  database: { connected: boolean };
  push: { totalTokens: number; activeTokens: number; inactiveTokens: number };
  market: { provider: string };
};

type AuditEntry = {
  id: number;
  actionType: string;
  description: string;
  createdAt: string;
  admin?: { name?: string; email?: string };
};

export default function AdminSystemScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [h, a] = await Promise.all([
        apiAuthGet<SystemHealth>('/api/admin/system-health'),
        apiAuthGet<{ items: AuditEntry[] }>('/api/admin/audit-log?limit=15'),
      ]);
      setHealth(h);
      setAudit(a?.items || []);
    } catch (err) {
      if (!silent) Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load system health');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(() => fetchData(true), 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  }, [fetchData]);

  return (
    <ScreenWrapper style={styles.screen}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.surface, theme.colors.background]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.bg}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text variant="h4" style={styles.headerTitle}>System Health</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
        >
          {loading && !health ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : health ? (
            <>
              {/* Server */}
              <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.cardHeader}>
                  <Icon name="dns" size={20} color={theme.colors.primary} />
                  <Text variant="body" style={styles.sectionTitle}>Server</Text>
                </View>
                <StatusRow label="Uptime" value={health.server.uptimeFormatted} colors={theme.colors} />
                <StatusRow label="Node.js" value={health.server.nodeVersion} colors={theme.colors} />
                <StatusRow label="Environment" value={health.server.env} colors={theme.colors} />
                <StatusRow label="RSS Memory" value={`${health.server.memoryMB.rss} MB`} colors={theme.colors} />
                <StatusRow label="Heap Used" value={`${health.server.memoryMB.heapUsed} MB`} colors={theme.colors} />
                <StatusRow label="Heap Total" value={`${health.server.memoryMB.heapTotal} MB`} colors={theme.colors} />
              </Card>

              {/* Database */}
              <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.cardHeader}>
                  <Icon name="storage" size={20} color={health.database.connected ? theme.colors.success : theme.colors.error} />
                  <Text variant="body" style={styles.sectionTitle}>Database</Text>
                </View>
                <View style={styles.statusIndicator}>
                  <View style={[styles.statusDot, { backgroundColor: health.database.connected ? theme.colors.success : theme.colors.error }]} />
                  <Text variant="body" color={health.database.connected ? theme.colors.success : theme.colors.error}>
                    {health.database.connected ? 'Connected' : 'Disconnected'}
                  </Text>
                </View>
              </Card>

              {/* Push Tokens */}
              <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.cardHeader}>
                  <Icon name="phonelink-ring" size={20} color={theme.colors.info} />
                  <Text variant="body" style={styles.sectionTitle}>Push Notifications</Text>
                </View>
                <StatusRow label="Total Tokens" value={String(health.push.totalTokens)} colors={theme.colors} />
                <StatusRow label="Active" value={String(health.push.activeTokens)} colors={theme.colors} />
                <StatusRow label="Inactive" value={String(health.push.inactiveTokens)} colors={theme.colors} />
              </Card>

              {/* Market */}
              <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.cardHeader}>
                  <Icon name="show-chart" size={20} color={theme.colors.accent} />
                  <Text variant="body" style={styles.sectionTitle}>Market Data</Text>
                </View>
                <StatusRow label="Provider" value={health.market.provider} colors={theme.colors} />
              </Card>

              {/* Recent Audit */}
              <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text variant="body" style={styles.sectionTitle}>Recent Admin Activity</Text>
                {audit.length === 0 ? (
                  <Text variant="bodySmall" color={theme.colors.textSecondary}>No recent activity.</Text>
                ) : (
                  audit.map((entry) => (
                    <View key={entry.id} style={styles.auditRow}>
                      <View style={styles.auditLeft}>
                        <Text variant="bodySmall" style={styles.auditType}>{entry.actionType.replace(/_/g, ' ')}</Text>
                        <Text variant="caption" color={theme.colors.textSecondary} numberOfLines={2}>
                          {entry.description}
                        </Text>
                        {entry.admin?.name && (
                          <Text variant="caption" color={theme.colors.textDisabled}>by {entry.admin.name}</Text>
                        )}
                      </View>
                      <Text variant="caption" color={theme.colors.textDisabled}>
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  ))
                )}
              </Card>
            </>
          ) : null}
        </ScrollView>
      </LinearGradient>
    </ScreenWrapper>
  );
}

function StatusRow({ label, value, colors }: { label: string; value: string; colors: Record<string, string> }) {
  return (
    <View style={rowStyles.row}>
      <Text variant="bodySmall" color={colors.textSecondary}>{label}</Text>
      <Text variant="body" style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, gap: 10 },
  value: { fontWeight: '600' },
});

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' },
  bg: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20, gap: 12 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontWeight: '700' },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  auditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6, gap: 10 },
  auditLeft: { flex: 1 },
  auditType: { fontWeight: '600', textTransform: 'capitalize' },
});
