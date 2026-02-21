import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text, Input, Button } from '../../components/common';
import { useTheme } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';

export default function BillingPaymentsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'BillingPayments'>>();
  const { startTrial, isLoading } = useAuth();

  const setupTrial = route.params?.setupTrial ?? false;
  const selectedPrice = route.params?.selectedPrice ?? 10;
  const billingLabel = route.params?.billingLabel ?? 'month';

  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [touched, setTouched] = useState({
    cardName: false,
    cardNumber: false,
    expiry: false,
    cvc: false,
    postalCode: false,
  });

  const formattedCardNumber = useMemo(() => {
    const digits = cardNumber.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  }, [cardNumber]);

  const formattedExpiry = useMemo(() => {
    const digits = expiry.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }, [expiry]);

  const cardNameError = useMemo(() => {
    if (!touched.cardName) return undefined;
    if (!cardName.trim()) return 'Name on card is required';
    return undefined;
  }, [cardName, touched.cardName]);

  const cardNumberError = useMemo(() => {
    if (!touched.cardNumber) return undefined;
    const digits = formattedCardNumber.replace(/\s/g, '');
    if (digits.length < 13) return 'Enter a valid card number';
    return undefined;
  }, [formattedCardNumber, touched.cardNumber]);

  const expiryError = useMemo(() => {
    if (!touched.expiry) return undefined;
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(formattedExpiry)) return 'Enter a valid expiry (MM/YY)';
    return undefined;
  }, [formattedExpiry, touched.expiry]);

  const cvcError = useMemo(() => {
    if (!touched.cvc) return undefined;
    const digits = cvc.replace(/\D/g, '');
    if (digits.length < 3) return 'Enter a valid CVC';
    return undefined;
  }, [cvc, touched.cvc]);

  const postalCodeError = useMemo(() => {
    if (!touched.postalCode) return undefined;
    if (!postalCode.trim()) return 'Postal code is required';
    return undefined;
  }, [postalCode, touched.postalCode]);

  const canSubmit =
    !cardNameError &&
    !cardNumberError &&
    !expiryError &&
    !cvcError &&
    !postalCodeError &&
    cardName &&
    formattedCardNumber &&
    formattedExpiry &&
    cvc &&
    postalCode;

  const handleStartTrial = async () => {
    setTouched({
      cardName: true,
      cardNumber: true,
      expiry: true,
      cvc: true,
      postalCode: true,
    });

    if (!canSubmit) {
      Alert.alert('Payment details missing', 'Please complete your card information to continue.');
      return;
    }

    const email = route.params?.email;
    const password = route.params?.password;
    if (!email || !password) {
      Alert.alert('Unable to start trial', 'Missing account details. Please sign up again.');
      return;
    }

    try {
      await startTrial(email, password);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' as never }],
      });
    } catch (error) {
      const verificationRequired =
        typeof error === 'object' &&
        error !== null &&
        (error as { verificationRequired?: boolean }).verificationRequired;
      if (verificationRequired) {
        navigation.replace('VerifyEmail', {
          email,
          nextScreen: 'BillingPayments',
          nextParams: route.params,
        });
        return;
      }
      Alert.alert('Trial activation failed', error instanceof Error ? error.message : 'Unable to start trial');
    }
  };

  const paymentMethods = [
    {
      id: 1,
      type: 'card',
      brand: 'Visa',
      last4: '4242',
      expiry: '12/26',
      isDefault: true,
    },
    {
      id: 2,
      type: 'card',
      brand: 'Mastercard',
      last4: '8888',
      expiry: '08/25',
      isDefault: false,
    },
  ];

  const billingHistory = [
    {
      id: 1,
      date: 'Dec 20, 2024',
      description: 'Premium Plan - Monthly',
      amount: '$29.99',
      status: 'Paid',
      invoice: 'INV-2024-12-001',
    },
    {
      id: 2,
      date: 'Nov 20, 2024',
      description: 'Premium Plan - Monthly',
      amount: '$29.99',
      status: 'Paid',
      invoice: 'INV-2024-11-001',
    },
    {
      id: 3,
      date: 'Oct 20, 2024',
      description: 'Premium Plan - Monthly',
      amount: '$29.99',
      status: 'Paid',
      invoice: 'INV-2024-10-001',
    },
    {
      id: 4,
      date: 'Sep 20, 2024',
      description: 'Premium Plan - Monthly',
      amount: '$29.99',
      status: 'Paid',
      invoice: 'INV-2024-09-001',
    },
  ];

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text variant="h3" style={styles.headerTitle}>
          Billing & Payments
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        <Container>
          {setupTrial && (
            <View style={styles.section}>
              <Text variant="h4" style={styles.sectionTitle}>
                Add a payment method
              </Text>
              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.sectionSubtitle}>
                Your card won’t be charged today. You’ll pay $0 until the 7-day free trial ends.
              </Text>

              <Card style={[styles.trialSummaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.trialSummaryRow}>
                  <Text variant="body" style={styles.trialSummaryLabel}>
                    Due today
                  </Text>
                  <Text variant="h3" style={styles.trialSummaryValue}>
                    $0.00
                  </Text>
                </View>
                <Text variant="caption" color={theme.colors.textSecondary}>
                  After the trial, you’ll be billed ${selectedPrice} per {billingLabel}. Cancel anytime.
                </Text>
              </Card>

              <Card style={[styles.paymentFormCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Input
                  label="Name on Card"
                  value={cardName}
                  onChangeText={(value) => {
                    setCardName(value);
                    if (!touched.cardName) setTouched((prev) => ({ ...prev, cardName: true }));
                  }}
                  placeholder="Jane Trader"
                  error={cardNameError}
                />
                <Input
                  label="Card Number"
                  value={formattedCardNumber}
                  onChangeText={(value) => {
                    setCardNumber(value);
                    if (!touched.cardNumber) setTouched((prev) => ({ ...prev, cardNumber: true }));
                  }}
                  placeholder="4242 4242 4242 4242"
                  keyboardType="numeric"
                  error={cardNumberError}
                />
                <View style={styles.inlineRow}>
                  <View style={styles.inlineField}>
                    <Input
                      label="Expiry"
                      value={formattedExpiry}
                      onChangeText={(value) => {
                        setExpiry(value);
                        if (!touched.expiry) setTouched((prev) => ({ ...prev, expiry: true }));
                      }}
                      placeholder="MM/YY"
                      keyboardType="numeric"
                      error={expiryError}
                    />
                  </View>
                  <View style={styles.inlineField}>
                    <Input
                      label="CVC"
                      value={cvc}
                      onChangeText={(value) => {
                        setCvc(value.replace(/\D/g, '').slice(0, 4));
                        if (!touched.cvc) setTouched((prev) => ({ ...prev, cvc: true }));
                      }}
                      placeholder="123"
                      keyboardType="numeric"
                      error={cvcError}
                    />
                  </View>
                </View>
                <Input
                  label="Postal Code"
                  value={postalCode}
                  onChangeText={(value) => {
                    setPostalCode(value);
                    if (!touched.postalCode) setTouched((prev) => ({ ...prev, postalCode: true }));
                  }}
                  placeholder="10001"
                  keyboardType="numeric"
                  error={postalCodeError}
                />

                <Button
                  title={isLoading ? 'Starting 7-day free trial...' : 'Save Card & Start 7-Day Free Trial'}
                  onPress={handleStartTrial}
                  variant="primary"
                  size="large"
                  disabled={!canSubmit || isLoading}
                  style={styles.trialSubmitButton}
                />
              </Card>
            </View>
          )}

          {!setupTrial && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="h4" style={styles.sectionTitle}>
                Payment Methods
              </Text>
              <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.colors.primary }]}>
                <Icon name="add" size={20} color="#fff" />
                <Text variant="bodySmall" style={styles.addButtonText}>
                  Add New
                </Text>
              </TouchableOpacity>
            </View>

            {paymentMethods.map((method) => (
              <Card key={method.id} style={[styles.paymentCard, { backgroundColor: theme.colors.surface, borderColor: method.isDefault ? theme.colors.primary : theme.colors.border }, method.isDefault && { borderWidth: 2 }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, { backgroundColor: `${theme.colors.primary}14` }]}>
                    <Icon name="card-outline" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text variant="body" style={styles.cardBrand}>
                      {method.brand} •••• {method.last4}
                    </Text>
                    <Text variant="caption" color={theme.colors.textSecondary}>
                      Expires {method.expiry}
                    </Text>
                  </View>
                  {method.isDefault && (
                    <View style={[styles.defaultBadge, { backgroundColor: theme.colors.primary }]}>
                      <Text variant="caption" style={styles.defaultText}>
                        Default
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardActions}>
                  {!method.isDefault && (
                    <TouchableOpacity style={styles.actionButton}>
                      <Icon name="checkmark-circle-outline" size={18} color={theme.colors.primary} />
                      <Text variant="bodySmall" style={[styles.actionText, { color: theme.colors.primary }]}>
                        Set as Default
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.actionButton}>
                    <Icon name="create-outline" size={18} color={theme.colors.text} />
                    <Text variant="bodySmall" style={styles.actionText}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Icon name="trash-outline" size={18} color="#f44336" />
                    <Text variant="bodySmall" style={[styles.actionText, { color: '#f44336' }]}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
          )}

          {!setupTrial && (
          <View style={styles.section}>
            <Text variant="h4" style={styles.sectionTitle}>
              Billing History
            </Text>

            <Card style={[styles.historyCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              {billingHistory.map((item, idx) => (
                <View key={item.id} style={[styles.historyItem, idx < billingHistory.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}>
                  <View style={styles.historyLeft}>
                    <View style={[styles.historyIcon, { backgroundColor: '#4CAF5014' }]}>
                      <Icon name="checkmark-circle" size={20} color="#4CAF50" />
                    </View>
                    <View style={styles.historyInfo}>
                      <Text variant="body" style={styles.historyDescription}>
                        {item.description}
                      </Text>
                      <Text variant="caption" color={theme.colors.textSecondary}>
                        {item.date} • {item.invoice}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historyRight}>
                    <Text variant="body" style={styles.historyAmount}>
                      {item.amount}
                    </Text>
                    <TouchableOpacity style={styles.downloadButton}>
                      <Icon name="download-outline" size={18} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </Card>
          </View>
          )}

          {!setupTrial && (
          <View style={styles.section}>
            <Text variant="h4" style={styles.sectionTitle}>
              Billing Information
            </Text>

            <Card style={[styles.infoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.infoRow}>
                <Text variant="bodySmall" color={theme.colors.textSecondary}>
                  Billing Email
                </Text>
                <Text variant="body" style={styles.infoValue}>
                  john.trader@email.com
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="bodySmall" color={theme.colors.textSecondary}>
                  Billing Address
                </Text>
                <Text variant="body" style={styles.infoValue}>
                  123 Trading St, Honolulu, HI 96813
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="bodySmall" color={theme.colors.textSecondary}>
                  Tax ID
                </Text>
                <Text variant="body" style={styles.infoValue}>
                  Not provided
                </Text>
              </View>
              <TouchableOpacity style={styles.editInfoButton}>
                <Icon name="create-outline" size={18} color={theme.colors.primary} />
                <Text variant="body" style={[styles.editInfoText, { color: theme.colors.primary }]}>
                  Edit Billing Information
                </Text>
              </TouchableOpacity>
            </Card>
          </View>
          )}

          {!setupTrial && (
          <View style={styles.section}>
            <Text variant="h4" style={styles.sectionTitle}>
              Quick Actions
            </Text>

            <Card style={[styles.actionsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <TouchableOpacity style={styles.quickAction}>
                <Icon name="receipt-outline" size={22} color={theme.colors.text} />
                <Text variant="body" style={styles.quickActionText}>
                  Download All Invoices
                </Text>
                <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction}>
                <Icon name="card-outline" size={22} color={theme.colors.text} />
                <Text variant="body" style={styles.quickActionText}>
                  Update Payment Method
                </Text>
                <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction}>
                <Icon name="help-circle-outline" size={22} color={theme.colors.text} />
                <Text variant="body" style={styles.quickActionText}>
                  Billing Support
                </Text>
                <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </Card>
          </View>
          )}
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
  section: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '900',
  },
  sectionSubtitle: {
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 4,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  paymentCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  paymentFormCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  trialSummaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  trialSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  trialSummaryLabel: {
    fontWeight: '700',
  },
  trialSummaryValue: {
    fontWeight: '800',
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inlineField: {
    flex: 1,
  },
  trialSubmitButton: {
    marginTop: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardBrand: {
    fontWeight: '700',
    marginBottom: 4,
  },
  defaultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  defaultText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontWeight: '600',
    fontSize: 13,
  },
  historyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyInfo: {
    flex: 1,
  },
  historyDescription: {
    fontWeight: '700',
    marginBottom: 4,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyAmount: {
    fontWeight: '800',
  },
  downloadButton: {
    padding: 4,
  },
  infoCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoValue: {
    fontWeight: '700',
    marginTop: 4,
  },
  editInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    marginTop: 8,
  },
  editInfoText: {
    fontWeight: '700',
  },
  actionsCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  quickActionText: {
    flex: 1,
    fontWeight: '600',
  },
});
