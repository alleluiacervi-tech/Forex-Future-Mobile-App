// ADDED: offline banner component (CHECK 6)
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Text } from './Text';

export const OfflineBanner: React.FC = () => {
  return (
    <View style={styles.banner}>
      <Icon name="cloud-off" size={16} color="#fff" />
      <Text variant="bodySmall" style={styles.text}>
        No internet connection
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b91c1c',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});
