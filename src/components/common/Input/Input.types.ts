import type { ReactNode } from 'react';

export interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  label?: string;
  error?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  editable?: boolean;
  leftAccessory?: ReactNode;
  rightAccessory?: ReactNode;
  style?: any;
}
