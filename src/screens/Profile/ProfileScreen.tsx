import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import TopNavBar from '../../components/navigation/TopNavBar';
import { useTheme } from '../../hooks';

export default function ProfileScreen() {
  const theme = useTheme();

  return (
    <ScreenWrapper>
      <TopNavBar />
      <ScrollView style={styles.scrollView}>
        <Container>
          <Text variant="h3" style={styles.title}>
            Settings
          </Text>
          <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.subtitle}>
            This app focuses on AI-driven market insights and alerts. Execute trades in your preferred trading platform.
          </Text>

          <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="h4" style={styles.sectionTitle}>
              Core Features
            </Text>
            <View style={styles.row}>
              <Text variant="bodySmall" color={theme.colors.textSecondary}>
                AI recommendations and confidence scoring
              </Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodySmall" color={theme.colors.textSecondary}>
                Market alerts for volatility and key moves
              </Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodySmall" color={theme.colors.textSecondary}>
                Technical analysis tools (RSI, multi-timeframe charts)
              </Text>
            </View>
          </Card>

          <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="h4" style={styles.sectionTitle}>
              Legal
            </Text>
            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.legalText}>
              Insights are informational and educational only; not financial advice. No accuracy guarantees. Trading involves risk.
            </Text>
          </Card>

          <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="h4" style={styles.sectionTitle}>
              Support
            </Text>
            <TouchableOpacity activeOpacity={0.8} style={styles.linkRow}>
              <Text variant="bodySmall" color={theme.colors.primary}>
                Contact support
              </Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} style={styles.linkRow}>
              <Text variant="bodySmall" color={theme.colors.primary}>
                About Forex Future
              </Text>
            </TouchableOpacity>
          </Card>
        </Container>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  title: {
    marginBottom: 10,
  },
  subtitle: {
    marginBottom: 16,
    lineHeight: 18,
  },
  sectionCard: {
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontWeight: '800',
    marginBottom: 10,
  },
  row: {
    paddingVertical: 6,
  },
  legalText: {
    lineHeight: 18,
  },
  linkRow: {
    paddingVertical: 8,
  },
});

