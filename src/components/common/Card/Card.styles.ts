import { StyleSheet } from 'react-native';
import { colors, spacing, shadows } from '../../../theme';

export const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    ...shadows.small,
  },
  pressable: {
    ...shadows.small,
  },
});

