import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MainTabParamList, RootStackParamList } from '../../types';
import { useTheme } from '../../hooks';
import { Text } from '../common';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function TopNavBar() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const active = route.name;

  const goTab = (name: keyof MainTabParamList) => {
    if (active === 'Home' || active === 'Market' || active === 'Notifications' || active === 'Profile') {
      navigation.navigate(name);
      return;
    }

    navigation.navigate('Main', { screen: name } as any);
  };
  const goSettings = () => navigation.navigate('Settings');

  const isActive = (name: string) => active === name;
  const iconColor = (name: string) => (isActive(name) ? theme.colors.primary : theme.colors.textSecondary);

  const renderItem = (opts: {
    key: string;
    label: string;
    icon: string;
    activeIcon?: string;
    onPress: () => void;
  }) => {
    const selected = isActive(opts.key);
    const bg = selected ? `${theme.colors.primary}20` : `${theme.colors.surfaceLight}55`;
    const border = selected ? `${theme.colors.primary}55` : theme.colors.border;
    const iconName = selected && opts.activeIcon ? opts.activeIcon : opts.icon;

    return (
      <TouchableOpacity
        key={opts.key}
        onPress={opts.onPress}
        activeOpacity={0.82}
        style={[
          styles.pill,
          {
            backgroundColor: bg,
            borderColor: border,
          },
          selected && styles.pillActive,
        ]}
      >
        <Icon name={iconName} size={22} color={iconColor(opts.key)} />
        <Text
          variant="caption"
          style={[
            styles.pillLabel,
            {
              color: selected ? theme.colors.primary : theme.colors.textSecondary,
            },
          ]}
        >
          {opts.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
          shadowColor: '#000',
        },
      ]}
    >
      <View style={styles.group}>
        {renderItem({
          key: 'Home',
          label: 'Home',
          icon: 'insights',
          activeIcon: 'insights',
          onPress: () => goTab('Home'),
        })}
        {renderItem({
          key: 'Market',
          label: 'Market',
          icon: 'show-chart',
          activeIcon: 'trending-up',
          onPress: () => goTab('Market'),
        })}
        {renderItem({
          key: 'Notifications',
          label: 'Alerts',
          icon: 'notifications-none',
          activeIcon: 'notifications-active',
          onPress: () => goTab('Notifications'),
        })}
      </View>

      <View style={styles.group}>
        {renderItem({
          key: 'Settings',
          label: 'Settings',
          icon: 'tune',
          activeIcon: 'settings',
          onPress: goSettings,
        })}
        {renderItem({
          key: 'Profile',
          label: 'Profile',
          icon: 'account-circle',
          onPress: () => goTab('Profile'),
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 12,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    width: 64,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  pillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  pillLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
