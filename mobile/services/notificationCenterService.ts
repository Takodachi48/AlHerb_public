import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import apiClient from './apiClient';
import { API_ENDPOINTS } from '../shared/constants/api-endpoints';

const READ_NOTIFICATION_IDS_KEY = '@notification_center_read_ids_v1';

type NotificationPreferences = {
  email: boolean;
  push: boolean;
  system: boolean;
  blog: boolean;
};

type NotificationItem = {
  id: string;
  type: 'blog' | 'update' | 'announcement' | 'other';
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  action?: { type: 'blog'; blogId: string } | null;
};

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  email: true,
  push: true,
  system: true,
  blog: true,
};

const asObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' ? (value as Record<string, any>) : {};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const normalizeIsoDate = (value: unknown): string => {
  const text = String(value || '').trim();
  if (!text) return new Date().toISOString();
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const normalizePreferences = (value: unknown): NotificationPreferences => {
  const raw = asObject(value);
  return {
    email: raw.email !== false,
    push: raw.push !== false,
    system: raw.system !== false,
    blog: raw.blog !== false,
  };
};

const parseNumericVersion = (value: string): number[] =>
  String(value || '')
    .split('.')
    .map((segment) => Number.parseInt(segment, 10))
    .map((num) => (Number.isFinite(num) ? num : 0));

const compareVersions = (a: string, b: string) => {
  const aParts = parseNumericVersion(a);
  const bParts = parseNumericVersion(b);
  const length = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < length; i += 1) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal > bVal) return 1;
    if (aVal < bVal) return -1;
  }
  return 0;
};

const getCurrentAppVersion = () =>
  String(Constants.expoConfig?.version || Constants.manifest2?.extra?.expoClient?.version || '0.0.0');

const getLatestBuildVersion = (): string | null => {
  const extraVersion = String(
    (Constants.expoConfig?.extra as any)?.env?.EXPO_PUBLIC_LATEST_APP_VERSION || ''
  ).trim();
  const envVersion = String(process.env.EXPO_PUBLIC_LATEST_APP_VERSION || '').trim();
  if (extraVersion) {
    return extraVersion;
  }
  return envVersion || null;
};

const getReadNotificationIds = async (): Promise<Set<string>> => {
  try {
    const saved = await AsyncStorage.getItem(READ_NOTIFICATION_IDS_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    const list = asArray<string>(parsed)
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    return new Set(list);
  } catch {
    return new Set();
  }
};

const persistReadNotificationIds = async (ids: Set<string>) => {
  const payload = JSON.stringify(Array.from(ids));
  await AsyncStorage.setItem(READ_NOTIFICATION_IDS_KEY, payload);
};

const mapBlogToNotification = (entry: any): NotificationItem | null => {
  const blogId = String(entry?._id || '').trim();
  if (!blogId) return null;

  const category = String(entry?.category || '').toLowerCase();
  const tags = asArray<string>(entry?.tags).map((item) => String(item || '').toLowerCase());
  const title = String(entry?.title || 'New blog post');

  let type: NotificationItem['type'] = 'blog';
  if (category.includes('announcement') || tags.some((tag) => tag.includes('announcement'))) {
    type = 'announcement';
  } else if (
    category.includes('update') ||
    category.includes('release') ||
    tags.some((tag) => tag.includes('update') || tag.includes('release'))
  ) {
    type = 'update';
  }

  const messages: Record<NotificationItem['type'], string> = {
    blog: `A new community blog was posted: ${title}`,
    update: `A product update post is available: ${title}`,
    announcement: `A new announcement was posted: ${title}`,
    other: title,
  };

  return {
    id: `blog-${blogId}`,
    type,
    title:
      type === 'announcement'
        ? 'New Announcement'
        : type === 'update'
          ? 'Update Post'
          : 'New Blog Post',
    message: messages[type],
    createdAt: normalizeIsoDate(entry?.publishedAt || entry?.updatedAt || entry?.createdAt),
    isRead: false,
    action: { type: 'blog', blogId },
  };
};

const mapInteractionToNotification = (entry: any): NotificationItem | null => {
  const id = String(entry?._id || '').trim();
  if (!id) return null;

  const type = String(entry?.type || 'other');
  const actionType = entry?.data?.blogId ? 'blog' : null;
  const blogId = entry?.data?.blogId ? String(entry.data.blogId) : undefined;

  return {
    id,
    type: 'blog', // Default for UI icons
    title: entry.title || 'Notification',
    message: entry.message || '',
    createdAt: normalizeIsoDate(entry.createdAt),
    isRead: Boolean(entry.isRead),
    action: actionType === 'blog' ? { type: 'blog', blogId: blogId! } : null,
  };
};

const getInteractionNotifications = async (): Promise<NotificationItem[]> => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.NOTIFICATIONS.LIST, {
      params: { page: 1, limit: 50 },
    });
    const data = asObject(response?.data?.data || response?.data);
    const items = asArray<any>(data.items || data);
    return items
      .map((entry) => mapInteractionToNotification(entry))
      .filter((entry): entry is NotificationItem => Boolean(entry));
  } catch (error) {
    console.warn('[NotificationCenter] Failed to fetch interaction notifications:', error);
    return [];
  }
};

const getBlogNotifications = async (): Promise<NotificationItem[]> => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.BLOGS.LIST, {
      params: { page: 1, limit: 20 },
    });
    const data = asObject(response?.data?.data || response?.data);
    const blogs = asArray<any>(data.blogs || data);
    return blogs
      .map((entry) => mapBlogToNotification(entry))
      .filter((entry): entry is NotificationItem => Boolean(entry));
  } catch {
    return [];
  }
};

const getSystemNotifications = async (): Promise<NotificationItem[]> => {
  const currentVersion = getCurrentAppVersion();
  const latestBuildVersion = getLatestBuildVersion();
  const now = new Date().toISOString();
  const items: NotificationItem[] = [];

  if (latestBuildVersion && compareVersions(latestBuildVersion, currentVersion) > 0) {
    items.push({
      id: `app-update-v${latestBuildVersion}`,
      type: 'update',
      title: 'Update Available',
      message: `Version ${latestBuildVersion} is available. You are on ${currentVersion}.`,
      createdAt: now,
      isRead: false,
      action: null,
    });
  }

  items.push({
    id: 'system-announcement-default',
    type: 'announcement',
    title: 'Announcements',
    message: 'Important platform announcements will appear here.',
    createdAt: now,
    isRead: false,
    action: null,
  });

  return items;
};

const notificationCenterService = {
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.USERS.PREFERENCES);
      const payload = asObject(response?.data?.data || response?.data);
      return normalizePreferences(payload?.notifications);
    } catch {
      try {
        const profileResponse = await apiClient.get(API_ENDPOINTS.USERS.PROFILE);
        const profilePayload = asObject(profileResponse?.data?.data || profileResponse?.data);
        return normalizePreferences(profilePayload?.preferences?.notifications);
      } catch {
        return DEFAULT_NOTIFICATION_PREFS;
      }
    }
  },

  async updateNotificationPreferences(
    partial: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const current = await this.getNotificationPreferences();
    const next = {
      ...current,
      ...partial,
    };

    await apiClient.put(API_ENDPOINTS.USERS.PREFERENCES, {
      preferences: {
        notifications: next,
      },
    });

    return next;
  },

  async getNotificationsFeed(): Promise<{
    items: NotificationItem[];
    unreadCount: number;
    preferences: NotificationPreferences;
  }> {
    const [preferences, interactionItems, blogItems, systemItems, readIds] = await Promise.all([
      this.getNotificationPreferences(),
      getInteractionNotifications(),
      getBlogNotifications(),
      getSystemNotifications(),
      getReadNotificationIds(),
    ]);

    // Deduplicate and merge
    // interactionItems come from DB with real isRead status
    // blogItems/systemItems are virtual and use local readIds
    const merged = [...interactionItems, ...blogItems, ...systemItems]
      .filter((item) => {
        if (item.type === 'blog') return preferences.blog;
        if (item.type === 'announcement' || item.type === 'update' || item.type === 'other') {
          return preferences.system;
        }
        return true;
      })
      .map((item) => {
        // If it's a MongoDB ID (24 chars hex), use its own isRead
        const isDbId = /^[0-9a-fA-F]{24}$/.test(item.id);
        return {
          ...item,
          isRead: isDbId ? item.isRead : readIds.has(item.id),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const unreadCount = merged.filter((item) => !item.isRead).length;
    return { items: merged, unreadCount, preferences };
  },

  async markNotificationAsRead(notificationId: string) {
    if (!notificationId) return;

    const isDbId = /^[0-9a-fA-F]{24}$/.test(notificationId);
    if (isDbId) {
      try {
        await apiClient.patch(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId));
      } catch (err) {
        console.warn('[NotificationCenter] Failed to mark as read on server:', err);
      }
    } else {
      const ids = await getReadNotificationIds();
      ids.add(notificationId);
      await persistReadNotificationIds(ids);
    }
  },

  async markAllNotificationsAsRead(notificationIds: string[]) {
    // Call server to mark all real notifications
    try {
      await apiClient.post(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
    } catch (err) {
      console.warn('[NotificationCenter] Failed to mark all as read on server:', err);
    }

    // Still sync local ones
    const ids = await getReadNotificationIds();
    notificationIds.forEach((id) => {
      const safe = String(id || '').trim();
      const isDbId = /^[0-9a-fA-F]{24}$/.test(safe);
      if (safe && !isDbId) ids.add(safe);
    });
    await persistReadNotificationIds(ids);
  },

  async getUnreadCount() {
    try {
      const response = await apiClient.get(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT);
      const data = asObject(response?.data?.data || response?.data);
      const serverUnread = Number(data.unreadCount || 0);

      // We still need to account for virtual unread items from blogs/system
      const feed = await this.getNotificationsFeed();
      return feed.unreadCount;
    } catch {
      return 0;
    }
  },
};

export type { NotificationItem, NotificationPreferences };
export default notificationCenterService;
