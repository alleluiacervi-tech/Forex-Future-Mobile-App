import React from 'react';
import { Ionicons as Icon } from '@expo/vector-icons';

interface IconProps {
  size?: number;
  color?: string;
}

export const SettingsIcon: React.FC<IconProps> = ({ size = 24, color = '#fff' }) => {
  return <Icon name="settings-outline" size={size} color={color} />;
};
