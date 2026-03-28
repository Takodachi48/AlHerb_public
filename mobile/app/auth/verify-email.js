import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    StatusBar,
    StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth } from '../../services/firebase';
import { sendEmailVerification } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../hooks/useAuth';

export default function VerifyEmailScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { setAuthenticated } = useAuth();
    const [checking, setChecking] = useState(false);
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const intervalRef = useRef(null);

    const userEmail = auth.currentUser?.email || '';

    const handleVerified = useCallback(async () => {
        try {
            // Get a fresh token now that email is verified
            const token = await auth.currentUser.getIdToken(true);
            await AsyncStorage.setItem('authToken', token);

            const userData = {
                id: auth.currentUser.uid,
                email: auth.currentUser.email,
                displayName: auth.currentUser.displayName,
                role: 'user',
            };
            await AsyncStorage.setItem('userData', JSON.stringify(userData));

            // Update AuthContext — this triggers AuthNavigator to redirect to main app
            setAuthenticated(userData);

            Alert.alert('Verified!', 'Your email has been verified. Welcome!');
        } catch (_e) {
            console.error('Error after verification:', _e);
            Alert.alert('Error', 'Something went wrong. Please try logging in.');
            router.replace('/auth/login');
        }
    }, [router, setAuthenticated]);

    // Poll Firebase every 5 seconds to check if email has been verified
    useEffect(() => {
        intervalRef.current = setInterval(async () => {
            if (auth.currentUser) {
                try {
                    await auth.currentUser.reload();
                    if (auth.currentUser.emailVerified) {
                        clearInterval(intervalRef.current);
                        handleVerified();
                    }
                } catch (_e) {
                    // Silently retry
                }
            }
        }, 5000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [handleVerified]);

    // Countdown timer for resend button
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleCheckNow = async () => {
        setChecking(true);
        try {
            if (auth.currentUser) {
                await auth.currentUser.reload();
                if (auth.currentUser.emailVerified) {
                    await handleVerified();
                } else {
                    Alert.alert(
                        'Not Yet Verified',
                        'Your email hasn\'t been verified yet. Please check your inbox and click the verification link.'
                    );
                }
            }
        } catch (_e) {
            Alert.alert('Error', 'Could not check verification status. Please try again.');
        } finally {
            setChecking(false);
        }
    };

    const handleResend = async () => {
        if (countdown > 0) return;
        setResending(true);
        try {
            if (auth.currentUser) {
                await sendEmailVerification(auth.currentUser);
                setCountdown(60);
                Alert.alert('Email Sent', 'A new verification email has been sent to your inbox.');
            }
        } catch (_e) {
            if (_e.code === 'auth/too-many-requests') {
                Alert.alert('Too Many Requests', 'Please wait before requesting another verification email.');
            } else {
                Alert.alert('Error', 'Could not send verification email. Please try again later.');
            }
        } finally {
            setResending(false);
        }
    };

    const handleBackToLogin = async () => {
        // Sign out and go back to login
        try {
            await auth.signOut();
            await AsyncStorage.multiRemove(['authToken', 'userData', 'refreshToken']);
        } catch (_e) { }
        router.replace('/auth/login');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAF9" />

            <View style={styles.content}>
                {/* Mail Icon */}
                <View style={styles.iconCircle}>
                    <MaterialCommunityIcons name="email-check-outline" size={56} color="#10B981" />
                </View>

                {/* Title */}
                <Text style={styles.title}>Verify Your Email</Text>
                <Text style={styles.subtitle}>
                    We've sent a verification link to
                </Text>
                <Text style={styles.email}>{userEmail}</Text>
                <Text style={styles.description}>
                    Please check your inbox and click the verification link. Once verified, you'll be automatically logged in.
                </Text>

                {/* Check Now Button */}
                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleCheckNow}
                    disabled={checking}
                    activeOpacity={0.8}
                >
                    {checking ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <>
                            <MaterialCommunityIcons name="check-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={styles.primaryButtonText}>I've Verified My Email</Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* Resend Button */}
                <TouchableOpacity
                    style={[styles.secondaryButton, countdown > 0 && styles.disabledButton]}
                    onPress={handleResend}
                    disabled={resending || countdown > 0}
                    activeOpacity={0.7}
                >
                    {resending ? (
                        <ActivityIndicator color="#10B981" size="small" />
                    ) : (
                        <>
                            <MaterialCommunityIcons name="email-sync-outline" size={18} color={countdown > 0 ? '#94A3B8' : '#10B981'} style={{ marginRight: 8 }} />
                            <Text style={[styles.secondaryButtonText, countdown > 0 && styles.disabledText]}>
                                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Verification Email'}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* Auto-check indicator */}
                <View style={styles.autoCheckRow}>
                    <ActivityIndicator size="small" color="#10B981" />
                    <Text style={styles.autoCheckText}>Automatically checking for verification...</Text>
                </View>
            </View>

            {/* Back to Login */}
            <TouchableOpacity
                style={[styles.backButton, { marginBottom: insets.bottom + 24 }]}
                onPress={handleBackToLogin}
            >
                <MaterialCommunityIcons name="arrow-left" size={18} color="#64748B" />
                <Text style={styles.backButtonText}>Back to Login</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAF9',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
    },
    email: {
        fontSize: 15,
        fontWeight: '600',
        color: '#10B981',
        marginTop: 4,
        marginBottom: 12,
    },
    description: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32,
        paddingHorizontal: 16,
    },
    primaryButton: {
        flexDirection: 'row',
        backgroundColor: '#10B981',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 12,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        flexDirection: 'row',
        backgroundColor: '#ECFDF5',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 24,
    },
    secondaryButtonText: {
        color: '#10B981',
        fontSize: 14,
        fontWeight: '600',
    },
    disabledButton: {
        backgroundColor: '#F1F5F9',
    },
    disabledText: {
        color: '#94A3B8',
    },
    autoCheckRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    autoCheckText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
    },
    backButtonText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
});
