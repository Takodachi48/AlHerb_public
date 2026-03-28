import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { FadeInDown, Layout } from 'react-native-reanimated';
import { styles } from '../../styles/InteractionsScreen.styles';
import { interactionService } from '../../services/interactionService';
import Header from '../../components/common/Header';

const SEVERITY_CONFIG = {
  contraindicated: {
    color: '#EF4444',
    bg: '#FEF2F2',
    icon: 'alert-octagon',
    label: 'Contraindicated',
    description: 'Do not use together'
  },
  major: {
    color: '#F97316',
    bg: '#FFF7ED',
    icon: 'alert-circle',
    label: 'Major Interaction',
    description: 'High risk - Avoid or monitor closely'
  },
  moderate: {
    color: '#F59E0B',
    bg: '#FFFBEB',
    icon: 'alert-triangle',
    label: 'Moderate Interaction',
    description: 'Moderate risk - Use with caution'
  },
  minor: {
    color: '#3B82F6',
    bg: '#EFF6FF',
    icon: 'information',
    label: 'Minor Interaction',
    description: 'Low risk - Minor effects possible'
  },
  unknown: {
    color: '#6B7280',
    bg: '#F3F4F6',
    icon: 'help-circle',
    label: 'Unknown Interaction',
    description: 'No data available'
  }
};

const normalizeMedicationName = (value = '') => String(value).replace(/\s+/g, ' ').trim();

const dedupeMedications = (list = []) => {
  const seen = new Set();
  const medications = [];

  list.forEach((entry) => {
    const normalized = normalizeMedicationName(entry);
    if (!normalized) return;

    const key = normalized.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    medications.push(normalized);
  });

  return medications;
};

const hasMedication = (list = [], value = '') => {
  const key = normalizeMedicationName(value).toLowerCase();
  if (!key) return false;
  return list.some((item) => normalizeMedicationName(item).toLowerCase() === key);
};

const parseMedicationsParam = (rawValue) => {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (!value) return [];

  if (Array.isArray(value)) {
    return dedupeMedications(value);
  }

  const asString = String(value).trim();
  if (!asString) return [];

  try {
    const parsed = JSON.parse(asString);
    if (Array.isArray(parsed)) return dedupeMedications(parsed);
  } catch (_err) {
    // Fallback to CSV parsing below.
  }

  return dedupeMedications(
    asString
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
};

const InteractionCard = ({ interaction, index }) => {
  const [expanded, setExpanded] = useState(false);
  const config = SEVERITY_CONFIG[interaction.severity?.toLowerCase()] || SEVERITY_CONFIG.unknown;
  const isHerbDrug = interaction.interactsWith?.type === 'drug';

  return (
    <Reanimated.View
      entering={FadeInDown.delay(index * 100).springify()}
      layout={Layout.springify()}
      style={[styles.interactionCard, { borderLeftColor: config.color, borderLeftWidth: 4 }]}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpanded(!expanded)}
        style={styles.cardHeader}
      >
        <View style={styles.cardHeaderTop}>
          <View style={[styles.severityBadge, { backgroundColor: config.bg }]}>
            <MaterialCommunityIcons name={config.icon} size={16} color={config.color} />
            <Text style={[styles.severityText, { color: config.color }]}>{config.label}</Text>
          </View>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
        </View>
        
        <View style={styles.interactionPair}>
          <Text style={styles.herbName}>{interaction.herbId?.name || 'Unknown Herb'}</Text>
          <MaterialCommunityIcons name="plus" size={16} color="#9CA3AF" style={{ marginHorizontal: 8 }} />
          <Text style={styles.drugName}>
            {isHerbDrug 
              ? (interaction.interactsWith.drugName || 'Unknown Drug') 
              : (interaction.interactsWith.herbId?.name || 'Unknown Herb')}
          </Text>
        </View>

        <Text style={styles.effectSummary} numberOfLines={expanded ? undefined : 2}>
          {interaction.effect}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.cardContent}>
          <View style={styles.divider} />
          
          {interaction.mechanism && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Mechanism</Text>
              <Text style={styles.detailText}>{interaction.mechanism}</Text>
            </View>
          )}

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Recommendation</Text>
            <View style={[styles.recommendationBox, { backgroundColor: config.bg, borderColor: config.color + '40' }]}>
              <Text style={[styles.recommendationText, { color: '#1F2937' }]}>
                {interaction.recommendation}
              </Text>
            </View>
          </View>

          {interaction.management && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Management</Text>
              <Text style={styles.detailText}>{interaction.management}</Text>
            </View>
          )}
        </View>
      )}
    </Reanimated.View>
  );
};

export default function InteractionsScreen() {
  const params = useLocalSearchParams();
  const [selectedHerbs, setSelectedHerbs] = useState([]);
  const [selectedMedications, setSelectedMedications] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [herbSearch, setHerbSearch] = useState('');
  const [medicationSearch, setMedicationSearch] = useState('');
  const [availableHerbs, setAvailableHerbs] = useState([]);
  const [availableMedications, setAvailableMedications] = useState([]);
  const [, setLoading] = useState(false);
  const [checkingInteractions, setCheckingInteractions] = useState(false);
  const [interactionType, setInteractionType] = useState('herb-drug'); // 'herb-drug' or 'herb-herb'
  const [showResults, setShowResults] = useState(false);

  // Load available herbs on component mount
  useEffect(() => {
    loadAvailableHerbs();
    loadSuggestedMedications();
    if (params.herbId) {
      setSelectedHerbs([params.herbId]);
      // If we have an herb, user likely wants to check drug interactions
      setInteractionType('herb-drug');
    }
    const medsFromParams = parseMedicationsParam(params.medications);
    if (medsFromParams.length > 0) {
      setSelectedMedications((prev) => dedupeMedications([...prev, ...medsFromParams]));
    }
  }, [params.herbId, params.medications]);

  const loadAvailableHerbs = async () => {
    try {
      setLoading(true);
      const response = await interactionService.getAvailableHerbs({ limit: 100 });
      if (response.success && response.data) {
        setAvailableHerbs(response.data);
      }
    } catch (error) {
      console.error('Error loading herbs:', error);
      Alert.alert('Error', 'Failed to load available herbs');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestedMedications = async () => {
    try {
      const response = await interactionService.getUserMedications();
      if (response.success && Array.isArray(response.data)) {
        setAvailableMedications(response.data);
      }
    } catch (error) {
      console.warn('Unable to load saved medications:', error?.message || error);
    }
  };

  const toggleHerb = (herb) => {
    const herbId = herb._id || herb;
    setSelectedHerbs(prev =>
      prev.includes(herbId)
        ? prev.filter(h => h !== herbId)
        : [...prev, herbId]
    );
    setShowResults(false);
  };

  const toggleMedication = (medication) => {
    const normalized = normalizeMedicationName(medication);
    if (!normalized) return;

    setSelectedMedications(prev => {
      const exists = hasMedication(prev, normalized);
      if (exists) {
        const target = normalized.toLowerCase();
        return prev.filter((item) => normalizeMedicationName(item).toLowerCase() !== target);
      }
      return [...prev, normalized];
    });
    setShowResults(false);
  };

  const addMedicationFromInput = () => {
    const normalized = normalizeMedicationName(medicationSearch);
    if (!normalized) return;

    setSelectedMedications((prev) => (hasMedication(prev, normalized) ? prev : [...prev, normalized]));
    setAvailableMedications((prev) => dedupeMedications([...prev, normalized]));
    setMedicationSearch('');
    setShowResults(false);
  };

  const checkInteractions = async () => {
    if (selectedHerbs.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one herb to check.');
      return;
    }

    if (interactionType === 'herb-drug' && selectedMedications.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one medication.');
      return;
    }

    if (interactionType === 'herb-herb' && selectedHerbs.length < 2) {
      Alert.alert('Selection Required', 'Please select at least two herbs to check for interactions.');
      return;
    }

    try {
      setCheckingInteractions(true);
      Keyboard.dismiss();

      const data = {
        herbs: selectedHerbs,
        drugs: interactionType === 'herb-drug' ? selectedMedications : [],
        type: interactionType
      };

      const response = await interactionService.checkInteractions(data);

      if (response.success) {
        const allInteractions = interactionType === 'herb-drug'
          ? response.data.herbDrugInteractions || []
          : response.data.herbHerbInteractions || [];

        setInteractions(allInteractions);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Error checking interactions:', error);
      Alert.alert('Error', error?.message || 'Failed to check interactions. Please try again.');
    } finally {
      setCheckingInteractions(false);
    }
  };

  const clearSelections = () => {
    setSelectedHerbs([]);
    setSelectedMedications([]);
    setInteractions([]);
    setShowResults(false);
    setHerbSearch('');
    setMedicationSearch('');
  };

  const filteredHerbs = availableHerbs.filter(herb => {
    const searchLower = herbSearch.toLowerCase().trim();
    if (!searchLower && selectedHerbs.length > 0) return true; // Show selected if no search
    if (!searchLower) return true; // Show all if no search (limit in render)

    return (
      herb.name?.toLowerCase().includes(searchLower) ||
      herb.scientificName?.toLowerCase().includes(searchLower) ||
      herb.commonNames?.some(name => name.toLowerCase().includes(searchLower))
    );
  }).sort((a, b) => {
    const aSelected = selectedHerbs.includes(a._id);
    const bSelected = selectedHerbs.includes(b._id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return a.name.localeCompare(b.name);
  });

  const filteredMedications = dedupeMedications([...selectedMedications, ...availableMedications]).filter(medication => {
    const searchLower = medicationSearch.toLowerCase().trim();
    if (!searchLower && selectedMedications.length > 0) return true;
    if (!searchLower) return true;
    return medication.toLowerCase().includes(searchLower);
  }).sort((a, b) => {
    const aSelected = hasMedication(selectedMedications, a);
    const bSelected = hasMedication(selectedMedications, b);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return a.localeCompare(b);
  });

  const renderSelectionChip = (item, isSelected, onPress, type) => (
    <TouchableOpacity
      key={type === 'herb' ? (item?._id || item?.id || item?.name || String(item)) : String(item)}
      style={[
        styles.chip,
        isSelected && styles.chipSelected
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[
        styles.chipIconContainer,
        isSelected && styles.chipIconContainerSelected
      ]}>
        <Ionicons 
          name={type === 'herb' ? "leaf" : "medical"} 
          size={14} 
          color={isSelected ? "#FFFFFF" : "#10B981"} 
        />
      </View>
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
        {item.name || item}
      </Text>
      {isSelected && (
        <View style={styles.chipCheck}>
          <Ionicons name="checkmark" size={12} color="#10B981" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Interaction Checker" showBack={true} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Type Selector */}
        <View style={styles.typeSelectorContainer}>
          <TouchableOpacity
            style={[styles.typeButton, interactionType === 'herb-drug' && styles.typeButtonActive]}
            onPress={() => {
              setInteractionType('herb-drug');
              setShowResults(false);
            }}
          >
            <MaterialCommunityIcons 
              name="pill" 
              size={20} 
              color={interactionType === 'herb-drug' ? '#FFFFFF' : '#6B7280'} 
            />
            <Text style={[styles.typeButtonText, interactionType === 'herb-drug' && styles.typeButtonTextActive]}>
              Herb-Drug
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.typeButton, interactionType === 'herb-herb' && styles.typeButtonActive]}
            onPress={() => {
              setInteractionType('herb-herb');
              setShowResults(false);
            }}
          >
            <MaterialCommunityIcons 
              name="leaf" 
              size={20} 
              color={interactionType === 'herb-herb' ? '#FFFFFF' : '#6B7280'} 
            />
            <Text style={[styles.typeButtonText, interactionType === 'herb-herb' && styles.typeButtonTextActive]}>
              Herb-Herb
            </Text>
          </TouchableOpacity>
        </View>

        {/* Herb Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Herbs</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search herbs..."
              value={herbSearch}
              onChangeText={setHerbSearch}
              placeholderTextColor="#9CA3AF"
            />
            {herbSearch.length > 0 && (
              <TouchableOpacity onPress={() => setHerbSearch('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.chipsContainer}>
            {filteredHerbs.slice(0, 8).map((herb) => (
              renderSelectionChip(
                herb,
                selectedHerbs.includes(herb._id),
                () => toggleHerb(herb),
                'herb'
              )
            ))}
          </View>
        </View>

        {/* Medication Selection Section */}
        {interactionType === 'herb-drug' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Medications</Text>
            <View style={styles.searchContainer}>
              <Ionicons name="medical" size={20} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Type medication and tap +"
                value={medicationSearch}
                onChangeText={setMedicationSearch}
                onSubmitEditing={addMedicationFromInput}
                returnKeyType="done"
                placeholderTextColor="#9CA3AF"
              />
              {medicationSearch.length > 0 && (
                <TouchableOpacity onPress={() => setMedicationSearch('')}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.addMedicationButton, !medicationSearch.trim() && styles.addMedicationButtonDisabled]}
                onPress={addMedicationFromInput}
                disabled={!medicationSearch.trim()}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputHint}>
              You can type any medication. Suggestions below come from your saved medical info.
            </Text>

            <View style={styles.chipsContainer}>
              {filteredMedications.slice(0, 8).map((medication) => (
                renderSelectionChip(
                  medication,
                  hasMedication(selectedMedications, medication),
                  () => toggleMedication(medication),
                  'drug'
                )
              ))}
            </View>
            {filteredMedications.length === 0 && (
              <Text style={styles.emptyHint}>
                No medication suggestions yet. Add one using the input above.
              </Text>
            )}
          </View>
        )}

        {/* Check Button */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.checkButton, checkingInteractions && styles.checkButtonDisabled]}
            onPress={checkInteractions}
            disabled={checkingInteractions}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradient}
            >
              {checkingInteractions ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="shield-check" size={22} color="#FFFFFF" />
                  <Text style={styles.checkButtonText}>Check Interactions</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          
          {(selectedHerbs.length > 0 || selectedMedications.length > 0) && (
            <TouchableOpacity style={styles.clearButton} onPress={clearSelections}>
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Results Section */}
        {showResults && (
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Analysis Results</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {interactions.length} Found
                </Text>
              </View>
            </View>

            {interactions.length > 0 ? (
              interactions.map((interaction, index) => (
                <InteractionCard key={index} interaction={interaction} index={index} />
              ))
            ) : (
              <View style={styles.safeState}>
                <View style={styles.safeIconContainer}>
                  <MaterialCommunityIcons name="shield-check-outline" size={48} color="#10B981" />
                </View>
                <Text style={styles.safeTitle}>No Interactions Found</Text>
                <Text style={styles.safeDescription}>
                  We didn't find any known interactions between the selected items. 
                  However, always consult with a healthcare provider.
                </Text>
              </View>
            )}
          </View>
        )}
        
        <View style={styles.disclaimerBox}>
          <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.disclaimerText}>
            This tool provides information for educational purposes only and does not replace professional medical advice.
          </Text>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
