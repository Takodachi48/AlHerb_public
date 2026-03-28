import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import Header from '../components/common/Header';
import userActivityService from '../services/userActivityService';

const formatDateTime = (value) => {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
};

const StatusBadge = ({ status }) => {
  const normalized = String(status || '').toLowerCase();
  const isBlocked = normalized === 'pending' || normalized === 'blocked';
  return (
    <View style={[styles.statusBadge, isBlocked ? styles.statusBlocked : styles.statusComplete]}>
      <Text style={[styles.statusBadgeText, isBlocked ? styles.statusBlockedText : styles.statusCompleteText]}>
        {isBlocked ? 'Blocked' : 'Completed'}
      </Text>
    </View>
  );
};

export default function RecommendationHistoryScreen() {
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

      const response = await userActivityService.getRecommendationHistory({
        page,
        limit: 10,
      });

      setItems((prev) => (append ? [...prev, ...response.items] : response.items));
      setPagination(response.pagination || { page: 1, totalPages: 1, hasNextPage: false });
    } catch (requestError) {
      setError(requestError?.message || 'Failed to load recommendation history.');
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

  const renderHistoryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => router.push(`/recommendation-results/${item.id}`)}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.dateText}>{formatDateTime(item.createdAt)}</Text>
        <StatusBadge status={item.status} />
      </View>

      <Text style={styles.sectionLabel}>Symptoms</Text>
      <Text style={styles.symptomsText}>
        {item.symptoms?.length ? item.symptoms.join(', ') : 'No symptoms recorded.'}
      </Text>

      <Text style={styles.sectionLabel}>Top Herbs</Text>
      <View style={styles.herbRow}>
        {item.topHerbs?.length ? (
          item.topHerbs.map((herb) => (
            <View key={herb.id || herb.name} style={styles.herbChip}>
              <Text style={styles.herbChipText}>{herb.name || 'Unknown herb'}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyInlineText}>No herbs recorded</Text>
        )}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Source: {item.rankingSource || 'unknown'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.metaText}>{item.recommendationCount || 0} recommendations</Text>
          <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Recommendation History" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2D8A4E" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Recommendation History" showBack />
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={16} color="#B45309" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={44} color="#6B7280" />
          <Text style={styles.emptyTitle}>No recommendation history yet</Text>
          <Text style={styles.emptyText}>
            Your generated recommendations will appear here.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/recommendation')}>
            <Text style={styles.primaryButtonText}>Find Remedies</Text>
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
    padding: 14,
    marginBottom: 12,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusComplete: {
    backgroundColor: '#DCFCE7',
  },
  statusBlocked: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusCompleteText: {
    color: '#166534',
  },
  statusBlockedText: {
    color: '#92400E',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  symptomsText: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 19,
  },
  herbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  herbChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
  },
  herbChipText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  emptyInlineText: {
    fontSize: 12,
    color: '#6B7280',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  metaText: {
    fontSize: 11,
    color: '#6B7280',
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
