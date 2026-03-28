import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../../components/common/Header';
import apiClient from '../../services/apiClient';

export default function RecommendationResultDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                setLoading(true);
                const response = await apiClient.get(`/users/recommendations/${id}`);
                setData(response.data?.data);
            } catch (err) {
                console.error('Failed to fetch recommendation detail:', err);
                setError('Failed to load recommendation session. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchDetail();
    }, [id]);

    const renderHerbItem = ({ item }) => {
        const herb = item.herb || {};

        return (
            <TouchableOpacity
                style={styles.herbCard}
                onPress={() => router.push({
                    pathname: '/remedy-detail',
                    params: {
                        recData: JSON.stringify({
                            rec: item,
                            selectedAge: data.ageGroup || (data.age <= 12 ? 'children' : data.age <= 18 ? 'teens' : data.age <= 64 ? 'adults' : 'seniors'),
                            selectedGender: data.gender,
                            selectedSymptoms: data.symptoms,
                            medications: data.additionalInfo?.medications || [],
                            isPregnant: data.additionalInfo?.isPregnant || false,
                            searchMode: 'symptom',
                            hideFavorite: true
                        })
                    }
                })}
            >
                <View style={styles.herbHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.herbName}>{herb.name || 'Unknown Herb'}</Text>
                        <Text style={styles.herbSciName}>{herb.scientificName || 'Botanical name'}</Text>
                    </View>
                    <View style={styles.matchBadge}>
                        <Text style={styles.matchValue}>{Math.round((item.confidence || 0) * 100)}%</Text>
                        <Text style={styles.matchLabel}>Match</Text>
                    </View>
                </View>

                <Text style={styles.reasoning} numberOfLines={3}>
                    {item.reasoning || herb.description || 'Analysis complete for this specific remedy.'}
                </Text>

                <View style={styles.cardFooter}>
                    <Text style={styles.viewLink}>View Remedy Guide</Text>
                    <Ionicons name="chevron-forward" size={16} color="#2D8A4E" />
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <Header title="Historical Results" showBack />
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#2D8A4E" />
                    <Text style={styles.loadingText}>Restoring session...</Text>
                </View>
            </View>
        );
    }

    if (error || !data) {
        return (
            <View style={styles.container}>
                <Header title="Historical Results" showBack />
                <View style={styles.centered}>
                    <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                    <Text style={styles.errorText}>{error || 'Session results not found'}</Text>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Text style={styles.backBtnText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Header title="Historical Results" showBack />

            <FlatList
                data={data.recommendations}
                keyExtractor={(item, index) => item.herb?.id || item.herb?._id || String(index)}
                renderItem={renderHerbItem}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                    <View style={styles.headerInfo}>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryLabel}>SYMPTOMS ADDRESSED</Text>
                            <Text style={styles.summaryText}>{data.symptoms.join(', ')}</Text>

                            <View style={styles.metaRow}>
                                <View style={styles.metaItem}>
                                    <Ionicons name="person-outline" size={14} color="#6B7280" />
                                    <Text style={styles.metaText}>
                                        {data.gender?.toUpperCase()}, {(data.ageGroup || (data.age <= 12 ? 'children' : data.age <= 18 ? 'teens' : data.age <= 64 ? 'adults' : 'seniors')).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.metaItem}>
                                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                                    <Text style={styles.metaText}>
                                        {new Date(data.createdAt).toLocaleDateString()}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <Text style={styles.sectionTitle}>Recommended Remedies</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAF9' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
    errorText: { marginTop: 16, color: '#374151', fontSize: 16, textAlign: 'center', marginBottom: 24 },
    backBtn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#2D8A4E', borderRadius: 12 },
    backBtnText: { color: '#FFF', fontWeight: '700' },

    list: { padding: 20, paddingBottom: 40 },
    headerInfo: { marginBottom: 20 },
    summaryCard: {
        backgroundColor: '#F3F4F6', borderRadius: 20, padding: 20, marginBottom: 24,
        borderWidth: 1, borderColor: '#E5E7EB'
    },
    summaryLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 8 },
    summaryText: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
    metaRow: { flexDirection: 'row', gap: 16 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },

    sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1F2937', textTransform: 'uppercase', letterSpacing: 1 },

    herbCard: {
        backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16,
        borderWidth: 1, borderColor: '#E5E7EB',
        shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, elevation: 1
    },
    herbHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    herbName: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginBottom: 2 },
    herbSciName: { fontSize: 13, fontStyle: 'italic', color: '#6B7280' },
    matchBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, alignItems: 'center' },
    matchValue: { fontSize: 14, fontWeight: '800', color: '#059669' },
    matchLabel: { fontSize: 8, fontWeight: '700', color: '#059669', textTransform: 'uppercase' },

    reasoning: { fontSize: 14, color: '#4B5563', lineHeight: 20, marginBottom: 16 },

    cardFooter: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
        borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12
    },
    viewLink: { fontSize: 13, fontWeight: '700', color: '#2D8A4E' },
});
