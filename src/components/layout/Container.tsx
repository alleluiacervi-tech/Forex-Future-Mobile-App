import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '../../theme';

interface ContainerProps {
  children: ReactNode;
  style?: any;
  padding?: boolean;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  style,
  padding = true,
}) => {
  return (
    <View style={[styles.container, padding && styles.padding, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  padding: {
    padding: spacing.md,
  },
});

