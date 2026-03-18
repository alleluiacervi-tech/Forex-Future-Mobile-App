import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout';
import { Button, Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { apiAuthGet } from '../../services/api';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type StatsPayload = {
  users: { total: number; active: number; newToday: number; newThisWeek: number; suspended: number };
  subscriptions: { total: number; active: number; trial: number; expired: number; cancelled: number; failed: number };
  revenue: { today: number; month: number; allTime: number; mrr: number };
  alerts: { today: number; week: number; total: number; avgPerDay: number };
  notifications: { total: number };
};

type AuditEntry = {
  id: number;
  actionType: string;
  description: string;
  createdAt: string;
  admin?: { name?: string; email?: string };
};

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [recentAudit, setRecentAudit] = useState<AuditEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAdmin = Boolean(user?.isAdmin);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, audit] = await Promise.all([
        apiAuthGet<StatsPayload>('/api/admin/stats'),
        apiAuthGet<{ items: AuditEntry[] }>('/api/admin/audit-log?limit=10'),
      ]);
      setStats(s);
      setRecentAudit(audit?.items || []);
    } catch (err) {
      if (!silent) Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) { navigation.replace('Welcome'); return; }
    if (!isAdmin) { navigation.replace('Main'); return; }
    void fetchData();
    timerRef.current = setInterval(() => fetchData(true), 60000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isAuthLoading, isAuthenticated, isAdmin, fetchData, navigation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  }, [fetchData]);

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total Users', value: String(stats.users.total), sub: `+${stats.users.newThisWeek} this week`, icon: 'people' as const },
      { label: 'Active Subs', value: String(stats.subscriptions.active), sub: `${stats.subscriptions.trial} trials`, icon: 'verified-user' as const },
      { label: 'MRR', value: money(stats.revenue.mrr), sub: `Today: ${money(stats.revenue.today)}`, icon: 'attach-money' as const },
      { label: 'Alerts Today', value: String(stats.alerts.today), sub: `${stats.alerts.avgPerDay} avg/day`, icon: 'notifications-active' as const },
    ];
  }, [stats]);

  return (
    <ScreenWrapper style={styles.screen}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.surface, theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bg}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="h3" style={styles.title}>Admin Dashboard</Text>
            <Text variant="bodySmall" color={theme.colors.textSecondary}>
              {user?.email || 'admin'}
            </Text>
          </View>
          <Button
            title="Trading App"
            onPress={() => navigation.replace('Main')}
            variant="outline"
            size="small"
          />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
        >
          {loading && !stats ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <>
              {/* Stats Cards */}
              <View style={styles.grid}>
                {statCards.map((c) => (
                  <Card key={c.label} style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Icon name={c.icon} size={22} color={theme.colors.primary} />
                    <Text variant="h4" style={styles.statValue}>{c.value}</Text>
                    <Text variant="caption" color={theme.colors.textSecondary}>{c.label}</Text>
                    <Text variant="caption" color={theme.colors.textDisabled} style={styles.statSub}>{c.sub}</Text>
                  </Card>
                ))}
              </View>

              {/* Quick Actions */}
              <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text variant="body" style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.colors.primary + '20' }]}
                    onPress={() => navigation.navigate('AdminUsers')}
                    activeOpacity={0.7}
                  >
                    <Icon name="people" size={20} color={theme.colors.primary} />
                    <Text variant="caption" color={theme.colors.primary}>Users</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.colors.accent + '20' }]}
                    onPress={() => navigation.navigate('AdminBroadcast')}
                    activeOpacity={0.7}
                  >
                    <Icon name="campaign" size={20} color={theme.colors.accent} />
                    <Text variant="caption" color={theme.colors.accent}>Broadcast</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.colors.success + '20' }]}
                    onPress={() => navigation.navigate('AdminSystem')}
                    activeOpacity={0.7}
                  >
                    <Icon name="dns" size={20} color={theme.colors.success} />
                    <Text variant="caption" color={theme.colors.success}>System</Text>
                  </TouchableOpacity>
                </View>
              </Card>

              {/* Subscription Breakdown */}
              {stats && (
                <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <Text variant="body" style={styles.sectionTitle}>Subscriptions</Text>
                  {[
                    { label: 'Active', val: stats.subscriptions.active, color: theme.colors.success },
                    { label: 'Trial', val: stats.subscriptions.trial, color: theme.colors.info },
                    { label: 'Expired', val: stats.subscriptions.expired, color: theme.colors.warning },
                    { label: 'Cancelled', val: stats.subscriptions.cancelled, color: theme.colors.error },
                    { label: 'Failed', val: stats.subscriptions.failed, color: theme.colors.textDisabled },
                  ].map((r) => (
                    <View key={r.label} style={styles.metricRow}>
                      <View style={styles.dotRow}>
                        <View style={[styles.dot, { backgroundColor: r.color }]} />
                        <Text variant="bodySmall" color={theme.colors.textSecondary}>{r.label}</Text>
                      </View>
                      <Text variant="body" style={styles.metricValue}>{r.val}</Text>
                    </View>
                  ))}
                </Card>
              )}

              {/* Revenue */}
              {stats && (
                <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <Text variant="body" style={styles.sectionTitle}>Revenue</Text>
                  {[
                    { label: 'Today', val: money(stats.revenue.today) },
                    { label: 'This Month', val: money(stats.revenue.month) },
                    { label: 'All-Time', val: money(stats.revenue.allTime) },
                  ].map((r) => (
                    <View key={r.label} style={styles.metricRow}>
                      <Text variant="bodySmall" color={theme.colors.textSecondary}>{r.label}</Text>
                      <Text variant="body" style={styles.metricValue}>{r.val}</Text>
                    </View>
                  ))}
                </Card>
              )}

              {/* Recent Activity */}
              <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text variant="body" style={styles.sectionTitle}>Recent Activity</Text>
                {recentAudit.length === 0 ? (
                  <Text variant="bodySmall" color={theme.colors.textSecondary}>No recent activity.</Text>
                ) : (
                  recentAudit.map((entry) => (
                    <View key={entry.id} style={styles.auditRow}>
                      <View style={styles.auditLeft}>
                        <Text variant="bodySmall" style={styles.auditType}>{entry.actionType.replace(/_/g, ' ')}</Text>
                        <Text variant="caption" color={theme.colors.textSecondary} numberOfLines={2}>
                          {entry.description}
                        </Text>
                      </View>
                      <Text variant="caption" color={theme.colors.textDisabled}>
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  ))
                )}
              </Card>
            </>
          )}
        </ScrollView>
      </LinearGradient>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' },
  bg: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 },
  headerText: { flex: 1 },
  title: { marginBottom: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20, gap: 12 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%' as unknown as number, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, alignItems: 'flex-start', gap: 4 },
  statValue: { fontWeight: '700', marginTop: 4 },
  statSub: { marginTop: 2 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12 },
  sectionTitle: { fontWeight: '700', marginBottom: 8 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 6 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: 10 },
  metricValue: { fontWeight: '700' },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  auditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6, gap: 10 },
  auditLeft: { flex: 1 },
  auditType: { fontWeight: '600', textTransform: 'capitalize' },
});
