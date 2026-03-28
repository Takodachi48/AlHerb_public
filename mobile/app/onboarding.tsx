import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    Dimensions,
    TouchableOpacity,
    FlatList,
    Animated,
    Image,
    Platform,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import hapticUtils from '../utils/haptics';

const { width, height } = Dimensions.get('window');
const isCompactHeight = height < 700;
const imageHeight = Math.min(
    height * (isCompactHeight ? 0.32 : 0.42),
    isCompactHeight ? 260 : 340
);

const slides = [
    {
        id: '1',
        title: 'Discover Nature\'s Secrets',
        description: 'Explore a vast library of herbal remedies and learn about their traditional uses in the Philippines.',
        image: require('../assets/onboarding_discover.png'),
    },
    {
        id: '2',
        title: 'Identify with AI',
        description: 'Use our advanced AI scanner to instantly identify plants and get detailed health insights.',
        image: require('../assets/onboarding_scan.png'),
    },
    {
        id: '3',
        title: 'Safe & Informed',
        description: 'Check for drug interactions and safety warnings to ensure your herbal journey is safe.',
        image: require('../assets/onboarding_safety.png'),
    },
    {
        id: '4',
        title: 'Join the Community',
        description: 'Share your experiences, read articles, and connect with other herbal enthusiasts.',
        image: require('../assets/onboarding_community.png'),
    },
];

interface SlideItemProps {
    item: typeof slides[0];
}

const Slide: React.FC<SlideItemProps> = ({ item }) => {
    return (
        <View style={{ width, flex: 1, paddingHorizontal: 24, paddingBottom: isCompactHeight ? 12 : 24 }} className="items-center pt-0">
            <View
                style={{ height: imageHeight, marginBottom: isCompactHeight ? 16 : 32 }}
                className="w-full rounded-3xl overflow-hidden items-center justify-center"
            >
                <Image
                    source={item.image}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                />
            </View>
            <View className="items-center px-4 w-full">
                <Text className="text-[28px] font-extrabold text-slate-900 text-center mb-4 leading-tight tracking-tight">
                    {item.title}
                </Text>
                <Text className="text-[16px] text-slate-600 text-center leading-[24px]">
                    {item.description}
                </Text>
            </View>
        </View>
    );
};

export default function OnboardingScreen() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const slidesRef = useRef<FlatList>(null);
    const router = useRouter();
    const { setOnboardingSeen, user } = useAuth();
    const insets = useSafeAreaInsets();

    // Calculate top padding to handle translucent status bar on Android and Safe Area on iOS
    const paddingTop = Platform.OS === 'android'
        ? (insets.top > 0 ? insets.top : (StatusBar.currentHeight || 0)) + 16
        : Math.max(insets.top, 20);

    const paddingBottom = Math.max(insets.bottom, 20);

    const viewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems && viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const scrollToNext = () => {
        if (currentIndex < slides.length - 1) {
            slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
            hapticUtils.medium();
        } else {
            handleFinish();
        }
    };

    const handleFinish = async () => {
        hapticUtils.success();
        await setOnboardingSeen(true);

        if (user) {
            router.replace('/(tabs)');
        } else {
            router.replace('/auth/choice');
        }
    };

    return (
        <View className="flex-1 bg-white" style={{ paddingTop, paddingBottom }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            {/* Top Header */}
            <View className="flex-row justify-between items-center px-6 pb-6">
                <View className="flex-row items-center">
                    <Image source={require('../assets/logo.jpg')} className="w-8 h-8 rounded-lg border border-slate-200 mr-2" />
                    <Text className="text-sm font-bold text-slate-500 tracking-wider">HERBALENS</Text>
                </View>
                <TouchableOpacity onPress={handleFinish} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text className="text-[15px] font-medium text-slate-400">Skip</Text>
                </TouchableOpacity>
            </View>

            {/* Slider content */}
            <View className="flex-[3]">
                <FlatList
                    data={slides}
                    renderItem={({ item }) => <Slide item={item} />}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    pagingEnabled
                    bounces={false}
                    keyExtractor={(item) => item.id}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                        useNativeDriver: false,
                    })}
                    scrollEventThrottle={32}
                    onViewableItemsChanged={viewableItemsChanged}
                    viewabilityConfig={viewConfig}
                    ref={slidesRef}
                />
            </View>

            {/* Footer controls */}
            <View className="px-6" style={{ paddingBottom: isCompactHeight ? 20 : 48 }}>
                <View className="flex-row justify-center items-center mb-8">
                    {slides.map((_, i) => {
                        const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                        const dotWidth = scrollX.interpolate({
                            inputRange,
                            outputRange: [8, 24, 8],
                            extrapolate: 'clamp',
                        });
                        const opacity = scrollX.interpolate({
                            inputRange,
                            outputRange: [0.3, 1, 0.3],
                            extrapolate: 'clamp',
                        });
                        const backgroundColor = scrollX.interpolate({
                            inputRange,
                            outputRange: ['#E5E7EB', '#10B981', '#E5E7EB'],
                            extrapolate: 'clamp',
                        });
                        return (
                            <Animated.View
                                key={i}
                                style={{ width: dotWidth, opacity, backgroundColor }}
                                className="h-2 rounded-full mx-1.5"
                            />
                        );
                    })}
                </View>

                <TouchableOpacity
                    onPress={scrollToNext}
                    activeOpacity={0.85}
                    className="w-full h-[56px] rounded-2xl bg-[#10B981] justify-center items-center shadow-sm"
                >
                    <Text className="text-white text-[17px] font-bold">
                        {currentIndex === slides.length - 1 ? 'Get Started' : 'Continue'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
