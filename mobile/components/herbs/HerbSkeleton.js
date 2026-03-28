import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    withSequence
} from 'react-native-reanimated';
import { styles } from '../../styles/HerbsScreen.styles';

export const HerbSkeleton = () => {
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.7, { duration: 800 }),
                withTiming(0.3, { duration: 800 })
            ),
            -1,
            true
        );
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <View style={styles.skeletonCard}>
            <Animated.View style={[styles.skeletonImage, animatedStyle]} />
            <View style={styles.skeletonContent}>
                <Animated.View style={[styles.skeletonTitle, animatedStyle]} />
                <Animated.View style={[styles.skeletonSubtitle, animatedStyle]} />
                <Animated.View style={[styles.skeletonLine, animatedStyle]} />
                <Animated.View style={[styles.skeletonLine, animatedStyle]} />
                <Animated.View style={[styles.skeletonLastLine, animatedStyle]} />
            </View>
        </View>
    );
};
