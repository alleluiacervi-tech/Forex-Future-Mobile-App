import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Text, Button } from '../../components/common';
import { useTheme } from '../../hooks';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FeatureCardProps {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, iconColor, title, description }) => {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.featureCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.featureHeaderRow}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: `${iconColor}26`,
              borderColor: `${iconColor}80`,
            },
          ]}
        >
          <View style={[styles.iconInnerGlow, { backgroundColor: `${iconColor}33` }]} />
          <Icon name={icon} size={30} color={iconColor} />
        </View>
        <Text variant="caption" color={theme.colors.textSecondary} style={styles.featureBadge}>
          CORE CAPABILITY
        </Text>
      </View>
      <Text variant="h4" style={styles.featureTitle}>
        {title}
      </Text>
      <Text variant="body" color={theme.colors.textSecondary} style={styles.featureDescription}>
        {description}
      </Text>
    </View>
  );
};

export default function AboutScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const handleGetStarted = () => {
    navigation.navigate('Welcome');
  };

  const features = [
    {
      icon: 'show-chart',
      iconColor: '#4CAF50', // Green
      title: 'Market Volatility',
      description: 'Track volatility and momentum so you can react before the move is over.',
    },
    {
      icon: 'insights',
      iconColor: '#03A9F4', // Light Blue
      title: 'AI Trade Recommendations',
      description:
        'Professional-grade buy, sell, or wait signals that combine price action, volatility, and trend context into clear, risk-aware recommendations.',
    },
    {
      icon: 'psychology',
      iconColor: '#9C27B0', // Purple
      title: 'AI Insights',
      description:
        'AI‑powered insights that surface high‑probability setups based on price action and volatility.',
    },
    {
      icon: 'notifications-active',
      iconColor: '#FFC107', // Yellow
      title: 'Price Alerts',
      description:
        'Smart alerts that notify you when key levels are hit so you don’t sit in front of charts all day.',
    },
  ];

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
        <Container>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back" size={24} color={theme.colors.text} />
            <Text variant="body" color={theme.colors.text} style={styles.backButtonText}>
              Back
            </Text>
          </TouchableOpacity>

          {/* Title */}
          <Text variant="h1" style={styles.title}>
            Institutional‑Grade AI Insights
          </Text>

          {/* Description */}
          <Text variant="body" color={theme.colors.textSecondary} style={styles.description}>
            Forex Future is your AI‑powered trading copilot, built for serious forex professionals.
            It continuously monitors volatility, scans global markets for opportunity, and delivers
            precise, signal‑driven alerts so you can focus on strategy and execution—not staring at
            charts all day.
          </Text>

          {/* Feature Cards */}
          <View style={styles.featuresContainer}>
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </View>

          {/* Get Started Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Get Started →"
              onPress={handleGetStarted}
              variant="primary"
              size="large"
              style={styles.getStartedButton}
            />
          </View>
        </Container>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  backButtonText: {
    marginLeft: 8,
  },
  title: {
    marginBottom: 16,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'left',
  },
  description: {
    marginBottom: 32,
    lineHeight: 26,
    fontSize: 15,
  },
  featuresContainer: {
    gap: 18,
    marginBottom: 32,
  },
  featureCard: {
    padding: 18,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  featureHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  iconInnerGlow: {
    position: 'absolute',
    width: '140%',
    height: '140%',
    borderRadius: 999,
    opacity: 0.85,
  },
  featureBadge: {
    fontSize: 11,
    letterSpacing: 1.2,
  },
  featureTitle: {
    marginBottom: 6,
    fontSize: 18,
    fontWeight: '600',
  },
  featureDescription: {
    lineHeight: 22,
    fontSize: 14,
  },
  buttonContainer: {
    marginBottom: 32,
  },
  getStartedButton: {
    width: '100%',
  },
});
