import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import { ScreenWrapper, Container } from '../../components/layout';
import { Button, Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TermsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [accepted, setAccepted] = useState(false);

  const terms = useMemo(
    () =>
      [
        'Forex Future provides market insights and analytics for educational and decision-support purposes only.',
        'Nothing in this app constitutes financial, investment, or trading advice.',
        'Trading involves risk. You are responsible for your decisions and risk management.',
        'Past performance and AI-generated insights do not guarantee future results.',
      ],
    []
  );

  const handleAgree = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Landing' }],
    });
  };

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Container>
          <Text variant="h2" style={styles.title}>
            Terms & Agreement
          </Text>
          <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.subtitle}>
            Please review and accept to continue.
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
