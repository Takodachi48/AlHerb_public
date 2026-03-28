import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Image,
    ActivityIndicator, Animated, Alert, StatusBar, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import apiClient from '../services/apiClient';
import { chatbotService } from '../services/apiServices';
import remedyStorageService from '../services/remedyStorageService';
import { debugLog } from '../utils/logger';

import LinkedText from '../components/common/LinkedText';

export default function RemedyDetailScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();

    // Parse the rec data passed from recommendations
    const recData = params.recData ? JSON.parse(params.recData) : {};
    const rec = recData.rec || {};
    const herb = rec.herb || {};
    const selectedAge = recData.selectedAge || 'adults';
    const selectedGender = recData.selectedGender || 'any';
    const selectedSymptoms = Array.isArray(recData.selectedSymptoms) ? recData.selectedSymptoms : [];
    const selectedMedications = Array.isArray(recData.medications) ? recData.medications : [];
    const selectedConditions = Array.isArray(recData.conditions) ? recData.conditions : [];
    const selectedAllergies = Array.isArray(recData.allergies) ? recData.allergies : [];
    const selectedSeverity = recData.severity || 'moderate';
    const isBreastfeeding = recData.isBreastfeeding === true;
    const isPregnant = recData.isPregnant === true;
    const matchedSymptoms = Array.isArray(rec.matchedSymptoms) ? rec.matchedSymptoms : [];
    const searchMode = recData.searchMode || 'symptom';
    const diseaseName = recData.diseaseName || '';
    const selectedSymptomsKey = selectedSymptoms.join('|');
    const matchedSymptomsKey = matchedSymptoms.join('|');
    const hideFavorite = recData.hideFavorite === true;
    const recommendationWarnings = Array.isArray(rec.warnings) ? rec.warnings : [];
    const recommendationContraindications = Array.isArray(rec.contraindications) ? rec.contraindications : [];
    const recommendationDrugInteractions = Array.isArray(rec.drugInteractions) ? rec.drugInteractions : [];

    const formatContraindication = (item) => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        const parts = [];
        if (item.condition) parts.push(`Condition: ${item.condition}`);
        if (item.reason) parts.push(item.reason);
        if (item.severity) parts.push(`Severity: ${item.severity}`);
        return parts.join(' - ');
    };

    const formatDrugInteraction = (item) => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        const drugName = item?.interactsWith?.drugName || item?.with || 'Medication';
        const effect = item?.effect ? `Effect: ${item.effect}` : '';
        const severity = item?.severity ? `Severity: ${item.severity}` : '';
        const recommendation = item?.recommendation ? `Advice: ${item.recommendation}` : '';
        return [drugName, effect, severity, recommendation].filter(Boolean).join(' - ');
    };

    const confidence = rec.confidence ?? (rec.totalEffectiveness || rec.effectiveness ? (rec.totalEffectiveness || rec.effectiveness) / 5 : 0.6);
    const effectiveness = confidence * 5;
    const fillPct = Math.min(confidence * 100, 100);

    // Dosage based on age
    const ageKey = selectedAge === 'children'
        ? 'child'
        : selectedAge === 'seniors'
            ? 'elderly'
            : 'adult';
    let dosageInfo = herb.dosage ? herb.dosage[ageKey] : null;

    // Fallback if dosage is already the specific info (happens when loading from saved remedies)
    if (!dosageInfo && herb.dosage && (herb.dosage.min || herb.dosage.unit || herb.dosage.frequency)) {
        dosageInfo = herb.dosage;
    }

    // State
    const [isSaved, setIsSaved] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [savingFav, setSavingFav] = useState(false);
    const [savingRemedy, setSavingRemedy] = useState(false);
    const [aiInsight, setAiInsight] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiExpanded, setAiExpanded] = useState(true);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const checkSavedStatus = useCallback(async () => {
        if (!herb._id) return;
        try {
            const saved = await remedyStorageService.isRemedySaved({
                herbId: herb._id,
                selectedSymptoms,
                matchedSymptoms,
                selectedAge,
                selectedGender,
                searchMode,
                diseaseName,
                medications: selectedMedications,
                conditions: selectedConditions,
                allergies: selectedAllergies,
                severity: selectedSeverity,
                isPregnant,
                isBreastfeeding,
            });
            setIsSaved(saved);
        } catch (_err) {
            setIsSaved(false);
        }
    }, [
        herb._id,
        selectedAge,
        selectedGender,
        searchMode,
        diseaseName,
        selectedSymptomsKey,
        matchedSymptomsKey,
    ]);

    const checkFavoriteStatus = useCallback(async () => {
        if (!herb._id) return;
        try {
            const res = await apiClient.get('/users/favorites');
            const favs = res.data?.data || [];
            setIsFavorite(favs.some(h => (h._id || h.id || h) === herb._id));
        } catch (_err) { /* silently fail */ }
    }, [herb._id]);

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        checkSavedStatus();
        checkFavoriteStatus();

        // Proactive AI Insight Generation
        fetchAiInsight();
    }, [checkFavoriteStatus, checkSavedStatus, fadeAnim]);

    const toggleFavorite = async () => {
        if (!herb._id || savingFav) {
            debugLog('⚠️ Remedy Favorite Toggle blocked:', { herbId: herb._id, savingFav });
            return;
        }

        debugLog('💜 Attempting to toggle favorite for remedy herb:', herb._id);
        setSavingFav(true);
        const wasFavorite = isFavorite;

        try {
            if (wasFavorite) {
                debugLog('💜 Sending DELETE request to /users/favorites/' + herb._id);
                await apiClient.delete(`/users/favorites/${herb._id}`);
                setIsFavorite(false);
                debugLog('✅ Successfully removed from favorites');
            } else {
                debugLog('💜 Sending POST request to /users/favorites with herbId:', herb._id);
                await apiClient.post('/users/favorites', { herbId: herb._id });
                setIsFavorite(true);
                debugLog('✅ Successfully added to favorites');
            }
        } catch (err) {
            console.error('❌ Favorite error:', err.message);
            if (err.response) {
                console.error('❌ Server response error:', err.response.data);
            }
            setIsFavorite(wasFavorite);
            Alert.alert('Error', 'Failed to update favorites');
        } finally {
            setTimeout(() => {
                setSavingFav(false);
                debugLog('💜 Saving state reset to false');
            }, 800);
        }
    };

    const handleSaveRemedy = async () => {
        if (!herb._id || savingRemedy) return;
        setSavingRemedy(true);
        try {
            const remedyIdentity = {
                herbId: herb._id,
                selectedSymptoms,
                matchedSymptoms,
                selectedAge,
                selectedGender,
                searchMode,
                diseaseName,
                medications: selectedMedications,
                conditions: selectedConditions,
                allergies: selectedAllergies,
                severity: selectedSeverity,
                isPregnant,
                isBreastfeeding,
            };

            if (isSaved) {
                const match = await remedyStorageService.findSavedRemedy(remedyIdentity);
                if (match) {
                    await remedyStorageService.removeRemedy(match.id);
                }
                setIsSaved(false);

                // Keep cloud in sync only when no local variants for this herb remain.
                try {
                    const remaining = await remedyStorageService.getSavedRemedies();
                    const hasSameHerbVariant = remaining.some((item) => item.herbId === herb._id);
                    if (!hasSameHerbVariant) {
                        await apiClient.delete(`/users/saved/${herb._id}`);
                    }
                } catch (_syncErr) {
                    // ignore cloud sync failures
                }
            } else {
                const remedyData = {
                    herbId: herb._id,
                    herbName: herb.name,
                    scientificName: herb.scientificName,
                    dosageInfo: dosageInfo,
                    preparation: herb.preparation,
                    effectiveness: effectiveness,
                    matchedSymptoms: matchedSymptoms,
                    selectedSymptoms: selectedSymptoms,
                    evidence: rec.evidence,
                    notes: rec.notes,
                    selectedAge: selectedAge,
                    selectedGender: selectedGender,
                    medications: selectedMedications,
                    conditions: selectedConditions,
                    allergies: selectedAllergies,
                    severity: selectedSeverity,
                    isPregnant: isPregnant,
                    isBreastfeeding: isBreastfeeding,
                    searchMode: searchMode,
                    diseaseName: diseaseName,
                };
                await remedyStorageService.saveRemedy(remedyData);
                setIsSaved(true);

                // Best-effort cloud sync. Local save remains source of truth.
                try {
                    await apiClient.post('/users/saved', remedyData);
                } catch (cloudErr) {
                    debugLog('Cloud save skipped for remedy variant:', cloudErr?.message || cloudErr);
                }
            }
        } catch (err) {
            console.error('Save remedy error:', err);
            Alert.alert('Error', 'Failed to save remedy');
        } finally {
            setSavingRemedy(false);
        }
    };

    const fetchAiInsight = async () => {
        if (aiInsight || aiLoading) return;
        setAiLoading(true);
        try {
            const symptomList = matchedSymptoms.length > 0
                ? matchedSymptoms.join(', ')
                : (selectedSymptoms.length > 0 ? 'selected symptoms' : diseaseName || 'the condition');

            const genderLabel = selectedGender === 'male' ? 'male' : selectedGender === 'female' ? 'female' : '';
            const ageLabel = selectedAge || 'adult';
            const medsLabel = selectedMedications.length > 0 ? `Taking: ${selectedMedications.join(', ')}.` : '';
            const condsLabel = selectedConditions.length > 0 ? `Conditions: ${selectedConditions.join(', ')}.` : '';
            const allergiesLabel = selectedAllergies.length > 0 ? `Allergies: ${selectedAllergies.join(', ')}.` : '';
            const statusLabel = [isPregnant ? 'pregnant' : '', isBreastfeeding ? 'breastfeeding' : ''].filter(Boolean).join(' and ');

            const prompt = `As a herbal medicine expert, give a brief personalized insight (max 150 words) about using "${herb.name}" (${herb.scientificName || ''}) as a remedy for: ${symptomList}.

Patient profile: ${ageLabel}${genderLabel ? ', ' + genderLabel : ''}.

Include:
1. Why this herb is effective for these specific symptoms
2. Best preparation method for this case
3. One important precaution specific to this ${genderLabel || 'patient'} ${ageLabel} profile

Keep it practical and concise. Do not use headers.`;

            const response = await chatbotService.sendMessage(prompt, []);
            setAiInsight(response.data?.content || response.data?.reply || response.content || 'No insights available.');
        } catch (err) {
            debugLog('AI insight error:', err.message);
            setAiInsight('Unable to generate insights right now. Please try again later.');
        } finally {
            setAiLoading(false);
        }
    };

    const getEffectivenessColor = (score) => {
        if (score >= 4) return { primary: '#059669', bg: '#ECFDF5', label: 'Highly Effective' };
        if (score >= 3) return { primary: '#D97706', bg: '#FFFBEB', label: 'Moderately Effective' };
        return { primary: '#DC2626', bg: '#FEF2F2', label: 'Mildly Effective' };
    };

    const ec = getEffectivenessColor(effectiveness);

    const ageLabels = { children: 'Children', teens: 'Teens', adults: 'Adults', seniors: 'Seniors', elderly: 'Elderly' };
    const genderLabels = { male: 'Male', female: 'Female', any: 'Any' };

    const markdownStyles = {
        body: { fontSize: 14, lineHeight: 22, color: '#374151' },
        strong: { fontWeight: '700', color: '#064E3B' },
        bullet_list: { marginVertical: 2 },
        ordered_list: { marginVertical: 2 },
        list_item: { marginVertical: 1 },
        paragraph: { marginVertical: 4 },
    };

    return (
        <View style={s.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Header */}
            {/* Full-Bleed Header */}
            <View style={[s.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Remedy Info</Text>
                {!hideFavorite ? (
                    <TouchableOpacity onPress={toggleFavorite} disabled={savingFav} style={s.favBtn}>
                        {savingFav ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Ionicons
                                name={isFavorite ? 'heart' : 'heart-outline'}
                                size={26}
                                color={isFavorite ? '#FF4B4B' : '#FFF'}
                            />
                        )}
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} /> // Placeholder to maintain centered title
                )}
            </View>

            <Animated.ScrollView
                style={{ opacity: fadeAnim }}
                contentContainerStyle={s.scroll}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section */}
                <View style={[s.heroSection, { backgroundColor: ec.primary }]}>
                    <View style={s.heroGlow} />
                    <View style={s.heroContent}>
                        <View style={s.herbIconLarge}>
                            {herb.images?.[0]?.url || herb.primaryImage ? (
                                <Image
                                    source={{ uri: herb.images?.[0]?.url || herb.primaryImage }}
                                    style={s.herbImageFull}
                                    resizeMode="cover"
                                />
                            ) : (
                                <MaterialCommunityIcons name="leaf" size={48} color="#FFF" />
                            )}
                        </View>
                        <Text style={s.herbNameLarge}>{herb.name || 'Unknown Herb'}</Text>
                        {herb.scientificName && (
                            <Text style={s.scientificNameLarge}>{herb.scientificName}</Text>
                        )}

                        <View style={s.heroBadges}>
                            <View style={s.heroBadge}>
                                <Text style={s.heroBadgeText}>{ageLabels[selectedAge] || selectedAge}</Text>
                            </View>
                            <View style={s.heroBadge}>
                                <Text style={s.heroBadgeText}>{genderLabels[selectedGender] || selectedGender}</Text>
                            </View>
                            {isPregnant && (
                                <View style={[s.heroBadge, { backgroundColor: '#FCE7F3' }]}>
                                    <Text style={[s.heroBadgeText, { color: '#9D174D' }]}>Pregnant</Text>
                                </View>
                            )}
                            {isBreastfeeding && (
                                <View style={[s.heroBadge, { backgroundColor: '#F0F9FF' }]}>
                                    <Text style={[s.heroBadgeText, { color: '#075985' }]}>Breastfeeding</Text>
                                </View>
                            )}
                            <View style={[s.heroBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                <Text style={s.heroBadgeText}>{selectedSeverity.toUpperCase()}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={s.contentWrapper}>
                    <View style={s.recommendedForBox}>
                        <MaterialCommunityIcons name="bullseye-arrow" size={18} color={ec.primary} />
                        <Text style={s.recommendedForText}>
                            {searchMode === 'disease'
                                ? `Targeting ${diseaseName}`
                                : `Treating ${matchedSymptoms.length > 0 ? matchedSymptoms.join(', ') : 'your symptoms'}`}
                        </Text>
                    </View>

                    {/* Effectiveness Radial Concept (Simplified as sleek bar for RN) */}
                    <View style={s.card}>
                        <View style={s.cardHeader}>
                            <MaterialCommunityIcons name="star-face" size={20} color={ec.primary} />
                            <Text style={s.cardTitle}>Effectiveness</Text>
                            <View style={[s.pillBadge, { backgroundColor: ec.bg }]}>
                                <Text style={[s.pillBadgeText, { color: ec.primary }]}>{ec.label}</Text>
                            </View>
                        </View>
                        <View style={s.contentBox}>
                            <View style={s.gaugeWrapper}>
                                <Text style={[s.gaugePercentage, { color: ec.primary }]}>{Math.round(fillPct)}%</Text>
                                <Text style={s.gaugeSubtext}>Match Strength</Text>
                                <View style={s.gaugeTrack}>
                                    <View style={[s.gaugeFill, { width: `${fillPct}%`, backgroundColor: ec.primary }]} />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Personalized Dosage */}
                    <View style={s.card}>
                        <View style={s.cardHeader}>
                            <MaterialCommunityIcons name="clock-outline" size={18} color="#2D8A4E" />
                            <Text style={s.cardTitle}>Personalized Dosage</Text>
                            <View style={s.ageBadge}>
                                <Text style={s.ageBadgeText}>{ageLabels[selectedAge] || selectedAge}</Text>
                            </View>
                        </View>
                        {dosageInfo ? (
                            <View style={s.dosageBox}>
                                <View style={s.dosageRow}>
                                    <Text style={s.dosageLabel}>Amount</Text>
                                    <Text style={s.dosageValue}>{dosageInfo.min}–{dosageInfo.max} {dosageInfo.unit}</Text>
                                </View>
                                <View style={s.dosageDivider} />
                                <View style={s.dosageRow}>
                                    <Text style={s.dosageLabel}>Frequency</Text>
                                    <Text style={s.dosageValue}>{dosageInfo.frequency || 'As needed'}</Text>
                                </View>
                                {dosageInfo.notes && (
                                    <>
                                        <View style={s.dosageDivider} />
                                        <View style={s.dosageRow}>
                                            <Text style={s.dosageLabel}>Notes</Text>
                                            <Text style={[s.dosageValue, { flex: 1 }]}>{dosageInfo.notes}</Text>
                                        </View>
                                    </>
                                )}
                            </View>
                        ) : (
                            <View style={s.noDosageBox}>
                                <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
                                <Text style={s.noDosageText}>Dosage information is not available. Please consult a healthcare professional.</Text>
                            </View>
                        )}
                    </View>

                    {/* Preparation Guide */}
                    {(herb.preparation && herb.preparation.length > 0) ? (
                        <View style={s.card}>
                            <View style={s.cardHeader}>
                                <MaterialCommunityIcons name="pot-steam-outline" size={18} color="#2D8A4E" />
                                <Text style={s.cardTitle}>Preparation Guide</Text>
                            </View>

                            {herb.preparation.map((prep, index) => {
                                const isObj = typeof prep === 'object' && prep !== null;
                                const method = (isObj ? prep.method : 'standard') || 'standard';
                                const methodIcons = {
                                    tea: 'tea',
                                    decoction: 'pot-steam',
                                    infusion: 'water',
                                    tincture: 'flask-outline',
                                    ointment: 'lotion',
                                    capsule: 'pill',
                                    powder: 'grain',
                                    poultice: 'medical-bag',
                                    salve: 'spray'
                                };
                                const icon = methodIcons[method.toLowerCase()] || 'leaf';
                                const instructionText = isObj ? prep.instructions : String(prep);
                                // Split by numbers or just treat as one big step if no numbering found
                                const steps = instructionText.includes('1.')
                                    ? instructionText.split(/\d+\.\s+/).filter(Boolean)
                                    : [instructionText];

                                return (
                                    <View key={index} style={[s.contentBox, { marginBottom: 12 }]}>
                                        <View style={s.prepMethodHeader}>
                                            <MaterialCommunityIcons name={icon} size={22} color={ec.primary} style={{ marginRight: 12, marginTop: 2 }} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={[s.prepMethodTitle, { color: ec.primary }]}>{method.toUpperCase()}</Text>
                                                {isObj && prep.ratio && (
                                                    <View style={s.prepRatioBadge}>
                                                        <Text style={s.prepRatioText}>Ratio: {prep.ratio}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>

                                        <View style={s.prepContent}>
                                            {steps.map((step, sIdx) => (
                                                <View key={sIdx} style={s.simpleStep}>
                                                    <Text style={s.stepNumber}>{sIdx + 1}</Text>
                                                    <Text style={s.timelineStepText}>{step.trim()}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : null}

                    {/* Target Symptoms (Full List) */}
                    {(herb.symptoms && herb.symptoms.length > 0) && (
                        <View style={s.card}>
                            <View style={s.cardHeader}>
                                <MaterialCommunityIcons name="check-decagram-outline" size={18} color="#2D8A4E" />
                                <Text style={s.cardTitle}>Targeted Symptoms</Text>
                            </View>
                            <View style={s.contentBox}>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', marginBottom: 12, letterSpacing: 0.5 }}>
                                    TRADITIONALLY USED FOR
                                </Text>
                                <View style={s.tagsRow}>
                                    {herb.symptoms.map((sym, i) => {
                                        const isMatch = matchedSymptoms.some(ms => ms.toLowerCase() === sym.toLowerCase());
                                        return (
                                            <View key={i} style={[s.symptomTag, isMatch && { backgroundColor: '#D1FAE5', borderColor: '#34D399', borderWidth: 1 }]}>
                                                {isMatch && <MaterialCommunityIcons name="check-circle" size={12} color="#059669" />}
                                                <Text style={[s.symptomTagText, isMatch && { color: '#065F46', fontWeight: '700' }]}>{sym}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Scientific Evidence & Sources */}
                    {(Array.isArray(rec.studyLinks) && rec.studyLinks.length > 0 || (herb.info?.sources && herb.info.sources.length > 0)) && (
                        <View style={s.card}>
                            <View style={s.cardHeader}>
                                <MaterialCommunityIcons name="flask-outline" size={18} color="#0369A1" />
                                <Text style={s.cardTitle}>Scientific Evidence</Text>
                                <View style={[s.evidenceBadge, { backgroundColor: '#DBEAFE' }]}>
                                    <Text style={s.evidenceBadgeText}>verified-sources</Text>
                                </View>
                            </View>
                            <View style={s.contentBox}>
                                {/* {Array.isArray(rec.studyLinks) && rec.studyLinks.map((link, idx) => (
                                    <LinkedText
                                        key={`study-link-${idx}`}
                                        text={`${link?.label ? `${link.label}: ` : ''}${link?.url || ''}`}
                                        style={[s.evidenceNotes, { marginBottom: 8 }]}
                                        linkStyle={s.evidenceLink}
                                    />
                                ))} */}

                                {herb.info?.sources?.map((source, idx) => (
                                    <View key={`herb-source-${idx}`} style={s.sourceItem}>
                                        <Ionicons name="document-text-outline" size={14} color="#64748B" />
                                        <LinkedText
                                            text={`${source.title || 'Herb Source'}: ${source.url}`}
                                            style={s.sourceItemText}
                                            linkStyle={s.evidenceLink}
                                        />
                                    </View>
                                ))}

                                {Array.isArray(herb.phytochemicals) && herb.phytochemicals.length > 0 && (
                                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 8, letterSpacing: 0.5 }}>
                                            ACTIVE COMPOUNDS
                                        </Text>
                                        <Text style={{ fontSize: 13, color: '#475569', lineHeight: 18 }}>
                                            Contains {herb.phytochemicals.map(p => p.name || p.compound?.name).filter(Boolean).join(', ')}. These compounds are linked to the herb's medicinal properties.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* 🤖 AI Insights */}
                    <View style={[s.card, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE', borderWidth: 1 }]}>
                        <TouchableOpacity style={s.cardHeader} onPress={() => {
                            setAiExpanded(!aiExpanded);
                            if (!aiInsight && !aiLoading) fetchAiInsight();
                        }}>
                            <View style={s.aiIndicatorWrap}>
                                <Ionicons name="sparkles" size={16} color="#7C3AED" />
                            </View>
                            <Text style={[s.cardTitle, { color: '#5B21B6' }]}>AI Assistant Insights</Text>
                            <View style={{ flex: 1 }} />
                            {!aiInsight && !aiLoading && (
                                <TouchableOpacity style={s.aiGenerateBtn} onPress={fetchAiInsight}>
                                    <Text style={s.aiGenerateBtnText}>Get Insights</Text>
                                </TouchableOpacity>
                            )}
                            <Ionicons name={aiExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#7C3AED" style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                        {aiExpanded && (
                            <View style={s.aiContent}>
                                {aiLoading ? (
                                    <View style={s.aiLoadingBox}>
                                        <ActivityIndicator size="small" color="#7C3AED" />
                                        <Text style={s.aiLoadingText}>Generating Personalized insights...</Text>
                                    </View>
                                ) : aiInsight ? (
                                    <View style={s.aiInsightBox}>
                                        <Markdown style={markdownStyles}>{aiInsight}</Markdown>
                                    </View>
                                ) : (
                                    <View style={s.aiEmptyBox}>
                                        <Ionicons name="sparkles-outline" size={20} color="#C4B5FD" />
                                        <Text style={s.aiEmptyText}>Tap "Generate" to get AI-powered personalized insights about this remedy.</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Safety Warnings */}
                    {(herb.sideEffects && herb.sideEffects.length > 0) ||
                        recommendationWarnings.length > 0 ||
                        recommendationContraindications.length > 0 ||
                        recommendationDrugInteractions.length > 0 ? (
                        <View style={[s.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B' }]}>
                            <View style={s.cardHeader}>
                                <Ionicons name="warning-outline" size={18} color="#F59E0B" />
                                <Text style={s.cardTitle}>Safety & Warnings</Text>
                            </View>

                            <View style={s.contentBox}>
                                {/* High-Priority Interaction Alert */}
                                {(recommendationDrugInteractions.length > 0) && (
                                    <View style={s.interactionAlert}>
                                        <View style={s.interactionAlertIcon}>
                                            <MaterialCommunityIcons name="alert-decagram" size={24} color="#DC2626" />
                                        </View>
                                        <View style={s.interactionAlertContent}>
                                            <Text style={s.interactionAlertTitle}>Critical Drug Interaction</Text>
                                            <Text style={s.interactionAlertText}>
                                                This herb may interact with medications you are currently taking. Consult your doctor immediately.
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                {recommendationWarnings.map((effect, i) => (
                                    <View key={`rw-${i}`} style={s.warningItem}>
                                        <Text style={s.warningDot}>-</Text>
                                        <Text style={s.warningText}>{effect}</Text>
                                    </View>
                                ))}
                                {recommendationContraindications.map((item, i) => (
                                    <View key={`rc-${i}`} style={s.warningItem}>
                                        <Text style={s.warningDot}>-</Text>
                                        <Text style={s.warningText}>{formatContraindication(item)}</Text>
                                    </View>
                                ))}
                                {recommendationDrugInteractions.map((item, i) => (
                                    <View key={`rdi-${i}`} style={s.warningItem}>
                                        <Text style={s.warningDot}>-</Text>
                                        <Text style={s.warningText}>{formatDrugInteraction(item)}</Text>
                                    </View>
                                ))}
                                {(herb.sideEffects || []).map((effect, i) => (
                                    <View key={i} style={s.warningItem}>
                                        <Text style={s.warningDot}>•</Text>
                                        <Text style={s.warningText}>{effect}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : null}

                    {/* Action Buttons */}
                    <View style={s.actionsWrapper}>
                        <TouchableOpacity
                            style={[s.primaryActionBtn, { backgroundColor: isSaved ? '#166534' : ec.primary }]}
                            onPress={handleSaveRemedy}
                            disabled={savingRemedy}
                        >
                            {savingRemedy ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <>
                                    <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color="#FFF" />
                                    <Text style={s.primaryActionBtnText}>{isSaved ? 'Remedy Saved' : 'Save this Remedy'}</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={s.secondaryActionsRow}>
                            {herb._id && (
                                <TouchableOpacity
                                    style={s.ghostBtn}
                                    onPress={() => router.push(`/herbs/${herb._id}`)}
                                >
                                    <MaterialCommunityIcons name="leaf" size={18} color="#4B5563" />
                                    <Text style={s.ghostBtnText}>Full Profile</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={s.ghostBtn}
                                onPress={() => router.push({
                                    pathname: '/screens/interactions',
                                    params: {
                                        herbId: herb._id,
                                        medications: JSON.stringify(selectedMedications),
                                    },
                                })}
                            >
                                <Ionicons name="shield-outline" size={18} color="#4B5563" />
                                <Text style={s.ghostBtnText}>Safety Check</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={s.findNearbyBtn}
                            onPress={() => router.push({ pathname: '/(tabs)/herb-map', params: { query: herb.name } })}
                        >
                            <MaterialCommunityIcons name="map-marker-radius" size={20} color="#059669" />
                            <Text style={s.findNearbyBtnText}>Find {herb.name} Nearby</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Disclaimer */}
                <View style={s.disclaimer}>
                    <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
                    <Text style={s.disclaimerText}>
                        This information is for educational purposes only. Always consult a healthcare professional before starting any herbal remedy.
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </Animated.ScrollView>
        </View>
    );
}

// ─── Styles ─────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAF9' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 14,
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center' },
    favBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
    scroll: { paddingBottom: 40 },
    contentWrapper: { padding: 20, marginTop: -16, backgroundColor: '#FAFAF9', borderTopLeftRadius: 32, borderTopRightRadius: 32 },

    // Hero Section
    heroSection: {
        minHeight: 400,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 40,
        paddingBottom: 40,
    },
    heroGlow: {
        position: 'absolute',
        width: 200, height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    heroContent: { alignItems: 'center', paddingHorizontal: 24, width: '100%' },
    herbIconLarge: {
        width: 100, height: 100, borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
    },
    herbImageFull: {
        width: '100%',
        height: '100%',
    },
    herbNameLarge: { fontSize: 32, fontWeight: '900', color: '#FFF', textAlign: 'center', flexShrink: 1 },
    scientificNameLarge: { fontSize: 15, fontStyle: 'italic', color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' },
    heroBadges: { flexDirection: 'row', gap: 10, marginTop: 20 },
    heroBadge: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    heroBadgeText: { fontSize: 12, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },

    recommendedForBox: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#F9FAFB', borderRadius: 20, padding: 18,
        marginBottom: 20,
        borderWidth: 1, borderColor: '#E5E7EB',
    },
    recommendedForText: { fontSize: 15, color: '#374151', fontWeight: '700', flex: 1 },

    // Card
    card: {
        backgroundColor: '#FFF', borderRadius: 24, padding: 24, marginBottom: 16,
        shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, elevation: 1,
        overflow: 'hidden',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    cardTitle: { fontSize: 14, fontWeight: '800', color: '#1F2937', textTransform: 'uppercase', letterSpacing: 1 },
    pillBadge: { marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    pillBadgeText: { fontSize: 11, fontWeight: '800' },

    // Gauge
    gaugeWrapper: { alignItems: 'center' },
    gaugePercentage: { fontSize: 48, fontWeight: '900', marginBottom: 2 },
    gaugeSubtext: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
    gaugeTrack: { height: 6, width: '100%', backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
    gaugeFill: { height: '100%', borderRadius: 3 },

    // Dosage
    ageBadge: { marginLeft: 'auto', backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    ageBadgeText: { fontSize: 11, fontWeight: '800', color: '#166534' },
    dosageBox: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
    contentBox: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
    dosageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    dosageLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
    dosageValue: { fontSize: 14, color: '#111827', fontWeight: '700', textAlign: 'right', flexShrink: 1 },
    dosageDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
    noDosageBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, backgroundColor: '#F9FAFB', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' },
    noDosageText: { fontSize: 13, color: '#6B7280', flex: 1 },

    // Preparation
    prepText: { fontSize: 14, color: '#374151', lineHeight: 22 },

    // Symptoms
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    symptomTag: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    },
    symptomTagText: { fontSize: 13, color: '#059669', fontWeight: '500' },

    // Evidence
    evidenceBadge: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    evidenceBadgeText: { fontSize: 11, fontWeight: '600', color: '#0369A1', textTransform: 'capitalize' },
    evidenceNotes: { fontSize: 14, color: '#374151', lineHeight: 22 },
    evidenceLink: { color: '#0369A1', textDecorationLine: 'underline', fontWeight: '700' },

    // AI Insights
    aiIndicatorWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    aiGenerateBtn: { backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    aiGenerateBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
    aiContent: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 16 },
    aiInsightBox: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
    aiLoadingBox: { alignItems: 'center', padding: 20 },
    aiLoadingText: { marginTop: 10, fontSize: 13, color: '#7C3AED', fontWeight: '600' },
    aiEmptyBox: { alignItems: 'center', padding: 20 },
    aiEmptyText: { marginTop: 10, fontSize: 13, color: '#7C3AED', textAlign: 'center', lineHeight: 20 },

    // Warnings
    warningItem: { flexDirection: 'row', gap: 6, marginBottom: 6 },
    warningDot: { fontSize: 14, color: '#F59E0B', lineHeight: 20 },
    warningText: { fontSize: 14, color: '#374151', lineHeight: 20, flex: 1 },

    // Actions
    actionsWrapper: { paddingTop: 10 },
    primaryActionBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        paddingVertical: 18, borderRadius: 20, marginBottom: 16,
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
    },
    primaryActionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    secondaryActionsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    ghostBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#FFF', paddingVertical: 14, borderRadius: 16,
        borderWidth: 1, borderColor: '#E5E7EB',
    },
    ghostBtnText: { fontSize: 14, fontWeight: '700', color: '#4B5563' },
    findNearbyBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: '#ECFDF5', paddingVertical: 16, borderRadius: 16,
        borderWidth: 1, borderColor: '#D1FAE5',
    },
    findNearbyBtnText: { fontSize: 15, fontWeight: '700', color: '#059669' },
    safetyLink: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        marginTop: 10, paddingVertical: 10,
    },
    safetyLinkText: { fontSize: 13, fontWeight: '500', color: '#F59E0B' },

    disclaimer: { flexDirection: 'row', gap: 8, marginTop: 40, paddingHorizontal: 10 },
    disclaimerText: { fontSize: 12, color: '#9CA3AF', flex: 1, lineHeight: 18, textAlign: 'center' },

    prepSection: { marginBottom: 24 },
    prepMethodHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
    prepMethodTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 },
    prepRatioBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
    prepRatioText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },

    prepContent: { marginTop: 8 },
    simpleStep: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
    stepNumber: { fontSize: 13, fontWeight: '800', color: '#6B7280', width: 20, marginTop: 2 },
    timelineStepText: { fontSize: 14, color: '#4B5563', lineHeight: 20, flex: 1 },

    // Interaction Alert
    interactionAlert: {
        flexDirection: 'row',
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FCA5A5',
        gap: 12,
    },
    interactionAlertIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    interactionAlertContent: {
        flex: 1,
    },
    interactionAlertTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#991B1B',
        marginBottom: 2,
    },
    interactionAlertText: {
        fontSize: 13,
        color: '#B91C1C',
        lineHeight: 18,
    },
    sourceItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 6,
    },
    sourceItemText: {
        fontSize: 13,
        color: '#475569',
        flex: 1,
    },
});

