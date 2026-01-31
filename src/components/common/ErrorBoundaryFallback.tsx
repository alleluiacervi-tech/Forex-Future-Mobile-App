import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Text } from '../common';
import { useTheme } from '../../hooks';

interface ErrorBoundaryFallbackProps {
  error?: Error;
  onRetry?: () => void;
  message?: string;
}

export default function ErrorBoundaryFallback({ error, onRetry, message }: ErrorBoundaryFallbackProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.error }]}>
      <Icon name="error-outline" size={32} color={theme.colors.error} />
      <Text variant="body" color={theme.colors.error} style={styles.title}>
        {message || 'Something went wrong'}
      </Text>
      {error?.message && (
        <Text variant="caption" color={theme.colors.textSecondary} style={styles.subtitle}>
          {error.message}
        </Text>
      )}
      {onRetry && (
        <Pressable onPress={onRetry} style={[styles.retryButton, { backgroundColor: theme.colors.error }]}>
          <Text variant="bodySmall" style={styles.retryText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    borderRadius: 12,
    margin: 16,
  },
  title: {
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
  },
});
