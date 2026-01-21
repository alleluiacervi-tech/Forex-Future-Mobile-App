import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View, Image } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainNavigator from './src/navigation';
import { ThemeProvider } from './src/theme';
import { useTheme } from './src/hooks';
import { Text } from './src/components/common';
import TermsScreen from './src/screens/Terms/TermsScreen';

const STARTUP_SPLASH_DURATION_MS = 5000;

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if the splash screen is already prevented or unavailable.
});

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showStartupSplash, setShowStartupSplash] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const prepare = async () => {
      try {
        // If you add custom fonts later, you can load them here.
        // Example:
        // await Font.loadAsync({
        //   'YourFontName': require('./assets/fonts/YourFont.ttf'),
        // });
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
    <SafeAreaProvider>
      <ThemeProvider>
        <View style={styles.container} onLayout={onLayoutRootView}>
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
          <Image
            source={require('./assets/image.png')}
            resizeMode="contain"
            style={styles.splashLogo}
          />
        </View>

        <View style={styles.splashWordmark}>
          <Text variant="h1" style={[styles.splashForex, { color: '#E7C77A' }]}>
            FOREX
          </Text>
          <Text variant="h3" style={[styles.splashFuture, { color: '#00CFEA' }]}>
            FUTURE
          </Text>
        </View>

        <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.splashSubtitle}>
          AI-driven market insights for smarter financial decisions
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
    width: 108,
    height: 108,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  splashLogo: {
    width: 92,
    height: 92,
    borderRadius: 20,
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
