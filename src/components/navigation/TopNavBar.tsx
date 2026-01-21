import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { MainTabParamList, RootStackParamList } from '../../types';
import { useTheme } from '../../hooks';

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
    icon: string;
    activeIcon?: string;
    onPress: () => void;
  }) => {
    const selected = isActive(opts.key);
    const iconName = selected && opts.activeIcon ? opts.activeIcon : opts.icon;

    return (
      <TouchableOpacity
        key={opts.key}
        onPress={opts.onPress}
        activeOpacity={0.7}
        style={styles.navButton}
      >
        <View
          style={[
            styles.iconWrapper,
            selected && [
              styles.iconWrapperActive,
              {
                backgroundColor: `${theme.colors.primary}1A`,
                borderColor: theme.colors.primary,
              },
            ],
          ]}
        >
          <Icon name={iconName} size={24} color={iconColor(opts.key)} />
          {selected && (
            <View style={[styles.activeIndicator, { backgroundColor: theme.colors.accent }]} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceLight,
          borderBottomColor: theme.colors.borderLight,
        },
      ]}
    >
      {renderItem({
        key: 'Home',
        icon: 'grid-outline',
        activeIcon: 'grid',
        onPress: () => goTab('Home'),
      })}
      {renderItem({
        key: 'Market',
        icon: 'stats-chart-outline',
        activeIcon: 'stats-chart',
        onPress: () => goTab('Market'),
      })}
      {renderItem({
        key: 'Notifications',
        icon: 'notifications-outline',
        activeIcon: 'notifications',
        onPress: () => goTab('Notifications'),
      })}
      {renderItem({
        key: 'Profile',
        icon: 'person-circle-outline',
        activeIcon: 'person-circle',
        onPress: () => goTab('Profile'),
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRadius: 14,
  },
  iconWrapperActive: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -8,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
