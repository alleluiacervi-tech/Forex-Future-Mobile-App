import React from 'react';
import { Text as RNText } from 'react-native';
import { TextProps } from './Text.types';
import { textStyles } from './Text.styles';
import { useTheme } from '../../../hooks';

export const Text: React.FC<TextProps> = ({
  children,
  variant = 'body',
  color,
  style,
}) => {
  const theme = useTheme();
  const textColor = color || theme.colors.text;

  return (
    <RNText
      style={[
        textStyles[variant],
        { color: textColor },
        style,
      ]}
    >
      {children}
    </RNText>
  );
};

