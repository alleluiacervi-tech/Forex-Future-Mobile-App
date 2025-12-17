import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { ButtonProps } from './Button.types';
import { buttonStyles } from './Button.styles';
import { useTheme } from '../../../hooks';

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
}) => {
  const theme = useTheme();

  const getTextStyle = () => {
    const baseStyle = [
      buttonStyles.text,
      buttonStyles[`text${size.charAt(0).toUpperCase() + size.slice(1)}` as keyof typeof buttonStyles],
    ];
    
    if (variant === 'outline') {
      baseStyle.push(buttonStyles.textOutline);
    } else if (variant === 'danger') {
      baseStyle.push(buttonStyles.textDanger);
    } else {
      baseStyle.push(buttonStyles.textPrimary);
    }
    
    return baseStyle;
  };

  return (
    <TouchableOpacity
      style={[
        buttonStyles.button,
        buttonStyles[variant],
        buttonStyles[size],
        disabled && buttonStyles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.text} />
      ) : (
        <Text style={getTextStyle()}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

