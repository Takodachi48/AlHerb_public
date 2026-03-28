import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    Alert,
    StatusBar,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import remedyStorageService from '../services/remedyStorageService';
import apiClient from '../services/apiClient';

export default function SavedRemediesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [savedRemedies, setSavedRemedies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const normalizeSavedEntry = (entry, index = 0) => ({
        ...entry,
        id: String(entry?.id || entry?._id || `${entry?.herbId || 'herb'}_${entry?.savedAt || index}`),
        herbId: String(entry?.herbId || entry?.herb?._id || ''),
        selectedSymptoms: Array.isArray(entry?.selectedSymptoms) ? entry.selectedSymptoms : [],
        matchedSymptoms: Array.isArray(entry?.matchedSymptoms) ? entry.matchedSymptoms : [],
        medications: Array.isArray(entry?.medications) ? entry.medications : [],
    });

    const loadSavedRemedies = async () => {
        try {
            setLoading(true);
            const localData = await remedyStorageService.getSavedRemedies();
            if (localData.length > 0) {
                setSavedRemedies(localData.map((item, index) => normalizeSavedEntry(item, index)));
                return;
            }

            try {
                const res = await apiClient.get('/users/saved');
                const cloudData = res.data?.data || [];
                setSavedRemedies(cloudData.map((item, index) => normalizeSavedEntry(item, index)));
            } catch (error) {
                console.error('Failed to load remedies from cloud:', error);
                setSavedRemedies([]);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadSavedRemedies();
        }, [])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadSavedRemedies();
    };

    const handleDelete = (item) => {
        const herbId = item?.herbId;
        const name = item?.herbName || 'this remedy';
        Alert.alert(
            'Remove Remedy',
            `Are you sure you want to remove "${name}" from your saved remedies?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (item?.id) {
                                await remedyStorageService.removeRemedy(item.id);
                            } else {
                                const match = await remedyStorageService.findSavedRemedy(item);
                                if (match) await remedyStorageService.removeRemedy(match.id);
                            }

                            // Best-effort cloud sync if no local variants remain for this herb.
                            if (herbId) {
                                try {
                                    const all = await remedyStorageService.getSavedRemedies();
                                    const hasSameHerbVariant = all.some((savedItem) => savedItem.herbId === herbId);
                                    if (!hasSameHerbVariant) {
                                        await apiClient.delete(`/users/saved/${herbId}`);
                                    }
                                } catch (_syncErr) {
                                    // ignore cloud sync failures
                                }
                            }
                            loadSavedRemedies();
                        } catch (_err) {
                            Alert.alert('Error', 'Failed to remove remedy');
                        }
                    }
                }
            ]
        );
    };

    const navigateToDetail = (item) => {
        // Wrap the saved data back into the format remedy-detail expects
        const recData = JSON.stringify({
            rec: {
                herb: {
                    _id: item.herbId,
                    name: item.herbName,
                    scientificName: item.scientificName,
                    dosage: item.dosageInfo,
                    // Note: we store this in saveRemedy
                    preparation: item.preparation,
                },
                effectiveness: item.effectiveness,
                matchedSymptoms: item.matchedSymptoms?.length > 0 ? item.matchedSymptoms : item.selectedSymptoms,
                evidence: item.evidence,
                notes: item.notes,
            },
            selectedAge: item.selectedAge,
            selectedGender: item.selectedGender,
            selectedSymptoms: item.selectedSymptoms?.length > 0 ? item.selectedSymptoms : item.matchedSymptoms,
            medications: item.medications,
            searchMode: item.searchMode,
            diseaseName: item.diseaseName,
        });

        router.push({
            pathname: '/remedy-detail',
            params: { recData }
        });
    };

    const formatDate = (dateString) => {
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={s.remedyCard}
            onPress={() => navigateToDetail(item)}
            activeOpacity={0.7}
        >
            <View style={s.cardHeader}>
                <View style={[s.iconBg, { backgroundColor: getEffectivenessColor(item.effectiveness).bg }]}>
                    <MaterialCommunityIcons name="leaf" size={24} color={getEffectivenessColor(item.effectiveness).primary} />
                </View>
                <View style={s.titleArea}>
                    <Text style={s.herbName}>{item.herbName}</Text>
                    <Text style={s.scientificName}>{item.scientificName}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item)} style={s.deleteBtn}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
            </View>

            <View style={s.cardBody}>
                <View style={s.infoRow}>
                    <Ionicons name="medical-outline" size={14} color="#6B7280" />
                    <Text style={s.infoText} numberOfLines={1}>
                        Target: {item.searchMode === 'disease'
                            ? item.diseaseName
                            : (item.selectedSymptoms?.length > 0 ? item.selectedSymptoms.join(', ') : item.matchedSymptoms?.join(', '))}
                    </Text>
                </View>
                <View style={s.infoRow}>
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text style={s.infoText}>Saved on {formatDate(item.savedAt)}</Text>
                </View>
            </View>

            <View style={s.cardFooter}>
                <View style={[s.badge, { backgroundColor: getEffectivenessColor(item.effectiveness).bg }]}>
                    <Text style={[s.badgeText, { color: getEffectivenessColor(item.effectiveness).primary }]}>
                        {item.effectiveness.toFixed(1)} Effectiveness
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </View>
        </TouchableOpacity>
    );

    const getEffectivenessColor = (score) => {
        if (score >= 4) return { primary: '#059669', bg: '#ECFDF5' };
        if (score >= 3) return { primary: '#D97706', bg: '#FFFBEB' };
        return { primary: '#DC2626', bg: '#FEF2F2' };
    };

    if (loading) {
        return (
            <View style={[s.container, s.centered]}>
                <ActivityIndicator size="large" color="#2D8A4E" />
            </View>
        );
    }

    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />

            <View style={s.header}>
                <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Saved Remedies</Text>
                <View style={{ width: 38 }} />
            </View>

            {savedRemedies.length === 0 ? (
                <View style={s.emptyState}>
                    <LinearGradient
                        colors={['#F0FDF4', '#DCFCE7']}
                        style={s.emptyIconBg}
                    >
                        <Ionicons name="bookmark-outline" size={48} color="#2D8A4E" />
                    </LinearGradient>
                    <Text style={s.emptyTitle}>No saved remedies yet</Text>
                    <Text style={s.emptyText}>
                        Find remedies using the Symptom Guide and save them here for quick access.
                    </Text>
                    <TouchableOpacity
                        style={s.browseBtn}
                        onPress={() => router.push('/recommendation')}
                    >
                        <Ionicons name="medical-outline" size={20} color="#fff" />
                        <Text style={s.browseBtnText}>Try Symptom Guide</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={savedRemedies}
                    renderItem={renderItem}
                    keyExtractor={(item) =>
                        String(
                            item.id ||
                            item._id ||
                            `${item.herbId || 'herb'}_${(item.selectedSymptoms || item.matchedSymptoms || []).join('|')}`,
                        )
                    }
                    contentContainerStyle={s.list}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                />
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

    list: { padding: 16, paddingBottom: 40 },
    remedyCard: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    iconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    titleArea: { flex: 1 },
    herbName: { fontSize: 16, fontWeight: '700', color: '#111827' },
    scientificName: { fontSize: 13, color: '#6B7280', fontStyle: 'italic' },
    deleteBtn: { padding: 4 },

    cardBody: { marginBottom: 12 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    infoText: { fontSize: 13, color: '#6B7280' },

    cardFooter: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6',
    },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 12, fontWeight: '600' },

    /* Empty State */
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyIconBg: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 10 },
    emptyText: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    browseBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#2D8A4E', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
        shadowColor: '#2D8A4E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
    },
    browseBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
