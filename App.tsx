import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View, Image } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MainNavigator from './src/navigation';
import { ThemeProvider } from './src/theme';
import { useTheme } from './src/hooks';
import { Text } from './src/components/common';
import TermsScreen from './src/screens/Terms/TermsScreen';
import { AuthProvider } from './src/context/AuthContext';

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
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
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
          </AuthProvider>
        </ThemeProvider>
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
    shadowColor: '#0A1216',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 8,
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
