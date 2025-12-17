import React from 'react';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface IconProps {
  size?: number;
  color?: string;
}

export const MarketIcon: React.FC<IconProps> = ({ size = 24, color = '#fff' }) => {
  return <Icon name="show-chart" size={size} color={color} />;
};

