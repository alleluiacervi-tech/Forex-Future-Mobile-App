import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { LinearGradient } from 'expo-linear-gradient';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MainNavigator from './src/navigation';
import { ThemeProvider } from './src/theme';
import { useTheme } from './src/hooks';
import { Text } from './src/components/common';
import TermsScreen from './src/screens/Terms/TermsScreen';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import { createQueryClient } from './src/services/queryClient';

const STARTUP_SPLASH_DURATION_MS = 5000;
const TERMS_ACCEPTED_KEY = '@forexapp_terms_accepted';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if the splash screen is already prevented or unavailable.
});

export default function App() {
  const [queryClient] = useState(createQueryClient);
  const [appIsReady, setAppIsReady] = useState(false);
  const [showStartupSplash, setShowStartupSplash] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const prepare = async () => {
      try {
        const storedTerms = await AsyncStorage.getItem(TERMS_ACCEPTED_KEY);
        if (isMounted && storedTerms === 'true') {
          setAcceptedTerms(true);
        }
      } catch (e) {
        console.warn(e);
      } finally {
        if (isMounted) {
          setAppIsReady(true);
        }
      }
    };

    void prepare();

    return () => {
      isMounted = false;
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (!appIsReady) return;
    try {
      await SplashScreen.hideAsync();
    } catch (e) {
      console.warn(e);
    }
  }, [appIsReady]);

  useEffect(() => {
    if (!appIsReady) return;
    const t = setTimeout(() => setShowStartupSplash(false), STARTUP_SPLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <View style={styles.container} onLayout={onLayoutRootView}>
                  <StatusBar style="light" />
                  {showStartupSplash ? (
                    <StartupSplash />
                  ) : !acceptedTerms ? (
                    <TermsScreen onAgree={() => {
                      setAcceptedTerms(true);
                      void AsyncStorage.setItem(TERMS_ACCEPTED_KEY, 'true').catch(() => {});
                    }} />
                  ) : (
                    <MainNavigator />
                  )}
                </View>
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function StartupSplash() {
  const theme = useTheme();

  return (
    <View style={[styles.splashContainer, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.splashCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <LinearGradient
          colors={[`${theme.colors.accent}55`, `${theme.colors.primary}44`]}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={styles.splashHalo}
        >
          <View style={[styles.splashMark, { backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.borderLight }]}>
            <Image
              source={require('./assets/image.png')}
              resizeMode="contain"
              style={styles.splashLogo}
            />
          </View>
        </LinearGradient>

        <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.splashSubtitle}>
          Smart market alerts for big moves
        </Text>

        <ActivityIndicator style={styles.splashSpinner} color={theme.colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  splashCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  splashHalo: {
    width: 128,
    height: 128,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2B5260',
    ...Platform.select({
      ios: { shadowColor: '#0A1216', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 22 },
      android: { elevation: 8 },
      web: { boxShadow: '0px 10px 22px rgba(10, 18, 22, 0.35)' },
    }),
  },
  splashMark: {
    width: 108,
    height: 108,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 86,
    height: 86,
    borderRadius: 18,
  },
  splashSubtitle: {
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.9,
  },
  splashSpinner: {
    marginTop: 18,
  },
});
