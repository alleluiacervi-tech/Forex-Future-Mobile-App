import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator, Alert, FlatList, StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout';
import { Button, Card, Text, Modal as CustomModal } from '../../components/common';
import { Input } from '../../components/common';
import { useTheme } from '../../hooks';
import { apiAuthGet, apiPost } from '../../services/api';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type UserItem = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  isAdmin: boolean;
  trialActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  suspendedAt: string | null;
  deletedAt: string | null;
  plan: string | null;
  subStatus: string | null;
  statusLabel: string;
  isFree: boolean;
};

type UsersResponse = {
  items: UserItem[];
  total: number;
  page: number;
  pages: number;
};

const FILTERS = ['All', 'Active', 'Trial', 'Suspended', 'Deleted', 'Admin'] as const;

const statusColor = (item: UserItem, colors: Record<string, string>) => {
  if (item.deletedAt) return colors.error;
  if (item.suspendedAt) return colors.warning;
  if (item.subStatus === 'active') return colors.success;
  if (item.subStatus === 'trial') return colors.info;
  return colors.textDisabled;
};

export default function AdminUsersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('All');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(async (p = 1, s = search, f = filter) => {
    if (p === 1) setLoading(true);
    try {
      const filterParam = f.toLowerCase() === 'all' ? '' : f.toLowerCase();
      const includeDeleted = f.toLowerCase() === 'deleted' ? '&includeDeleted=true' : '';
      const data = await apiAuthGet<UsersResponse>(
        `/api/admin/users?page=${p}&limit=20&search=${encodeURIComponent(s)}&filter=${filterParam}${includeDeleted}`
      );
      if (p === 1) {
        setUsers(data.items || []);
      } else {
        setUsers((prev) => [...prev, ...(data.items || [])]);
      }
      setTotal(data.total || 0);
      setPage(data.page || 1);
      setPages(data.pages || 1);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    fetchUsers(1, search, filter);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUsers(1, text, filter);
    }, 300);
  }, [fetchUsers, filter]);

  const loadMore = useCallback(() => {
    if (page < pages) fetchUsers(page + 1, search, filter);
  }, [page, pages, fetchUsers, search, filter]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }
    setCreating(true);
    try {
      await apiPost('/api/admin/users/create', {
        name: newName.trim(), email: newEmail.trim(), password: newPassword, startTrial: true,
      });
      setShowCreate(false);
      setNewName(''); setNewEmail(''); setNewPassword('');
      fetchUsers(1, search, filter);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }, [newName, newEmail, newPassword, fetchUsers, search, filter]);

  const renderUser = useCallback(({ item }: { item: UserItem }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => navigation.navigate('AdminUserDetail', { userId: item.id })}
    >
      <Card style={[styles.userCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.userTop}>
          <View style={styles.userInfo}>
            <Text variant="body" style={styles.userName}>{item.name}</Text>
            <Text variant="caption" color={theme.colors.textSecondary}>{item.email}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor(item, theme.colors) + '30' }]}>
            <Text variant="caption" color={statusColor(item, theme.colors)} style={styles.badgeText}>
              {item.statusLabel}
            </Text>
          </View>
        </View>
        <View style={styles.userBottom}>
          <Text variant="caption" color={theme.colors.textDisabled}>
            {item.plan ? `${item.plan}` : 'No plan'} {item.isFree ? '(Free)' : ''}
          </Text>
          <Text variant="caption" color={theme.colors.textDisabled}>
            {item.lastLogin ? new Date(item.lastLogin).toLocaleDateString() : 'Never'}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  ), [navigation, theme.colors]);

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
          <Text variant="h4" style={styles.headerTitle}>Users ({total})</Text>
          <TouchableOpacity onPress={() => setShowCreate(true)} activeOpacity={0.7}>
            <Icon name="person-add" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchWrap, { backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.border }]}>
          <Icon name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search users..."
            placeholderTextColor={theme.colors.textDisabled}
            value={search}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
          {search ? (
            <TouchableOpacity onPress={() => { setSearch(''); fetchUsers(1, '', filter); }} activeOpacity={0.7}>
              <Icon name="close" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter chips */}
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.chip,
                { borderColor: theme.colors.border },
                filter === f && { backgroundColor: theme.colors.primary + '30', borderColor: theme.colors.primary },
              ]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
            >
              <Text variant="caption" color={filter === f ? theme.colors.primary : theme.colors.textSecondary}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* User list */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={renderUser}
            contentContainerStyle={styles.listContent}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              <Text variant="body" color={theme.colors.textSecondary} style={styles.empty}>
                No users found.
              </Text>
            }
          />
        )}

        {/* Create User Modal */}
        <CustomModal visible={showCreate} onClose={() => setShowCreate(false)} title="Create User">
          <View style={styles.formGap}>
            <Input label="Name" value={newName} onChangeText={setNewName} placeholder="Full name" />
            <Input label="Email" value={newEmail} onChangeText={setNewEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Input label="Password" value={newPassword} onChangeText={setNewPassword} placeholder="Temporary password" secureTextEntry />
            <Button title={creating ? 'Creating...' : 'Create User'} onPress={handleCreate} disabled={creating} loading={creating} />
          </View>
        </CustomModal>
      </LinearGradient>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' },
  bg: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontWeight: '700' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, height: 44 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  listContent: { paddingBottom: 20, gap: 8 },
  userCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12 },
  userTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  userInfo: { flex: 1 },
  userName: { fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontWeight: '600', fontSize: 11 },
  userBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  empty: { textAlign: 'center', paddingVertical: 40 },
  formGap: { gap: 12 },
});
