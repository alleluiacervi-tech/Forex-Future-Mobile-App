import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';

export default function SettingsScreen() {
  const theme = useTheme();
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
    <ScreenWrapper>
      <ScrollView style={styles.scrollView}>
        <Container>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <Icon name="account-circle" size={64} color={theme.colors.primary} />
            </View>
            <Text variant="h3">Trader Account</Text>
            <Text variant="bodySmall" color={theme.colors.textSecondary}>
              trader@example.com
            </Text>
          </View>

          {/* Settings List */}
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

