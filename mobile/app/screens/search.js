import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { styles } from '../../styles/SearchScreen.styles';
import { ArticleCard } from '../../components/common/ArticleCard';
import Header from '../../components/common/Header';
import { herbService, blogService, locationService } from '../../services/apiServices';
import { debugLog } from '../../utils/logger';
import { formatLocationAddress } from '../../utils/locationFormat';

const SEARCH_TABS = ['all', 'herbs', 'articles', 'locations'];

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState(params.query || '');
  const [activeTab, setActiveTab] = useState('all');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = String(searchQuery || '').trim();
    if (!query) {
      setResults([]);
      setError('');
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const [herbsResponse, blogsResponse, locationsResponse] = await Promise.all([
          herbService.searchHerbs(query).catch(() => []),
          blogService.searchBlogs(query).catch(() => []),
          locationService.getAllLocations().catch(() => []),
        ]);

        const herbs = normalizeArray(herbsResponse).map((item) => ({
          ...item,
          id: item._id || item.id,
          type: 'herb',
        }));

        const blogs = normalizeArray(blogsResponse).map((item) => ({
          ...item,
          id: item._id || item.id || item.slug,
          type: 'article',
          date: item.publishedAt
            ? new Date(item.publishedAt).toLocaleDateString()
            : item.createdAt
              ? new Date(item.createdAt).toLocaleDateString()
              : '',
        }));

        const locations = normalizeArray(locationsResponse)
          .filter((item) => {
            const addressText = formatLocationAddress(item, '');
            const haystack = `${item?.name || ''} ${addressText} ${item?.city || ''}`.toLowerCase();
            return haystack.includes(query.toLowerCase());
          })
          .map((item) => ({
            ...item,
            id: item._id || item.id,
            type: 'location',
          }));

        const combined = [...herbs, ...blogs, ...locations];
        setResults(combined);
        debugLog('[search] results', {
          query,
          herbs: herbs.length,
          blogs: blogs.length,
          locations: locations.length,
        });
      } catch (_err) {
        setError('Search failed. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const filteredResults = useMemo(() => {
    if (activeTab === 'all') return results;
    const targetType = activeTab === 'articles' ? 'article' : activeTab.slice(0, -1);
    return results.filter((item) => item.type === targetType);
  }, [results, activeTab]);

  const renderHerbItem = ({ item }) => (
    <TouchableOpacity
      style={styles.herbCard}
      onPress={() => router.push(`/herbs/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.colorIndicator, { backgroundColor: '#F4A460' }]} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemSubtitle}>{item.scientificName}</Text>
        <Text style={styles.itemDescription} numberOfLines={2}>
          {item.description || item.summary || 'No description available.'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderArticleItem = ({ item }) => <ArticleCard item={item} />;

  const renderLocationItem = ({ item }) => (
    <TouchableOpacity
      style={styles.locationCard}
      onPress={() => router.push({ pathname: '/(tabs)/herb-map', params: { locationId: item.id } })}
      activeOpacity={0.7}
    >
      <View style={styles.locationContent}>
        <View style={styles.locationHeader}>
          <Text style={styles.locationName}>{item.name || 'Location'}</Text>
          <Text style={styles.locationType}>({item.typeLabel || item.type || 'location'})</Text>
        </View>
        <Text style={styles.locationAddress}>{formatLocationAddress(item, 'Address unavailable')}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    if (item.type === 'herb') return renderHerbItem({ item });
    if (item.type === 'article') return renderArticleItem({ item });
    if (item.type === 'location') return renderLocationItem({ item });
    return null;
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>Search</Text>
      <Text style={styles.emptyTitle}>No results found</Text>
      <Text style={styles.emptyText}>
        Try a broader keyword for herbs, blogs, or locations.
      </Text>
      {error ? <Text style={[styles.emptyText, { color: '#EF4444', marginTop: 8 }]}>{error}</Text> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Search Results" showBack />

      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search herbs, articles, locations..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
          returnKeyType="search"
        />
      </View>

      <View style={styles.filterTabs}>
        {SEARCH_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, activeTab === tab && styles.filterTabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.filterTabText, activeTab === tab && styles.filterTabTextActive]}>
              {tab === 'all' ? `All (${results.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#2D8A4E" />
          <Text style={styles.emptyText}>Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredResults}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </View>
  );
}
