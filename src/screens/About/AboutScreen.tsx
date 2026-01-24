import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper, Container } from '../../components/layout';
import { Text, Button, BrandLogo } from '../../components/common';
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
        <View style={styles.featureTitleRow}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: `${iconColor}1F`,
                borderColor: `${iconColor}55`,
              },
            ]}
          >
            <Icon name={icon} size={22} color={iconColor} />
          </View>
          <Text variant="h4" style={styles.featureTitle}>
            {title}
          </Text>
        </View>
        <Icon name="chevron-right" size={22} color={theme.colors.textSecondary} />
      </View>
      <Text variant="body" color={theme.colors.textSecondary} style={styles.featureDescription}>
        {description}
      </Text>
    </View>
  );
};

export default function AboutScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const handleContinue = () => {
    navigation.navigate('Welcome');
  };

  const features = [
    {
      icon: 'show-chart',
      iconColor: theme.colors.success,
      title: 'Volatility & Momentum',
      description: 'See volatility shifts early and track momentum across major pairs in real time.',
    },
    {
      icon: 'insights',
      iconColor: theme.colors.info,
      title: 'AI Trade Signals',
      description:
        'Clear buy/sell/wait guidance that blends price action, volatility, and trend context into risk-aware setups.',
    },
    {
      icon: 'psychology',
      iconColor: theme.colors.accent,
      title: 'Explainable Insights',
      description:
        'Actionable rationale for each setup so you understand why the model is confident (or not).',
    },
    {
      icon: 'notifications-active',
      iconColor: theme.colors.warning,
      title: 'Smart Alerts',
      description:
        'Get notified when key levels and conditions are met—no need to watch charts all day.',
    },
  ];

  return (
    <ScreenWrapper style={styles.screen}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.surface, theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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

          {/* Hero */}
          <LinearGradient
            colors={[theme.colors.surface, theme.colors.surfaceLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroCard, { borderColor: theme.colors.border }]}
          >
            <View style={styles.logoRow}>
              <BrandLogo />
            </View>
            <View style={[styles.heroPill, { borderColor: theme.colors.border }]}
            >
              <Icon name="bolt" size={16} color={theme.colors.primary} />
              <Text variant="caption" color={theme.colors.textSecondary} style={styles.heroPillText}>
                Built for fast decisions
              </Text>
            </View>

            <Text variant="h1" style={styles.title}>
              Professional trading tools.
              {'\n'}Simplified.
            </Text>

            <Text variant="body" color={theme.colors.textSecondary} style={styles.description}>
              Forex Future is your AI‑powered trading copilot. It monitors volatility, tracks trend
              context, and surfaces signal‑driven opportunities—so you can focus on execution.
            </Text>

            <View style={styles.metricsRow}>
              <View style={[styles.metricCard, { borderColor: theme.colors.border }]}
              >
                <Text variant="caption" color={theme.colors.textSecondary}>
                  Signals
                </Text>
                <Text variant="h3">Buy / Sell / Wait</Text>
              </View>
              <View style={[styles.metricCard, { borderColor: theme.colors.border }]}
              >
                <Text variant="caption" color={theme.colors.textSecondary}>
                  Coverage
                </Text>
                <Text variant="h3">Major Pairs</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Feature Cards */}
          <View style={styles.featuresContainer}>
            <View style={styles.sectionHeader}>
              <Text variant="h3">What you get</Text>
              <Text variant="bodySmall" color={theme.colors.textSecondary}>
                Core features designed for focus
              </Text>
            </View>
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </View>

          {/* Continue CTA */}
          <View style={[styles.ctaCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.ctaHeaderRow}>
              <View style={styles.ctaTitleRow}>
                <Icon name="verified" size={20} color={theme.colors.primary} />
                <Text variant="h4" style={styles.ctaTitle}>
                  Ready to continue?
                </Text>
              </View>
              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.ctaSubtitle}>
                Continue to sign in or request access after you explore.
              </Text>
            </View>
            <Button
              title="Continue to Login"
              onPress={handleContinue}
              variant="primary"
              size="large"
              style={styles.getStartedButton}
            />
          </View>
          </Container>
        </ScrollView>
      </LinearGradient>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: 'transparent',
  },
  background: {
    flex: 1,
  },
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
  heroCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  logoRow: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  heroPillText: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  title: {
    marginBottom: 12,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'left',
  },
  description: {
    marginBottom: 16,
    lineHeight: 24,
    fontSize: 15,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 24,
  },
  sectionHeader: {
    gap: 4,
    marginBottom: 6,
  },
  featureCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  featureHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 0,
  },
  featureDescription: {
    lineHeight: 22,
    fontSize: 14,
  },
  ctaCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 32,
    gap: 14,
  },
  ctaHeaderRow: {
    gap: 6,
  },
  ctaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  ctaSubtitle: {
    lineHeight: 20,
  },
  getStartedButton: {
    width: '100%',
  },
});
