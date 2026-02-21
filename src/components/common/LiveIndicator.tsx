import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Text } from '../common';
import { useTheme } from '../../hooks';

interface LiveIndicatorProps {
  size?: 'small' | 'medium';
  label?: string;
  isLive?: boolean;
}

export default function LiveIndicator({ size = 'small', label, isLive = true }: LiveIndicatorProps) {
  const theme = useTheme();
  const dotSize = size === 'small' ? 6 : 8;
  const fontSize = size === 'small' ? 'caption' : 'bodySmall';
  const color = isLive ? theme.colors.success : theme.colors.textSecondary;
  const resolvedLabel = label || (isLive ? 'Live' : 'Closed');

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            backgroundColor: color,
          },
        ]}
      />
      <Text variant={fontSize} color={color} style={styles.text}>
        {resolvedLabel}
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
