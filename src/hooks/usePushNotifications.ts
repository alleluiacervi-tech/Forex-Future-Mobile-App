// ADDED: push notification hook for registration + deep linking (CHECK 2 + CHECK 13)
import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import {
  registerForPushNotifications,
  savePushTokenToServer,
  addNotificationResponseListener,
} from '../services/pushNotifications';

/**
 * Registers for push notifications when authenticated,
 * and handles deep-linking from tapped notifications.
 */
export function usePushNotifications(isAuthenticated: boolean) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const registered = useRef(false);

  // ADDED: register push token on login
  useEffect(() => {
    if (!isAuthenticated || registered.current) return;
    registered.current = true;

    (async () => {
      const token = await registerForPushNotifications();
      if (token) {
        await savePushTokenToServer(token);
      }
    })();
  }, [isAuthenticated]);

  // ADDED: handle notification tap → navigate to relevant screen
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.pair) {
        navigation.navigate('CurrencyDetail', { pair: data.pair as string });
      } else {
        // Default: go to notifications tab
        navigation.navigate('Main' as any);
      }
    });

    return unsubscribe;
  }, [isAuthenticated, navigation]);
}
