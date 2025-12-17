import React from 'react';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface IconProps {
  size?: number;
  color?: string;
}

export const HomeIcon: React.FC<IconProps> = ({ size = 24, color = '#fff' }) => {
  return <Icon name="home" size={size} color={color} />;
};

