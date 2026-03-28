import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
  Animated,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, Alert, Image } from 'react-native';
import { styles } from '../styles/RecommendationScreen.styles';
import { useSymptoms, useSymptomRecommendations } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../services/apiClient';
import Header from '../components/common/Header';
import { Colors } from '../styles/DesignSystem';

// Category icons for symptom cards (mostly MaterialCommunityIcons)
const categoryIcons = {
  digestive: 'stomach',
  respiratory: 'lungs',
  pain: 'human-handsup',
  skin: 'opacity',
  sleep_stress: 'brain',
  menstrual: 'flower',
  general_wellness: 'medical-bag',
};

const ageGroups = [
  { label: 'Children', sub: '2-12', value: 'children', icon: 'baby-face-outline' },
  { label: 'Teens', sub: '13-18', value: 'teens', icon: 'account-outline' },
  { label: 'Adults', sub: '19-64', value: 'adults', icon: 'account' },
  { label: 'Seniors', sub: '65+', value: 'seniors', icon: 'account-tie-outline' },
];

/**
 * Helper to render text with clickable links
 */
const LinkedText = ({ text, style, linkStyle }) => {
  if (!text) return null;

  // Regex to find URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <Text
              key={i}
              style={linkStyle}
              onPress={() => Linking.openURL(part)}
            >
              {part}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
};

const genders = [
  { label: 'Male', value: 'male', icon: 'gender-male' },
  { label: 'Female', value: 'female', icon: 'gender-female' },
];

const deriveAgeGroupFromDateOfBirth = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  if (!Number.isFinite(age) || age < 0) return null;
  if (age <= 12) return 'children';
  if (age <= 18) return 'teens';
  if (age <= 64) return 'adults';
  return 'seniors';
};

// ─── Progress Bar Component ───
function ProgressBar({ currentStep }) {
  const steps = [
    { num: 1, label: 'Symptoms' },
    { num: 2, label: 'Profile' },
    { num: 3, label: 'Results' },
  ];

  return (
    <View style={styles.progressContainer}>
      {steps.map((step, i) => (
        <React.Fragment key={step.num}>
          <View style={styles.progressStep}>
            <View
              style={[
                styles.progressCircle,
                currentStep >= step.num && styles.progressCircleActive,
                currentStep > step.num && styles.progressCircleDone,
              ]}
            >
              {currentStep > step.num ? (
                <MaterialCommunityIcons name="check" size={18} color="#FFF" />
              ) : (
                <Text
                  style={[
                    styles.progressNumber,
                    currentStep >= step.num && styles.progressNumberActive,
                  ]}
                >
                  {step.num}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.progressLabel,
                currentStep >= step.num && styles.progressLabelActive,
              ]}
            >
              {step.label}
            </Text>
          </View>
          {i < steps.length - 1 && (
            <View
              style={[
                styles.progressLine,
                currentStep > step.num && styles.progressLineDone,
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

// ─── Main Component ───
export default function RecommendationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  // Symptom Mode State
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [showSymptomInput, setShowSymptomInput] = useState(false);
  const [showSelectedSymptomsModal, setShowSelectedSymptomsModal] = useState(false);
  const [symptomSearchQuery, setSymptomSearchQuery] = useState('');
  const [recommendationMode, setRecommendationMode] = useState('others');
  const [activeBodyCategory, setActiveBodyCategory] = useState(null);

  // Profile State
  const [selectedAge, setSelectedAge] = useState(null);
  const [selectedGender, setSelectedGender] = useState(null);
  const [medicationsInput, setMedicationsInput] = useState('');
  const [conditionsInput, setConditionsInput] = useState('');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('moderate');
  const [isPregnant, setIsPregnant] = useState(false);
  const [isBreastfeeding, setIsBreastfeeding] = useState(false);
  const [showAdvancedProfile, setShowAdvancedProfile] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState({
    symptomIds: [],
    ageGroup: null,
    gender: null,
    medications: [],
    isPregnant: false,
    conditions: [],
    allergies: [],
    severity: 'moderate',
    isBreastfeeding: false,
  });

  // Profile Inline Update State
  const [inlineDoB, setInlineDoB] = useState('');
  const [inlineGender, setInlineGender] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showInlineDatePicker, setShowInlineDatePicker] = useState(false);

  // Animated transition
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateStep = (newStep) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setStep(newStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  };

  // API hooks
  const { symptoms, loading: symptomsLoading, error: symptomsError, refetch: refetchSymptoms } = useSymptoms();

  // Symptom-based Recommendations
  const {
    recommendations: symptomRecs,
    loading: symptomRecLoading,
    error: symptomRecError,
    refetch: refetchSymptomRecs,
  } = useSymptomRecommendations(
    submittedRequest.symptomIds,
    submittedRequest.ageGroup,
    submittedRequest.gender,
    {
      medications: submittedRequest.medications,
      conditions: submittedRequest.conditions,
      allergies: submittedRequest.allergies,
      severity: submittedRequest.severity,
      isPregnant: submittedRequest.isPregnant,
      isBreastfeeding: submittedRequest.isBreastfeeding,
    }
  );

  const recommendations = symptomRecs;
  const recommendationsLoading = symptomRecLoading;
  const recommendationsError = symptomRecError;

  const profileGenderRaw = String(user?.gender || '').toLowerCase();
  const profileGender = ['male', 'female'].includes(profileGenderRaw) ? profileGenderRaw : null;
  const profileAgeGroup = deriveAgeGroupFromDateOfBirth(user?.dateOfBirth);
  const profileIsPregnant = Boolean(
    user?.medicalInfo?.isPregnant ??
    user?.medicalInfo?.pregnant
  );
  const profileIsBreastfeeding = Boolean(
    user?.profile?.isBreastfeeding ??
    user?.medicalInfo?.isBreastfeeding ??
    user?.medicalInfo?.breastfeeding
  );
  const forMeMissingFields = [
    ...(profileAgeGroup ? [] : ['Date of Birth']),
    ...(profileGender ? [] : ['Gender']),
  ];
  const isForMeProfileComplete = forMeMissingFields.length === 0;

  useEffect(() => {
    if (selectedGender !== 'female' && (isPregnant || isBreastfeeding)) {
      setIsPregnant(false);
      setIsBreastfeeding(false);
    }
  }, [selectedGender, isPregnant, isBreastfeeding]);

  useEffect(() => {
    if (recommendationMode !== 'me') return;
    setSelectedAge(profileAgeGroup);
    setSelectedGender(profileGender);
    setIsPregnant(profileGender === 'female' ? profileIsPregnant : false);
    setIsBreastfeeding(profileGender === 'female' ? profileIsBreastfeeding : false);
  }, [recommendationMode, profileAgeGroup, profileGender, profileIsPregnant, profileIsBreastfeeding]);

  const onInlineDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || (inlineDoB ? new Date(inlineDoB) : new Date());
    setShowInlineDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      setInlineDoB(dateString);
    }
  };

  const handleInlineProfileSave = async () => {
    const missingDoB = forMeMissingFields.includes('Date of Birth');
    const missingGender = forMeMissingFields.includes('Gender');

    if (missingDoB && !inlineDoB) {
      Alert.alert('Required', 'Please select your Date of Birth');
      return;
    }
    if (missingGender && !inlineGender) {
      Alert.alert('Required', 'Please select your Gender');
      return;
    }

    setIsSavingProfile(true);
    try {
      const payload = {};
      if (inlineDoB) payload.dateOfBirth = inlineDoB;
      if (inlineGender) payload.gender = inlineGender;

      const response = await apiClient.put('/users/profile', payload);
      if (response.data.success) {
        const { updateUser } = require('../hooks/useAuth').useAuth();
        await updateUser(response.data.data || payload);
        // Reset local inline states after success
        setInlineDoB('');
        setInlineGender('');
        Alert.alert('Success', 'Profile updated successfully!');
      }
    } catch (error) {
      console.error('Inline profile update error:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const splitCsv = (value) =>
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);



  const formatPreparation = (prep) => {
    if (!prep) return '—';
    if (Array.isArray(prep)) {
      return prep
        .map((item) => {
          if (!item) return null;
          if (typeof item === 'string') return item;
          if (typeof item === 'object') {
            const parts = [item.method, item.instructions, item.ratio].filter(Boolean);
            return parts.join(' • ');
          }
          return String(item);
        })
        .filter(Boolean)
        .join('\n');
    }
    if (typeof prep === 'object') {
      const parts = [prep.method, prep.instructions, prep.ratio].filter(Boolean);
      return parts.join(' • ') || '—';
    }
    return String(prep);
  };

  // Helper functions for enhanced UI
  const getEffectivenessColor = (effectiveness) => {
    if (effectiveness >= 4.5) return { primary: '#2D8A4E', bg: '#E8F5E9' }; // High - Green
    if (effectiveness >= 3.5) return { primary: '#FF6B35', bg: '#FFF3E0' }; // Medium - Orange
    return { primary: '#9CA89C', bg: '#F0F4F0' }; // Low - Gray
  };

  const getEffectivenessRating = (effectiveness) => {
    if (effectiveness >= 4.5) return 'Excellent';
    if (effectiveness >= 3.5) return 'Good';
    if (effectiveness >= 2.5) return 'Moderate';
    return 'Mild';
  };

  const getHerbIcon = (herbName, category) => {
    const lowerName = (herbName || '').toLowerCase();
    if (lowerName.includes('moringa')) return 'leaf';
    if (lowerName.includes('lagundi')) return 'leaf';
    if (lowerName.includes('ampalaya')) return 'sprout';
    if (lowerName.includes('bayabas')) return 'fruit-citrus';
    if (lowerName.includes('sambong')) return 'leaf-variant';
    if (lowerName.includes('akapulko')) return 'flower';
    if (lowerName.includes('niyog-niyogan')) return 'palm-tree';
    if (lowerName.includes('tsang guba')) return 'tea';
    if (lowerName.includes('ulmasim')) return 'leaf';
    if (lowerName.includes('bawang')) return 'clover';
    if (lowerName.includes('luya')) return 'ginger';
    if (lowerName.includes('oregano')) return 'leaf';
    if (lowerName.includes('tsaang gubat')) return 'leaf';

    const categoryIconsMatch = {
      'digestive': 'stomach',
      'respiratory': 'lungs',
      'cardiovascular': 'heart-pulse',
      'nervous': 'brain',
      'musculoskeletal': 'human-handsup',
      'skin': 'opacity',
      'immune': 'shield-check',
      'endocrine': 'lightning-bolt',
      'reproductive': 'flower',
      'mental': 'head-heart',
      'general': 'medical-bag',
    };

    return categoryIconsMatch[category] || 'leaf';
  };



  const handleGetRecommendations = () => {
    if (!selectedSymptoms.length) return;
    if (!selectedAge || !selectedGender) return;
    if (recommendationMode === 'me' && !isForMeProfileComplete) return;

    const medications = splitCsv(medicationsInput);
    setSubmittedRequest({
      symptomIds: selectedSymptoms,
      ageGroup: selectedAge,
      gender: selectedGender,
      medications,
      conditions: splitCsv(conditionsInput),
      allergies: splitCsv(allergiesInput),
      severity: selectedSeverity,
      isPregnant: selectedGender === 'female' ? isPregnant : false,
      isBreastfeeding: selectedGender === 'female' ? isBreastfeeding : false,
    });

    animateStep(3);
  };

  const resetRecommendation = () => {
    animateStep(1);
    setSelectedSymptoms([]);
    setSymptomSearchQuery('');
    setSubmittedRequest({
      symptomIds: [],
      ageGroup: null,
      gender: null,
      medications: [],
      conditions: [],
      allergies: [],
      severity: 'moderate',
      isPregnant: false,
      isBreastfeeding: false,
    });
    // Keep profile selections for UX or clear if preferred? Let's clear to be safe.
    // setSelectedAge(null);
    // setSelectedGender(null);
    // User probably stays same person, so keep profile? The original code cleared it.
    // Let's keep profile, user requested "profile" as step 2.
    // Actually, step is reset to 1.
  };

  const handleRecommendationModeChange = (mode) => {
    if (mode === recommendationMode) return;
    setRecommendationMode(mode);

    if (mode === 'me') {
      setSelectedAge(profileAgeGroup);
      setSelectedGender(profileGender);
      setIsPregnant(profileGender === 'female' ? profileIsPregnant : false);
      setMedicationsInput('');
    }
  };

  const toggleSymptom = (id) => {
    setSelectedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // Get the display name for a symptom
  const getSymptomName = (id) => {
    const s = symptoms.find((sym) => sym._id === id);
    return s?.name || id;
  };

  const selectedSymptomNames = selectedSymptoms.map((id) => getSymptomName(id));
  const normalizedSymptomSearch = symptomSearchQuery.trim().toLowerCase();

  const filteredSymptoms = symptoms.filter((symptom) => {
    const symptomName = String(symptom?.name || '').toLowerCase();
    const categoryName = String(symptom?.category || '').toLowerCase();

    // Search filter
    if (normalizedSymptomSearch && !symptomName.includes(normalizedSymptomSearch) && !categoryName.includes(normalizedSymptomSearch)) {
      return false;
    }

    // Category filter
    if (activeBodyCategory && categoryName !== activeBodyCategory.toLowerCase()) {
      return false;
    }

    return true;
  });
  const requestedSymptomIds = submittedRequest.symptomIds?.length
    ? submittedRequest.symptomIds
    : selectedSymptoms;
  const requestedSymptomNames = requestedSymptomIds.map((id) => getSymptomName(id));

  const normalizeSymptomLabel = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const recommendationCoverage = (() => {
    const requested = requestedSymptomNames.filter(Boolean);
    const recs = Array.isArray(recommendations?.recommendations)
      ? recommendations.recommendations
      : [];

    if (!requested.length || !recs.length) {
      return { requested, matched: [], unmatched: requested };
    }

    const requestedIndex = requested.map((label) => ({
      label,
      norm: normalizeSymptomLabel(label),
    }));
    const matchedSet = new Set();

    recs.forEach((rec) => {
      const matchedSymptoms = Array.isArray(rec?.matchedSymptoms) ? rec.matchedSymptoms : [];
      matchedSymptoms.forEach((symptom) => {
        const norm = normalizeSymptomLabel(symptom);
        if (!norm) return;

        requestedIndex.forEach((item) => {
          if (!item.norm) return;
          if (norm.includes(item.norm) || item.norm.includes(norm)) {
            matchedSet.add(item.label);
          }
        });
      });
    });

    const matched = requested.filter((label) => matchedSet.has(label));
    const unmatched = requested.filter((label) => !matchedSet.has(label));
    return { requested, matched, unmatched };
  })();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.white }}>
      <Header title="Find Remedies" showBack={true} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={step === 1 ? styles.containerWithStickyAction : undefined}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Bar */}
        <ProgressBar currentStep={step} />

        {/* Animated Content */}
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ─── Step 1: Symptoms ─── */}
          {step === 1 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What are you looking for?</Text>

              <Text style={styles.subtitle}>
                Select the symptoms that best describe how you feel. We'll find the right herbs for you.
              </Text>

              <View style={styles.modeSelectorWrap}>
                <Text style={styles.modeSelectorLabel}>Recommendation Mode</Text>
                <View style={styles.modeSelectorRow}>
                  <TouchableOpacity
                    style={[
                      styles.modePill,
                      recommendationMode === 'me' && styles.modePillActive,
                    ]}
                    onPress={() => handleRecommendationModeChange('me')}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="person-outline"
                      size={14}
                      color={recommendationMode === 'me' ? '#FFF' : '#2D8A4E'}
                    />
                    <Text style={[
                      styles.modePillText,
                      recommendationMode === 'me' && styles.modePillTextActive,
                    ]}>
                      For Me
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modePill,
                      recommendationMode === 'others' && styles.modePillActive,
                    ]}
                    onPress={() => handleRecommendationModeChange('others')}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="people-outline"
                      size={14}
                      color={recommendationMode === 'others' ? '#FFF' : '#2D8A4E'}
                    />
                    <Text style={[
                      styles.modePillText,
                      recommendationMode === 'others' && styles.modePillTextActive,
                    ]}>
                      For Others
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Category Cards Selector */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryScrollContent}
              >
                {/* "All" Category */}
                <TouchableOpacity
                  style={[styles.categoryCard, !activeBodyCategory && styles.categoryCardActive]}
                  onPress={() => setActiveBodyCategory(null)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.categoryIconWrap, !activeBodyCategory && styles.categoryIconWrapActive]}>
                    <MaterialCommunityIcons
                      name="dots-grid"
                      size={20}
                      color={!activeBodyCategory ? '#FFF' : '#2D8A4E'}
                    />
                  </View>
                  <Text style={[styles.categoryCardLabel, !activeBodyCategory && styles.categoryCardLabelActive]}>
                    All
                  </Text>
                </TouchableOpacity>

                {Object.entries(categoryIcons).map(([cat, icon]) => {
                  const isActive = activeBodyCategory === cat;
                  // Format label: "general_wellness" -> "General Wellness"
                  const displayLabel = cat.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryCard, isActive && styles.categoryCardActive]}
                      onPress={() => setActiveBodyCategory(isActive ? null : cat)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.categoryIconWrap, isActive && styles.categoryIconWrapActive]}>
                        <MaterialCommunityIcons
                          name={icon}
                          size={20}
                          color={isActive ? '#FFF' : '#2D8A4E'}
                        />
                      </View>
                      <Text
                        style={[styles.categoryCardLabel, isActive && styles.categoryCardLabelActive]}
                        numberOfLines={1}
                      >
                        {displayLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>


              {/* Existing Symptom Grid UI ... */}
              {symptomsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2D8A4E" />
                  <Text style={styles.loadingText}>Loading symptoms...</Text>
                </View>
              ) : symptomsError ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Couldn't load symptoms. Please try again.</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={refetchSymptoms}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.searchContainer}>
                    <View style={styles.searchInputWrapper}>
                      <Ionicons name="search-outline" size={18} color="#7A8A7A" style={styles.searchIcon} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search symptoms..."
                        placeholderTextColor="#9CA89C"
                        value={symptomSearchQuery}
                        onChangeText={(text) => {
                          setSymptomSearchQuery(text);
                        }}
                        autoCapitalize="none"
                      />
                      {symptomSearchQuery.length > 0 && (
                        <TouchableOpacity
                          style={styles.clearButton}
                          onPress={() => setSymptomSearchQuery('')}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle" size={18} color="#9CA89C" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.symptomSearchMeta}>
                      {filteredSymptoms.length} symptom{filteredSymptoms.length !== 1 ? 's' : ''}{' '}
                      {normalizedSymptomSearch ? 'matching your search' : 'available'}
                    </Text>
                  </View>


                  {filteredSymptoms.length === 0 ? (
                    <View style={styles.symptomSearchEmpty}>
                      <Ionicons name="search-outline" size={22} color="#7A8A7A" />
                      <Text style={styles.symptomSearchEmptyTitle}>No matching symptom found</Text>
                      <Text style={styles.symptomSearchEmptyText}>
                        Try another keyword or add a custom symptom.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.symptomGrid}>
                      {filteredSymptoms.map((symptom) => {
                        const isSelected = selectedSymptoms.includes(symptom._id);
                        const iconName = categoryIcons[symptom.category] || 'medical-bag';
                        return (
                          <TouchableOpacity
                            key={symptom._id}
                            style={[styles.symptomCard, isSelected && styles.symptomCardSelected]}
                            onPress={() => toggleSymptom(symptom._id)}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons name={iconName} size={24} color={isSelected ? '#FFF' : '#2D8A4E'} style={styles.symptomIcon} />
                            <Text
                              style={[styles.symptomCardText, isSelected && styles.symptomCardTextSelected]}
                            >
                              {symptom.name}
                            </Text>
                            {symptom.category && (
                              <Text style={[styles.symptomCategory, isSelected && styles.symptomCategorySelected]}>
                                {symptom.category}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.addSymptomButton}
                    onPress={() => setShowSymptomInput(true)}
                  >
                    <Text style={styles.addSymptomButtonText}>+ Add Custom Symptom</Text>
                  </TouchableOpacity>

                  {false && (
                    <TouchableOpacity
                      style={styles.nextButton}
                      onPress={() => animateStep(2)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.nextButtonText}>Continue →</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}

          {/* ─── Step 2: Age & Gender ─── */}
          {step === 2 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About You</Text>
              <Text style={styles.subtitle}>
                {recommendationMode === 'me'
                  ? 'Using your profile details for age and gender. These fields are locked. Add medications if needed.'
                  : 'Help us personalize recommendations based on your age, gender, and current medications.'}
              </Text>

              {recommendationMode === 'me' && !isForMeProfileComplete && (
                <View style={styles.profileIncompleteCard}>
                  <View style={styles.profileIncompleteTitleRow}>
                    <Ionicons name="information-circle-outline" size={18} color="#10B981" />
                    <Text style={styles.profileIncompleteTitle}>Complete Your Profile</Text>
                  </View>
                  <Text style={styles.profileIncompleteText}>
                    Please provide your missing details to get personalized recommendations.
                  </Text>

                  <View style={styles.inlineFixContainer}>
                    {forMeMissingFields.includes('Date of Birth') && (
                      <View style={styles.inlineInputGroup}>
                        <Text style={styles.inlineLabel}>Date of Birth</Text>
                        <TouchableOpacity
                          style={styles.inlineDateBtn}
                          onPress={() => setShowInlineDatePicker(true)}
                        >
                          <Text style={inlineDoB ? styles.inlineDateText : styles.inlineDatePlaceholder}>
                            {inlineDoB || "YYYY-MM-DD"}
                          </Text>
                          <Ionicons name="calendar-outline" size={18} color="#2D8A4E" />
                        </TouchableOpacity>
                        {showInlineDatePicker && (
                          <DateTimePicker
                            value={inlineDoB ? new Date(inlineDoB) : new Date()}
                            mode="date"
                            display="default"
                            onChange={onInlineDateChange}
                            maximumDate={new Date()}
                          />
                        )}
                      </View>
                    )}

                    {forMeMissingFields.includes('Gender') && (
                      <View style={styles.inlineInputGroup}>
                        <Text style={styles.inlineLabel}>Gender</Text>
                        <View style={styles.inlineGenderRow}>
                          {['male', 'female'].map((g) => (
                            <TouchableOpacity
                              key={g}
                              style={[
                                styles.inlineGenderBtn,
                                inlineGender === g && styles.inlineGenderBtnActive
                              ]}
                              onPress={() => setInlineGender(g)}
                            >
                              <Text style={[
                                styles.inlineGenderText,
                                inlineGender === g && styles.inlineGenderTextActive
                              ]}>
                                {g.charAt(0).toUpperCase() + g.slice(1)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.inlineSaveBtn, isSavingProfile && styles.inlineSaveBtnDisabled]}
                      onPress={handleInlineProfileSave}
                      disabled={isSavingProfile}
                      activeOpacity={0.8}
                    >
                      {isSavingProfile ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.inlineSaveBtnText}>Save & Continue</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {recommendationMode === 'me' && isForMeProfileComplete && (
                <View style={styles.profileLockedCard}>
                  <Ionicons name="lock-closed-outline" size={15} color="#2D8A4E" />
                  <Text style={styles.profileLockedText}>
                    Profile fields are locked in For Me mode.
                  </Text>
                </View>
              )}

              {/* Age */}
              <View style={styles.subsection}>
                <Text style={styles.smallTitle}>Age Group</Text>
                <View style={styles.optionsGrid}>
                  {ageGroups.map((age) => (
                    <TouchableOpacity
                      key={age.value}
                      style={[
                        styles.optionButton,
                        selectedAge === age.value && styles.optionButtonSelected,
                        recommendationMode === 'me' && styles.optionButtonLocked,
                      ]}
                      onPress={() => recommendationMode !== 'me' && setSelectedAge(age.value)}
                      disabled={recommendationMode === 'me'}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name={age.icon} size={24} color={selectedAge === age.value ? '#FFF' : '#2D8A4E'} style={styles.optionIcon} />
                      <Text style={[styles.optionText, selectedAge === age.value && styles.optionTextSelected]}>
                        {age.label}
                      </Text>
                      <Text
                        style={[
                          styles.optionText,
                          { fontSize: 11, marginTop: 2 },
                          selectedAge === age.value && styles.optionTextSelected,
                        ]}
                      >
                        {age.sub}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Gender */}
              <View style={styles.subsection}>
                <Text style={styles.smallTitle}>Gender</Text>
                <View style={styles.optionsRow}>
                  {genders.map((gender) => (
                    <TouchableOpacity
                      key={gender.value}
                      style={[
                        styles.optionButton,
                        styles.genderOption,
                        selectedGender === gender.value && styles.optionButtonSelected,
                        recommendationMode === 'me' && styles.optionButtonLocked,
                      ]}
                      onPress={() => recommendationMode !== 'me' && setSelectedGender(gender.value)}
                      disabled={recommendationMode === 'me'}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name={gender.icon} size={24} color={selectedGender === gender.value ? '#FFF' : '#2D8A4E'} style={styles.optionIcon} />
                      <Text style={[styles.optionText, selectedGender === gender.value && styles.optionTextSelected]}>
                        {gender.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Advanced Toggle */}
              <TouchableOpacity
                style={styles.advancedToggle}
                onPress={() => setShowAdvancedProfile(!showAdvancedProfile)}
                activeOpacity={0.8}
              >
                <View style={styles.advancedToggleContent}>
                  <Text style={styles.advancedToggleTitle}>Health & Safety Details</Text>
                  <Text style={styles.advancedToggleSummary}>
                    {[
                      medicationsInput.trim() && 'Medications',
                      conditionsInput.trim() && 'Conditions',
                      allergiesInput.trim() && 'Allergies',
                      selectedSeverity !== 'moderate' && 'Severity',
                      isPregnant && 'Pregnancy',
                      isBreastfeeding && 'Breastfeeding'
                    ].filter(Boolean).length || 0} safety fields filled • {showAdvancedProfile ? 'Tap to hide' : 'Tap to expand'}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={showAdvancedProfile ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color="#2D8A4E"
                />
              </TouchableOpacity>

              {showAdvancedProfile && (
                <View style={styles.advancedSection}>
                  {/* Medications */}
                  <View style={styles.subsection}>
                    <Text style={styles.smallTitle}>Current Medications (comma-separated)</Text>
                    <TextInput
                      style={styles.profileInput}
                      placeholder="e.g. lisinopril, metformin"
                      placeholderTextColor="#9CA89C"
                      value={medicationsInput}
                      onChangeText={setMedicationsInput}
                      autoCapitalize="none"
                    />
                    <Text style={styles.profileInputHelp}>
                      Add medications so we can filter risky herb-drug interactions.
                    </Text>
                  </View>

                  {/* Severity */}
                  <View style={styles.subsection}>
                    <Text style={styles.smallTitle}>Condition Severity</Text>
                    <View style={styles.optionsRow}>
                      {[
                        { label: 'Mild', value: 'mild', icon: 'thermometer-low' },
                        { label: 'Moderate', value: 'moderate', icon: 'thermometer' },
                        { label: 'Severe', value: 'severe', icon: 'thermometer-high' },
                      ].map((s) => (
                        <TouchableOpacity
                          key={s.value}
                          style={[
                            styles.optionButton,
                            { flex: 1, marginHorizontal: 4 },
                            selectedSeverity === s.value && styles.optionButtonSelected,
                          ]}
                          onPress={() => setSelectedSeverity(s.value)}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons
                            name={s.icon}
                            size={22}
                            color={selectedSeverity === s.value ? '#FFF' : '#2D8A4E'}
                          />
                          <Text style={[styles.optionText, selectedSeverity === s.value && styles.optionTextSelected]}>
                            {s.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Medical Conditions */}
                  <View style={styles.subsection}>
                    <Text style={styles.smallTitle}>Medical Conditions (comma-separated)</Text>
                    <TextInput
                      style={styles.profileInput}
                      placeholder="e.g. hypertension, diabetes"
                      placeholderTextColor="#9CA89C"
                      value={conditionsInput}
                      onChangeText={setConditionsInput}
                      autoCapitalize="none"
                    />
                  </View>

                  {/* Allergies */}
                  <View style={styles.subsection}>
                    <Text style={styles.smallTitle}>Allergies (comma-separated)</Text>
                    <TextInput
                      style={styles.profileInput}
                      placeholder="e.g. peanuts, penicillin"
                      placeholderTextColor="#9CA89C"
                      value={allergiesInput}
                      onChangeText={setAllergiesInput}
                      autoCapitalize="none"
                    />
                  </View>

                  {/* Pregnancy (female only) */}
                  {selectedGender === 'female' && (
                    <View style={styles.subsection}>
                      <Text style={styles.smallTitle}>Pregnancy Status</Text>
                      <View style={styles.optionsRow}>
                        <TouchableOpacity
                          style={[
                            styles.optionButton,
                            styles.pregnancyOption,
                            !isPregnant && styles.optionButtonSelected,
                            recommendationMode === 'me' && styles.optionButtonLocked,
                          ]}
                          onPress={() => recommendationMode !== 'me' && setIsPregnant(false)}
                          disabled={recommendationMode === 'me'}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons
                            name="close-circle-outline"
                            size={22}
                            color={!isPregnant ? '#FFF' : '#2D8A4E'}
                            style={styles.optionIcon}
                          />
                          <Text style={[styles.optionText, !isPregnant && styles.optionTextSelected]}>
                            Not Pregnant
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.optionButton,
                            styles.pregnancyOption,
                            isPregnant && styles.optionButtonSelected,
                            recommendationMode === 'me' && styles.optionButtonLocked,
                          ]}
                          onPress={() => recommendationMode !== 'me' && setIsPregnant(true)}
                          disabled={recommendationMode === 'me'}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons
                            name="human-pregnant"
                            size={22}
                            color={isPregnant ? '#FFF' : '#2D8A4E'}
                            style={styles.optionIcon}
                          />
                          <Text style={[styles.optionText, isPregnant && styles.optionTextSelected]}>
                            Pregnant
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Breastfeeding (female only) */}
                  {selectedGender === 'female' && (
                    <View style={styles.subsection}>
                      <Text style={styles.smallTitle}>Breastfeeding Status</Text>
                      <View style={styles.optionsRow}>
                        <TouchableOpacity
                          style={[
                            styles.optionButton,
                            styles.pregnancyOption,
                            !isBreastfeeding && styles.optionButtonSelected,
                            recommendationMode === 'me' && styles.optionButtonLocked,
                          ]}
                          onPress={() => recommendationMode !== 'me' && setIsBreastfeeding(false)}
                          disabled={recommendationMode === 'me'}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons
                            name="baby-bottle-outline"
                            size={22}
                            color={!isBreastfeeding ? '#FFF' : '#2D8A4E'}
                            style={styles.optionIcon}
                          />
                          <Text style={[styles.optionText, !isBreastfeeding && styles.optionTextSelected]}>
                            Not Breastfeeding
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.optionButton,
                            styles.pregnancyOption,
                            isBreastfeeding && styles.optionButtonSelected,
                            recommendationMode === 'me' && styles.optionButtonLocked,
                          ]}
                          onPress={() => recommendationMode !== 'me' && setIsBreastfeeding(true)}
                          disabled={recommendationMode === 'me'}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons
                            name="baby-bottle"
                            size={22}
                            color={isBreastfeeding ? '#FFF' : '#2D8A4E'}
                            style={styles.optionIcon}
                          />
                          <Text style={[styles.optionText, isBreastfeeding && styles.optionTextSelected]}>
                            Breastfeeding
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.backButtonWide} onPress={() => animateStep(1)} activeOpacity={0.8}>
                  <Text style={styles.backButtonWideText}>← Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.recommendButton,
                    (!selectedAge || !selectedGender || (recommendationMode === 'me' && !isForMeProfileComplete)) &&
                    styles.recommendButtonDisabled,
                  ]}
                  onPress={handleGetRecommendations}
                  disabled={!selectedAge || !selectedGender || (recommendationMode === 'me' && !isForMeProfileComplete)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.recommendButtonText}>Get Recommendations</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ─── Step 3: Results ─── */}
          {step === 3 && (
            <View style={styles.section}>
              {/* Result Header Card */}
              <View style={styles.resultHeaderCard}>
                <View style={styles.resultHeaderTop}>
                  <View style={styles.resultTitleRow}>
                    <View style={styles.resultTitleContainer}>
                      <MaterialCommunityIcons name="leaf" size={24} color="#2D8A4E" />
                      <Text style={styles.resultTitle}>Your Herbal Remedies</Text>
                    </View>
                    <View style={styles.resultCountBadge}>
                      <Text style={styles.resultCountText}>
                        {recommendations?.recommendations?.length || 0} Found
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.resultSubtitle}>
                    For {requestedSymptomNames.length} symptom{requestedSymptomNames.length > 1 ? 's' : ''}
                  </Text>
                </View>

                <View style={styles.resultBadges}>
                  <View style={styles.badge}>
                    <MaterialCommunityIcons
                      name={ageGroups.find((a) => a.value === selectedAge)?.icon || 'account'}
                      size={14}
                      color="#2D8A4E"
                    />
                    <Text style={styles.badgeText}>
                      {ageGroups.find((a) => a.value === selectedAge)?.label}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <MaterialCommunityIcons
                      name={genders.find((g) => g.value === selectedGender)?.icon || 'account'}
                      size={14}
                      color="#2D8A4E"
                    />
                    <Text style={styles.badgeText}>
                      {genders.find((g) => g.value === selectedGender)?.label}
                    </Text>
                  </View>
                  {submittedRequest.medications.length > 0 && (
                    <View style={styles.badge}>
                      <MaterialCommunityIcons name="pill" size={14} color="#2D8A4E" />
                      <Text style={styles.badgeText}>
                        {submittedRequest.medications.length} Medication{submittedRequest.medications.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                  {selectedGender === 'female' && (
                    <View style={styles.badge}>
                      <MaterialCommunityIcons
                        name={submittedRequest.isPregnant ? 'human-pregnant' : 'account-check-outline'}
                        size={14}
                        color="#2D8A4E"
                      />
                      <Text style={styles.badgeText}>
                        {submittedRequest.isPregnant ? 'Pregnant' : 'Not Pregnant'}
                      </Text>
                    </View>
                  )}
                  {selectedGender === 'female' && (
                    <View style={styles.badge}>
                      <MaterialCommunityIcons
                        name={submittedRequest.isBreastfeeding ? 'baby-bottle' : 'baby-bottle-outline'}
                        size={14}
                        color="#2D8A4E"
                      />
                      <Text style={styles.badgeText}>
                        {submittedRequest.isBreastfeeding ? 'Breastfeeding' : 'Not Breastfeeding'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.modeBadge}>
                    <MaterialCommunityIcons
                      name={'clipboard-text-outline'}
                      size={14}
                      color="#2D8A4E"
                    />
                    <Text style={styles.modeBadgeText}>
                      Symptoms
                    </Text>
                  </View>
                </View>
              </View>

              {recommendationsLoading ? (
                <View style={styles.loadingContainer}>
                  <View style={styles.loadingCard}>
                    <ActivityIndicator size="large" color="#2D8A4E" />
                    <Text style={styles.loadingText}>Finding the best herbs for you...</Text>
                    <Text style={styles.loadingSubtext}>Analyzing your symptoms and profile</Text>
                  </View>
                </View>
              ) : recommendationsError ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Couldn't load recommendations. Please try again.</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={refetchSymptomRecs}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : recommendations?.status === 'blocked_red_flag' ? (
                <View style={styles.statusCardBlocked}>
                  <View style={styles.statusTitleRow}>
                    <Ionicons name="warning-outline" size={18} color="#B45309" />
                    <Text style={styles.statusTitle}>Recommendations Blocked</Text>
                  </View>
                  <Text style={styles.statusText}>
                    {recommendations?.message || 'At least one red-flag symptom requires medical attention.'}
                  </Text>
                  {Array.isArray(recommendations?.redFlags) && recommendations.redFlags.length > 0 && (
                    <View style={styles.statusList}>
                      {recommendations.redFlags.map((flag, idx) => (
                        <Text key={`${flag?.name || 'flag'}-${idx}`} style={styles.statusListItem}>
                          {`\u2022 ${flag?.name || 'Red-flag symptom'}${flag?.medicalAttentionNote ? `: ${flag.medicalAttentionNote}` : ''}`}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ) : recommendations && recommendations.recommendations &&
                recommendations.recommendations.length > 0 ? (
                <View>
                  <View style={styles.pipelineInfoCard}>
                    <Text style={styles.pipelineInfoText}>
                      Ranking Source: {recommendations?.rankingSource || 'unknown'}
                    </Text>
                    {(recommendations?.excluded?.combinationConflicts || []).length > 0 && (
                      <Text style={styles.pipelineWarningText}>
                        {(recommendations.excluded.combinationConflicts || []).length} herb(s) removed due to major combination conflicts.
                      </Text>
                    )}
                  </View>

                  {recommendationCoverage.matched.length > 0 && recommendationCoverage.unmatched.length > 0 && (
                    <View style={styles.partialResultsCard}>
                      <View style={styles.partialResultsTitleRow}>
                        <MaterialCommunityIcons name="filter-check-outline" size={16} color="#0D9488" />
                        <Text style={styles.partialResultsTitle}>Showing Results For</Text>
                      </View>
                      <View style={styles.partialResultsChips}>
                        {recommendationCoverage.matched.map((m, i) => (
                          <View key={`m-${i}`} style={styles.partialChipMatched}>
                            <Text style={styles.partialChipMatchedText}>{m}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Results Summary */}
                  <View style={styles.resultsSummaryCard}>
                    <View style={styles.summaryTitleContainer}>
                      <MaterialCommunityIcons name="chart-bar" size={20} color="#2D8A4E" />
                      <Text style={styles.summaryTitle}>Summary</Text>
                    </View>
                    <View style={styles.summaryStats}>
                      <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{recommendations.recommendations.length}</Text>
                        <Text style={styles.statLabel}>Herbs Found</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Text style={styles.statNumber}>
                          {recommendations.recommendations.filter(rec => (rec.totalEffectiveness || rec.effectiveness || 3) >= 4).length}
                        </Text>
                        <Text style={styles.statLabel}>Highly Effective</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Text style={styles.statNumber}>
                          {Math.round(recommendations.recommendations.reduce((acc, rec) => acc + (rec.totalEffectiveness || rec.effectiveness || 3), 0) / recommendations.recommendations.length * 10) / 10}
                        </Text>
                        <Text style={styles.statLabel}>Avg. Effectiveness</Text>
                      </View>
                    </View>
                  </View>

                  {recommendations.recommendations.map((rec, index) => {
                    const herb = rec.herb || {};
                    const confidence = rec.confidence ?? (rec.totalEffectiveness || rec.effectiveness ? (rec.totalEffectiveness || rec.effectiveness) / 5 : 0.6);
                    const fillPct = Math.min(confidence * 100, 100);
                    const effectiveness = confidence * 5;

                    // Extract dosage if available (from backend match) or herb default
                    // Note: Backend 'symptoms' logic populates 'dosages'
                    // Need to rely on 'herb.dosage' if 'rec.dosage' missing.
                    const dosageKey = selectedAge === 'children'
                      ? 'child'
                      : selectedAge === 'seniors'
                        ? 'elderly'
                        : 'adult';
                    const dosageInfo = herb.dosage ? herb.dosage[dosageKey] : null;

                    return (
                      <TouchableOpacity
                        key={herb._id || index}
                        style={styles.herbCard}
                        activeOpacity={0.9}
                        onPress={() => router.push({
                          pathname: '/remedy-detail',
                          params: {
                            recData: JSON.stringify({
                              rec,
                              selectedAge,
                              selectedGender,
                              selectedSymptoms: requestedSymptomNames,
                              medications: submittedRequest.medications,
                              isPregnant: submittedRequest.isPregnant,
                              isBreastfeeding: submittedRequest.isBreastfeeding,
                              conditions: submittedRequest.conditions,
                              allergies: submittedRequest.allergies,
                              severity: submittedRequest.severity,
                            })
                          }
                        })
                        }>
                        {/* Header */}
                        <View style={styles.herbHeader}>
                          <View style={styles.herbNameRow}>
                            <View style={[styles.herbIcon, { backgroundColor: getEffectivenessColor(effectiveness).bg, overflow: 'hidden' }]}>
                              {herb.images?.[0]?.url || herb.primaryImage ? (
                                <Image
                                  source={{ uri: herb.images?.[0]?.url || herb.primaryImage }}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="cover"
                                />
                              ) : (
                                <MaterialCommunityIcons
                                  name={getHerbIcon(herb.name, herb.category)}
                                  size={22}
                                  color={getEffectivenessColor(effectiveness).primary}
                                />
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.herbName} numberOfLines={1}>{herb.name || 'Herb'}</Text>
                              {herb.scientificName && (
                                <Text style={styles.herbScientific} numberOfLines={1}>{herb.scientificName}</Text>
                              )}
                            </View>
                          </View>
                          <View style={[styles.herbRankBadge, { backgroundColor: getEffectivenessColor(effectiveness).primary }]}>
                            <Text style={styles.herbRankText}>#{index + 1}</Text>
                          </View>
                        </View>

                        {/* Effectiveness Section */}
                        <View style={styles.effectivenessContainer}>
                          <View style={styles.effectivenessHeader}>
                            <Text style={styles.effectivenessLabel}>MATCH STRENGTH</Text>
                            <View style={styles.effectivenessScore}>
                              <Text style={[styles.effectivenessValue, { color: getEffectivenessColor(effectiveness).primary }]}>
                                {Math.round(confidence * 100)}%
                              </Text>
                            </View>
                          </View>
                          <View style={styles.effectivenessTrack}>
                            <View
                              style={[
                                styles.effectivenessFill,
                                {
                                  width: `${fillPct}%`,
                                  backgroundColor: getEffectivenessColor(effectiveness).primary
                                }
                              ]}
                            />
                          </View>
                          <View style={styles.propertyTagsRow}>
                            {(herb.properties || []).slice(0, 3).map((prop, pIdx) => (
                              <Text key={pIdx} style={styles.propertyTag}>
                                {String(prop).toUpperCase()}
                              </Text>
                            ))}
                          </View>
                        </View>

                        {/* Details Grid */}
                        <View style={styles.herbDetailsGrid}>
                          {dosageInfo ? (
                            <View style={styles.detailBox}>
                              <View style={styles.detailBoxHeader}>
                                <MaterialCommunityIcons name="clock-outline" size={14} color="#2D8A4E" />
                                <Text style={styles.detailBoxLabel}>Dosage ({ageGroups.find(a => a.value === selectedAge)?.label})</Text>
                              </View>
                              <Text style={styles.detailBoxValue}>
                                {dosageInfo.min}-{dosageInfo.max} {dosageInfo.unit} • {dosageInfo.frequency}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.detailBox}>
                              <View style={styles.detailBoxHeader}>
                                <MaterialCommunityIcons name="clock-outline" size={14} color="#2D8A4E" />
                                <Text style={styles.detailBoxLabel}>Dosage</Text>
                              </View>
                              <Text style={styles.detailBoxValue}>Consult Professional</Text>
                            </View>
                          )}
                          {herb.preparation && (
                            <View style={styles.detailBox}>
                              <View style={styles.detailBoxHeader}>
                                <MaterialCommunityIcons name="pot-steam-outline" size={14} color="#2D8A4E" />
                                <Text style={styles.detailBoxLabel}>Preparation</Text>
                              </View>
                              <Text style={styles.detailBoxValue} numberOfLines={2}>{formatPreparation(herb.preparation)}</Text>
                            </View>
                          )}
                        </View>

                        {/* Scientific Evidence Section */}
                        {Array.isArray(rec.studyLinks) && rec.studyLinks.length > 0 && (
                          <View style={styles.evidenceContainer}>
                            <View style={styles.evidenceTitleRow}>
                              <MaterialCommunityIcons name="flask-outline" size={16} color="#0369A1" />
                              <Text style={styles.evidenceTitle}>Scientific Evidence</Text>
                              <View style={[styles.evidenceBadge, { backgroundColor: '#E0F2FE' }]}>
                                <Text style={[styles.evidenceBadgeText, { color: '#0369A1' }]}>study-links</Text>
                              </View>
                            </View>
                            {rec.studyLinks.map((link, linkIdx) => (
                              <LinkedText
                                key={`study-${linkIdx}`}
                                text={`${link?.label ? `${link.label}: ` : ''}${link?.url || ''}`}
                                style={styles.evidenceNotes}
                                linkStyle={styles.evidenceLink}
                              />
                            ))}
                          </View>
                        )}

                        {/* Matched Symptoms Section */}
                        {rec.matchedSymptoms && rec.matchedSymptoms.length > 0 && (
                          <View style={styles.matchedSymptomsContainer}>
                            <View style={styles.matchedTitleRow}>
                              <MaterialCommunityIcons name="check-decagram-outline" size={16} color="#2D8A4E" />
                              <Text style={styles.matchedSymptomsTitle}>Target Symptoms</Text>
                            </View>
                            <View style={styles.matchedSymptomsRow}>
                              {rec.matchedSymptoms.map((symptom, idx) => (
                                <View key={idx} style={styles.matchedTag}>
                                  <Text style={styles.matchedTagText}>{symptom}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.noResultsCard}>
                  <Ionicons name="search-outline" size={48} color="#9CA89C" style={styles.noResultsIcon} />
                  <Text style={styles.noResultsText}>
                    {recommendations?.status === 'no_matches' ? 'No matching herbs found' : 'No matching remedies found'}
                  </Text>
                  <Text style={styles.noResultsSubtext}>
                    {recommendations?.message || 'Try selecting different criteria or check back later.'}
                  </Text>
                </View>
              )}

              {/* Disclaimer */}
              <View style={styles.disclaimerCard}>
                <View style={styles.disclaimerHeader}>
                  <View style={styles.disclaimerIconWrap}>
                    <Ionicons name="warning-outline" size={16} color="#FFFFFF" />
                  </View>
                  <Text style={styles.disclaimerTitle}>Safety Reminder</Text>
                </View>
                <Text style={styles.disclaimerText}>
                  These recommendations are for informational purposes only. Always consult a healthcare professional before starting any herbal treatment.
                </Text>
              </View>

              {/* New Search */}
              <TouchableOpacity
                style={styles.newSearchButton}
                onPress={resetRecommendation}
                activeOpacity={0.8}
              >
                <Text style={styles.newSearchButtonText}>Start New Search</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* Custom Symptom Modal */}
        <Modal visible={showSymptomInput} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add Custom Symptom</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Describe your symptom..."
                placeholderTextColor="#9CA89C"
                value={customSymptom}
                onChangeText={setCustomSymptom}
                multiline
                numberOfLines={3}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => { setShowSymptomInput(false); setCustomSymptom(''); }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.addButton]}
                  onPress={() => {
                    if (customSymptom.trim()) {
                      const newId = `custom_${Date.now()}`;
                      setSelectedSymptoms([...selectedSymptoms, newId]);
                      setShowSymptomInput(false);
                      setCustomSymptom('');
                    }
                  }}
                >
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showSelectedSymptomsModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSelectedSymptomsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.selectedSymptomsModalCard}>
              <View style={styles.selectedSymptomsModalHeader}>
                <Text style={styles.selectedSymptomsModalTitle}>Selected Symptoms</Text>
                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => setShowSelectedSymptomsModal(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={18} color="#1A2E1A" />
                </TouchableOpacity>
              </View>

              <Text style={styles.selectedSymptomsModalSubtitle}>
                {selectedSymptoms.length} symptom{selectedSymptoms.length > 1 ? 's' : ''} selected
              </Text>

              <ScrollView style={styles.selectedSymptomsList} showsVerticalScrollIndicator={false}>
                {selectedSymptoms.length === 0 ? (
                  <Text style={styles.selectedSymptomsEmptyText}>No selected symptoms yet.</Text>
                ) : (
                  selectedSymptoms.map((symptomId) => {
                    const symptomName = getSymptomName(symptomId);
                    return (
                      <View key={symptomId} style={styles.selectedSymptomsListItem}>
                        <Text style={styles.selectedSymptomsListText}>{symptomName}</Text>
                        <TouchableOpacity
                          style={styles.selectedSymptomsRemoveButton}
                          onPress={() => toggleSymptom(symptomId)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle" size={20} color="#D14343" />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <View style={styles.selectedSymptomsModalActions}>
                <TouchableOpacity
                  style={[
                    styles.clearSelectedButton,
                    selectedSymptoms.length === 0 && styles.clearSelectedButtonDisabled,
                  ]}
                  onPress={() => setSelectedSymptoms([])}
                  disabled={selectedSymptoms.length === 0}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearSelectedButtonText}>Clear all</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.doneSelectedButton}
                  onPress={() => setShowSelectedSymptomsModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doneSelectedButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Loading Modal */}
        <Modal visible={recommendationsLoading} transparent animationType="fade">
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#2D8A4E" />
              <Text style={styles.loadingText}>Finding remedies...</Text>
            </View>
          </View>
        </Modal>
      </ScrollView>

      {step === 1 && (
        <View style={styles.stickyActionBar}>
          <TouchableOpacity
            style={styles.stickyActionMeta}
            onPress={() => setShowSelectedSymptomsModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.stickyActionReviewRow}>
              <Text style={styles.stickyActionCount}>
                {selectedSymptoms.length} selected
              </Text>
              <Ionicons name="eye-outline" size={14} color="#2D8A4E" style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.stickyActionHint}>Tap to review your picks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.stickyContinueButton,
              selectedSymptoms.length === 0 && styles.stickyContinueButtonDisabled,
            ]}
            onPress={() => selectedSymptoms.length > 0 && animateStep(2)}
            disabled={selectedSymptoms.length === 0}
            activeOpacity={0.85}
          >
            <Text style={styles.stickyContinueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

