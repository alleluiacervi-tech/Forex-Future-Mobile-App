import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AdminModeToggle() {
  const { user } = useAuth();
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  // Determine current route name
  const currentRoute = useNavigationState((state) => {
    if (!state?.routes?.length) return '';
    return state.routes[state.index]?.name || '';
  });

  if (!user?.isAdmin) return null;

  const isInAdminMode = currentRoute.startsWith('Admin');

  const toggle = () => {
    if (isInAdminMode) {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] });
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        { backgroundColor: isInAdminMode ? theme.colors.accent : theme.colors.primary },
      ]}
      onPress={toggle}
      activeOpacity={0.7}
    >
      <Icon
        name={isInAdminMode ? 'person' : 'admin-panel-settings'}
        size={26}
        color="#FFFFFF"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 999,
  },
});
