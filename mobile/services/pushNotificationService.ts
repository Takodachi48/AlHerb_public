import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import apiClient from './apiClient';

const getExpoProjectId = (): string | null => {
    const easConfigProjectId = (Constants as any)?.easConfig?.projectId;
    if (__DEV__ && easConfigProjectId) {
        console.log('[Push] Using Constants.easConfig.projectId');
    }
    if (easConfigProjectId) return String(easConfigProjectId);
    const envProjectId = String(process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '').trim();
    if (__DEV__ && envProjectId) {
        console.log('[Push] Using EXPO_PUBLIC_EAS_PROJECT_ID');
    }
    if (envProjectId) return envProjectId;
    const extraProjectId =
        (Constants?.expoConfig?.extra as any)?.eas?.projectId ||
        (Constants as any)?.manifest?.extra?.eas?.projectId ||
        (Constants as any)?.manifest2?.extra?.eas?.projectId;
    if (__DEV__ && extraProjectId) {
        console.log('[Push] Using Constants.expoConfig.extra.eas.projectId');
    }
    return extraProjectId ? String(extraProjectId) : null;
};

/**
 * Requests push notification permissions and registers the Expo Push Token
 * with the backend. Should be called once after login on a physical device.
 * Returns the token string or null if unavailable (simulator / permission denied).
 */
export async function registerForPushNotifications(): Promise<string | null> {
    // Push notifications require a physical device
    if (!Device.isDevice) {
        console.log('[Push] Skipping — not a physical device');
        return null;
    }

    // Request permission
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

    // Android requires a notification channel
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'HerbAssist Notifications',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#10B981',
            sound: 'default',
        });
    }

    try {
        const projectId = getExpoProjectId();
        if (!projectId) {
            console.warn('[Push] Missing EAS projectId. Set EXPO_PUBLIC_EAS_PROJECT_ID or app.json extra.eas.projectId.');
            return null;
        }
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;
        console.log('[Push] Expo Push Token:', token);

        // Register with backend
        await apiClient.post('/users/push-token', { token });
        return token;
    } catch (error) {
        console.warn('[Push] Failed to get push token:', error);
        return null;
    }
}

/**
 * Removes the push token from the backend on logout.
 */
export async function unregisterPushToken(): Promise<void> {
    try {
        if (!Device.isDevice) return;
        const projectId = getExpoProjectId();
        if (!projectId) return;
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId }).catch(() => null);
        if (tokenData?.data) {
            await apiClient.delete('/users/push-token', { data: { token: tokenData.data } });
        }
    } catch {
        // Best-effort cleanup
    }
}

/**
 * Configure how notifications are shown when the app is in the foreground.
 * Call this once at app startup.
 */
export function configureForegroundNotificationHandler() {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true, // Required in Expo 50+
            shouldShowList: true, // Required in Expo 50+
        }),
    });
}
