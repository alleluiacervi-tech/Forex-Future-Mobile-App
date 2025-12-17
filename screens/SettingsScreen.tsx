import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [soundEnabled, setSoundEnabled] = React.useState(true);

  const settingsItems = [
    {
      id: 'account',
      title: 'Account Settings',
      icon: 'account-circle',
      onPress: () => {},
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: 'notifications',
      onPress: () => {},
      hasSwitch: true,
      switchValue: notificationsEnabled,
      onSwitchChange: setNotificationsEnabled,
    },
    {
      id: 'sound',
      title: 'Sound Alerts',
      icon: 'volume-up',
      onPress: () => {},
      hasSwitch: true,
      switchValue: soundEnabled,
      onSwitchChange: setSoundEnabled,
    },
    {
      id: 'risk',
      title: 'Risk Management',
      icon: 'security',
      onPress: () => {},
    },
    {
      id: 'about',
      title: 'About',
      icon: 'info',
      onPress: () => {},
    },
    {
      id: 'help',
      title: 'Help & Support',
      icon: 'help',
      onPress: () => {},
    },
    {
      id: 'logout',
      title: 'Logout',
      icon: 'logout',
      onPress: () => {},
      isDestructive: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Icon name="account-circle" size={64} color="#4CAF50" />
          </View>
          <Text style={styles.profileName}>Trader Account</Text>
          <Text style={styles.profileEmail}>trader@example.com</Text>
        </View>

        {/* Settings List */}
        <View style={styles.settingsList}>
          {settingsItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.settingItem}
              onPress={item.onPress}
            >
              <View style={styles.settingLeft}>
                <Icon
                  name={item.icon}
                  size={24}
                  color={item.isDestructive ? '#f44336' : '#4CAF50'}
                />
                <Text
                  style={[
                    styles.settingText,
                    item.isDestructive && styles.settingTextDestructive,
                  ]}
                >
                  {item.title}
                </Text>
              </View>
              {item.hasSwitch ? (
                <Switch
                  value={item.switchValue}
                  onValueChange={item.onSwitchChange}
                  trackColor={{ false: '#767577', true: '#4CAF50' }}
                  thumbColor="#fff"
                />
              ) : (
                <Icon name="chevron-right" size={24} color="#9e9e9e" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    padding: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  avatar: {
    marginBottom: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#9e9e9e',
  },
  settingsList: {
    paddingVertical: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  settingText: {
    fontSize: 16,
    color: '#fff',
  },
  settingTextDestructive: {
    color: '#f44336',
  },
  versionContainer: {
    alignItems: 'center',
    padding: 24,
  },
  versionText: {
    fontSize: 12,
    color: '#666',
  },
});

