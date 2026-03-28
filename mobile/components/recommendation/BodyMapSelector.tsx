import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ViewStyle, TextStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Typography } from '../../styles/DesignSystem';

const { width } = Dimensions.get('window');
const MAP_WIDTH = width * 0.8;
const MAP_HEIGHT = MAP_WIDTH * 1.5;

interface BodyRegion {
    id: string;
    label: string;
    sub: string;
    icon: any;
    categories: string[];
    top: any;
    left: any;
    width: any;
    height: any;
}

const BODY_REGIONS: BodyRegion[] = [
    {
        id: 'head',
        label: 'Head',
        sub: 'Mental, Nervous, Sinus',
        icon: 'head',
        categories: ['mental', 'nervous', 'respiratory'],
        top: '5%',
        left: '35%',
        width: '30%',
        height: '15%',
    },
    {
        id: 'chest',
        label: 'Chest',
        sub: 'Lungs & Heart',
        icon: 'lungs',
        categories: ['respiratory', 'cardiovascular'],
        top: '22%',
        left: '25%',
        width: '50%',
        height: '18%',
    },
    {
        id: 'stomach',
        label: 'Abdomen',
        sub: 'Digestive & Endocrine',
        icon: 'stomach',
        categories: ['digestive', 'endocrine'],
        top: '42%',
        left: '28%',
        width: '44%',
        height: '15%',
    },
    {
        id: 'pelvis',
        label: 'Pelvis',
        sub: 'Reproductive & Back',
        icon: 'flower',
        categories: ['reproductive', 'musculoskeletal'],
        top: '59%',
        left: '28%',
        width: '44%',
        height: '12%',
    },
    {
        id: 'extremities',
        label: 'Limbs',
        sub: 'Muscles & Joint Pain',
        icon: 'human-handsup',
        categories: ['musculoskeletal'],
        top: '30%',
        left: '5%',
        width: '20%',
        height: '60%',
    },
    {
        id: 'extremities_right',
        label: 'Limbs',
        sub: 'Muscles & Joint Pain',
        icon: 'human-handsup',
        categories: ['musculoskeletal'],
        top: '30%',
        left: '75%',
        width: '20%',
        height: '60%',
    },
    {
        id: 'skin',
        label: 'Skin',
        sub: 'Rash, Irritation',
        icon: 'opacity',
        categories: ['skin'],
        top: '75%',
        left: '35%',
        width: '30%',
        height: '15%',
    },
];

export default function BodyMapSelector({
    onSelectCategory,
    selectedCategories = []
}: {
    onSelectCategory: (cat: string) => void,
    selectedCategories?: string[]
}) {
    const isSelected = (categories: string[]) => {
        return categories.some(cat => selectedCategories.includes(cat));
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Tap an area to focus</Text>
            <View style={styles.mapWrapper}>
                {/* Stylized Human Outline Background */}
                <View style={styles.bodyOutline}>
                    <View style={styles.outlineHead} />
                    <View style={styles.outlineTorso} />
                    <View style={styles.outlineArmLeft} />
                    <View style={styles.outlineArmRight} />
                    <View style={styles.outlineLegLeft} />
                    <View style={styles.outlineLegRight} />
                </View>

                {/* Interactive Overlay Zones */}
                {BODY_REGIONS.map((region) => {
                    const active = isSelected(region.categories);
                    return (
                        <TouchableOpacity
                            key={region.id}
                            activeOpacity={0.6}
                            onPress={() => onSelectCategory(region.categories[0])}
                            style={[
                                styles.regionZone as ViewStyle,
                                {
                                    top: region.top,
                                    left: region.left,
                                    width: region.width,
                                    height: region.height,
                                    backgroundColor: active ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                    borderColor: active ? Colors.primaryGreen : 'transparent',
                                    borderWidth: active ? 2 : 0,
                                    borderRadius: Radius.md,
                                },
                            ]}
                        >
                            <View style={[styles.regionPill, active && styles.regionPillActive]}>
                                <MaterialCommunityIcons
                                    name={region.icon}
                                    size={16}
                                    color={active ? Colors.white : Colors.primaryGreen}
                                />
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.legend}>
                <Text style={styles.legendText}>Selecting an area will filter the symptoms below.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: 20,
        backgroundColor: Colors.white,
        padding: 20,
        borderRadius: Radius.lg,
        ...Shadows.neumorphic,
    },
    title: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 15,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    } as TextStyle,
    mapWrapper: {
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        position: 'relative',
        alignSelf: 'center',
    } as ViewStyle,
    bodyOutline: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        opacity: 0.1,
    },
    outlineHead: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.black,
    },
    outlineTorso: {
        width: 100,
        height: 180,
        backgroundColor: Colors.black,
        marginTop: 10,
        borderRadius: 20,
    },
    outlineArmLeft: {
        position: 'absolute',
        left: '5%',
        top: 80,
        width: 30,
        height: 150,
        backgroundColor: Colors.black,
        borderRadius: 15,
        transform: [{ rotate: '15deg' }],
    },
    outlineArmRight: {
        position: 'absolute',
        right: '5%',
        top: 80,
        width: 30,
        height: 150,
        backgroundColor: Colors.black,
        borderRadius: 15,
        transform: [{ rotate: '-15deg' }],
    },
    outlineLegLeft: {
        position: 'absolute',
        left: '25%',
        bottom: 20,
        width: 35,
        height: 180,
        backgroundColor: Colors.black,
        borderRadius: 15,
    },
    outlineLegRight: {
        position: 'absolute',
        right: '25%',
        bottom: 20,
        width: 35,
        height: 180,
        backgroundColor: Colors.black,
        borderRadius: 15,
    },
    regionZone: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    regionPill: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.softWhite,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadows.neumorphic,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.1)',
    },
    regionPillActive: {
        backgroundColor: Colors.primaryGreen,
        borderColor: Colors.primaryGreen,
    },
    legend: {
        marginTop: 20,
        paddingHorizontal: 20,
    },
    legendText: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        color: Colors.textLight,
    } as TextStyle
});
