import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { CardProps } from './Card.types';
import { cardStyles } from './Card.styles';

export const Card: React.FC<CardProps> = ({ children, style, onPress }) => {
  if (onPress) {
    return (
      <TouchableOpacity
        style={[cardStyles.card, cardStyles.pressable, style]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[cardStyles.card, style]}>{children}</View>;
};

