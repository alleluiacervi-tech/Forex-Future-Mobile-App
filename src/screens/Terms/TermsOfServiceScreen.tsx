import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';

export default function TermsOfServiceScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const terms = useMemo(
    () =>
      [
        'Forex Future provides market data, AI-driven insights, indicators, and educational information for general informational purposes only.',
        'Forex Future does not provide financial, investment, tax, or legal advice. You are solely responsible for all decisions you make.',
        'Trading foreign exchange and leveraged products carries a high level of risk and may not be suitable for all investors. You may lose some or all of your capital.',
        'AI signals and analytics are probabilistic and may be incorrect, incomplete, delayed, or affected by unusual market conditions.',
        'You agree to use the platform responsibly and to apply appropriate risk management including position sizing and stop-losses where applicable.',
        'We are not liable for losses, damages, or claims arising from use of the app or reliance on any information provided.',
        'You must comply with all applicable laws and regulations in your jurisdiction, including restrictions on trading and data usage.',
        'We may update these Terms from time to time. Continued use of the app constitutes acceptance of the updated Terms.',
      ],
    []
  );

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text variant="h3" style={styles.headerTitle}>
          Terms & Agreement
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Container>
          <Text variant="body" color={theme.colors.textSecondary} style={styles.subtitle}>
            Please review these Terms & Agreement carefully.
          </Text>

          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {terms.map((line, idx) => (
              <View key={idx} style={styles.termRow}>
                <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
                <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.termText}>
                  {line}
                </Text>
              </View>
            ))}
          </Card>

          <Text variant="caption" color={theme.colors.textSecondary} style={styles.footer}>
            Last updated: December 20, 2024
          </Text>
        </Container>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontWeight: '900',
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  subtitle: {
    marginTop: 16,
    marginBottom: 16,
    lineHeight: 20,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: 10,
  },
  termText: {
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
