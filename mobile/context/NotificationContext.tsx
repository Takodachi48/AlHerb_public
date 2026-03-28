import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';
import notificationCenterService from '../services/notificationCenterService';
import {
    registerForPushNotifications,
    configureForegroundNotificationHandler,
} from '../services/pushNotificationService';

// Configure foreground display once at module level
configureForegroundNotificationHandler();

// ─── Types ───────────────────────────────────────────────────────────────────
export type BannerNotification = {
    id: string;
    title: string;
    message: string;
    type?: 'blog' | 'update' | 'announcement' | 'other';
};

type NotificationContextValue = {
    /** Number of unread notifications */
    unreadCount: number;
    /** Current notification to show in the slide-down banner (null = hidden) */
    bannerNotification: BannerNotification | null;
    /** Dismiss the banner */
    dismissBanner: () => void;
    /** Re-fetch unread count (call after marking notifications as read) */
    refreshUnreadCount: () => Promise<void>;
};

// ─── Context ─────────────────────────────────────────────────────────────────
const NotificationContext = createContext<NotificationContextValue>({
    unreadCount: 0,
    bannerNotification: null,
    dismissBanner: () => { },
    refreshUnreadCount: async () => { },
});

export const useNotification = () => useContext(NotificationContext);

// ─── Provider ────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const router = useRouter();
    const [unreadCount, setUnreadCount] = useState(0);
    const [bannerNotification, setBannerNotification] = useState<BannerNotification | null>(null);

    const foregroundSubRef = useRef<Notifications.Subscription | null>(null);
    const responseSubRef = useRef<Notifications.Subscription | null>(null);

    // ── Fetch unread count ────────────────────────────────────────────────────
    const refreshUnreadCount = useCallback(async () => {
        try {
            const feed = await notificationCenterService.getNotificationsFeed();
            setUnreadCount(Number(feed?.unreadCount ?? 0));
        } catch {
            // Non-fatal — keep existing count
        }
    }, []);

    // ── Register push token when user logs in ────────────────────────────────
    useEffect(() => {
        if (!user) return;
        registerForPushNotifications().catch((err) =>
            console.warn('[Notification] Push registration failed:', err?.message)
        );
        refreshUnreadCount();
    }, [user, refreshUnreadCount]);

    // ── Foreground push listener ─────────────────────────────────────────────
    useEffect(() => {
        foregroundSubRef.current = Notifications.addNotificationReceivedListener(
            (notification) => {
                const { title, body, data } = notification.request.content;
                setBannerNotification({
                    id: notification.request.identifier,
                    title: title ?? 'New notification',
                    message: body ?? '',
                    type: (data?.type as BannerNotification['type']) ?? 'other',
                });
                // Refresh count in background
                refreshUnreadCount();
            }
        );

        // Tap on push notification (background / killed state)
        responseSubRef.current = Notifications.addNotificationResponseReceivedListener(
            () => {
                router.push('/notifications');
            }
        );

        return () => {
            foregroundSubRef.current?.remove();
            responseSubRef.current?.remove();
        };
    }, [router, refreshUnreadCount]);

    const dismissBanner = useCallback(() => setBannerNotification(null), []);

    return (
        <NotificationContext.Provider
            value={{ unreadCount, bannerNotification, dismissBanner, refreshUnreadCount }}
        >
            {children}
        </NotificationContext.Provider>
    );
}
