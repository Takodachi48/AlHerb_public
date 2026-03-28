import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TextInput,
    View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Header from '../../components/common/Header';
import apiClient from '../../services/apiClient';
import { identificationService } from '../../services/apiServices';
import { Colors } from '../../styles/DesignSystem';

export default function ScanResultDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    // Feedback State
    const [feedbackChoice, setFeedbackChoice] = useState(null); // true for Correct, false for Incorrect
    const [userCorrection, setUserCorrection] = useState('');
    const [rating, setRating] = useState(5);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                setLoading(true);
                const response = await apiClient.get(`/images/plant-identification/${id}`);
                setData(response.data?.data?.identification || response.data?.data);
            } catch (err) {
                console.error('Failed to fetch scan detail:', err);
                setError('Failed to load analysis details. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchDetail();
    }, [id]);

    const handleSubmitFeedback = async () => {
        if (feedbackChoice === null) return;

        try {
            setSubmitting(true);
            await identificationService.submitFeedback(
                id,
                feedbackChoice,
                rating,
                !feedbackChoice ? userCorrection : undefined
            );
            setSubmitted(true);
        } catch (err) {
            console.error('Failed to submit feedback:', err);
            Alert.alert('Error', 'Failed to submit feedback. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <Header title="Scan Analysis" showBack />
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#2D8A4E" />
                    <Text style={styles.loadingText}>Retrieving analysis...</Text>
                </View>
            </View>
        );
    }

    if (error || !data) {
        return (
            <View style={styles.container}>
                <Header title="Scan Analysis" showBack />
                <View style={styles.centered}>
                    <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                    <Text style={styles.errorText}>{error || 'Analysis not found'}</Text>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Text style={styles.backBtnText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const { classification, image, createdAt, status } = data;
    const isUncertain = status === 'uncertain' || (classification?.uncertainty?.isUncertain);

    return (
        <View style={styles.container}>
            <Header title="Scan Analysis" showBack />

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Hero Image Section */}
                <View style={styles.imageCard}>
                    <Image source={{ uri: image.url }} style={styles.mainImage} />
                    <BlurView intensity={20} tint="dark" style={styles.imageOverlay}>
                        <View style={styles.timestampWrap}>
                            <Ionicons name="calendar-outline" size={12} color="#FFF" />
                            <Text style={styles.timestampText}>
                                {new Date(createdAt).toLocaleString()}
                            </Text>
                        </View>
                    </BlurView>
                </View>

                {/* Results Section */}
                <View style={styles.content}>
                    {isUncertain && (
                        <View style={styles.warningBanner}>
                            <Ionicons name="warning" size={20} color="#D97706" />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.warningTitle}>Low Confidence Result</Text>
                                <Text style={styles.warningText}>
                                    Our AI identified this plant with lower confidence. Please verify botanical features manually.
                                </Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.mainInfo}>
                        <View style={styles.headerRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.herbName}>{classification.commonName || 'Identified Plant'}</Text>
                                <Text style={styles.scientificName}>{classification.scientificName}</Text>
                            </View>
                            <View style={styles.confidenceBadge}>
                                <Text style={styles.confidenceValue}>{Math.round(classification.confidence)}%</Text>
                                <Text style={styles.confidenceLabel}>Confidence</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <Text style={styles.sectionTitle}>Analysis Notes</Text>
                        <Text style={styles.description}>
                            {classification.description || 'No detailed description available for this specific scan result.'}
                        </Text>

                        {classification.symptoms && classification.symptoms.length > 0 && (
                            <>
                                <Text style={styles.sectionTitle}>Key Applications</Text>
                                <View style={styles.tagGrid}>
                                    {classification.symptoms.map((s, i) => (
                                        <View key={i} style={styles.tag}>
                                            <Text style={styles.tagText}>{s.toUpperCase()}</Text>
                                        </View>
                                    ))}
                                </View>
                            </>
                        )}
                    </View>

                    {/* Feedback Section */}
                    <View style={styles.feedbackCard}>
                        {!submitted ? (
                            <>
                                <Text style={styles.sectionTitle}>Was this accurate?</Text>
                                <View style={styles.feedbackChoices}>
                                    <TouchableOpacity
                                        style={[
                                            styles.choiceBtn,
                                            feedbackChoice === true && styles.choiceBtnActiveCorrect
                                        ]}
                                        onPress={() => setFeedbackChoice(true)}
                                    >
                                        <Ionicons
                                            name={feedbackChoice === true ? "checkmark-circle" : "checkmark-circle-outline"}
                                            size={20}
                                            color={feedbackChoice === true ? "#FFF" : "#059669"}
                                        />
                                        <Text style={[styles.choiceText, feedbackChoice === true && styles.choiceTextActive]}>Correct</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.choiceBtn,
                                            feedbackChoice === false && styles.choiceBtnActiveIncorrect
                                        ]}
                                        onPress={() => setFeedbackChoice(false)}
                                    >
                                        <Ionicons
                                            name={feedbackChoice === false ? "close-circle" : "close-circle-outline"}
                                            size={20}
                                            color={feedbackChoice === false ? "#FFF" : "#DC2626"}
                                        />
                                        <Text style={[styles.choiceText, feedbackChoice === false && styles.choiceTextActive]}>Incorrect</Text>
                                    </TouchableOpacity>
                                </View>

                                {feedbackChoice === false && (
                                    <View style={styles.correctionContainer}>
                                        <Text style={styles.inputLabel}>Help us improve. What plant is this?</Text>
                                        <TextInput
                                            style={styles.correctionInput}
                                            placeholder="Enter correct name..."
                                            value={userCorrection}
                                            onChangeText={setUserCorrection}
                                        />
                                    </View>
                                )}

                                <View style={styles.ratingContainer}>
                                    <Text style={styles.inputLabel}>Rate this result:</Text>
                                    <View style={styles.stars}>
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <TouchableOpacity key={star} onPress={() => setRating(star)}>
                                                <Ionicons
                                                    name={star <= rating ? "star" : "star-outline"}
                                                    size={24}
                                                    color="#F59E0B"
                                                />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.submitBtn, (feedbackChoice === null || submitting) && styles.submitBtnDisabled]}
                                    onPress={handleSubmitFeedback}
                                    disabled={feedbackChoice === null || submitting}
                                >
                                    {submitting ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <Text style={styles.submitBtnText}>Submit Feedback</Text>
                                    )}
                                </TouchableOpacity>
                            </>
                        ) : (
                            <View style={styles.successFeedback}>
                                <Ionicons name="checkmark-circle" size={40} color="#059669" />
                                <Text style={styles.successFeedbackTitle}>Thank You!</Text>
                                <Text style={styles.successFeedbackText}>Your feedback helps improve our identification accuracy.</Text>
                            </View>
                        )}
                    </View>

                    {/* Actions */}
                    <View style={styles.actionSection}>
                        {classification.herbId && (
                            <TouchableOpacity
                                style={styles.primaryAction}
                                onPress={() => router.push(`/herbs/${classification.herbId}`)}
                            >
                                <MaterialCommunityIcons name="book-open-variant" size={20} color="#FFF" />
                                <Text style={styles.primaryActionText}>View Full Medicinal Guide</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={styles.secondaryAction}
                            onPress={() => router.push('/(tabs)/image-processing')}
                        >
                            <Ionicons name="camera" size={20} color="#2D8A4E" />
                            <Text style={styles.secondaryActionText}>New Scan</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
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

    scroll: { paddingBottom: 40 },
    imageCard: { width: '100%', height: 300, backgroundColor: '#E5E7EB' },
    mainImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
    timestampWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timestampText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

    content: { padding: 20, marginTop: -20, backgroundColor: '#FAFAF9', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    warningBanner: {
        flexDirection: 'row', gap: 12, backgroundColor: '#FFFBEB',
        borderWidth: 1, borderColor: '#FDE68A', borderRadius: 16,
        padding: 16, marginBottom: 20
    },
    warningTitle: { color: '#92400E', fontWeight: '800', fontSize: 14, marginBottom: 2 },
    warningText: { color: '#78350F', fontSize: 13, lineHeight: 18 },

    mainInfo: {
        backgroundColor: '#FFF', borderRadius: 24, padding: 20,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
    herbName: { fontSize: 24, fontWeight: '900', color: '#1F2937', marginBottom: 4 },
    scientificName: { fontSize: 16, fontStyle: 'italic', color: '#4B5563', marginBottom: 12 },
    confidenceBadge: { backgroundColor: '#F0FDF4', padding: 10, borderRadius: 16, alignItems: 'center', minWidth: 80 },
    confidenceValue: { fontSize: 18, fontWeight: '900', color: '#166534' },
    confidenceLabel: { fontSize: 10, fontWeight: '700', color: '#166534', textTransform: 'uppercase' },

    divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 20 },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    description: { fontSize: 15, color: '#4B5563', lineHeight: 22, marginBottom: 24 },

    tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    tagText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },

    actionSection: { marginTop: 24, gap: 12 },
    primaryAction: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: '#2D8A4E', paddingVertical: 16, borderRadius: 16
    },
    primaryActionText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    secondaryAction: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: '#FFF', paddingVertical: 16, borderRadius: 16,
        borderWidth: 1.5, borderColor: '#2D8A4E'
    },
    secondaryActionText: { color: '#2D8A4E', fontSize: 15, fontWeight: '700' },

    // Feedback Styles
    feedbackCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        marginTop: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2
    },
    feedbackChoices: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16
    },
    choiceBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB'
    },
    choiceBtnActiveCorrect: {
        backgroundColor: '#059669',
        borderColor: '#059669'
    },
    choiceBtnActiveIncorrect: {
        backgroundColor: '#DC2626',
        borderColor: '#DC2626'
    },
    choiceText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#4B5563'
    },
    choiceTextActive: {
        color: '#FFF'
    },
    correctionContainer: {
        marginBottom: 16
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 8
    },
    correctionInput: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: '#1F2937',
        borderWidth: 1,
        borderColor: '#E5E7EB'
    },
    ratingContainer: {
        marginBottom: 20
    },
    stars: {
        flexDirection: 'row',
        gap: 8
    },
    submitBtn: {
        backgroundColor: '#1F2937',
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center'
    },
    submitBtnDisabled: {
        opacity: 0.5
    },
    submitBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700'
    },
    successFeedback: {
        alignItems: 'center',
        paddingVertical: 10
    },
    successFeedbackTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1F2937',
        marginTop: 12,
        marginBottom: 4
    },
    successFeedbackText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20
    }
});
