import React from 'react';
import type { ComponentProps } from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Text } from '../common';
import { colors, spacing } from '../../theme';

interface EmptyStateProps {
  icon?: ComponentProps<typeof Icon>['name'];
  title: string;
  message?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  message,
}) => {
  return (
    <View style={styles.container}>
      <Icon name={icon} size={64} color={colors.textSecondary} />
      <Text variant="h3" style={styles.title}>{title}</Text>
      {message && (
        <Text variant="bodySmall" color={colors.textSecondary} style={styles.message}>
          {message}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  title: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
