import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout';
import { Button, Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { apiAuthGet, apiPost, apiAuthPut, apiAuthDelete } from '../../services/api';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'AdminUserDetail'>;

type Sub = {
  id: number;
  plan: string;
  status: string;
  amount: number;
  currentPeriodEnd: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  discountPercent: number | null;
  discountReason: string | null;
  isFree: boolean;
  overrideReason: string | null;
  trialExtendCount: number;
};

type UserDetail = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  isAdmin: boolean;
  emailVerified: boolean;
  trialActive: boolean;
  trialStartedAt: string | null;
  lastLogin: string | null;
  createdAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  deletedAt: string | null;
  notes: string | null;
  adminCreated: boolean;
  subscriptions: Sub[];
  pushTokens: { id: string; platform: string }[];
};

type AuditEntry = {
  id: number;
  actionType: string;
  description: string;
  createdAt: string;
};

type AlertEntry = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

type UserDetailResponse = {
  user: UserDetail;
  recentAlerts: AlertEntry[];
  adminActions: AuditEntry[];
};

export default function AdminUserDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const theme = useTheme();
  const { userId } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [actions, setActions] = useState<AuditEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [trialDays, setTrialDays] = useState('7');
  const [discountPct, setDiscountPct] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [busy, setBusy] = useState('');

  const fetchUser = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiAuthGet<UserDetailResponse>(`/api/admin/users/${userId}`);
      setUser(data.user);
      setAlerts(data.recentAlerts || []);
      setActions(data.adminActions || []);
      setNotes(data.user?.notes || '');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUser(true);
    setRefreshing(false);
  }, [fetchUser]);

  const doAction = useCallback(async (
    label: string,
    path: string,
    method: 'post' | 'put' | 'delete',
    body?: Record<string, unknown>,
    confirm = true,
  ) => {
    const run = async () => {
      setBusy(label);
      try {
        if (method === 'post') await apiPost(path, body || {});
        else if (method === 'put') await apiAuthPut(path, body || {});
        else if (method === 'delete') await apiAuthDelete(path);
        await fetchUser(true);
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : `Failed: ${label}`);
      } finally {
        setBusy('');
      }
    };

    if (confirm) {
      Alert.alert('Confirm', `Are you sure you want to ${label.toLowerCase()}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'destructive', onPress: run },
      ]);
    } else {
      await run();
    }
  }, [fetchUser]);

  const sub = user?.subscriptions?.[0] || null;

  const saveNotes = useCallback(async () => {
    try {
      await apiAuthPut(`/api/admin/users/${userId}/notes`, { notes });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save notes');
    }
  }, [userId, notes]);

  if (loading) {
    return (
      <ScreenWrapper style={styles.screen}>
        <LinearGradient colors={[theme.colors.background, theme.colors.surface, theme.colors.background]} style={styles.bg}>
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        </LinearGradient>
      </ScreenWrapper>
    );
  }

  if (!user) {
    return (
      <ScreenWrapper style={styles.screen}>
        <LinearGradient colors={[theme.colors.background, theme.colors.surface, theme.colors.background]} style={styles.bg}>
          <Text variant="body" color={theme.colors.error} style={styles.empty}>User not found.</Text>
        </LinearGradient>
      </ScreenWrapper>
    );
  }

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
          <Text variant="h4" style={styles.headerTitle} numberOfLines={1}>{user.name}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
        >
          {/* User Info */}
          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="body" style={styles.sectionTitle}>User Info</Text>
            <InfoRow label="Email" value={user.email} colors={theme.colors} />
            <InfoRow label="Status" value={user.deletedAt ? 'Deleted' : user.suspendedAt ? 'Suspended' : user.isActive ? 'Active' : 'Inactive'} colors={theme.colors} />
            <InfoRow label="Admin" value={user.isAdmin ? 'Yes' : 'No'} colors={theme.colors} />
            <InfoRow label="Email Verified" value={user.emailVerified ? 'Yes' : 'No'} colors={theme.colors} />
            <InfoRow label="Created" value={new Date(user.createdAt).toLocaleDateString()} colors={theme.colors} />
            <InfoRow label="Last Login" value={user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'} colors={theme.colors} />
            {user.suspendedAt && <InfoRow label="Suspend Reason" value={user.suspendedReason || 'None'} colors={theme.colors} />}
            {user.adminCreated && <InfoRow label="Admin Created" value="Yes" colors={theme.colors} />}
            <InfoRow label="Push Tokens" value={`${user.pushTokens?.length || 0} active`} colors={theme.colors} />
          </Card>

          {/* Quick Actions */}
          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="body" style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {!user.suspendedAt && !user.deletedAt && (
                <Button
                  title={busy === 'Suspend' ? 'Suspending...' : 'Suspend'}
                  variant="danger"
                  size="small"
                  disabled={!!busy}
                  onPress={() => doAction('Suspend', `/api/admin/users/${userId}/suspend`, 'post', { reason: actionReason || undefined })}
                />
              )}
              {user.suspendedAt && (
                <Button
                  title={busy === 'Unsuspend' ? 'Restoring...' : 'Unsuspend'}
                  variant="primary"
                  size="small"
                  disabled={!!busy}
                  onPress={() => doAction('Unsuspend', `/api/admin/users/${userId}/unsuspend`, 'post')}
                />
              )}
              {!user.deletedAt && (
                <Button
                  title={busy === 'Delete' ? 'Deleting...' : 'Delete'}
                  variant="danger"
                  size="small"
                  disabled={!!busy}
                  onPress={() => doAction('Delete', `/api/admin/users/${userId}`, 'delete')}
                />
              )}
              {user.deletedAt && (
                <Button
                  title={busy === 'Restore' ? 'Restoring...' : 'Restore'}
                  variant="primary"
                  size="small"
                  disabled={!!busy}
                  onPress={() => doAction('Restore', `/api/admin/users/${userId}/restore`, 'post')}
                />
              )}
              <Button
                title={busy === 'Reset Password' ? 'Resetting...' : 'Reset Password'}
                variant="outline"
                size="small"
                disabled={!!busy}
                onPress={() => doAction('Reset Password', `/api/admin/users/${userId}/reset-password`, 'post')}
              />
            </View>
            <TextInput
              style={[styles.reasonInput, { color: theme.colors.text, backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.border }]}
              placeholder="Reason (optional)"
              placeholderTextColor={theme.colors.textDisabled}
              value={actionReason}
              onChangeText={setActionReason}
            />
          </Card>

          {/* Subscription Status */}
          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="body" style={styles.sectionTitle}>Subscription</Text>
            {sub ? (
              <>
                <InfoRow label="Plan" value={sub.plan} colors={theme.colors} />
                <InfoRow label="Status" value={sub.status} colors={theme.colors} />
                <InfoRow label="Period End" value={sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A'} colors={theme.colors} />
                {sub.isFree && <InfoRow label="Free Access" value="Yes" colors={theme.colors} />}
                {sub.discountPercent && <InfoRow label="Discount" value={`${sub.discountPercent}%`} colors={theme.colors} />}
                {sub.trialExtendCount > 0 && <InfoRow label="Trial Extensions" value={String(sub.trialExtendCount)} colors={theme.colors} />}
              </>
            ) : (
              <Text variant="bodySmall" color={theme.colors.textSecondary}>No subscription found.</Text>
            )}
          </Card>

          {/* Subscription Actions */}
          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="body" style={styles.sectionTitle}>Subscription Actions</Text>

            {/* Activate Trial */}
            <View style={styles.actionBlock}>
              <Text variant="bodySmall" color={theme.colors.textSecondary}>Trial Days:</Text>
              <View style={styles.inlineRow}>
                <TextInput
                  style={[styles.smallInput, { color: theme.colors.text, backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.border }]}
                  value={trialDays}
                  onChangeText={setTrialDays}
                  keyboardType="number-pad"
                />
                <Button
                  title="Activate Trial"
                  size="small"
                  variant="outline"
                  disabled={!!busy}
                  onPress={() => doAction('Activate Trial', `/api/admin/users/${userId}/activate-trial`, 'post', { days: parseInt(trialDays, 10) || 7, reason: actionReason || undefined }, false)}
                />
              </View>
            </View>

            {/* Activate Subscription */}
            <View style={styles.actionBlock}>
              <Button
                title="Grant Active Subscription"
                size="small"
                variant="outline"
                disabled={!!busy}
                onPress={() => doAction('Activate Subscription', `/api/admin/users/${userId}/activate-subscription`, 'post', { plan: 'annual', months: 12, reason: actionReason || undefined })}
              />
            </View>

            {/* Discount */}
            <View style={styles.actionBlock}>
              <Text variant="bodySmall" color={theme.colors.textSecondary}>Discount %:</Text>
              <View style={styles.inlineRow}>
                <TextInput
                  style={[styles.smallInput, { color: theme.colors.text, backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.border }]}
                  value={discountPct}
                  onChangeText={setDiscountPct}
                  keyboardType="number-pad"
                  placeholder="e.g. 25"
                  placeholderTextColor={theme.colors.textDisabled}
                />
                <Button
                  title="Apply"
                  size="small"
                  variant="outline"
                  disabled={!!busy || !discountPct}
                  onPress={() => doAction('Apply Discount', `/api/admin/users/${userId}/apply-discount`, 'post', { discountPercent: parseInt(discountPct, 10), reason: actionReason || undefined }, false)}
                />
                {sub?.discountPercent ? (
                  <Button
                    title="Remove"
                    size="small"
                    variant="danger"
                    disabled={!!busy}
                    onPress={() => doAction('Remove Discount', `/api/admin/users/${userId}/remove-discount`, 'post')}
                  />
                ) : null}
              </View>
            </View>

            {/* Cancel / Free Access */}
            <View style={styles.actionBlock}>
              <View style={styles.inlineRow}>
                <Button
                  title="Cancel Sub"
                  size="small"
                  variant="danger"
                  disabled={!!busy}
                  onPress={() => doAction('Cancel Subscription', `/api/admin/users/${userId}/cancel-subscription`, 'post', { reason: actionReason || undefined })}
                />
                {!sub?.isFree ? (
                  <Button
                    title="Grant Free"
                    size="small"
                    variant="primary"
                    disabled={!!busy}
                    onPress={() => doAction('Grant Free Access', `/api/admin/users/${userId}/grant-free-access`, 'post', { reason: actionReason || undefined })}
                  />
                ) : (
                  <Button
                    title="Revoke Free"
                    size="small"
                    variant="danger"
                    disabled={!!busy}
                    onPress={() => doAction('Revoke Free Access', `/api/admin/users/${userId}/revoke-free-access`, 'post')}
                  />
                )}
              </View>
            </View>
          </Card>

          {/* Admin Notes */}
          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="body" style={styles.sectionTitle}>Admin Notes</Text>
            <TextInput
              style={[styles.notesInput, { color: theme.colors.text, backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.border }]}
              value={notes}
              onChangeText={setNotes}
              onBlur={saveNotes}
              placeholder="Private notes about this user..."
              placeholderTextColor={theme.colors.textDisabled}
              multiline
              numberOfLines={4}
            />
          </Card>

          {/* Alert History */}
          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="body" style={styles.sectionTitle}>Alert History</Text>
            {alerts.length === 0 ? (
              <Text variant="bodySmall" color={theme.colors.textSecondary}>No alerts.</Text>
            ) : (
              alerts.map((a) => (
                <View key={a.id} style={styles.histRow}>
                  <View style={styles.histLeft}>
                    <Text variant="bodySmall" style={styles.histTitle}>{a.title}</Text>
                    <Text variant="caption" color={theme.colors.textSecondary} numberOfLines={1}>{a.body}</Text>
                  </View>
                  <Text variant="caption" color={theme.colors.textDisabled}>
                    {new Date(a.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ))
            )}
          </Card>

          {/* Admin Action Log */}
          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="body" style={styles.sectionTitle}>Admin Action Log</Text>
            {actions.length === 0 ? (
              <Text variant="bodySmall" color={theme.colors.textSecondary}>No actions recorded.</Text>
            ) : (
              actions.map((a) => (
                <View key={a.id} style={styles.histRow}>
                  <View style={styles.histLeft}>
                    <Text variant="bodySmall" style={styles.histTitle}>{a.actionType.replace(/_/g, ' ')}</Text>
                    <Text variant="caption" color={theme.colors.textSecondary} numberOfLines={2}>{a.description}</Text>
                  </View>
                  <Text variant="caption" color={theme.colors.textDisabled}>
                    {new Date(a.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      </LinearGradient>
    </ScreenWrapper>
  );
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: Record<string, string> }) {
  return (
    <View style={infoStyles.row}>
      <Text variant="bodySmall" color={colors.textSecondary}>{label}</Text>
      <Text variant="body" style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, gap: 10 },
  value: { fontWeight: '600' },
});

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' },
  bg: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontWeight: '700', flex: 1, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 30, gap: 12 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  empty: { textAlign: 'center', paddingVertical: 40 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12 },
  sectionTitle: { fontWeight: '700', marginBottom: 8 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  reasonInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, marginTop: 4 },
  actionBlock: { marginBottom: 10 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  smallInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, width: 70 },
  notesInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6, gap: 10 },
  histLeft: { flex: 1 },
  histTitle: { fontWeight: '600', textTransform: 'capitalize' },
});
