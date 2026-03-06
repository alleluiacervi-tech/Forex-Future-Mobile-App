// ADDED: trial enforcement banners (CHECK 3)
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Text } from './Text';
import { colors } from '../../theme';

type TrialBannerProps = {
  variant: 'ending_soon' | 'expired' | 'cancelled';
  daysLeft?: number | null;
  onPress: () => void;
};

export const TrialBanner: React.FC<TrialBannerProps> = ({ variant, daysLeft, onPress }) => {
  let backgroundColor: string;
  let iconName: string;
  let message: string;
  let actionText: string;

  switch (variant) {
    case 'ending_soon':
      backgroundColor = '#92400e';
      iconName = 'warning';
      message = daysLeft === 1 ? 'Trial ends tomorrow' : `Trial ends in ${daysLeft} days`;
      actionText = 'Subscribe now';
      break;
    case 'expired':
      backgroundColor = '#991b1b';
      iconName = 'error';
      message = 'Your subscription has expired';
      actionText = 'Renew';
      break;
    case 'cancelled':
      backgroundColor = '#78350f';
      iconName = 'info';
      message = 'Subscription cancelled — access until end of period';
      actionText = 'Re-subscribe';
      break;
  }

  return (
    <TouchableOpacity style={[styles.banner, { backgroundColor }]} onPress={onPress} activeOpacity={0.8}>
      <Icon name={iconName as any} size={18} color="#fff" />
      <Text variant="bodySmall" style={styles.text}>
        {message}
      </Text>
      <View style={styles.actionContainer}>
        <Text variant="bodySmall" style={styles.actionText}>
          {actionText}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  text: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    flex: 1,
  },
  actionContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  actionText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
});
