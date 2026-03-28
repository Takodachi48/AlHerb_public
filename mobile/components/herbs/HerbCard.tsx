import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { styles } from '../../styles/HerbsScreen.styles';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import hapticUtils from '../../utils/haptics';

export interface HerbImage {
    url: string;
    isPrimary?: boolean;
}

export interface HerbItem {
    id?: string;
    _id?: string;
    slug?: string;
    name: string;
    scientificName?: string;
    description?: string;
    images?: HerbImage[];
    isFeatured?: boolean;
    properties?: string[];
}

export interface HerbCardProps {
    item: HerbItem;
    index?: number;
}

export const HerbCard: React.FC<HerbCardProps> = ({ item, index = 0 }) => {
    const router = useRouter();

    // Find primary image or use first available, else fallback
    const herbImage = item.images?.find(img => img.isPrimary)?.url ||
        item.images?.[0]?.url ||
        'https://images.unsplash.com/photo-1540660290370-8aa90e95166a?auto=format&fit=crop&q=80&w=200';

    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        hapticUtils.light();
        scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
    };

    return (
        <Animated.View entering={FadeInDown.delay(index * 100).duration(500)} style={animatedStyle}>
            <TouchableOpacity
                style={styles.herbCard}
                onPress={() => router.push(`/herbs/${item.slug || item._id || item.id}`)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.9}
            >
                <Image
                    source={{ uri: herbImage }}
                    style={styles.herbImage}
                    resizeMode="cover"
                />

                <View style={styles.herbInfo}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.herbName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.scientificName} numberOfLines={1}>{item.scientificName}</Text>
                        </View>
                        {item.isFeatured && (
                            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 }}>
                                <Text style={{ color: '#D97706', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>★ FEATURED</Text>
                            </View>
                        )}
                    </View>

                    <Text style={styles.description} numberOfLines={2}>
                        {item.description}
                    </Text>

                    <View style={styles.benefitsContainer}>
                        {item.properties?.slice(0, 2).map((benefit, index) => (
                            <Text key={index} style={styles.benefitTag}>
                                {benefit}
                            </Text>
                        ))}
                        {item.properties?.length > 2 && (
                            <Text style={[styles.benefitTag, { backgroundColor: '#F3F4F6', color: '#6B7280' }]}>
                                +{item.properties.length - 2} more
                            </Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};
