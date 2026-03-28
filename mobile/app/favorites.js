import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    Image,
    StyleSheet,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../services/apiClient';
import { debugLog } from '../utils/logger';

export default function FavoritesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [removingId, setRemovingId] = useState(null);

    useEffect(() => {
        fetchFavorites();
    }, []);

    const fetchFavorites = async () => {
        try {
            const res = await apiClient.get('/users/favorites');
            const data = res.data?.data || res.data || [];
            setFavorites(Array.isArray(data) ? data : []);
        } catch (err) {
            debugLog('Failed to fetch favorites:', err.message);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchFavorites();
        setRefreshing(false);
    }, []);

    const removeFavorite = (herb) => {
        Alert.alert(
            'Remove Favorite',
            `Remove "${herb.name}" from your favorites?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                    try {
                        setRemovingId(herb._id || herb.id);
                        const id = herb._id || herb.id;
                        await apiClient.delete(`/users/favorites/${id}`);
                        setFavorites(prev => prev.filter(h => (h._id || h.id) !== id));
                    } catch (_err) {
                            Alert.alert('Error', 'Failed to remove from favorites');
                        } finally {
                            setRemovingId(null);
                        }
                    },
                },
            ]
        );
    };

    const getHerbImage = (herb) => {
        if (herb.imageUrl) return herb.imageUrl;
        if (herb.images?.length > 0) {
            const img = herb.images[0];
            return typeof img === 'object' && img.url ? img.url : img;
        }
        return null;
    };

    const renderHerb = ({ item }) => {
        const imageUrl = getHerbImage(item);
        const isRemoving = removingId === item._id;

        return (
            <TouchableOpacity
                style={s.herbCard}
                activeOpacity={0.85}
                onPress={() => router.push(`/herbs/${item._id || item.id}`)}
            >
                {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={s.herbImage} resizeMode="cover" />
                ) : (
                    <LinearGradient colors={['#D1FAE5', '#A7F3D0']} style={s.herbImagePlaceholder}>
                        <Ionicons name="leaf" size={28} color="#059669" />
                    </LinearGradient>
                )}
                <View style={s.herbInfo}>
                    <Text style={s.herbName} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.herbScientific} numberOfLines={1}>{item.scientificName || 'Unknown species'}</Text>
                    <View style={s.herbMeta}>
                        <Ionicons name="heart" size={12} color="#EF4444" />
                        <Text style={s.herbMetaText}>In your favorites</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={s.removeBtn}
                    onPress={() => removeFavorite(item)}
                disabled={isRemoving}
            >
                {isRemoving ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                    <Ionicons name="heart-dislike-outline" size={20} color="#EF4444" />
                )}
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

    const EmptyState = () => (
        <View style={s.emptyState}>
            <View style={s.emptyIconWrap}>
                <Ionicons name="heart-outline" size={48} color="#D1D5DB" />
            </View>
            <Text style={s.emptyTitle}>No Favorites Yet</Text>
            <Text style={s.emptyDesc}>
                Browse herbs and tap the heart icon to add them to your favorites collection.
            </Text>
            <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => router.push('/(tabs)/herbs')}
            >
                <Ionicons name="leaf-outline" size={18} color="#fff" />
                <Text style={s.emptyBtnText}>Browse Herbs</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Favorite Herbs</Text>
                <View style={s.headerRight}>
                    <Text style={s.countBadge}>{favorites.length}</Text>
                </View>
            </View>

            {loading ? (
                <View style={s.loadingWrap}>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text style={s.loadingText}>Loading favorites...</Text>
                </View>
            ) : (
                <FlatList
                    data={favorites}
                    renderItem={renderHerb}
                    keyExtractor={(item) => item._id?.toString()}
                    contentContainerStyle={[
                        s.listContent,
                        favorites.length === 0 && { flex: 1 }
                    ]}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={EmptyState}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" colors={['#10B981']} />
                    }
                />
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAF9' },

    /* Header */
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff',
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6',
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    headerRight: { alignItems: 'center' },
    countBadge: {
        fontSize: 13, fontWeight: '700', color: '#10B981',
        backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    },

    /* Loading */
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 12, fontSize: 14, color: '#9CA3AF', fontWeight: '500' },

    /* List */
    listContent: { padding: 20 },

    /* Herb Card */
    herbCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    },
    herbImage: {
        width: 64, height: 64, borderRadius: 14,
    },
    herbImagePlaceholder: {
        width: 64, height: 64, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    herbInfo: { flex: 1, marginLeft: 14 },
    herbName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
    herbScientific: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 6 },
    herbMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    herbMetaText: { fontSize: 11, color: '#EF4444', fontWeight: '600' },
    removeBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center',
    },

    /* Empty */
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
    emptyIconWrap: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
    emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    emptyBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14,
    },
    emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

