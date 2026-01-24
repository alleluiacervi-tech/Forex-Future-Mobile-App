import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';

export default function BillingPaymentsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

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
