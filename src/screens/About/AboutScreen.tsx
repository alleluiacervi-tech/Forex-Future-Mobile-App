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
    <View style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}>
      <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
        <Icon name={icon} size={32} color={iconColor} />
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
      icon: 'notifications-active',
      iconColor: '#FFC107', // Yellow
      title: 'Price Alerts',
      description: 'Instant notifications when pairs hit your target levels.',
    },
    {
      icon: 'show-chart',
      iconColor: '#4CAF50', // Green
      title: 'Volatility Tracking',
      description: 'Detect sudden market movements and volume spikes.',
    },
    {
      icon: 'article',
      iconColor: '#2196F3', // Blue
      title: 'Market News',
      description: 'Breaking financial news that impacts currency pairs.',
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
            Stay Ahead of the Market
          </Text>

          {/* Description */}
          <Text variant="body" color={theme.colors.textSecondary} style={styles.description}>
            Our terminal aggregates data from multiple liquidity providers to give you the fastest,
            most accurate forex signals available.
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
    fontSize: 32,
    fontWeight: 'bold',
  },
  description: {
    marginBottom: 32,
    lineHeight: 24,
    fontSize: 16,
  },
  featuresContainer: {
    gap: 20,
    marginBottom: 40,
  },
  featureCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 4,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    marginBottom: 8,
    fontSize: 20,
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
