import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ScreenWrapper } from '../../components/layout';
import { Card, Text, Button, Input } from '../../components/common';
import { useTheme } from '../../hooks';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type PlanType = 'monthly' | 'yearly';

export default function SubscriptionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');

  const handleConfirm = () => {
    // Handle subscription confirmation
    console.log('Subscription confirmed:', {
      plan: selectedPlan,
      cardNumber,
      expiryDate,
      cvv,
      cardName,
    });
    // Navigate to main app or show success message
    navigation.replace('Main');
  };

  const formatCardNumber = (text: string) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    // Add spaces every 4 digits
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    // Limit to 19 characters (16 digits + 3 spaces)
    return formatted.slice(0, 19);
  };

  const formatExpiryDate = (text: string) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    // Add slash after 2 digits
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const monthlyPrice = 20;
  const yearlyPrice = 240;
  const yearlySavings = monthlyPrice * 12 - yearlyPrice;

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Icon name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text variant="h2" style={styles.headerTitle}>
              Choose Your Plan
            </Text>
            <View style={styles.placeholder} />
          </View>

          {/* Free Trial Banner */}
          <Card style={[styles.trialBanner, { backgroundColor: theme.colors.primary + '20' }]}>
            <View style={styles.trialBannerContent}>
              <Icon name="stars" size={32} color={theme.colors.primary} />
              <View style={styles.trialBannerText}>
                <Text variant="h4" style={[styles.trialBannerTitle, { color: theme.colors.primary }]}>
                  14-Day Free Trial
                </Text>
                <Text variant="bodySmall" color={theme.colors.textSecondary}>
                  Full access to all premium features. No charges until the trial ends.
                </Text>
              </View>
            </View>
          </Card>

          {/* Plan Selection */}
          <View style={styles.planSection}>
            <Text variant="h3" style={styles.sectionTitle}>
              Select Your Plan
            </Text>
            <View style={styles.plansContainer}>
              {/* Monthly Plan */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  {
                    backgroundColor:
                      selectedPlan === 'monthly' ? theme.colors.surfaceLight : theme.colors.surface,
                    borderColor: selectedPlan === 'monthly' ? theme.colors.primary : theme.colors.border,
                    borderWidth: selectedPlan === 'monthly' ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.7}
              >
                <View style={styles.planHeader}>
                  <Text variant="h4" style={styles.planName}>
                    Monthly
                  </Text>
                  {selectedPlan === 'monthly' && (
                    <View style={[styles.checkBadge, { backgroundColor: theme.colors.primary }]}>
                      <Icon name="check" size={16} color={theme.colors.text} />
                    </View>
                  )}
                </View>
                <View style={styles.priceContainer}>
                  <Text variant="h2" style={styles.price}>
                    ${monthlyPrice}
                  </Text>
                  <Text variant="body" color={theme.colors.textSecondary}>
                    /month
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Yearly Plan */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  {
                    backgroundColor:
                      selectedPlan === 'yearly' ? theme.colors.surfaceLight : theme.colors.surface,
                    borderColor: selectedPlan === 'yearly' ? theme.colors.primary : theme.colors.border,
                    borderWidth: selectedPlan === 'yearly' ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedPlan('yearly')}
                activeOpacity={0.7}
              >
                <View style={styles.planHeader}>
                  <View style={styles.planHeaderLeft}>
                    <Text variant="h4" style={styles.planName}>
                      Yearly
                    </Text>
                    <View style={[styles.savingsBadge, { backgroundColor: theme.colors.success + '20' }]}>
                      <Text variant="caption" style={[styles.savingsText, { color: theme.colors.success }]}>
                        Save ${yearlySavings}
                      </Text>
                    </View>
                  </View>
                  {selectedPlan === 'yearly' && (
                    <View style={[styles.checkBadge, { backgroundColor: theme.colors.primary }]}>
                      <Icon name="check" size={16} color={theme.colors.text} />
                    </View>
                  )}
                </View>
                <View style={styles.priceContainer}>
                  <Text variant="h2" style={styles.price}>
                    ${yearlyPrice}
                  </Text>
                  <Text variant="body" color={theme.colors.textSecondary}>
                    /year
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Payment Details */}
          <View style={styles.paymentSection}>
            <Text variant="h3" style={styles.sectionTitle}>
              Payment Details
            </Text>
            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.sectionSubtitle}>
              Securely enter your payment information. You won't be charged until the trial ends.
            </Text>

            {/* Card Number */}
            <View style={styles.inputContainer}>
              <Text variant="body" color={theme.colors.textSecondary} style={styles.inputLabel}>
                Card Number
              </Text>
              <View style={[styles.cardInputWrapper, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <TextInput
                  style={[styles.cardInput, { color: theme.colors.text }]}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={cardNumber}
                  onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                  keyboardType="numeric"
                  maxLength={19}
                />
                <Icon name="credit-card" size={20} color={theme.colors.textSecondary} />
              </View>
            </View>

            {/* Card Name */}
            <View style={styles.inputContainer}>
              <Text variant="body" color={theme.colors.textSecondary} style={styles.inputLabel}>
                Cardholder Name
              </Text>
              <View style={[styles.cardInputWrapper, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <TextInput
                  style={[styles.cardInput, { color: theme.colors.text }]}
                  placeholder="John Doe"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={cardName}
                  onChangeText={setCardName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Expiry and CVV */}
            <View style={styles.rowInputs}>
              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text variant="body" color={theme.colors.textSecondary} style={styles.inputLabel}>
                  Expiry Date
                </Text>
                <View style={[styles.cardInputWrapper, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <TextInput
                    style={[styles.cardInput, { color: theme.colors.text }]}
                    placeholder="MM/YY"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={expiryDate}
                    onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              </View>

              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text variant="body" color={theme.colors.textSecondary} style={styles.inputLabel}>
                  CVV
                </Text>
                <View style={[styles.cardInputWrapper, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <TextInput
                    style={[styles.cardInput, { color: theme.colors.text }]}
                    placeholder="123"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={cvv}
                    onChangeText={(text) => setCvv(text.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={4}
                  />
                  <Icon name="lock" size={20} color={theme.colors.textSecondary} />
                </View>
              </View>
            </View>

            {/* Security Notice */}
            <View style={styles.securityNotice}>
              <Icon name="security" size={20} color={theme.colors.primary} />
              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.securityText}>
                Your payment information is encrypted and secure. We use industry-standard security measures.
              </Text>
            </View>
          </View>

          {/* Confirm Button */}
          <View style={styles.confirmSection}>
            <Button
              title={`Start Free Trial - ${selectedPlan === 'monthly' ? `$${monthlyPrice}/month` : `$${yearlyPrice}/year`}`}
              onPress={handleConfirm}
              variant="primary"
              size="large"
              style={styles.confirmButton}
            />
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.confirmSubtext}>
              You'll be charged after your 14-day free trial ends. Cancel anytime.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
  },
  trialBanner: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  trialBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trialBannerText: {
    flex: 1,
  },
  trialBannerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionSubtitle: {
    marginBottom: 16,
    lineHeight: 20,
  },
  plansContainer: {
    gap: 12,
  },
  planCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
  },
  savingsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  savingsText: {
    fontSize: 10,
    fontWeight: '600',
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  paymentSection: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  cardInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  cardInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  confirmSection: {
    marginTop: 'auto',
    paddingTop: 24,
  },
  confirmButton: {
    width: '100%',
    marginBottom: 12,
  },
  confirmSubtext: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
});
