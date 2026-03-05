import React, { useState } from 'react';
import type { ComponentProps } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { useAuth } from '../../context/AuthContext';

export default function SecurityScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { changePassword } = useAuth();

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);

  // Change password modal state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Error', 'Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert('Success', 'Your password has been changed.');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const SecurityItem = ({ icon, title, subtitle, onPress, hasSwitch, switchValue, onSwitchChange, iconColor }: {
    icon: ComponentProps<typeof Icon>['name'];
    title: string;
    subtitle: string;
    onPress?: () => void;
    hasSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void;
    iconColor?: string;
  }) => (
    <TouchableOpacity
      activeOpacity={hasSwitch ? 1 : 0.7}
      onPress={hasSwitch ? undefined : onPress}
      style={[styles.securityItem, { borderBottomColor: theme.colors.border }]}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${iconColor || theme.colors.primary}14` }]}>
        <Icon name={icon} size={22} color={iconColor || theme.colors.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text variant="body" style={styles.itemTitle}>
          {title}
        </Text>
        <Text variant="caption" color={theme.colors.textSecondary} style={styles.itemSubtitle}>
          {subtitle}
        </Text>
      </View>
      {hasSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}88` }}
          thumbColor={switchValue ? theme.colors.primary : theme.colors.textSecondary}
          ios_backgroundColor={theme.colors.border}
        />
      ) : (
        <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text variant="h3" style={styles.headerTitle}>
          Security
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        <Container>
          <View style={[styles.statusCard, { backgroundColor: '#4CAF5014', borderColor: '#4CAF50' }]}>
            <Icon name="shield-checkmark" size={48} color="#4CAF50" />
            <Text variant="h4" style={[styles.statusTitle, { color: '#4CAF50' }]}>
              Account Secured
            </Text>
            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.statusText}>
              Your account is protected with a strong password
            </Text>
          </View>

          <Text variant="h4" style={styles.sectionTitle}>
            Authentication
          </Text>

          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <SecurityItem
              icon="key-outline"
              title="Change Password"
              subtitle="Update your account password"
              onPress={() => setShowPasswordForm(!showPasswordForm)}
            />

            {showPasswordForm && (
              <View style={[styles.passwordForm, { borderTopColor: theme.colors.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                  placeholder="Current password"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                  placeholder="New password"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                  placeholder="Confirm new password"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                />
                <View style={styles.passwordButtons}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { borderColor: theme.colors.border }]}
                    onPress={() => {
                      setShowPasswordForm(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                  >
                    <Text variant="bodySmall" color={theme.colors.textSecondary}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                    onPress={handleChangePassword}
                    disabled={changingPassword}
                  >
                    <Text variant="bodySmall" style={{ color: '#fff', fontWeight: '700' }}>
                      {changingPassword ? 'Saving...' : 'Update Password'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <SecurityItem
              icon="shield-outline"
              title="Two-Factor Authentication"
              subtitle="Add extra layer of security"
              hasSwitch
              switchValue={twoFactorEnabled}
              onSwitchChange={setTwoFactorEnabled}
            />
            <SecurityItem
              icon="finger-print-outline"
              title="Biometric Login"
              subtitle="Use fingerprint or face ID"
              onPress={() => {}}
            />
          </Card>

          <Text variant="h4" style={styles.sectionTitle}>
            Login Activity
          </Text>

          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <SecurityItem
              icon="mail-outline"
              title="Email Notifications"
              subtitle="Get notified of security events"
              hasSwitch
              switchValue={emailNotifications}
              onSwitchChange={setEmailNotifications}
            />
            <SecurityItem
              icon="notifications-outline"
              title="Login Alerts"
              subtitle="Alert on new device login"
              hasSwitch
              switchValue={loginAlerts}
              onSwitchChange={setLoginAlerts}
            />
            <SecurityItem
              icon="time-outline"
              title="Active Sessions"
              subtitle="Manage logged-in devices"
              onPress={() => {}}
            />
          </Card>

          <Text variant="h4" style={styles.sectionTitle}>
            Advanced Security
          </Text>

          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <SecurityItem
              icon="download-outline"
              title="Download Security Report"
              subtitle="Get detailed security analysis"
              onPress={() => {}}
            />
            <SecurityItem
              icon="warning-outline"
              title="Security Recommendations"
              subtitle="View personalized security tips"
              onPress={() => {}}
              iconColor="#FF9800"
            />
            <SecurityItem
              icon="trash-outline"
              title="Revoke All Sessions"
              subtitle="Sign out from all devices"
              onPress={() => {}}
              iconColor="#f44336"
            />
          </Card>
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
  statusCard: {
    borderWidth: 2,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  statusTitle: {
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 8,
  },
  statusText: {
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionTitle: {
    fontWeight: '900',
    marginBottom: 12,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  itemSubtitle: {
    lineHeight: 16,
  },
  passwordForm: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 14,
  },
  passwordButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
