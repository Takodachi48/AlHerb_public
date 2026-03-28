
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  StatusBar,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { styles } from '../../styles/HerbDetailScreen.styles';
import { herbService } from '../../services/apiServices';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import apiClient from '../../services/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debugLog } from '../../utils/logger';

export default function HerbDetailScreen() {
  const router = useRouter();
  const { id, source } = useLocalSearchParams();
  const herbId = id // Handle parameter object if needed
    ? (typeof id === 'string' ? id : id.id)
    : null;

  const [herb, setHerb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [savingFav, setSavingFav] = useState(false);
  const LOCAL_FAVORITES_KEY = 'localFavoriteHerbIds';

  const isRouteNotFound = (err) => {
    const msg = String(err?.message || '').toLowerCase();
    const serverMsg = String(err?.response?.data?.message || '').toLowerCase();
    return msg.includes('route not found') || serverMsg.includes('route not found');
  };

  const getLocalFavorites = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(LOCAL_FAVORITES_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const setLocalFavorites = useCallback(async (ids) => {
    try {
      await AsyncStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(Array.from(new Set(ids))));
    } catch {
      // no-op
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await apiClient.get('/users/favorites');
      return res?.data?.data || [];
    } catch (err) {
      const locals = await getLocalFavorites();
      return locals;
    }
  }, [getLocalFavorites]);

  const addFavorite = async (targetId) => {
    try {
      await apiClient.post('/users/favorites', { herbId: targetId });
    } catch (err) {
      if (!isRouteNotFound(err)) throw err;
      const locals = await getLocalFavorites();
      await setLocalFavorites([...locals, targetId]);
    }
  };

  const removeFavorite = async (targetId) => {
    try {
      await apiClient.delete(`/users/favorites/${encodeURIComponent(targetId)}`);
    } catch (err) {
      if (!isRouteNotFound(err)) throw err;
      const locals = await getLocalFavorites();
      await setLocalFavorites(locals.filter((id) => id !== targetId));
    }
  };

  // Fallback image if herb has no images
  const defaultImage = 'https://images.unsplash.com/photo-1540660290370-8aa90e95166a?auto=format&fit=crop&q=80&w=800';

  useEffect(() => {
    const fetchHerb = async () => {
      if (!herbId) {
        debugLog('❌ No herbId provided');
        return;
      }

      debugLog('🔍 Fetching herb with ID:', herbId);

      try {
        setLoading(true);
        setError(null);
        const herbData = await herbService.getHerbById(herbId);
        setHerb(herbData);

        // Check if favorite
        try {
          const favs = await fetchFavorites();
          const targetId = herbData?._id || herbId;
          const localIds = await getLocalFavorites();
          setIsFavorite(
            favs.some(h => (h._id || h.id || h) === targetId) || localIds.includes(targetId)
          );
        } catch (_favErr) {
          debugLog('Failed to fetch favorite status');
        }
      } catch (err) {
        console.error('❌ Error fetching herb:', err);
        setError(`Failed to load herb details. Status: ${err.response?.status}`);
      } finally {
        setLoading(false);
      }
    };

    fetchHerb();
  }, [herbId, fetchFavorites, getLocalFavorites]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${herb?.name} on AlgoHerbarium! \n\n${herb?.description}`,
      });
    } catch (error) {
      console.error(error.message);
    }
  };

  const handleBack = () => {
    if (source === 'herb-map') {
      router.push('/(tabs)/herb-map');
    } else {
      router.back(); // Default behavior for herbs screen and others
    }
  };

  const toggleFavorite = async () => {
    const targetId = herb?._id || herbId;
    debugLog('💜 Attempting to toggle favorite for herb:', targetId);

    if (!targetId || savingFav) {
      debugLog('⚠️ Toggle blocked:', { targetId, savingFav });
      return;
    }

    setSavingFav(true);
    const wasFavorite = isFavorite;
    debugLog('💜 Current state:', wasFavorite ? 'is favorite' : 'not favorite');

    try {
      if (wasFavorite) {
        debugLog('💜 Sending DELETE favorite request for herb:', targetId);
        await removeFavorite(targetId);
        const locals = await getLocalFavorites();
        await setLocalFavorites(locals.filter((id) => id !== targetId));
        setIsFavorite(false);
        debugLog('✅ Successfully removed from favorites');
      } else {
        debugLog('💜 Sending POST favorite request for herb:', targetId);
        await addFavorite(targetId);
        const locals = await getLocalFavorites();
        await setLocalFavorites([...locals, targetId]);
        setIsFavorite(true);
        debugLog('✅ Successfully added to favorites');
      }
    } catch (err) {
      console.error('❌ Favorite error:', err.message);
      if (err.response) {
        console.error('❌ Server response error:', err.response.data);
      }
      // Revert state on error
      setIsFavorite(wasFavorite);
    } finally {
      // Small delay to make spinner visible if API is too fast
      setTimeout(() => {
        setSavingFav(false);
        debugLog('💜 Saving state reset to false');
      }, 800);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading herb details...</Text>
      </View>
    );
  }

  if (error || !herb) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>
          {error || 'Herb not found'}
        </Text>
        <Text style={styles.errorSubText}>
          This herb may not be available in our database yet.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleBack}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const primaryImage = herb.images?.find(img => img.isPrimary)?.url || herb.images?.[0]?.url || defaultImage;
  const dosageGroups = ['adult', 'child', 'elderly'];
  const dosage = herb?.dosage && typeof herb.dosage === 'object' ? herb.dosage : {};
  const dosageEntries = dosageGroups
    .map((group) => ({ group, details: dosage[group] }))
    .filter(({ details }) => {
      if (!details || typeof details !== 'object') return false;
      const hasMin = String(details.min || '').trim().length > 0;
      const hasMax = String(details.max || '').trim().length > 0;
      const hasUnit = String(details.unit || '').trim().length > 0;
      const hasFrequency = String(details.frequency || '').trim().length > 0;
      return hasMin || hasMax || hasUnit || hasFrequency;
    });

  const safetyInfo = (herb?.safety && typeof herb.safety === 'object')
    ? herb.safety
    : ((herb?.safetyProfile && typeof herb.safetyProfile === 'object') ? herb.safetyProfile : {});
  const pregnancyStatus = String(safetyInfo?.pregnancy || '').trim().toLowerCase();
  const isPregnancyHighRisk = ['avoid', 'contraindicated'].includes(pregnancyStatus);
  const toLabel = (value) => {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
  const safetyRows = [
    { key: 'pregnancy', label: 'Pregnancy', icon: 'baby-carriage', value: safetyInfo?.pregnancy },
    { key: 'nursing', label: 'Nursing', icon: 'mother-nurse', value: safetyInfo?.nursing || safetyInfo?.breastfeeding },
    { key: 'children', label: 'Children', icon: 'human-child', value: safetyInfo?.children },
    { key: 'elderly', label: 'Elderly', icon: 'human-cane', value: safetyInfo?.elderly },
  ].filter((item) => String(item.value || '').trim().length > 0);
  const interactionItems = Array.isArray(herb?.interactions) ? herb.interactions : [];
  const activeCompoundNames = Array.isArray(herb?.phytochemicals)
    ? herb.phytochemicals
      .map((item) => item?.name || item?.compound?.name)
      .filter(Boolean)
    : [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Hero Section ───────────────────────────── */}
        <ImageBackground source={{ uri: primaryImage }} style={styles.heroImage}>
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.6)']}
            style={styles.heroOverlay}
          >
            {/* Header Nav */}
            <View style={styles.headerNav}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                <Ionicons name="share-social" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Title Block */}
            <View style={styles.heroContent}>
              <Text style={styles.herbNameHero}>{herb.name}</Text>
              <Text style={[styles.scientificName, { fontStyle: 'italic', color: '#CBD5E1', marginTop: 4, fontSize: 16 }]}>{herb.scientificName}</Text>
            </View>
          </LinearGradient>
        </ImageBackground>

        {/* ── Main Content Sheet ───────────────────── */}
        <View style={styles.contentSheet}>

          {/* Other Names */}
          {herb.commonNames && herb.commonNames.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, color: '#64748B', fontStyle: 'italic', lineHeight: 20 }}>
                <Text style={{ fontWeight: '600', color: '#475569' }}>Also known as: </Text>
                {herb.commonNames.join(', ')}
              </Text>
            </View>
          )}

          {/* Quick Tags */}
          <View style={styles.tagsRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{herb.family || 'Unknown Family'}</Text>
            </View>
            {herb.partsUsed?.map((part, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>part: {part}</Text>
              </View>
            ))}
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={{ fontSize: 18, lineHeight: 30, color: '#475569' }}>
              {herb.description}
            </Text>
          </View>

          {/* Key Benefits */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Medical Uses</Text>
            <View style={styles.card}>
              {herb.properties?.map((prop, index) => (
                <View key={index} style={styles.benefitRow}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <MaterialCommunityIcons name="check" size={20} color="#059669" />
                  </View>
                  <Text style={styles.benefitText}>{prop}</Text>
                </View>
              ))}
            </View>

            {herb.symptoms?.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 14, color: '#94A3B8', marginBottom: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Traditionally used for</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {herb.symptoms.map((sym, i) => (
                    <View key={i} style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100 }}>
                      <Text style={{ color: '#475569', fontSize: 14, fontWeight: '600' }}>{sym}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Preparation */}
          {herb.preparation && herb.preparation.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Preparation</Text>
              {herb.preparation.map((prep, index) => (
                <View key={index} style={styles.prepCard}>
                  <View style={styles.prepHeader}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="tea" size={24} color="#059669" />
                    </View>
                    <Text style={styles.prepMethodTitle}>{prep.method}</Text>
                  </View>
                  <Text style={styles.prepInstructions}>{prep.instructions}</Text>
                  {prep.ratio && <Text style={styles.prepRatio}>Ratio: {prep.ratio}</Text>}
                </View>
              ))}
            </View>
          )}

          {/* Dosage Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommended Dosage</Text>
            <View style={[styles.card, { padding: 16 }]}>
              {dosageEntries.length > 0 ? (
                dosageEntries.map(({ group, details }, idx) => {
                  const isLast = idx === dosageEntries.length - 1;
                  const min = String(details.min || '').trim();
                  const max = String(details.max || '').trim();
                  const unit = String(details.unit || '').trim();
                  const frequency = String(details.frequency || '').trim();
                  const amount = min && max
                    ? (min === max ? `${min} ${unit}`.trim() : `${min} - ${max} ${unit}`.trim())
                    : `${(min || max || 'Amount not specified')} ${unit}`.trim();

                  return (
                    <View key={group} style={{
                      marginBottom: isLast ? 0 : 12,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: '#F1F5F9',
                      paddingBottom: isLast ? 0 : 12,
                    }}>
                      <Text style={{ fontWeight: '700', color: '#334155', textTransform: 'capitalize', marginBottom: 4, fontSize: 16 }}>{group}</Text>
                      <Text style={{ color: '#475569', fontSize: 14 }}>
                        {amount}
                      </Text>
                      <Text style={{ color: '#64748B', fontSize: 13, fontStyle: 'italic', marginTop: 2 }}>
                        {frequency || 'Frequency not specified'}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={{ color: '#64748B', fontSize: 14, lineHeight: 22 }}>
                  No recommended dosage is available for this herb yet.
                </Text>
              )}
            </View>
          </View>

          {/* Safety Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Safety & Precautions</Text>

            {/* Pregnancy/Nursing Waring */}
            {isPregnancyHighRisk && (
              <View style={[styles.alertBox, styles.alertRed]}>
                <MaterialCommunityIcons name="alert-octagon" size={22} color="#991B1B" style={styles.alertIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, styles.textRed]}>Do Not Use</Text>
                  <Text style={[styles.alertText, styles.textRed]}>
                    Avoid during pregnancy or breastfeeding unless directed by a professional.
                  </Text>
                </View>
              </View>
            )}

            {/* Detailed Safety Info */}
            {safetyRows.length > 0 ? (
              <View style={{ marginBottom: 16 }}>
                <View style={[styles.card, { padding: 16 }]}>
                  {safetyRows.map((item, idx) => (
                    <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: idx === safetyRows.length - 1 ? 0 : 8 }}>
                      <MaterialCommunityIcons name={item.icon} size={20} color="#64748B" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#475569', fontSize: 14 }}>
                        <Text style={{ fontWeight: '600' }}>{item.label}:</Text> {toLabel(item.value)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={{ marginBottom: 16 }}>
                <View style={[styles.card, { padding: 16 }]}>
                  <Text style={{ color: '#64748B', fontSize: 14, lineHeight: 22 }}>
                    No specific safety profile is available for this herb yet.
                  </Text>
                </View>
              </View>
            )}

            {/* General Disclaimer */}
            <View style={[styles.alertBox, styles.alertYellow]}>
              <MaterialCommunityIcons name="information" size={22} color="#92400E" style={styles.alertIcon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, styles.textYellow]}>Consult a Doctor</Text>
                <Text style={[styles.alertText, styles.textYellow]}>
                  Contains {activeCompoundNames.join(', ') || 'active compounds'}.
                  Always check for interactions with your medications.
                </Text>
              </View>
            </View>

            {/* Interactions */}
            {interactionItems.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 8 }]}>Known Interactions</Text>
                {interactionItems.map((interaction, idx) => (
                  <View key={idx} style={[styles.alertBox, styles.alertRed, { marginBottom: 8 }]}>
                    <MaterialCommunityIcons name="alert" size={20} color="#991B1B" style={styles.alertIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertTitle, styles.textRed]}>
                        {interaction.interactsWith?.drugName || interaction.interactsWith?.herbId || 'Unknown Interaction'}
                      </Text>
                      <Text style={[styles.alertText, styles.textRed]}>
                        {interaction.effect}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Growing Info intentionally hidden on mobile */}
          {false && herb.growingInfo && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cultivation</Text>
              <View style={styles.card}>
                <Text style={{ color: '#4B5563', marginBottom: 4 }}>☀️ {herb.growingInfo.sunlight}</Text>
                <Text style={{ color: '#4B5563', marginBottom: 4 }}>💧 {herb.growingInfo.water}</Text>
                <Text style={{ color: '#4B5563' }}>🌱 {herb.growingInfo.soil}</Text>
              </View>
            </View>
          )}

        </View>
      </ScrollView>

      {/* ── Stick Bottom Bar ────────────────────────── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.favButton, isFavorite && styles.favButtonActive]}
          onPress={toggleFavorite}
          disabled={savingFav}
        >
          {savingFav ? (
            <ActivityIndicator size="small" color="#10B981" />
          ) : (
            <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={26} color={isFavorite ? "#EF4444" : "#4B5563"} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.findButton}
          onPress={() => router.push({ pathname: '/(tabs)/herb-map', params: { herbId: herb._id, useNearby: 'true' } })}
        >
          <MaterialCommunityIcons name="map-marker-radius" size={22} color="#FFF" />
          <Text style={styles.findButtonText}>Find Nearby</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

