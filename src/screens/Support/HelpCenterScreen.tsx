import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';

export default function HelpCenterScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const categories = [
    {
      icon: 'rocket-outline',
      title: 'Getting Started',
      color: '#4CAF50',
      articles: 5,
    },
    {
      icon: 'card-outline',
      title: 'Subscription & Billing',
      color: '#2196F3',
      articles: 8,
    },
    {
      icon: 'stats-chart-outline',
      title: 'Trading & Analysis',
      color: '#FF9800',
      articles: 12,
    },
    {
      icon: 'shield-outline',
      title: 'Security & Privacy',
      color: '#9C27B0',
      articles: 6,
    },
  ];

  const faqs = [
    {
      id: 1,
      question: 'How do smart volatility alerts work?',
      answer: 'Forex Future monitors live price movements and triggers alerts when a pair makes a significant move within common time windows (for example 1m, 15m, 1h). Each alert includes the timeframe and % change so you can quickly judge impact. Alerts are informational only — not financial advice.',
    },
    {
      id: 2,
      question: 'What do the EMA lines represent on the chart?',
      answer: 'EMA (Exponential Moving Average) lines show price trends over different time periods. EMA20 (blue) tracks short-term trends, EMA50 (orange) shows medium-term trends, and EMA200 (purple) indicates long-term trends. When shorter EMAs cross above longer ones, it may signal an uptrend.',
    },
    {
      id: 3,
      question: 'How do I set up price alerts?',
      answer: 'Go to any currency pair detail page, tap the bell icon, and set your desired price level. You can choose to be notified when the price goes above or below your target. Enable push notifications in Settings to receive real-time alerts.',
    },
    {
      id: 4,
      question: 'Can I cancel my subscription anytime?',
      answer: 'Yes, you can cancel your subscription at any time from Profile > Subscription Plan > Manage Subscription > Cancel Subscription. Your access will continue until the end of your current billing period, and you won\'t be charged again.',
    },
    {
      id: 5,
      question: 'What is RSI and how should I use it?',
      answer: 'RSI (Relative Strength Index) measures momentum on a scale of 0-100. Values above 70 suggest the market may be overbought (potential sell signal), while values below 30 indicate oversold conditions (potential buy signal). Use RSI alongside other indicators for better decision-making.',
    },
    {
      id: 6,
      question: 'Why did I receive an alert?',
      answer: 'Alerts trigger when volatility thresholds are met (a large move within a given window) or when a price level you set is crossed. Market data can be delayed or affected by liquidity conditions, spreads, and news events, so always verify price and context before acting.',
    },
    {
      id: 7,
      question: 'Is my financial data secure?',
      answer: 'Yes, we use bank-level encryption (SSL/TLS) to protect your data in transit and at rest. We comply with GDPR and industry security standards. We never sell your personal information to third parties. You can review our full security measures in Profile > Legal & Compliance > Privacy Policy.',
    },
    {
      id: 8,
      question: 'How do I enable two-factor authentication?',
      answer: 'Go to Profile > Security > Two-Factor Authentication and toggle it on. You\'ll receive a verification code via email or SMS each time you log in from a new device. This adds an extra layer of protection to your account.',
    },
  ];

  const quickLinks = [
    { icon: 'book-outline', title: 'User Guide', subtitle: 'Complete app documentation' },
    { icon: 'play-circle-outline', title: 'Video Tutorials', subtitle: 'Learn with step-by-step videos' },
    { icon: 'chatbubbles-outline', title: 'Community Forum', subtitle: 'Connect with other traders' },
    { icon: 'document-text-outline', title: 'API Documentation', subtitle: 'For developers and integrations' },
  ];

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text variant="h3" style={styles.headerTitle}>
          Help Center
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        <Container>
          <View style={[styles.searchCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Icon name="search-outline" size={20} color={theme.colors.textSecondary} />
            <Text variant="body" color={theme.colors.textSecondary} style={styles.searchPlaceholder}>
              Search for help...
            </Text>
          </View>

          <Text variant="h4" style={styles.sectionTitle}>
            Browse by Category
          </Text>

          <View style={styles.categoriesGrid}>
            {categories.map((category, idx) => (
              <TouchableOpacity key={idx} style={[styles.categoryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={[styles.categoryIcon, { backgroundColor: `${category.color}14` }]}>
                  <Icon name={category.icon} size={28} color={category.color} />
                </View>
                <Text variant="body" style={styles.categoryTitle}>
                  {category.title}
                </Text>
                <Text variant="caption" color={theme.colors.textSecondary}>
                  {category.articles} articles
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text variant="h4" style={styles.sectionTitle}>
            Frequently Asked Questions
          </Text>

          <Card style={[styles.faqCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {faqs.map((faq, idx) => (
              <View key={faq.id}>
                <TouchableOpacity
                  style={[styles.faqItem, idx < faqs.length - 1 && !expandedId && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}
                  onPress={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                >
                  <View style={styles.faqQuestion}>
                    <Icon name="help-circle-outline" size={20} color={theme.colors.primary} />
                    <Text variant="body" style={styles.faqQuestionText}>
                      {faq.question}
                    </Text>
                  </View>
                  <Icon
                    name={expandedId === faq.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
                {expandedId === faq.id && (
                  <View style={[styles.faqAnswer, idx < faqs.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}>
                    <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.faqAnswerText}>
                      {faq.answer}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </Card>

          <Text variant="h4" style={styles.sectionTitle}>
            Quick Links
          </Text>

          <Card style={[styles.linksCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {quickLinks.map((link, idx) => (
              <TouchableOpacity key={idx} style={[styles.linkItem, idx < quickLinks.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}>
                <View style={[styles.linkIcon, { backgroundColor: `${theme.colors.primary}14` }]}>
                  <Icon name={link.icon} size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.linkContent}>
                  <Text variant="body" style={styles.linkTitle}>
                    {link.title}
                  </Text>
                  <Text variant="caption" color={theme.colors.textSecondary}>
                    {link.subtitle}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </Card>

          <View style={[styles.contactCard, { backgroundColor: `${theme.colors.primary}14`, borderColor: theme.colors.primary }]}>
            <Icon name="chatbubble-ellipses-outline" size={32} color={theme.colors.primary} />
            <Text variant="h4" style={[styles.contactTitle, { color: theme.colors.primary }]}>
              Still Need Help?
            </Text>
            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.contactText}>
              Our support team is here to assist you 24/7
            </Text>
            <TouchableOpacity style={[styles.contactButton, { backgroundColor: theme.colors.primary }]}>
              <Text variant="body" style={styles.contactButtonText}>
                Contact Support
              </Text>
            </TouchableOpacity>
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
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    marginBottom: 24,
    gap: 10,
  },
  searchPlaceholder: {
    flex: 1,
  },
  sectionTitle: {
    fontWeight: '900',
    marginBottom: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  categoryCard: {
    flex: 1,
    minWidth: '47%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  faqCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  faqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  faqQuestionText: {
    flex: 1,
    fontWeight: '600',
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingLeft: 46,
  },
  faqAnswerText: {
    lineHeight: 20,
  },
  linksCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkContent: {
    flex: 1,
  },
  linkTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  contactCard: {
    borderWidth: 2,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  contactTitle: {
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 8,
  },
  contactText: {
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  contactButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  contactButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
});
