import React, { useCallback, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Container, EmptyState } from '../../components/layout';
import { Card, Text } from '../../components/common';
import TopNavBar from '../../components/navigation/TopNavBar';
import { useTheme } from '../../hooks';
import { apiAuthGet, apiAuthPut } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../../types';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Notifications'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  data?: any;
  createdAt: string;
};

export default function NotificationsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const data = await apiAuthGet<{ notifications: Notification[] }>('/api/notifications?limit=50');
      setNotifications(data?.notifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchNotifications();
    } finally {
      setRefreshing(false);
    }
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await apiAuthPut(`/api/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      // Silently fail
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiAuthPut('/api/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // Silently fail
    }
  }, []);

  const handleNotificationPress = useCallback((notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    // Navigate to relevant screen based on notification data
    if (notification.data?.pair) {
      navigation.navigate('CurrencyDetail', { pair: notification.data.pair });
    }
  }, [markAsRead, navigation]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert': return 'notifications-active';
      case 'trade': return 'swap-horiz';
      case 'system': return 'info';
      case 'promo': return 'local-offer';
      default: return 'notifications';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'alert': return '#FF9800';
      case 'trade': return '#4CAF50';
      case 'system': return '#2196F3';
      case 'promo': return '#9C27B0';
      default: return theme.colors.textSecondary;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <ScreenWrapper>
      <TopNavBar />
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Container>
          <View style={styles.headerRow}>
            <Text variant="h3" style={styles.title}>
              Notifications
            </Text>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
                <Text variant="bodySmall" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                  Mark all read
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: `${theme.colors.primary}14` }]}>
              <Text variant="bodySmall" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                {unreadCount} unread
              </Text>
            </View>
          )}

          {notifications.length === 0 ? (
            <EmptyState
              icon="notifications-none"
              title="No Notifications"
              message={
                error
                  ? `Unable to load notifications: ${error}`
                  : loading
                    ? 'Loading notifications...'
                    : "You don't have any notifications yet"
              }
            />
          ) : (
            notifications.map((notification) => (
              <Card
                key={notification.id}
                style={[
                  styles.notificationCard,
                  { backgroundColor: theme.colors.surface },
                  !notification.read && { borderLeftWidth: 3, borderLeftColor: theme.colors.primary },
                ]}
                onPress={() => handleNotificationPress(notification)}
              >
                <View style={styles.notificationRow}>
                  <View style={[styles.iconCircle, { backgroundColor: `${getTypeColor(notification.type)}14` }]}>
                    <Icon name={getTypeIcon(notification.type)} size={20} color={getTypeColor(notification.type)} />
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text
                        variant="body"
                        style={[styles.notificationTitle, !notification.read && { fontWeight: '800' }]}
                        numberOfLines={1}
                      >
                        {notification.title}
                      </Text>
                      <Text variant="caption" color={theme.colors.textSecondary}>
                        {formatTime(notification.createdAt)}
                      </Text>
                    </View>
                    <Text
                      variant="bodySmall"
                      color={theme.colors.textSecondary}
                      numberOfLines={2}
                      style={styles.notificationBody}
                    >
                      {notification.body}
                    </Text>
                  </View>
                  {!notification.read && (
                    <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />
                  )}
                </View>
              </Card>
            ))
          )}
        </Container>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    marginBottom: 12,
  },
  unreadBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  notificationCard: {
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  notificationBody: {
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    marginLeft: 4,
  },
});
