import React from 'react';
import Icon from 'react-native-vector-icons/Ionicons';

interface IconProps {
  size?: number;
  color?: string;
}

export const ProfileIcon: React.FC<IconProps> = ({ size = 24, color = '#fff' }) => {
  return <Icon name="person-circle-outline" size={size} color={color} />;
};

