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
  style,
}) => {
  const theme = useTheme();

  return (
    <View style={inputStyles.container}>
      {label && (
        <Text style={inputStyles.label}>{label}</Text>
      )}
      <TextInput
        style={[
          inputStyles.input,
          error && inputStyles.inputError,
          style,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
      />
      {error && (
        <Text style={inputStyles.error}>{error}</Text>
      )}
    </View>
  );
};

