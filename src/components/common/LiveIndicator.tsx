import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Text } from '../common';
import { useTheme } from '../../hooks';

interface LiveIndicatorProps {
  size?: 'small' | 'medium';
  label?: string;
}

export default function LiveIndicator({ size = 'small', label }: LiveIndicatorProps) {
  const theme = useTheme();
  const dotSize = size === 'small' ? 6 : 8;
  const fontSize = size === 'small' ? 'caption' : 'bodySmall';

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            backgroundColor: theme.colors.success,
          },
        ]}
      />
      <Text variant={fontSize} color={theme.colors.success} style={styles.text}>
        {label || 'Live'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    borderRadius: 999,
  },
  text: {
    fontWeight: '500',
  },
});
