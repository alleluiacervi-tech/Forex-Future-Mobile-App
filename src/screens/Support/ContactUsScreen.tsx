import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';

export default function ContactUsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const contactMethods = [
    {
      icon: 'mail-outline',
      title: 'Email Support',
      subtitle: 'support@forexfuture.com',
      description: 'Response within 24 hours',
      color: '#2196F3',
    },
    {
      icon: 'chatbubbles-outline',
      title: 'Live Chat',
      subtitle: 'Available 24/7',
      description: 'Average response time: 5 minutes',
      color: '#4CAF50',
    },
    {
      icon: 'call-outline',
      title: 'Phone Support',
      subtitle: '+1 (808) 555-0123',
      description: 'Mon-Fri, 9AM-6PM HST',
      color: '#FF9800',
    },
    {
      icon: 'logo-twitter',
      title: 'Social Media',
      subtitle: '@ForexFuture',
      description: 'Follow us for updates',
      color: '#1DA1F2',
    },
  ];

  const commonTopics = [
    { icon: 'card-outline', title: 'Billing Issue', color: '#2196F3' },
    { icon: 'bug-outline', title: 'Report a Bug', color: '#f44336' },
    { icon: 'bulb-outline', title: 'Feature Request', color: '#FFC107' },
    { icon: 'shield-outline', title: 'Security Concern', color: '#9C27B0' },
    { icon: 'help-circle-outline', title: 'General Question', color: '#607D8B' },
    { icon: 'star-outline', title: 'Feedback', color: '#4CAF50' },
  ];

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text variant="h3" style={styles.headerTitle}>
          Contact Us
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        <Container>
          <Text variant="body" color={theme.colors.textSecondary} style={styles.intro}>
            We're here to help! Choose your preferred contact method or send us a message directly.
          </Text>

          <Text variant="h4" style={styles.sectionTitle}>
            Contact Methods
          </Text>

          {contactMethods.map((method, idx) => (
            <TouchableOpacity key={idx} style={[styles.methodCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={[styles.methodIcon, { backgroundColor: `${method.color}14` }]}>
                <Icon name={method.icon} size={28} color={method.color} />
              </View>
              <View style={styles.methodContent}>
                <Text variant="body" style={styles.methodTitle}>
                  {method.title}
                </Text>
                <Text variant="bodySmall" style={[styles.methodSubtitle, { color: method.color }]}>
                  {method.subtitle}
                </Text>
                <Text variant="caption" color={theme.colors.textSecondary}>
                  {method.description}
                </Text>
              </View>
              <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ))}

          <Text variant="h4" style={styles.sectionTitle}>
            Send Us a Message
          </Text>

          <Card style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.label}>
              What can we help you with?
            </Text>
            <View style={styles.topicsGrid}>
              {commonTopics.map((topic, idx) => (
                <TouchableOpacity key={idx} style={[styles.topicChip, { backgroundColor: `${topic.color}14`, borderColor: `${topic.color}44` }]}>
                  <Icon name={topic.icon} size={16} color={topic.color} />
                  <Text variant="caption" style={[styles.topicText, { color: topic.color }]}>
                    {topic.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.label}>
              Subject
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="Brief description of your issue"
              placeholderTextColor={theme.colors.textSecondary}
              value={subject}
              onChangeText={setSubject}
            />

            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.label}>
              Message
            </Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="Please provide as much detail as possible..."
              placeholderTextColor={theme.colors.textSecondary}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}>
              <Icon name="send" size={20} color="#fff" />
              <Text variant="body" style={styles.submitButtonText}>
                Send Message
              </Text>
            </TouchableOpacity>
          </Card>

          <View style={[styles.infoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Icon name="information-circle-outline" size={24} color={theme.colors.primary} />
            <View style={styles.infoContent}>
              <Text variant="body" style={styles.infoTitle}>
                Before You Contact Us
              </Text>
              <Text variant="caption" color={theme.colors.textSecondary} style={styles.infoText}>
                Check our Help Center for instant answers to common questions. Most issues can be resolved quickly through our comprehensive guides and FAQs.
              </Text>
              <TouchableOpacity style={styles.infoButton}>
                <Text variant="bodySmall" style={[styles.infoButtonText, { color: theme.colors.primary }]}>
                  Visit Help Center
                </Text>
                <Icon name="arrow-forward" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.hoursCard, { backgroundColor: `${theme.colors.primary}14`, borderColor: theme.colors.primary }]}>
            <Text variant="h4" style={[styles.hoursTitle, { color: theme.colors.primary }]}>
              Support Hours
            </Text>
            <View style={styles.hoursRow}>
              <Icon name="time-outline" size={18} color={theme.colors.primary} />
              <Text variant="bodySmall" style={[styles.hoursText, { color: theme.colors.primary }]}>
                Live Chat: 24/7
              </Text>
            </View>
            <View style={styles.hoursRow}>
              <Icon name="time-outline" size={18} color={theme.colors.primary} />
              <Text variant="bodySmall" style={[styles.hoursText, { color: theme.colors.primary }]}>
                Email: 24/7 (response within 24 hours)
              </Text>
            </View>
            <View style={styles.hoursRow}>
              <Icon name="time-outline" size={18} color={theme.colors.primary} />
              <Text variant="bodySmall" style={[styles.hoursText, { color: theme.colors.primary }]}>
                Phone: Mon-Fri, 9AM-6PM HST
              </Text>
            </View>
          </View>

          <View style={[styles.officeCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="h4" style={styles.officeTitle}>
              Office Location
            </Text>
            <View style={styles.officeRow}>
              <Icon name="location-outline" size={20} color={theme.colors.primary} />
              <View style={styles.officeContent}>
                <Text variant="body" style={styles.officeAddress}>
                  Forex Future Inc.
                </Text>
                <Text variant="bodySmall" color={theme.colors.textSecondary}>
                  123 Trading Street
                </Text>
                <Text variant="bodySmall" color={theme.colors.textSecondary}>
                  Financial District
                </Text>
                <Text variant="bodySmall" color={theme.colors.textSecondary}>
                  Honolulu, HI 96813
                </Text>
              </View>
            </View>
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
    lineHeight: 20,
  },
  sectionTitle: {
    fontWeight: '900',
    marginBottom: 16,
  },
  methodCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  methodIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodContent: {
    flex: 1,
  },
  methodTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },
  methodSubtitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  formCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontWeight: '600',
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  topicText: {
    fontWeight: '700',
    fontSize: 12,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontSize: 15,
  },
  textArea: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    fontSize: 15,
    minHeight: 120,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  infoCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontWeight: '800',
    marginBottom: 6,
  },
  infoText: {
    lineHeight: 18,
    marginBottom: 10,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoButtonText: {
    fontWeight: '700',
  },
  hoursCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  hoursTitle: {
    fontWeight: '900',
    marginBottom: 12,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  hoursText: {
    fontWeight: '600',
  },
  officeCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  officeTitle: {
    fontWeight: '900',
    marginBottom: 16,
  },
  officeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  officeContent: {
    flex: 1,
  },
  officeAddress: {
    fontWeight: '700',
    marginBottom: 6,
  },
});
