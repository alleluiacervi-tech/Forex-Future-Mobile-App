import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Button, Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';

interface TermsScreenProps {
  onAgree: () => void;
}

export default function TermsScreen({ onAgree }: TermsScreenProps) {
  const theme = useTheme();
  const [accepted, setAccepted] = useState(false);

  const terms = useMemo(
    () =>
      [
        'Forex Future is a serious, high-level AI-powered platform built to deliver institutional-grade market insights, AI-driven recommendations, real-time news updates, and advanced analytical tools.',
        'The platform supports informed decision-making and is designed as a reliable resource for market intelligence and financial insights.',
        'While the application leverages advanced artificial intelligence and data analysis, it does not guarantee 100% accuracy in predictions, recommendations, signals, or trading outcomes.',
        'Market conditions are volatile, complex, and inherently unpredictable; results can differ materially from any model-based expectations.',
        'All information, insights, and recommendations provided are for informational and educational purposes only and must not be considered financial, investment, or trading advice.',
        'Trading and investing involve significant risk, including the potential loss of capital. You are solely responsible for your decisions, position sizing, and risk management.',
        'By using this application, you agree that the app and its developers will not be held liable for losses, damages, or claims resulting from reliance on the information provided.',
      ],
    []
  );

  const handleAgree = () => onAgree();

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Container>
          <Text variant="h2" style={styles.title}>
            Terms & Agreement
          </Text>
          <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.subtitle}>
            Read carefully. You must accept to continue.
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

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setAccepted((v) => !v)}
            style={[styles.checkboxRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: accepted ? theme.colors.primary : theme.colors.border,
                  backgroundColor: accepted ? `${theme.colors.primary}20` : 'transparent',
                },
              ]}
            >
              {accepted ? <Icon name="check" size={18} color={theme.colors.primary} /> : null}
            </View>
            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.checkboxText}>
              I agree to the Terms & Agreement.
            </Text>
          </TouchableOpacity>

          <Button
            title="Agree & Continue"
            onPress={handleAgree}
            variant="primary"
            size="large"
            disabled={!accepted}
            style={styles.primaryButton}
          />

          <Text variant="caption" color={theme.colors.textSecondary} style={styles.footer}>
            You can review Terms later in Settings.
          </Text>
        </Container>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  title: {
    marginTop: 8,
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 16,
    lineHeight: 18,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxText: {
    flex: 1,
    lineHeight: 18,
  },
  primaryButton: {
    width: '100%',
  },
  footer: {
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
