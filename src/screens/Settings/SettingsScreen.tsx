import React, { useState, useEffect, useCallback } from 'react';
import type { ComponentProps } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import TopNavBar from '../../components/navigation/TopNavBar';
import { useTheme } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { apiAuthGet, apiAuthPut } from '../../services/api';
import { resetToLanding } from '../../navigation/rootNavigation'; // ADDED: navigate after logout
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Preferences = {
  notifications: boolean;
  pushAlerts: boolean;
  emailAlerts: boolean;
  theme: string;
  language: string;
};

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pushAlertsEnabled, setPushAlertsEnabled] = useState(true);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);

  const fetchPreferences = useCallback(async () => {
    try {
      const data = await apiAuthGet<{ preferences: Preferences }>('/api/preferences');
      if (data?.preferences) {
        setNotificationsEnabled(data.preferences.notifications);
        setPushAlertsEnabled(data.preferences.pushAlerts);
        setEmailAlertsEnabled(data.preferences.emailAlerts);
      }
    } catch {
      // Use defaults on failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreference = async (field: string, value: boolean) => {
    try {
      await apiAuthPut('/api/preferences', { [field]: value });
    } catch (error) {
      Alert.alert('Error', 'Failed to save preference. Please try again.');
      // Revert on failure
      fetchPreferences();
    }
  };

  const handleNotificationsChange = (value: boolean) => {
    setNotificationsEnabled(value);
    updatePreference('notifications', value);
  };

  const handlePushAlertsChange = (value: boolean) => {
    setPushAlertsEnabled(value);
    updatePreference('pushAlerts', value);
  };

  const handleEmailAlertsChange = (value: boolean) => {
    setEmailAlertsEnabled(value);
    updatePreference('emailAlerts', value);
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch {
            // FIX: logout never throws now, but fallback just in case
          } finally {
            // FIX: always navigate to Landing after logout
            resetToLanding();
          }
        },
      },
    ]);
  };

  type IconName = ComponentProps<typeof Icon>['name'];
  const settingsItems: Array<{
    id: string;
    title: string;
    icon: IconName;
    onPress: () => void;
    hasSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void;
    isDestructive?: boolean;
  }> = [
    {
      id: 'account',
      title: 'Account Settings',
      icon: 'account-circle',
      onPress: () => navigation.navigate('Security'),
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: 'notifications',
      onPress: () => {},
      hasSwitch: true,
      switchValue: notificationsEnabled,
      onSwitchChange: handleNotificationsChange,
    },
    {
      id: 'push',
      title: 'Push Alerts',
      icon: 'notifications-active',
      onPress: () => {},
      hasSwitch: true,
      switchValue: pushAlertsEnabled,
      onSwitchChange: handlePushAlertsChange,
    },
    {
      id: 'email',
      title: 'Email Alerts',
      icon: 'email',
      onPress: () => {},
      hasSwitch: true,
      switchValue: emailAlertsEnabled,
      onSwitchChange: handleEmailAlertsChange,
    },
    {
      id: 'risk',
      title: 'Risk Management',
      icon: 'security',
      onPress: () => navigation.navigate('RiskDisclosure'),
    },
    {
      id: 'about',
      title: 'About',
      icon: 'info',
      onPress: () => {
        navigation.navigate('About');
      },
    },
    {
      id: 'help',
      title: 'Help & Support',
      icon: 'help',
      onPress: () => navigation.navigate('HelpCenter'),
    },
    {
      id: 'logout',
      title: 'Logout',
      icon: 'logout',
      onPress: handleLogout,
      isDestructive: true,
    },
  ];

  return (
    <ScreenWrapper>
      <TopNavBar />
      <ScrollView style={styles.scrollView}>
        <Container>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <Icon name="account-circle" size={64} color={theme.colors.primary} />
            </View>
            <Text variant="h3">{user?.name || 'Trader Account'}</Text>
            <Text variant="bodySmall" color={theme.colors.textSecondary}>
              {user?.email || 'trader@example.com'}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            /* Settings List */
            <View style={styles.settingsList}>
              {settingsItems.map((item) => (
                <Card key={item.id} style={styles.settingItem} onPress={item.onPress}>
                  <View style={styles.settingLeft}>
                    <Icon
                      name={item.icon}
                      size={24}
                      color={item.isDestructive ? theme.colors.error : theme.colors.primary}
                    />
                    <Text
                      variant="body"
                      color={item.isDestructive ? theme.colors.error : theme.colors.text}
                    >
                      {item.title}
                    </Text>
                  </View>
                  {item.hasSwitch ? (
                    <Switch
                      value={item.switchValue}
                      onValueChange={item.onSwitchChange}
                      trackColor={{ false: '#767577', true: theme.colors.primary }}
                      thumbColor="#fff"
                    />
                  ) : (
                    <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
                  )}
                </Card>
              ))}
            </View>
          )}

          {/* App Version */}
          <View style={styles.versionContainer}>
            <Text variant="caption" color={theme.colors.textSecondary}>
              Version 1.0.0
            </Text>
          </View>
        </Container>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    padding: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: 8,
  },
  avatar: {
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  settingsList: {
    paddingVertical: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  versionContainer: {
    alignItems: 'center',
    padding: 24,
  },
});
