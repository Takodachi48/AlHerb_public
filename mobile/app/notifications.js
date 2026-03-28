import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Header from '../components/common/Header';
import notificationCenterService from '../services/notificationCenterService';
import { useNotification } from '../context/NotificationContext';

const formatDateTime = (value) => {
  if (!value) return 'Unknown date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return parsed.toLocaleString();
};

const notificationTypeIcon = (type) => {
  if (type === 'blog') return { name: 'newspaper-outline', color: '#1D4ED8', bg: '#DBEAFE' };
  if (type === 'update') return { name: 'refresh-outline', color: '#0F766E', bg: '#CCFBF1' };
  if (type === 'announcement') return { name: 'megaphone-outline', color: '#C2410C', bg: '#FFEDD5' };
  return { name: 'notifications-outline', color: '#374151', bg: '#E5E7EB' };
};

const ToggleItem = ({ label, value, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.toggleRow, disabled && styles.toggleRowDisabled]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.8}
  >
    <Text style={styles.toggleLabel}>{label}</Text>
    <View style={[styles.switchTrack, value ? styles.switchTrackOn : styles.switchTrackOff]}>
      <View style={[styles.switchThumb, value ? styles.switchThumbOn : styles.switchThumbOff]} />
    </View>
  </TouchableOpacity>
);

export default function NotificationsScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const { refreshUnreadCount } = useNotification();
  const settingsOnly = String(mode || '').toLowerCase() === 'settings';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [preferences, setPreferences] = useState({
    email: true,
    push: true,
    system: true,
    blog: true,
  });
  const [filter, setFilter] = useState('all');

  const loadNotifications = useCallback(async () => {
    try {
      setError('');
      const feed = await notificationCenterService.getNotificationsFeed();
      setItems(feed.items || []);
      setPreferences((prev) => {
        const next = feed.preferences || prev;
        return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
      });
    } catch (requestError) {
      setError(requestError?.message || 'Failed to load notifications.');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadNotifications();
    }, [loadNotifications]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const updatePreference = async (key, value) => {
    try {
      setSavingPrefs(true);
      const updated = await notificationCenterService.updateNotificationPreferences({
        [key]: value,
      });
      setPreferences(updated);
      await loadNotifications();
    } catch (requestError) {
      setError(requestError?.message || 'Failed to save notification settings.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const localUnreadCount = useMemo(
    () => items.filter((entry) => !entry.isRead).length,
    [items],
  );

  const visibleItems = useMemo(() => {
    if (filter === 'unread') return items.filter((entry) => !entry.isRead);
    return items;
  }, [filter, items]);

  const handleOpenNotification = async (item) => {
    if (!item) return;

    if (!item.isRead) {
      await notificationCenterService.markNotificationAsRead(item.id);
      setItems((prev) => prev.map((entry) => (
        entry.id === item.id ? { ...entry, isRead: true } : entry
      )));
      // Sync badge count in the app header immediately
      refreshUnreadCount();
    }

    if (item?.action?.type === 'blog' && item?.action?.blogId) {
      router.push(`/blog/${item.action.blogId}`);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = items.filter((entry) => !entry.isRead).map((entry) => entry.id);
    if (unreadIds.length === 0) return;

    await notificationCenterService.markAllNotificationsAsRead(unreadIds);
    setItems((prev) => prev.map((entry) => ({ ...entry, isRead: true })));
    // Sync badge count in app header
    refreshUnreadCount();
  };

  const renderNotification = ({ item }) => {
    const icon = notificationTypeIcon(item.type);

    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.isRead && styles.notificationCardUnread]}
        activeOpacity={0.85}
        onPress={() => handleOpenNotification(item)}
      >
        <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
          <Ionicons name={icon.name} size={18} color={icon.color} />
        </View>

        <View style={styles.notificationBody}>
          <View style={styles.notificationTopRow}>
            <Text style={styles.notificationTitle}>{item.title}</Text>
            {!item.isRead ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text style={styles.notificationMessage}>{item.message}</Text>
          <Text style={styles.notificationDate}>{formatDateTime(item.createdAt)}</Text>
        </View>

        {item?.action?.type === 'blog' ? (
          <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header title={settingsOnly ? 'Notification Settings' : 'Notifications'} showBack />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2D8A4E" />
        </View>
      ) : settingsOnly ? (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topContent}>
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="warning-outline" size={16} color="#B45309" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.preferencesCard}>
              <Text style={styles.preferencesTitle}>Notification Preferences</Text>
              <ToggleItem
                label="Blog posts"
                value={preferences.blog}
                onPress={() => updatePreference('blog', !preferences.blog)}
                disabled={savingPrefs}
              />
              <ToggleItem
                label="System alerts"
                value={preferences.system}
                onPress={() => updatePreference('system', !preferences.system)}
                disabled={savingPrefs}
              />
              <ToggleItem
                label="Email notifications"
                value={preferences.email}
                onPress={() => updatePreference('email', !preferences.email)}
                disabled={savingPrefs}
              />
              <ToggleItem
                label="Push notifications"
                value={preferences.push}
                onPress={() => updatePreference('push', !preferences.push)}
                disabled={savingPrefs}
              />
            </View>

            <Text style={styles.settingsNote}>
              These settings control what appears in your Home notification feed and notification center.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item, index) => String(item?.id || index)}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListHeaderComponent={
            <View style={styles.topContent}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.summaryTitle}>Notification Center</Text>
                  <Text style={styles.summarySubtitle}>
                    {localUnreadCount} unread notification{localUnreadCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.markAllButton, localUnreadCount === 0 && styles.markAllButtonDisabled]}
                  onPress={markAllAsRead}
                  disabled={localUnreadCount === 0}
                >
                  <Text style={[styles.markAllText, localUnreadCount === 0 && styles.markAllTextDisabled]}>
                    Mark all read
                  </Text>
                </TouchableOpacity>
              </View>

              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="warning-outline" size={16} color="#B45309" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
                  onPress={() => setFilter('all')}
                >
                  <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, filter === 'unread' && styles.filterPillActive]}
                  onPress={() => setFilter('unread')}
                >
                  <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>Unread</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={42} color="#6B7280" />
              <Text style={styles.emptyTitle}>No notifications to show</Text>
              <Text style={styles.emptyText}>
                New blogs, announcements, and updates will appear here.
              </Text>
            </View>
          }
          ListFooterComponent={<View style={styles.listFooterSpace} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 28,
  },
  topContent: {
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  summarySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
  },
  markAllButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  markAllText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '700',
  },
  markAllTextDisabled: {
    color: '#9CA3AF',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  filterPillActive: {
    borderColor: '#2D8A4E',
    backgroundColor: '#ECFDF5',
  },
  filterText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#166534',
  },
  preferencesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  preferencesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  toggleRowDisabled: {
    opacity: 0.6,
  },
  toggleLabel: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 999,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchTrackOn: {
    backgroundColor: '#2D8A4E',
    alignItems: 'flex-end',
  },
  switchTrackOff: {
    backgroundColor: '#D1D5DB',
    alignItems: 'flex-start',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  switchThumbOn: {},
  switchThumbOff: {},
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  notificationCardUnread: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBody: {
    flex: 1,
  },
  notificationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    marginRight: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  notificationMessage: {
    fontSize: 12,
    lineHeight: 18,
    color: '#374151',
    marginBottom: 3,
  },
  notificationDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  emptyText: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  listFooterSpace: {
    height: 20,
  },
  settingsNote: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
});
