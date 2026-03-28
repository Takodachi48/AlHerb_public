import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import Header from '../components/common/Header';
import userActivityService from '../services/userActivityService';

const formatDateTime = (value) => {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
};

const toConfidenceLabel = (confidence) => {
  const numeric = Number(confidence || 0);
  if (numeric <= 0) return 'Pending';
  return `${Math.round(numeric)}% confidence`;
};

const statusDisplay = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'classified' || normalized === 'verified') {
    return { label: 'Classified', bg: '#DCFCE7', fg: '#166534' };
  }
  if (normalized === 'uncertain') {
    return { label: 'Uncertain', bg: '#FEF3C7', fg: '#92400E' };
  }
  if (normalized === 'rejected') {
    return { label: 'Rejected', bg: '#FEE2E2', fg: '#991B1B' };
  }
  return { label: 'Pending', bg: '#E5E7EB', fg: '#374151' };
};

export default function ScanHistoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    hasNextPage: false,
  });

  const loadHistory = useCallback(async (page = 1, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else if (page === 1) setLoading(true);
      setError('');

      const response = await userActivityService.getScanHistory({
        page,
        limit: 12,
      });

      setItems((prev) => (append ? [...prev, ...response.items] : response.items));
      setPagination(response.pagination || { page: 1, totalPages: 1, hasNextPage: false });
    } catch (requestError) {
      setError(requestError?.message || 'Failed to load scan history.');
      if (!append) setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory(1, false);
    }, [loadHistory]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory(1, false);
  };

  const onLoadMore = () => {
    if (!pagination?.hasNextPage || loadingMore) return;
    const nextPage = Number(pagination?.page || 1) + 1;
    loadHistory(nextPage, true);
  };

  const openHerbDetail = (item) => {
    if (!item?.id) return;
    router.push(`/scan-results/${item.id}`);
  };

  const renderHistoryItem = ({ item }) => {
    const status = statusDisplay(item.status);

    return (
      <TouchableOpacity
        activeOpacity={item?.herbId ? 0.85 : 1}
        onPress={() => openHerbDetail(item)}
        style={[styles.card, !item?.herbId && styles.cardDisabled]}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.thumbWrap}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
            ) : (
              <View style={styles.thumbFallback}>
                <Ionicons name="image-outline" size={18} color="#6B7280" />
              </View>
            )}
          </View>

          <View style={styles.titleWrap}>
            <Text style={styles.herbName} numberOfLines={1}>
              {item.commonName || item.scientificName || 'Unknown plant'}
            </Text>
            {item.scientificName ? (
              <Text style={styles.scientificName} numberOfLines={1}>
                {item.scientificName}
              </Text>
            ) : null}
            <Text style={styles.dateText}>{formatDateTime(item.createdAt)}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.fg }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="percent-outline" size={14} color="#2D8A4E" />
            <Text style={styles.metaText}>{toConfidenceLabel(item.confidence)}</Text>
          </View>

          {item.herbId ? (
            <View style={styles.metaItem}>
              <Ionicons name="open-outline" size={14} color="#2D8A4E" />
              <Text style={styles.metaText}>Open herb</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Scan History" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2D8A4E" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Scan History" showBack />

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={16} color="#B45309" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="camera-outline" size={44} color="#6B7280" />
          <Text style={styles.emptyTitle}>No scan history yet</Text>
          <Text style={styles.emptyText}>
            Your image identification scans will appear here.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(tabs)/image-processing')}>
            <Text style={styles.primaryButtonText}>Start Scanning</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => String(item?.id || index)}
          renderItem={renderHistoryItem}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListFooterComponent={
            pagination?.hasNextPage ? (
              <TouchableOpacity
                style={[styles.loadMoreButton, loadingMore && styles.loadMoreButtonDisabled]}
                onPress={onLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#2D8A4E" />
                ) : (
                  <Text style={styles.loadMoreText}>Load More</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.listFooterSpace} />
            )
          }
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 26,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardDisabled: {
    opacity: 0.9,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thumbWrap: {
    width: 54,
    height: 54,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  herbName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  scientificName: {
    fontSize: 12,
    color: '#374151',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 11,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#2D8A4E',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  loadMoreButton: {
    marginTop: 4,
    marginBottom: 12,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#2D8A4E',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  loadMoreButtonDisabled: {
    opacity: 0.7,
  },
  loadMoreText: {
    fontSize: 13,
    color: '#2D8A4E',
    fontWeight: '700',
  },
  listFooterSpace: {
    height: 16,
  },
});
