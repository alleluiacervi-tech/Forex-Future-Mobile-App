import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  ViewToken,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Text, Button } from '../../components/common';
import { useTheme } from '../../hooks';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

export const ONBOARDING_STORAGE_KEY = 'hasSeenOnboarding';

interface OnboardingSlide {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Icon>['name'];
}

const slides: OnboardingSlide[] = [
  {
    title: 'Real-Time Velocity Alerts',
    description:
      'Forex Future detects fast price moves as they happen — not static price levels. ' +
      'When a currency pair accelerates beyond normal volatility, you get notified instantly.',
    icon: 'bolt',
  },
  {
    title: 'Entry, Stop-Loss & Take-Profit',
    description:
      'Every alert comes with actionable trading levels: a suggested entry price, ' +
      'a protective stop-loss, and up to three take-profit targets so you can act with confidence.',
    icon: 'candlestick-chart',
  },
  {
    title: 'Severity Levels',
    description:
      'Alerts are graded by intensity:\n\n' +
      'SIGNIFICANT — notable move, worth watching\n' +
      'STRONG — clear momentum shift\n' +
      'EXPLOSIVE — rapid acceleration\n' +
      'CRASH — extreme move, highest urgency',
    icon: 'trending-up',
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    }
  };

  const handleGetStarted = async () => {
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    navigation.replace('Main');
  };

  const isLastSlide = currentIndex === slides.length - 1;

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={[styles.slide, { width }]}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Icon name={item.icon} size={56} color={theme.colors.primary} />
      </View>
      <Text
        style={[
          theme.typography.h2,
          styles.title,
          { color: theme.colors.text },
        ]}
      >
        {item.title}
      </Text>
      <Text
        style={[
          theme.typography.body,
          styles.description,
          { color: theme.colors.textSecondary },
        ]}
      >
        {item.description}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === currentIndex
                      ? theme.colors.primary
                      : theme.colors.border,
                },
              ]}
            />
          ))}
        </View>

        <Button
          title={isLastSlide ? 'Get Started' : 'Next'}
          onPress={isLastSlide ? handleGetStarted : handleNext}
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
        />

        {!isLastSlide && (
          <Button
            title="Skip"
            onPress={handleGetStarted}
            variant="text"
            style={styles.skipButton}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 48,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  button: {
    width: '100%',
  },
  skipButton: {
    marginTop: 12,
  },
});
