// ADDED: push notification service (CHECK 2 + CHECK 13)
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiAuthPost } from './api';

// ADDED: configure how foreground notifications appear
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests push notification permissions and returns an Expo push token.
 * Returns null if permissions denied or not a physical device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // ADDED: push only works on physical devices
  if (!Device.isDevice) {
    console.log('[Push] Not a physical device, skipping registration');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted');
    return null;
  }

  // ADDED: Android channel for notifications
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00CFEA',
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    return tokenData.data;
  } catch (error) {
    console.error('[Push] Failed to get push token:', error);
    return null;
  }
}

/**
 * Registers the push token with the backend.
 */
export async function savePushTokenToServer(token: string): Promise<void> {
  try {
    await apiAuthPost('/api/push/register', {
      token,
      platform: Platform.OS,
    });
    console.log('[Push] Token registered with server');
  } catch (error) {
    console.error('[Push] Failed to register token with server:', error);
  }
}

/**
 * Adds a listener for when a notification is tapped (app opened from notification).
 * Returns an unsubscribe function.
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(callback);
  return () => subscription.remove();
}

/**
 * Adds a listener for foreground notifications.
 * Returns an unsubscribe function.
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void,
): () => void {
  const subscription = Notifications.addNotificationReceivedListener(callback);
  return () => subscription.remove();
}
