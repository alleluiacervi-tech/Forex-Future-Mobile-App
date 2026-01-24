import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { TouchableOpacity } from 'react-native';

export default function PrivacyPolicyScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const sections = [
    {
      title: '1. Information We Collect',
      content: [
        'Personal Information: Name, email address, phone number, and account credentials.',
        'Trading Data: Trading history, preferences, watchlists, and portfolio information.',
        'Device Information: Device type, operating system, unique device identifiers, and mobile network information.',
        'Usage Data: App interactions, features used, time spent, and navigation patterns.',
        'Location Data: Approximate location based on IP address for regulatory compliance.',
      ],
    },
    {
      title: '2. How We Use Your Information',
      content: [
        'Provide and maintain our trading platform and services.',
        'Process transactions and send transaction notifications.',
        'Deliver personalized market insights and AI-driven recommendations.',
        'Improve app functionality, user experience, and develop new features.',
        'Communicate important updates, security alerts, and promotional offers.',
        'Ensure platform security and prevent fraudulent activities.',
        'Comply with legal obligations and regulatory requirements.',
      ],
    },
    {
      title: '3. Data Sharing and Disclosure',
      content: [
        'Service Providers: We share data with trusted third-party service providers who assist in operating our platform (cloud hosting, analytics, customer support).',
        'Legal Requirements: We may disclose information when required by law, court order, or government request.',
        'Business Transfers: In case of merger, acquisition, or sale of assets, your information may be transferred.',
        'With Your Consent: We may share information with your explicit consent for specific purposes.',
        'We do NOT sell your personal information to third parties for marketing purposes.',
      ],
    },
    {
      title: '4. Data Security',
      content: [
        'Industry-standard encryption (SSL/TLS) for data transmission.',
        'Secure data storage with encrypted databases and regular security audits.',
        'Multi-factor authentication and biometric login options.',
        'Regular security updates and vulnerability assessments.',
        'Limited employee access to personal data on a need-to-know basis.',
        'However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.',
      ],
    },
    {
      title: '5. Your Privacy Rights',
      content: [
        'Access: Request a copy of your personal data we hold.',
        'Correction: Update or correct inaccurate information.',
        'Deletion: Request deletion of your account and personal data (subject to legal retention requirements).',
        'Opt-Out: Unsubscribe from marketing communications at any time.',
        'Data Portability: Request your data in a machine-readable format.',
        'Withdraw Consent: Withdraw consent for data processing where applicable.',
      ],
    },
    {
      title: '6. Data Retention',
      content: [
        'We retain your personal information for as long as your account is active or as needed to provide services.',
        'After account deletion, we may retain certain information for legal, regulatory, or legitimate business purposes.',
        'Trading records and transaction history are retained for 7 years as required by financial regulations.',
        'Anonymized and aggregated data may be retained indefinitely for analytics and research.',
      ],
    },
    {
      title: '7. Cookies and Tracking',
      content: [
        'We use cookies and similar technologies to enhance user experience and analyze app usage.',
        'Essential Cookies: Required for app functionality and security.',
        'Analytics Cookies: Help us understand how users interact with our platform.',
        'You can manage cookie preferences through your device settings.',
      ],
    },
    {
      title: '8. Children\'s Privacy',
      content: [
        'Our services are not intended for individuals under 18 years of age.',
        'We do not knowingly collect personal information from children.',
        'If we become aware of data collected from children, we will take steps to delete it promptly.',
      ],
    },
    {
      title: '9. International Data Transfers',
      content: [
        'Your information may be transferred to and processed in countries other than your country of residence.',
        'We ensure appropriate safeguards are in place to protect your data in accordance with applicable laws.',
        'By using our services, you consent to the transfer of your information to our facilities and service providers globally.',
      ],
    },
    {
      title: '10. Changes to This Policy',
      content: [
        'We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements.',
        'We will notify you of significant changes via email or in-app notification.',
        'Continued use of the app after changes constitutes acceptance of the updated policy.',
        'Last Updated: December 20, 2024',
      ],
    },
    {
      title: '11. Contact Us',
      content: [
        'If you have questions or concerns about this Privacy Policy or our data practices, please contact us:',
        'Email: privacy@forexfuture.com',
        'Address: Forex Future Inc., 123 Trading Street, Financial District, HI 96813',
        'Data Protection Officer: dpo@forexfuture.com',
      ],
    },
  ];

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text variant="h3" style={styles.headerTitle}>
          Privacy Policy
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        <Container>
          <Text variant="body" color={theme.colors.textSecondary} style={styles.intro}>
            At Forex Future, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your data when you use our mobile application.
          </Text>

          <View style={[styles.updateBadge, { backgroundColor: `${theme.colors.primary}14`, borderColor: `${theme.colors.primary}44` }]}>
            <Icon name="time-outline" size={16} color={theme.colors.primary} />
            <Text variant="caption" style={[styles.updateText, { color: theme.colors.primary }]}>
              Last Updated: December 20, 2024
            </Text>
          </View>

          {sections.map((section, idx) => (
            <Card key={idx} style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text variant="h4" style={styles.sectionTitle}>
                {section.title}
              </Text>
              {section.content.map((item, itemIdx) => (
                <View key={itemIdx} style={styles.contentRow}>
                  <View style={[styles.bullet, { backgroundColor: theme.colors.primary }]} />
                  <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.contentText}>
                    {item}
                  </Text>
                </View>
              ))}
            </Card>
          ))}

          <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Icon name="shield-checkmark" size={32} color={theme.colors.primary} />
            <Text variant="body" style={styles.footerTitle}>
              Your Privacy Matters
            </Text>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.footerText}>
              We are committed to transparency and protecting your personal information. If you have any questions or concerns, please don't hesitate to contact us.
            </Text>
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
  intro: {
    marginTop: 16,
    marginBottom: 16,
    lineHeight: 22,
  },
  updateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
    gap: 6,
  },
  updateText: {
    fontWeight: '700',
    fontSize: 12,
  },
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '900',
    marginBottom: 12,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 7,
    marginRight: 10,
  },
  contentText: {
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  footerTitle: {
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 8,
  },
  footerText: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
