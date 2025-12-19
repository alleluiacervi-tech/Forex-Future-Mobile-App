import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainNavigator from './src/navigation';
import { ThemeProvider } from './src/theme';
import { useTheme } from './src/hooks';
import { Text } from './src/components/common';
import TermsScreen from './src/screens/Terms/TermsScreen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showStartupSplash, setShowStartupSplash] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make any API calls you need to do here
        await Font.loadAsync({
          // Add any custom fonts here if needed
        });
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  useEffect(() => {
    if (!appIsReady) return;
    const t = setTimeout(() => setShowStartupSplash(false), 5000);
    return () => clearTimeout(t);
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <View style={styles.container}>
          <StatusBar style="light" />
          {showStartupSplash ? (
            <StartupSplash />
          ) : !acceptedTerms ? (
            <TermsScreen onAgree={() => setAcceptedTerms(true)} />
          ) : (
            <MainNavigator />
          )}
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function StartupSplash() {
  const theme = useTheme();

  return (
    <View style={[styles.splashContainer, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.splashCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={[styles.splashMark, { backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.border }]}>
          <View style={styles.splashCandles}>
            <View style={[styles.splashBaseline, { backgroundColor: theme.colors.border }]} />

            <View style={[styles.splashCandleWrap, styles.splashCandleLeft]}>
              <View style={[styles.splashWick, { backgroundColor: theme.colors.border }]} />
              <View style={[styles.splashBody, { backgroundColor: theme.colors.success }]} />
              <View style={[styles.splashWick, { backgroundColor: theme.colors.border }]} />
            </View>

            <View style={[styles.splashCandleWrap, styles.splashCandleCenter]}>
              <View style={[styles.splashWick, { backgroundColor: theme.colors.border }]} />
              <View style={[styles.splashBody, { backgroundColor: theme.colors.info }]} />
              <View style={[styles.splashWick, { backgroundColor: theme.colors.border }]} />
            </View>

            <View style={[styles.splashCandleWrap, styles.splashCandleRight]}>
              <View style={[styles.splashWick, { backgroundColor: theme.colors.border }]} />
              <View style={[styles.splashBody, { backgroundColor: theme.colors.error }]} />
              <View style={[styles.splashWick, { backgroundColor: theme.colors.border }]} />
            </View>
          </View>
        </View>

        <View style={styles.splashWordmark}>
          <Text variant="h1" style={[styles.splashForex, { color: theme.colors.primary }]}>
            FOREX
          </Text>
          <Text variant="h3" style={[styles.splashFuture, { color: theme.colors.textSecondary }]}>
            Future
          </Text>
        </View>

        <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.splashSubtitle}>
          AI‑driven market insights for smarter financial decisions
        </Text>

        <ActivityIndicator style={styles.splashSpinner} color={theme.colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  splashMark: {
    width: 84,
    height: 84,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  splashCandles: {
    width: 56,
    height: 44,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  splashBaseline: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 10,
    height: 2,
    borderRadius: 1,
    opacity: 0.65,
  },
  splashCandleWrap: {
    position: 'absolute',
    bottom: 14,
    width: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splashCandleLeft: {
    height: 22,
    left: 10,
  },
  splashCandleCenter: {
    height: 30,
    left: 24,
  },
  splashCandleRight: {
    height: 18,
    right: 10,
  },
  splashWick: {
    width: 2,
    height: 7,
    borderRadius: 1,
    opacity: 0.8,
  },
  splashBody: {
    width: 10,
    flex: 1,
    borderRadius: 5,
  },
  splashWordmark: {
    alignItems: 'center',
    marginBottom: 8,
  },
  splashForex: {
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 2,
  },
  splashFuture: {
    fontWeight: '700',
    letterSpacing: 0.9,
    opacity: 0.95,
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

