import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHerbs, loadHerbsFromCache } from '../../store/herbsSlice';
import { styles as herbStyles } from '../../styles/HerbsScreen.styles';
import { HerbCard } from '../../components/herbs/HerbCard';

const herbCategories = [
  'All', 'Anti-inflammatory', 'Digestive', 'Immune Support',
  'Sleep & Relaxation', 'Pain Relief', 'Skin Health',
];

// Map user-friendly categories to actual herb properties
const categoryPropertyMap = {
  'Anti-inflammatory': ['anti-inflammatory'],
  'Digestive': ['digestive_aid', 'digestive'],
  'Immune Support': ['antimicrobial', 'antioxidant', 'antihistamine', 'antipyretic', 'immune_boosting'],
  'Sleep & Relaxation': ['calming', 'sedative', 'relaxant'],
  'Pain Relief': ['analgesic', 'pain_relief'],
  'Skin Health': ['wound_healing', 'astringent', 'topical_healing'],
};

// const blogArticles = [
//   {
//     id: '1',
//     title: '10 Essential Filipino Herbs',
//     excerpt: 'Discover the most powerful traditional herbs used in Filipino folk medicine.',
//     category: 'Traditional Medicine',
//     readTime: '5 min',
//     image: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&q=80&w=400',
//     date: '2024-01-15',
//   },
//   {
//     id: '2',
//     title: 'How to Prepare Herbal Teas',
//     excerpt: 'Proper techniques for extracting maximum benefits from herbal teas.',
//     category: 'Preparation',
//     readTime: '8 min',
//     image: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=400',
//     date: '2024-01-12',
//   },
// ];

export default function HerbsScreen() {
  const { search } = useLocalSearchParams();
  const dispatch = useDispatch();

  const [searchQuery, setSearchQuery] = useState(search || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(search || '');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isFiltering, setIsFiltering] = useState(false);

  useEffect(() => {
    setIsFiltering(true);
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setIsFiltering(false);
    }, 400); // 400ms debounce for smoother UX

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCategorySelect = (category) => {
    if (selectedCategory === category) return;
    setIsFiltering(true);
    setSelectedCategory(category);
    setTimeout(() => {
      setIsFiltering(false);
    }, 300); // brief spinner for category switches
  };

  const { items: herbs, loading: herbsLoading } = useSelector((state) => state.herbs);

  useEffect(() => {
    dispatch(loadHerbsFromCache());
    dispatch(fetchHerbs());
  }, [dispatch]);

  const filteredHerbs = (herbs || []).filter((herb) => {
    const q = debouncedSearchQuery.toLowerCase();
    const matchesSearch =
      herb.name.toLowerCase().includes(q) ||
      herb.scientificName?.toLowerCase().includes(q) ||
      herb.commonNames?.some(name => name.toLowerCase().includes(q));

    const matchesCategory =
      selectedCategory === 'All' ||
      herb.properties?.some((p) => {
        const property = p.toLowerCase();
        const mappedProperties = categoryPropertyMap[selectedCategory] || [];
        return mappedProperties.some(mappedProp =>
          property === mappedProp.toLowerCase()
        );
      });

    return matchesSearch && matchesCategory;
  });


  return (
    <View style={herbStyles.container}>
      {/* ── Header ──────────────────────────── */}
      <View style={{ paddingTop: 60, paddingBottom: 20, backgroundColor: '#FFFFFF', paddingHorizontal: 24 }}>
        <Text style={herbStyles.headerTitle}>
          Herbal Remedies
        </Text>
        <Text style={{ fontSize: 16, color: '#64748B', marginTop: 4, fontWeight: '500' }}>
          Explore nature's healing library
        </Text>
      </View>

      {/* ── Search Section ──────────────────────────── */}
      <View style={herbStyles.searchSection}>
        <View style={herbStyles.searchBar}>
          <Ionicons name="search" size={20} color="#94A3B8" />
          <TextInput
            style={herbStyles.searchInput}
            placeholder="Search herbs, symptoms..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={{ height: 60 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={herbCategories}
          keyExtractor={(item) => item}
          style={herbStyles.categoryScroll}
          contentContainerStyle={{ paddingLeft: 24, paddingRight: 14 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleCategorySelect(item)}
              style={[
                herbStyles.chip,
                selectedCategory === item && herbStyles.chipActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  herbStyles.chipText,
                  selectedCategory === item && herbStyles.chipTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* ── Herb List ────────────────────── */}
      {herbsLoading || isFiltering ? (
        <View style={{ paddingTop: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={{ marginTop: 12, color: '#059669', fontWeight: '500' }}>
            {isFiltering ? 'Filtering herbs...' : 'Loading herbs...'}
          </Text>
        </View>
      ) : filteredHerbs.length === 0 ? (
        <View style={herbStyles.emptyWrap}>
          <View style={{ backgroundColor: '#D1FAE5', padding: 24, borderRadius: 50, marginBottom: 16 }}>
            <Ionicons name="leaf-outline" size={48} color="#059669" />
          </View>
          <Text style={herbStyles.emptyTitle}>No herbs found</Text>
          <Text style={herbStyles.emptyText}>We couldn't find any herbs matching "{searchQuery}". Try something else!</Text>
          <TouchableOpacity
            style={{ marginTop: 24, backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
            onPress={() => { setSearchQuery(''); setSelectedCategory('All'); }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Explore all herbs</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredHerbs}
          keyExtractor={(item) => item._id || item.id}
          renderItem={({ item, index }) => (
            <HerbCard item={item} index={index} />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
