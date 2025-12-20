import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { TouchableOpacity } from 'react-native';

export default function LicensesScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const licenses = [
    {
      icon: 'shield-checkmark-outline',
      color: '#4CAF50',
      title: 'Financial Services License',
      details: [
        'License Number: FSL-2024-8472',
        'Issued by: Financial Services Regulatory Authority',
        'Valid Until: December 31, 2026',
        'Authorized to provide forex trading information and educational services',
      ],
    },
    {
      icon: 'document-text-outline',
      color: '#2196F3',
      title: 'Data Protection Registration',
      details: [
        'Registration Number: DPR-2024-5631',
        'Issued by: Data Protection Commission',
        'Compliance with GDPR and local data protection laws',
        'Annual audit and compliance review completed',
      ],
    },
    {
      icon: 'business-outline',
      color: '#FF9800',
      title: 'Business Registration',
      details: [
        'Company Name: Forex Future Inc.',
        'Registration Number: BRN-2024-1234',
        'Registered Address: 123 Trading Street, Financial District, HI 96813',
        'Incorporation Date: January 15, 2024',
      ],
    },
  ];

  const compliance = [
    {
      title: 'Anti-Money Laundering (AML)',
      description: 'We maintain strict AML policies and procedures in accordance with international standards and local regulations. All users undergo identity verification and transaction monitoring.',
    },
    {
      title: 'Know Your Customer (KYC)',
      description: 'We implement comprehensive KYC procedures to verify user identities and ensure platform security. This includes document verification and ongoing monitoring.',
    },
    {
      title: 'Financial Conduct Standards',
      description: 'We adhere to the highest standards of financial conduct, including fair dealing, transparency, and client asset protection.',
    },
    {
      title: 'Data Security Standards',
      description: 'We comply with ISO 27001 information security standards and maintain SOC 2 Type II certification for data handling and security practices.',
    },
    {
      title: 'Consumer Protection',
      description: 'We follow consumer protection regulations including clear disclosure of risks, transparent pricing, and fair treatment of clients.',
    },
  ];

  const regulatoryBodies = [
    {
      name: 'Financial Services Regulatory Authority (FSRA)',
      role: 'Primary regulator for financial services',
      website: 'www.fsra.gov',
    },
    {
      name: 'Securities and Exchange Commission (SEC)',
      role: 'Oversight of securities and investment activities',
      website: 'www.sec.gov',
    },
    {
      name: 'Data Protection Commission',
      role: 'Data privacy and protection oversight',
      website: 'www.dataprotection.gov',
    },
  ];

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text variant="h3" style={styles.headerTitle}>
          Licenses & Compliance
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        <Container>
          <Text variant="body" color={theme.colors.textSecondary} style={styles.intro}>
            Forex Future operates in full compliance with applicable financial regulations and maintains all necessary licenses to provide our services. We are committed to transparency and regulatory adherence.
          </Text>

          <Text variant="h4" style={styles.sectionHeader}>
            Our Licenses
          </Text>

          {licenses.map((license, idx) => (
            <Card key={idx} style={[styles.licenseCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.licenseHeader}>
                <View style={[styles.licenseIcon, { backgroundColor: `${license.color}14` }]}>
                  <Icon name={license.icon} size={28} color={license.color} />
                </View>
                <Text variant="h4" style={styles.licenseTitle}>
                  {license.title}
                </Text>
              </View>
              {license.details.map((detail, detailIdx) => (
                <View key={detailIdx} style={styles.detailRow}>
                  <Icon name="checkmark-circle" size={18} color={license.color} />
                  <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.detailText}>
                    {detail}
                  </Text>
                </View>
              ))}
            </Card>
          ))}

          <Text variant="h4" style={styles.sectionHeader}>
            Compliance Standards
          </Text>

          <Card style={[styles.complianceCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {compliance.map((item, idx) => (
              <View key={idx} style={[styles.complianceItem, idx < compliance.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}>
                <View style={styles.complianceHeader}>
                  <Icon name="shield-checkmark" size={20} color={theme.colors.primary} />
                  <Text variant="body" style={styles.complianceTitle}>
                    {item.title}
                  </Text>
                </View>
                <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.complianceDescription}>
                  {item.description}
                </Text>
              </View>
            ))}
          </Card>

          <Text variant="h4" style={styles.sectionHeader}>
            Regulatory Bodies
          </Text>

          {regulatoryBodies.map((body, idx) => (
            <Card key={idx} style={[styles.regulatorCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.regulatorHeader}>
                <Icon name="business" size={24} color={theme.colors.primary} />
                <View style={styles.regulatorInfo}>
                  <Text variant="body" style={styles.regulatorName}>
                    {body.name}
                  </Text>
                  <Text variant="caption" color={theme.colors.textSecondary} style={styles.regulatorRole}>
                    {body.role}
                  </Text>
                </View>
              </View>
              <View style={[styles.websiteBadge, { backgroundColor: `${theme.colors.primary}14` }]}>
                <Icon name="globe-outline" size={14} color={theme.colors.primary} />
                <Text variant="caption" style={[styles.websiteText, { color: theme.colors.primary }]}>
                  {body.website}
                </Text>
              </View>
            </Card>
          ))}

          <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Icon name="ribbon-outline" size={32} color={theme.colors.primary} />
            <Text variant="body" style={styles.footerTitle}>
              Fully Licensed & Compliant
            </Text>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.footerText}>
              We maintain the highest standards of regulatory compliance and undergo regular audits to ensure we meet all legal and ethical requirements.
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
    marginBottom: 24,
    lineHeight: 22,
  },
  sectionHeader: {
    fontWeight: '900',
    marginBottom: 16,
  },
  licenseCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  licenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  licenseIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  licenseTitle: {
    fontWeight: '800',
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  detailText: {
    flex: 1,
    lineHeight: 20,
  },
  complianceCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  complianceItem: {
    padding: 16,
  },
  complianceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  complianceTitle: {
    fontWeight: '700',
  },
  complianceDescription: {
    lineHeight: 20,
    marginLeft: 28,
  },
  regulatorCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  regulatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  regulatorInfo: {
    flex: 1,
  },
  regulatorName: {
    fontWeight: '700',
    marginBottom: 4,
  },
  regulatorRole: {
    lineHeight: 16,
  },
  websiteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  websiteText: {
    fontWeight: '600',
    fontSize: 12,
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
