import React from 'react';
import { View, StyleSheet, Image, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../hooks';

type BrandLogoProps = {
  style?: ViewStyle;
};

export function BrandLogo({ style }: BrandLogoProps) {
  const theme = useTheme();

  return (
    <LinearGradient
      colors={[`${theme.colors.accent}55`, `${theme.colors.primary}44`]}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
      style={[styles.halo, style]}
    >
      <View
        style={[
          styles.plate,
          { backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.borderLight },
        ]}
      >
        <Image
          source={require('../../../../assets/image.png')}
          resizeMode="contain"
          style={styles.logo}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  halo: {
    width: 128,
    height: 128,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2B5260',
    shadowColor: '#0A1216',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 8,
  },
  plate: {
    width: 108,
    height: 108,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  logo: {
    width: 86,
    height: 86,
    borderRadius: 18,
  },
});
