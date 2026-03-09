import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper } from '../../components/layout';
import { Button, Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { apiAuthGet } from '../../services/api';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type DashboardStat = {
  title?: string;
  value?: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral' | string;
};

type RevenueMetrics = Record<string, string | number | null | undefined>;

type DashboardAlert = {
  pair?: string;
  severity?: string;
  changePercent?: number;
  direction?: string;
  triggeredAt?: string;
};

type DashboardNotification = {
  message?: string;
  time?: string;
};

type DashboardUser = {
  name?: string;
  email?: string;
  plan?: string;
  status?: string;
};

type DashboardPayload = {
  stats?: DashboardStat[];
  alerts?: DashboardAlert[];
  notifications?: DashboardNotification[];
  users?: DashboardUser[];
  revenueMetrics?: RevenueMetrics;
  ws?: {
    provider?: string;
    ticks?: number;
    uptime?: string;
    lastTick?: string;
  };
};

const formatMetricLabel = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

export default function AdminDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);

  const isAdmin = Boolean(user?.isAdmin);

  const loadDashboard = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setIsLoading(true);
      try {
        const data = await apiAuthGet<DashboardPayload>('/api/admin/dashboard');
        setPayload(data);
      } catch (error) {
        Alert.alert('Dashboard error', error instanceof Error ? error.message : 'Unable to load admin dashboard.');
      } finally {
        if (!opts.silent) setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      navigation.replace('Welcome');
      return;
    }
    if (!isAdmin) {
      navigation.replace('Main');
      return;
    }
    void loadDashboard();
  }, [isAuthLoading, isAuthenticated, isAdmin, loadDashboard, navigation]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadDashboard({ silent: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDashboard]);

  const metricEntries = useMemo(
    () => Object.entries(payload?.revenueMetrics || {}).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    [payload?.revenueMetrics],
  );

  return (
    <ScreenWrapper style={styles.screen}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.surface, theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="h3" style={styles.title}>
              Admin Dashboard
            </Text>
            <Text variant="bodySmall" color={theme.colors.textSecondary}>
              Signed in as {user?.email || 'admin'}
            </Text>
          </View>
          <Button
            title="Open Trading App"
            onPress={() => navigation.replace('Main')}
            variant="outline"
            size="medium"
            style={styles.switchButton}
          />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
        >
          {isLoading && !payload ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <>
              <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text variant="body" style={styles.sectionTitle}>
                  Overview
                </Text>
                {(payload?.stats || []).map((stat, index) => (
                  <View key={`${stat.title || 'stat'}-${index}`} style={styles.row}>
                    <View style={styles.rowText}>
                      <Text variant="body" style={styles.rowTitle}>
                        {stat.title || 'Metric'}
                      </Text>
                      {stat.subtitle ? (
                        <Text variant="caption" color={theme.colors.textSecondary} style={styles.rowSubtitle}>
                          {stat.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Text variant="body" style={styles.rowValue}>
                      {String(stat.value ?? '-')}
                    </Text>
                  </View>
                ))}
              </Card>

              <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text variant="body" style={styles.sectionTitle}>
                  Revenue Metrics
                </Text>
                {metricEntries.length ? (
                  metricEntries.map(([key, value]) => (
                    <View key={key} style={styles.metricRow}>
                      <Text variant="bodySmall" color={theme.colors.textSecondary}>
                        {formatMetricLabel(key)}
                      </Text>
                      <Text variant="body" style={styles.metricValue}>
                        {String(value)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text variant="bodySmall" color={theme.colors.textSecondary}>
                    No metrics available.
                  </Text>
                )}
              </Card>

              <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text variant="body" style={styles.sectionTitle}>
                  Market Alerts
                </Text>
                {(payload?.alerts || []).slice(0, 6).map((alert, index) => (
                  <View key={`${alert.pair || 'pair'}-${index}`} style={styles.alertRow}>
                    <View style={styles.rowText}>
                      <Text variant="body" style={styles.rowTitle}>
                        {alert.pair || 'Unknown pair'}
                      </Text>
                      <Text variant="caption" color={theme.colors.textSecondary} style={styles.rowSubtitle}>
                        {(alert.severity || 'info').toUpperCase()} {alert.direction ? `• ${alert.direction}` : ''}
                      </Text>
                    </View>
                    <Text variant="body" style={styles.rowValue}>
                      {typeof alert.changePercent === 'number' ? `${alert.changePercent.toFixed(2)}%` : '-'}
                    </Text>
                  </View>
                ))}
              </Card>

              <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text variant="body" style={styles.sectionTitle}>
                  Recent Users
                </Text>
                {(payload?.users || []).slice(0, 6).map((entry, index) => (
                  <View key={`${entry.email || 'user'}-${index}`} style={styles.row}>
                    <View style={styles.rowText}>
                      <Text variant="body" style={styles.rowTitle}>
                        {entry.name || 'User'}
                      </Text>
                      <Text variant="caption" color={theme.colors.textSecondary} style={styles.rowSubtitle}>
                        {entry.email || 'No email'}
                      </Text>
                    </View>
                    <Text variant="bodySmall" color={theme.colors.textSecondary}>
                      {entry.status || entry.plan || '-'}
                    </Text>
                  </View>
                ))}
              </Card>

              <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text variant="body" style={styles.sectionTitle}>
                  System
                </Text>
                <View style={styles.metricRow}>
                  <Text variant="bodySmall" color={theme.colors.textSecondary}>
                    Provider
                  </Text>
                  <Text variant="body">{payload?.ws?.provider || '-'}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text variant="bodySmall" color={theme.colors.textSecondary}>
                    Ticks Today
                  </Text>
                  <Text variant="body">{String(payload?.ws?.ticks ?? '-')}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text variant="bodySmall" color={theme.colors.textSecondary}>
                    Uptime
                  </Text>
                  <Text variant="body">{payload?.ws?.uptime || '-'}</Text>
                </View>
              </Card>

              <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text variant="body" style={styles.sectionTitle}>
                  Notifications
                </Text>
                {(payload?.notifications || []).slice(0, 6).map((entry, index) => (
                  <View key={`${entry.time || 'notice'}-${index}`} style={styles.row}>
                    <View style={styles.rowText}>
                      <Text variant="bodySmall">{entry.message || '-'}</Text>
                    </View>
                    <Text variant="caption" color={theme.colors.textSecondary}>
                      {entry.time || '-'}
                    </Text>
                  </View>
                ))}
              </Card>
            </>
          )}
        </ScrollView>
      </LinearGradient>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: 'transparent',
  },
  background: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  headerText: {
    flex: 1,
  },
  title: {
    marginBottom: 2,
  },
  switchButton: {
    minWidth: 150,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    gap: 12,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontWeight: '600',
  },
  rowSubtitle: {
    marginTop: 2,
    lineHeight: 16,
  },
  rowValue: {
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  metricValue: {
    fontWeight: '700',
  },
  alertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
  },
});
