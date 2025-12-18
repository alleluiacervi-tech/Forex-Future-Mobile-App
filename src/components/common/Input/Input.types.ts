import type { ReactNode } from 'react';

export interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  leftAccessory?: ReactNode;
  rightAccessory?: ReactNode;
  style?: any;
}

