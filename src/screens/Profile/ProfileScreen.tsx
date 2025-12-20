import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import TopNavBar from '../../components/navigation/TopNavBar';
import { useTheme } from '../../hooks';
import { RootStackParamList } from '../../types';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<ProfileScreenNavigationProp>();

  const MenuItem = ({ icon, title, subtitle, onPress, showChevron = true }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    showChevron?: boolean;
  }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${theme.colors.primary}14` }]}>
        <Icon name={icon} size={22} color={theme.colors.primary} />
      </View>
      <View style={styles.menuContent}>
        <Text variant="body" style={styles.menuTitle}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="caption" color={theme.colors.textSecondary} style={styles.menuSubtitle}>
            {subtitle}
          </Text>
        )}
      </View>
      {showChevron && (
        <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper>
      <TopNavBar />
      <ScrollView style={styles.scrollView}>
        <Container>
          <View style={[styles.profileHeader, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.avatarCircle, { backgroundColor: `${theme.colors.primary}22`, borderColor: theme.colors.primary }]}>
              <Icon name="person" size={48} color={theme.colors.primary} />
            </View>
            <Text variant="h3" style={styles.userName}>
              Trader Account
            </Text>
            <Text variant="caption" color={theme.colors.textSecondary}>
              Professional Trading Platform
            </Text>
          </View>

          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.sectionLabel}>
              ACCOUNT
            </Text>
            <Card style={[styles.menuCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MenuItem
                icon="settings-outline"
                title="Settings"
                subtitle="App preferences and configuration"
                onPress={() => navigation.navigate('Settings')}
              />
              <MenuItem
                icon="card-outline"
                title="Subscription"
                subtitle="Manage your plan"
                onPress={() => navigation.navigate('Subscription')}
              />
              <MenuItem
                icon="notifications-outline"
                title="Notifications"
                subtitle="Alert preferences"
                onPress={() => {}}
              />
            </Card>
          </View>

          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.sectionLabel}>
              APP INFO
            </Text>
            <Card style={[styles.menuCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MenuItem
                icon="information-circle-outline"
                title="About"
                subtitle="App version and details"
                onPress={() => navigation.navigate('About')}
              />
              <MenuItem
                icon="document-text-outline"
                title="Terms & Privacy"
                subtitle="Legal information"
                onPress={() => {}}
              />
            </Card>
          </View>

          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.sectionLabel}>
              SUPPORT
            </Text>
            <Card style={[styles.menuCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MenuItem
                icon="help-circle-outline"
                title="Help Center"
                subtitle="Get support and answers"
                onPress={() => {}}
              />
              <MenuItem
                icon="mail-outline"
                title="Contact Us"
                subtitle="Send feedback or report issues"
                onPress={() => {}}
              />
            </Card>
          </View>

          <View style={styles.footer}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.footerText}>
              Forex Future v1.0.0
            </Text>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.footerText}>
              AI-driven market insights • Not financial advice
            </Text>
          </View>
        </Container>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
  },
  userName: {
    fontWeight: '900',
    marginBottom: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  footerText: {
    textAlign: 'center',
  },
});

