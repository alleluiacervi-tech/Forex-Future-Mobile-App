import { colors } from '../theme';

export const NAVIGATION_CONFIG = {
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textSecondary,
  headerStyle: {
    backgroundColor: colors.surface,
  },
  headerTintColor: colors.text,
  tabBarStyle: {
    backgroundColor: colors.surfaceLight,
    borderTopColor: colors.borderLight,
  },
} as const;
