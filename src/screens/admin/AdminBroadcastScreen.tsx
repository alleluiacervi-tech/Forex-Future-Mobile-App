import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout';
import { Button, Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { apiPost } from '../../services/api';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TARGET_GROUPS = [
  { value: 'all', label: 'All Users' },
  { value: 'active', label: 'Active Subscribers' },
  { value: 'trial', label: 'Trial Users' },
  { value: 'expired', label: 'Expired Users' },
] as const;

type TabKey = 'push' | 'email';

export default function AdminBroadcastScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const [tab, setTab] = useState<TabKey>('push');
  const [sending, setSending] = useState(false);
  const [targetGroup, setTargetGroup] = useState('all');

  // Push state
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');

  // Email state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Result
  const [result, setResult] = useState<string | null>(null);

  const sendPush = useCallback(async () => {
    if (!pushTitle.trim() || !pushBody.trim()) {
      Alert.alert('Error', 'Title and body are required.');
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const data = await apiPost<{ sentCount: number; totalTokens: number }>('/api/admin/broadcast-notification', {
        title: pushTitle.trim(), body: pushBody.trim(), targetGroup,
      });
      setResult(`Push sent to ${data.sentCount} of ${data.totalTokens} devices.`);
      setPushTitle('');
      setPushBody('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send notification');
    } finally {
      setSending(false);
    }
  }, [pushTitle, pushBody, targetGroup]);

  const sendEmail = useCallback(async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      Alert.alert('Error', 'Subject and body are required.');
      return;
    }
    Alert.alert('Confirm', `Send email to ${targetGroup === 'all' ? 'all' : targetGroup} users?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send', style: 'destructive', onPress: async () => {
          setSending(true);
          setResult(null);
          try {
            const data = await apiPost<{ sentCount: number; totalUsers: number }>('/api/admin/broadcast-email', {
              subject: emailSubject.trim(), body: emailBody.trim(), targetGroup,
            });
            setResult(`Email sent to ${data.sentCount} of ${data.totalUsers} users.`);
            setEmailSubject('');
            setEmailBody('');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send email');
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  }, [emailSubject, emailBody, targetGroup]);

  return (
    <ScreenWrapper style={styles.screen}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.surface, theme.colors.background]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.bg}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text variant="h4" style={styles.headerTitle}>Broadcast</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['push', 'email'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
              onPress={() => { setTab(t); setResult(null); }}
              activeOpacity={0.7}
            >
              <Icon name={t === 'push' ? 'notifications' : 'email'} size={18} color={tab === t ? theme.colors.primary : theme.colors.textSecondary} />
              <Text variant="body" color={tab === t ? theme.colors.primary : theme.colors.textSecondary}>
                {t === 'push' ? 'Push Notification' : 'Email'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Target group */}
          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="body" style={styles.sectionTitle}>Target Group</Text>
            <View style={styles.chips}>
              {TARGET_GROUPS.map((g) => (
                <TouchableOpacity
                  key={g.value}
                  style={[
                    styles.chip,
                    { borderColor: theme.colors.border },
                    targetGroup === g.value && { backgroundColor: theme.colors.primary + '30', borderColor: theme.colors.primary },
                  ]}
                  onPress={() => setTargetGroup(g.value)}
                  activeOpacity={0.7}
                >
                  <Text variant="caption" color={targetGroup === g.value ? theme.colors.primary : theme.colors.textSecondary}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Push form */}
          {tab === 'push' && (
            <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text variant="body" style={styles.sectionTitle}>Push Notification</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.border }]}
                placeholder="Title (max 50 chars)"
                placeholderTextColor={theme.colors.textDisabled}
                value={pushTitle}
                onChangeText={(t) => setPushTitle(t.slice(0, 50))}
                maxLength={50}
              />
              <Text variant="caption" color={theme.colors.textDisabled} style={styles.charCount}>{pushTitle.length}/50</Text>
              <TextInput
                style={[styles.input, styles.textArea, { color: theme.colors.text, backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.border }]}
                placeholder="Body (max 200 chars)"
                placeholderTextColor={theme.colors.textDisabled}
                value={pushBody}
                onChangeText={(t) => setPushBody(t.slice(0, 200))}
                maxLength={200}
                multiline
                numberOfLines={4}
              />
              <Text variant="caption" color={theme.colors.textDisabled} style={styles.charCount}>{pushBody.length}/200</Text>
              <Button
                title={sending ? 'Sending...' : 'Send Push Notification'}
                onPress={sendPush}
                disabled={sending || !pushTitle.trim() || !pushBody.trim()}
                loading={sending}
              />
            </Card>
          )}

          {/* Email form */}
          {tab === 'email' && (
            <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text variant="body" style={styles.sectionTitle}>Email</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.border }]}
                placeholder="Subject"
                placeholderTextColor={theme.colors.textDisabled}
                value={emailSubject}
                onChangeText={setEmailSubject}
              />
              <TextInput
                style={[styles.input, styles.textAreaLarge, { color: theme.colors.text, backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.border }]}
                placeholder="Email body"
                placeholderTextColor={theme.colors.textDisabled}
                value={emailBody}
                onChangeText={setEmailBody}
                multiline
                numberOfLines={8}
              />
              <Button
                title={sending ? 'Sending...' : 'Send Email'}
                onPress={sendEmail}
                disabled={sending || !emailSubject.trim() || !emailBody.trim()}
                loading={sending}
              />
            </Card>
          )}

          {/* Result */}
          {result && (
            <Card style={[styles.card, { backgroundColor: theme.colors.success + '20', borderColor: theme.colors.success }]}>
              <View style={styles.resultRow}>
                <Icon name="check-circle" size={20} color={theme.colors.success} />
                <Text variant="body" color={theme.colors.success}>{result}</Text>
              </View>
            </Card>
          )}
        </ScrollView>
      </LinearGradient>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' },
  bg: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20, gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12 },
  sectionTitle: { fontWeight: '700', marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 4 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  textAreaLarge: { minHeight: 140, textAlignVertical: 'top' },
  charCount: { textAlign: 'right', marginBottom: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
