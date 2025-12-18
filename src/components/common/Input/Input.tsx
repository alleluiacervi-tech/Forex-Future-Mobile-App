import React from 'react';
import { View, TextInput, Text } from 'react-native';
import { InputProps } from './Input.types';
import { inputStyles } from './Input.styles';
import { useTheme } from '../../../hooks';

export const Input: React.FC<InputProps> = ({
  value,
  onChangeText,
  placeholder,
  label,
  error,
  keyboardType = 'default',
  secureTextEntry = false,
  leftAccessory,
  rightAccessory,
  style,
}) => {
  const theme = useTheme();

  return (
    <View style={inputStyles.container}>
      {label && (
        <Text style={inputStyles.label}>{label}</Text>
      )}
      <View style={[inputStyles.inputWrapper, error && inputStyles.inputError, style]}>
        {leftAccessory ? (
          <View style={inputStyles.accessoryLeft}>{leftAccessory}</View>
        ) : null}
        <TextInput
          style={inputStyles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
        />
        {rightAccessory ? (
          <View style={inputStyles.accessoryRight}>{rightAccessory}</View>
        ) : null}
      </View>
      {error && (
        <Text style={inputStyles.error}>{error}</Text>
      )}
    </View>
  );
};

