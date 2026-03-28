import React, { useEffect, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BannerNotification = {
    id: string;
    title: string;
    message: string;
    type?: 'blog' | 'update' | 'announcement' | 'other';
};

interface NotificationBannerProps {
    notification: BannerNotification | null;
    onDismiss: () => void;
}



const AUTO_DISMISS_MS = 4500;

export default function NotificationBanner({ notification, onDismiss }: NotificationBannerProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(-120)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const dismiss = () => {
        if (dismissTimer.current) {
            clearTimeout(dismissTimer.current);
            dismissTimer.current = null;
        }
        Animated.parallel([
            Animated.timing(translateY, { toValue: -120, duration: 280, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
        ]).start(() => onDismiss());
    };

    useEffect(() => {
        if (!notification) return;

        // Slide in
        Animated.parallel([
            Animated.spring(translateY, { toValue: 0, tension: 80, friction: 11, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();

        // Auto-dismiss
        dismissTimer.current = setTimeout(dismiss, AUTO_DISMISS_MS);

        return () => {
            if (dismissTimer.current) clearTimeout(dismissTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [notification?.id]);

    if (!notification) return null;

    if (!notification) return null;

    const handlePress = () => {
        dismiss();
        router.push('/notifications');
    };

    return (
        <Animated.View
            style={[
                styles.container,
                { top: insets.top + 8, transform: [{ translateY }], opacity },
            ]}
            pointerEvents="box-none"
        >
            <TouchableOpacity style={styles.banner} activeOpacity={0.92} onPress={handlePress}>
                <Image
                    source={require('../../assets/logo.jpg')}
                    style={styles.iconWrap}
                />
                <View style={styles.textWrap}>
                    <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
                    <Text style={styles.message} numberOfLines={2}>{notification.message}</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={16} color="#6B7280" />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 12,
        right: 12,
        zIndex: 9999,
        elevation: 20,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        flexShrink: 0,
    },
    textWrap: {
        flex: 1,
    },
    title: {
        fontSize: 13,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 2,
    },
    message: {
        fontSize: 12,
        color: '#374151',
        lineHeight: 16,
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
});

export type { BannerNotification };
