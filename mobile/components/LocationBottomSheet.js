import React, { useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, TouchableOpacity, FlatList, Linking, Share, ScrollView, Image } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLocationAddress } from '../utils/locationFormat';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SPRING_CONFIG = {
    damping: 50,
    stiffness: 200,
    mass: 1,
    overshootClamping: true,
    restDisplacementThreshold: 0.1,
    restSpeedThreshold: 0.1,
};

const formatTypeLabel = (type) => {
    const value = String(type || 'location').replace(/[-_]/g, ' ').trim();
    if (!value) return 'Location';
    return value
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

const getCoordinates = (location) => {
    const lat = Number(location?.location?.coordinates?.[1] ?? location?.latitude);
    const lng = Number(location?.location?.coordinates?.[0] ?? location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return '';
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

const getPrimaryImage = (images = []) => {
    if (!Array.isArray(images) || images.length === 0) return null;
    const normalized = images
        .map((image, index) => {
            if (!image) return null;
            if (typeof image === 'string') {
                return { url: image, caption: '', isPrimary: index === 0 };
            }
            if (typeof image === 'object' && image.url) {
                return image;
            }
            return null;
        })
        .filter(Boolean);
    if (normalized.length === 0) return null;
    return normalized.find((image) => image.isPrimary) || normalized[0];
};

const getAreaLabel = (location) => {
    const derived = location?.derivedLocation || {};
    const area = [derived.city, derived.province].filter(Boolean).join(', ');
    if (area) return area;
    const fallbackAddress = formatLocationAddress(location, '');
    if (!fallbackAddress) return 'Area not specified';
    return fallbackAddress.split(',').slice(-2).join(', ').trim() || fallbackAddress;
};

const getLocationTagline = (location) => {
    const description = String(location?.description || '').trim();
    if (description) {
        return description.length > 52 ? `${description.slice(0, 52).trimEnd()}...` : description;
    }

    const firstHerb = Array.isArray(location?.herbs) && location.herbs.length > 0
        ? (location.herbs[0]?.herbId?.name || location.herbs[0]?.name)
        : '';
    if (firstHerb) return `${firstHerb} herbal source`;

    return `${formatTypeLabel(location?.type)} herb location`;
};

const LocationBottomSheet = ({
    locations,
    selectedLocation,
    onLocationSelect,
    isGeocoding = false,
    headerMode = 'all',
    onSheetStateChange = () => { },
}) => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const MAX_TRANSLATE_Y = -(SCREEN_HEIGHT - insets.top - 8);
    const MIN_TRANSLATE_Y = -SCREEN_HEIGHT * 0.15;

    // Store as shared values so worklets can access them on the UI thread
    const maxTranslateY = useSharedValue(MAX_TRANSLATE_Y);
    const minTranslateY = useSharedValue(MIN_TRANSLATE_Y);

    const translateY = useSharedValue(MIN_TRANSLATE_Y);
    const gestureStartY = useSharedValue(MIN_TRANSLATE_Y);

    const safeLocations = useMemo(() => {
        if (!locations) return [];
        return locations.filter((item) => item && (item._id || item.id));
    }, [locations]);
    const visibleCount = safeLocations.length;

    // EXPANDED STATE: If selectedLocation is present, show details
    const showDetails = !!selectedLocation;
    const headerTitle = useMemo(() => {
        if (isGeocoding) return 'Finding locations...';
        if (headerMode === 'all') return 'All Herbal Locations';
        if (headerMode === 'search') return `${visibleCount} Search Results`;
        if (headerMode === 'nearby') return `${visibleCount} Nearby Herbal Locations`;
        return `${visibleCount} Herbal Locations`;
    }, [headerMode, isGeocoding, visibleCount]);

    // Helper functions for actions
    const handleGetDirections = () => {
        if (!selectedLocation) return;
        const lat = selectedLocation.location?.coordinates?.[1] || selectedLocation.latitude;
        const lng = selectedLocation.location?.coordinates?.[0] || selectedLocation.longitude;
        if (lat && lng) {
            const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
            const latLng = `${lat},${lng}`;
            const label = selectedLocation.name;
            const url = Platform.select({
                ios: `${scheme}${label}@${latLng}`,
                android: `${scheme}${latLng}(${label})`
            });
            Linking.openURL(url);
        }
    };

    const handleCall = () => {
        if (selectedLocation?.phone) {
            Linking.openURL(`tel:${selectedLocation.phone}`);
        }
    };

    const handleShare = async () => {
        if (!selectedLocation) return;
        try {
            const addressText = formatLocationAddress(selectedLocation, 'Location details unavailable');

            await Share.share({
                message: `Check out ${selectedLocation.name} in Sproutify! It's located at ${addressText}.`,
                title: selectedLocation.name,
            });
        } catch (error) {
            console.error(error.message);
        }
    };

    const handleOpenWebsite = () => {
        const raw = selectedLocation?.website;
        if (!raw) return;
        const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        Linking.openURL(normalized);
    };

    // Helper function to format hours object to readable string
    const formatHours = (hours) => {
        if (!hours) return '';

        if (typeof hours === 'string') return hours;

        if (typeof hours === 'object') {
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const formattedDays = days.map(day => {
                const dayData = hours[day];
                if (!dayData) return null;

                const dayName = day.charAt(0).toUpperCase() + day.slice(1, 3);

                // Handle nested object structure
                if (typeof dayData === 'string') {
                    return `${dayName}: ${dayData}`;
                } else if (typeof dayData === 'object') {
                    if (dayData.closed === true) {
                        return `${dayName}: Closed`;
                    } else if (dayData.closed === false) {
                        if (dayData.open && dayData.close) {
                            return `${dayName}: ${dayData.open} - ${dayData.close}`;
                        } else if (dayData.openTime && dayData.closeTime) {
                            return `${dayName}: ${dayData.openTime} - ${dayData.closeTime}`;
                        } else {
                            return `${dayName}: Open`;
                        }
                    }
                }
                return null;
            }).filter(Boolean);

            return formattedDays.join(' | ');
        }

        return '';
    };

    // Snap points logic
    const scrollTo = useCallback((destination) => {
        'worklet';
        translateY.value = withSpring(destination, SPRING_CONFIG);
    }, [translateY]);

    // React to selection
    useEffect(() => {
        if (selectedLocation) {
            scrollTo(MAX_TRANSLATE_Y + 50);
            onSheetStateChange('expanded');
        } else if (locations.length > 0) {
            scrollTo(MIN_TRANSLATE_Y);
            onSheetStateChange('collapsed');
        } else {
            scrollTo(-50);
            onSheetStateChange('collapsed');
        }
    }, [selectedLocation, locations.length, scrollTo, onSheetStateChange]);

    const panGesture = Gesture.Pan()
        .onStart(() => {
            gestureStartY.value = translateY.value;
        })
        .onUpdate((event) => {
            'worklet';
            const next = gestureStartY.value + event.translationY;
            translateY.value = Math.max(maxTranslateY.value, Math.min(minTranslateY.value, next));
        })
        .onEnd((event) => {
            const snapPoints = [MIN_TRANSLATE_Y, -SCREEN_HEIGHT * 0.45, MAX_TRANSLATE_Y];
            let dest = MIN_TRANSLATE_Y;
            let minDist = Infinity;
            snapPoints.forEach((point) => {
                const dist = Math.abs(translateY.value - point);
                if (dist < minDist) { minDist = dist; dest = point; }
            });
            if (event.velocityY < -500) dest = MAX_TRANSLATE_Y;
            else if (event.velocityY > 500) dest = MIN_TRANSLATE_Y;
            scrollTo(dest);
            runOnJS(onSheetStateChange)(dest <= -SCREEN_HEIGHT * 0.45 ? 'expanded' : 'collapsed');
        });

    const rBottomSheetStyle = useAnimatedStyle(() => {
        return { transform: [{ translateY: translateY.value }] };
    });

    const handleHerbPress = (herbItem) => {
        if (herbItem) {
            const actualHerb = herbItem.herbId || herbItem;
            const herbId = actualHerb._id || actualHerb.slug || actualHerb.id;
            if (herbId) {
                router.push(`/herbs/${herbId}?source=herb-map`);
            }
        }
    };

    // --- RENDER HELPERS ---

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.line} />
            {!showDetails && (
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>
                        {headerTitle}
                    </Text>
                </View>
            )}
        </View>
    );

    const renderLocationItem = ({ item }) => {
        if (!item) return null;
        return (
            <TouchableOpacity
                style={[styles.card, selectedLocation?._id === item?._id && styles.selectedCard]}
                onPress={() => onLocationSelect(item)}
            >
                <View style={[styles.iconContainer, { backgroundColor: getTypeColor(item.type) + '15' }]}>
                    <Ionicons name={getTypeIcon(item.type)} size={22} color={getTypeColor(item.type)} />
                </View>
                <View style={styles.cardContent}>
                    <View style={styles.titleRow}>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        {(item.isVerified || item.verified) && (
                            <View style={styles.verifiedBadge}>
                                <Ionicons name="checkmark-circle" size={12} color="#D97706" />
                                <Text style={styles.verifiedText}>Verified</Text>
                            </View>
                        )}
                        {item.isPromoted && (
                            <View style={styles.promotedBadge}>
                                <Text style={styles.promotedText}>Ad</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.cardAddress} numberOfLines={1}>
                        {getAreaLabel(item)}
                    </Text>
                    <Text style={styles.cardTagline} numberOfLines={1}>
                        {getLocationTagline(item)}
                    </Text>
                    <View style={styles.cardMeta}>
                        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) + '10' }]}>
                            <Text style={[styles.typeBadgeText, { color: getTypeColor(item.type) }]}>{formatTypeLabel(item.type)}</Text>
                        </View>
                        {Number.isFinite(Number(item.distance)) ? (
                            <Text style={styles.distancePill}>{Number(item.distance).toFixed(1)} km</Text>
                        ) : (
                            <Text style={styles.herbCount}>{item.herbs?.length || 0} herbs</Text>
                        )}
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>
        );
    };

    const renderDetails = () => {
        const loc = selectedLocation;
        if (!loc) return null;

        const inventory = Array.isArray(loc.herbs) ? loc.herbs : [];
        const primaryImage = getPrimaryImage(loc.images);
        const coordinateText = getCoordinates(loc);
        const derived = loc.derivedLocation || {};
        const areaText = [derived.city, derived.province, derived.country].filter(Boolean).join(', ');
        const postcodeText = derived.postcode ? String(derived.postcode) : '';
        const isVerified = Boolean(loc.verified || loc.isVerified);
        const verifiedOn = formatDate(loc.verifiedDate);
        const createdOn = formatDate(loc.createdAt);
        const updatedOn = formatDate(loc.updatedAt);
        const distanceText = Number.isFinite(Number(loc.distance)) ? `${Number(loc.distance).toFixed(1)} km away` : '';
        const typeLabel = formatTypeLabel(loc.type);
        const herbCount = inventory.length;
        const descriptionText = String(loc.description || '').trim() || 'No description has been added for this location yet.';

        return (
            <View style={styles.detailsContainer}>
                <TouchableOpacity onPress={() => onLocationSelect(null)} style={styles.backButton}>
                    <Ionicons name="close-circle" size={28} color="#4B5563" />
                </TouchableOpacity>

                <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.heroCard}>
                        {primaryImage?.url && (
                            <Image
                                source={{ uri: primaryImage.url }}
                                style={styles.heroImage}
                                resizeMode="cover"
                            />
                        )}
                        <View style={styles.heroBody}>
                            <View style={styles.detailHero}>
                                <View style={[styles.largeIcon, { backgroundColor: getTypeColor(loc.type) + '15' }]}>
                                    <Ionicons name={getTypeIcon(loc.type)} size={30} color={getTypeColor(loc.type)} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.detailTitleRow}>
                                        <Text style={styles.detailTitle}>{loc.name}</Text>
                                        {isVerified && (
                                            <View style={styles.heroVerifiedPill}>
                                                <Ionicons name="checkmark-circle" size={12} color="#D97706" />
                                                <Text style={styles.heroVerifiedText}>Verified</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.heroAddress}>{formatLocationAddress(loc, 'Resolving address...')}</Text>
                                </View>
                            </View>

                            <View style={styles.heroChipRow}>
                                <View style={[styles.heroChip, { backgroundColor: getTypeColor(loc.type) + '12' }]}>
                                    <Text style={[styles.heroChipText, { color: getTypeColor(loc.type) }]}>{typeLabel}</Text>
                                </View>
                                <View style={styles.heroChip}>
                                    <Ionicons name="layers-outline" size={13} color="#10B981" />
                                    <Text style={styles.heroChipTextNeutral}>{herbCount} herbs</Text>
                                </View>
                                {distanceText ? (
                                    <View style={styles.heroChip}>
                                        <Ionicons name="navigate-outline" size={13} color="#3B82F6" />
                                        <Text style={styles.heroChipTextNeutral}>{distanceText}</Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    </View>

                    <View style={styles.actionBar}>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleGetDirections}>
                            <View style={[styles.actionIcon, { backgroundColor: '#3B82F615' }]}>
                                <Ionicons name="navigate" size={20} color="#3B82F6" />
                            </View>
                            <Text style={styles.actionText}>Directions</Text>
                        </TouchableOpacity>

                        {loc.phone && (
                            <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
                                <View style={[styles.actionIcon, { backgroundColor: '#10B98115' }]}>
                                    <Ionicons name="call" size={20} color="#10B981" />
                                </View>
                                <Text style={styles.actionText}>Call</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                            <View style={[styles.actionIcon, { backgroundColor: '#6366F115' }]}>
                                <Ionicons name="share-social" size={20} color="#6366F1" />
                            </View>
                            <Text style={styles.actionText}>Share</Text>
                        </TouchableOpacity>

                        {loc.website && (
                            <TouchableOpacity style={styles.actionBtn} onPress={handleOpenWebsite}>
                                <View style={[styles.actionIcon, { backgroundColor: '#F59E0B15' }]}>
                                    <Ionicons name="globe-outline" size={20} color="#F59E0B" />
                                </View>
                                <Text style={styles.actionText}>Website</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>About</Text>
                        <Text style={styles.sectionBodyText}>{descriptionText}</Text>
                    </View>

                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Location Info</Text>
                        <View style={styles.infoSection}>
                            <View style={styles.infoRow}>
                                <Ionicons name="location-outline" size={18} color="#6B7280" />
                                <Text style={styles.infoRowText}>{formatLocationAddress(loc, 'Resolving address...')}</Text>
                            </View>
                            {areaText ? (
                                <View style={styles.infoRow}>
                                    <Ionicons name="map-outline" size={18} color="#6B7280" />
                                    <Text style={styles.infoRowText}>{areaText}</Text>
                                </View>
                            ) : null}
                            {postcodeText ? (
                                <View style={styles.infoRow}>
                                    <Ionicons name="mail-outline" size={18} color="#6B7280" />
                                    <Text style={styles.infoRowText}>Postal code: {postcodeText}</Text>
                                </View>
                            ) : null}
                            {coordinateText ? (
                                <View style={styles.infoRow}>
                                    <Ionicons name="locate-outline" size={18} color="#6B7280" />
                                    <Text style={styles.infoRowText}>Coordinates: {coordinateText}</Text>
                                </View>
                            ) : null}
                            {loc.hours ? (
                                <View style={styles.infoRow}>
                                    <Ionicons name="time-outline" size={18} color="#6B7280" />
                                    <Text style={styles.infoRowText}>{formatHours(loc.hours)}</Text>
                                </View>
                            ) : null}
                            {loc.phone ? (
                                <View style={styles.infoRow}>
                                    <Ionicons name="call-outline" size={18} color="#6B7280" />
                                    <Text style={styles.infoRowText}>{loc.phone}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.inventoryHeader}>
                        <Text style={styles.sectionTitle}>Plant Registry</Text>
                        <Text style={styles.sectionSubtitle}>{herbCount} varieties identified</Text>
                    </View>

                    {inventory.length > 0 ? (
                        inventory.map((item, index) => {
                            if (!item) return null;
                            const actualHerb = item.herbId || item;
                            const herbName = actualHerb.name || 'Unknown Herb';
                            const updatedText = formatDate(item.lastUpdated);

                            return (
                                <TouchableOpacity
                                    key={`${actualHerb?._id || actualHerb?.id || herbName}-${index}`}
                                    style={styles.inventoryCard}
                                    onPress={() => handleHerbPress(item)}
                                >
                                    <View style={styles.invImageContainer}>
                                        <Ionicons name="leaf" size={24} color="#10B981" />
                                    </View>
                                    <View style={styles.invCardInfo}>
                                        <Text style={styles.invCardName}>{herbName}</Text>
                                        {actualHerb.scientificName && (
                                            <Text style={styles.invCardScientific}>{actualHerb.scientificName}</Text>
                                        )}
                                        {item.notes ? (
                                            <Text style={styles.invCardNotes} numberOfLines={1}>{item.notes}</Text>
                                        ) : null}
                                        {updatedText ? (
                                            <Text style={styles.invCardMeta}>Updated {updatedText}</Text>
                                        ) : null}
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                                </TouchableOpacity>
                            );
                        })
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={48} color="#E5E7EB" />
                            <Text style={styles.emptyText}>No plants recorded at this location yet.</Text>
                        </View>
                    )}

                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Record Details</Text>
                        <View style={styles.infoSection}>
                            {isVerified ? (
                                <View style={styles.infoRow}>
                                    <Ionicons name="shield-checkmark-outline" size={18} color="#6B7280" />
                                    <Text style={styles.infoRowText}>
                                        Verified{verifiedOn ? ` on ${verifiedOn}` : ''}
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.infoRow}>
                                    <Ionicons name="shield-outline" size={18} color="#6B7280" />
                                    <Text style={styles.infoRowText}>Unverified listing</Text>
                                </View>
                            )}
                            {createdOn ? (
                                <View style={styles.infoRow}>
                                    <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                                    <Text style={styles.infoRowText}>Added {createdOn}</Text>
                                </View>
                            ) : null}
                            {updatedOn ? (
                                <View style={styles.infoRow}>
                                    <Ionicons name="refresh-outline" size={18} color="#6B7280" />
                                    <Text style={styles.infoRowText}>Last updated {updatedOn}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    };

    // --- SKELETON LOADER ---
    const renderSkeleton = () => (
        <View style={styles.listContent}>
            {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.card}>
                    <View style={[styles.iconContainer, { backgroundColor: '#F3F4F6' }]} />
                    <View style={styles.cardContent}>
                        <View style={{ width: '60%', height: 16, backgroundColor: '#F3F4F6', borderRadius: 4, marginBottom: 8 }} />
                        <View style={{ width: '40%', height: 14, backgroundColor: '#F3F4F6', borderRadius: 4, marginBottom: 8 }} />
                        <View style={{ flexDirection: 'row' }}>
                            <View style={{ width: 60, height: 20, backgroundColor: '#F3F4F6', borderRadius: 4, marginRight: 8 }} />
                            <View style={{ width: 80, height: 20, backgroundColor: '#F3F4F6', borderRadius: 4 }} />
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );

    return (
        <Animated.View style={[styles.bottomSheetContainer, rBottomSheetStyle]}>
            <GestureDetector gesture={panGesture}>
                <View>
                    {renderHeader()}
                </View>
            </GestureDetector>
            {isGeocoding && !locations.length ? renderSkeleton() : (
                showDetails ? renderDetails() : (
                    <FlatList
                        data={safeLocations}
                        keyExtractor={(item, index) => (item._id || item.id || index).toString()}
                        renderItem={renderLocationItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>
                                    {isGeocoding ? 'Finding herbs nearby...' : 'No locations found in this area.'}
                                </Text>
                            </View>
                        }
                    />
                )
            )}
        </Animated.View>
    );
};

const getTypeIcon = (type) => {
    const t = String(type || '').toLowerCase();
    switch (t) {
        case 'market': return 'storefront-outline';
        case 'shop':
        case 'store': return 'bag-handle-outline';
        case 'clinic':
        case 'pharmacy': return 'medkit-outline';
        case 'wild':
        case 'foraging': return 'leaf-outline';
        case 'garden': return 'flower-outline';
        case 'farm': return 'nutrition-outline';
        case 'park': return 'map-outline';
        case 'suggested': return 'pin-outline';
        default: return 'location-outline';
    }
};

const getTypeColor = (type) => {
    const t = String(type || '').toLowerCase();
    switch (t) {
        case 'market': return '#10B981';
        case 'store':
        case 'shop': return '#3B82F6';
        case 'clinic':
        case 'pharmacy': return '#EF4444';
        case 'wild':
        case 'foraging': return '#8B5CF6';
        case 'garden': return '#10B981';
        case 'suggested': return '#F59E0B';
        default: return '#6B7280';
    }
};

const styles = StyleSheet.create({
    bottomSheetContainer: {
        height: SCREEN_HEIGHT,
        width: '100%',
        backgroundColor: '#F4FBF7',
        position: 'absolute',
        top: SCREEN_HEIGHT,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        borderWidth: 1,
        borderColor: '#B7E4CD',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 18,
        zIndex: 100,
    },
    line: {
        width: 44,
        height: 5,
        backgroundColor: '#6EE7B7',
        alignSelf: 'center',
        marginTop: 8,
        marginBottom: 8,
        borderRadius: 3,
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        backgroundColor: '#064E3B',
        borderBottomWidth: 1,
        borderBottomColor: '#065F46',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    headerInfo: {
        marginTop: 8,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#ECFDF5',
        lineHeight: 32,
        letterSpacing: 0.2,
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#A7F3D0',
        marginTop: 8,
        lineHeight: 16,
    },
    listContent: {
        paddingBottom: 210,
        paddingHorizontal: 16,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#D7E8DE',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    selectedCard: {
        backgroundColor: '#F0FDF4',
        borderColor: '#10B981',
        shadowOpacity: 0.08,
        elevation: 2,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        flexShrink: 1,
        lineHeight: 24,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    promotedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    verifiedText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#D97706',
        marginLeft: 2,
        textTransform: 'uppercase',
    },
    promotedText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#2563EB',
        textTransform: 'uppercase',
    },
    cardAddress: {
        fontSize: 12,
        color: '#475569',
        marginTop: 8,
        lineHeight: 16,
    },
    cardTagline: {
        fontSize: 12,
        color: '#065F46',
        marginTop: 8,
        lineHeight: 16,
    },
    cardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginRight: 8,
    },
    typeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    herbCount: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },
    distancePill: {
        fontSize: 12,
        fontWeight: '700',
        color: '#065F46',
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#86EFAC',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    // DETAILS STYLES
    detailsContainer: {
        flex: 1,
    },
    detailScroll: {
        flex: 1,
    },
    detailScrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 128,
    },
    backButton: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        alignSelf: 'flex-end',
    },
    heroCard: {
        borderWidth: 1,
        borderColor: '#C8DED2',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        marginBottom: 16,
    },
    heroImage: {
        width: '100%',
        height: 160,
        backgroundColor: '#F3F4F6',
    },
    heroBody: {
        padding: 16,
    },
    detailHero: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    largeIcon: {
        width: 54,
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    detailTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        flexShrink: 1,
        lineHeight: 32,
    },
    detailTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    heroVerifiedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 8,
    },
    heroVerifiedText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#D97706',
        marginLeft: 4,
        textTransform: 'uppercase',
    },
    heroAddress: {
        fontSize: 12,
        color: '#475569',
        marginTop: 8,
        lineHeight: 16,
    },
    heroChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    heroChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E6F4EC',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    heroChipText: {
        fontSize: 12,
        fontWeight: '700',
    },
    heroChipTextNeutral: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1E293B',
        marginLeft: 8,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#D7E8DE',
        marginBottom: 16,
    },
    actionBtn: {
        alignItems: 'center',
        flex: 1,
    },
    actionIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#14532D',
    },
    sectionCard: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D7E8DE',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    sectionBodyText: {
        fontSize: 12,
        color: '#334155',
        lineHeight: 16,
        marginTop: 8,
    },
    infoSection: {
        gap: 8,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoRowText: {
        fontSize: 12,
        color: '#334155',
        lineHeight: 16,
        flex: 1,
    },
    inventoryHeader: {
        marginTop: 8,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#14532D',
        lineHeight: 24,
        letterSpacing: 0.2,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 8,
        lineHeight: 16,
    },
    inventoryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#D7E8DE',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    invImageContainer: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: '#E6F4EC',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    invCardInfo: {
        flex: 1,
    },
    invCardName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        lineHeight: 24,
    },
    invCardScientific: {
        fontSize: 12,
        color: '#047857',
        fontStyle: 'italic',
        marginTop: 8,
    },
    invCardNotes: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 8,
        lineHeight: 16,
    },
    invCardMeta: {
        fontSize: 12,
        color: '#475569',
        marginTop: 8,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    emptyText: {
        textAlign: 'center',
        color: '#64748B',
        fontSize: 12,
        fontStyle: 'italic',
        maxWidth: '80%',
        lineHeight: 16,
    }
});

export default LocationBottomSheet;