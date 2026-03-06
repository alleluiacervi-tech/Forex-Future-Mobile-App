import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useNetworkStatus } from '../../hooks';
import { OfflineBanner } from '../common/OfflineBanner'; // ADDED: offline banner (CHECK 6)

interface ScreenWrapperProps {
  children: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: any;
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  edges = ['top'],
  style,
}) => {
  const theme = useTheme();
  const { isConnected } = useNetworkStatus(); // ADDED: offline detection (CHECK 6)

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }, style]}
      edges={edges}
    >
      {/* ADDED: global offline banner (CHECK 6) */}
      {!isConnected && <OfflineBanner />}
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

