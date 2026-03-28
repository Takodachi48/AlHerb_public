import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    StyleSheet,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../services/apiClient';

export default function PrivacySecurityScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, logout } = useAuth();

    // Password state
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    // Password validation
    const getPasswordStrength = (pw) => {
        if (!pw) return { label: '', color: '#D1D5DB', width: 0 };
        let score = 0;
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;

        if (score <= 1) return { label: 'Weak', color: '#EF4444', width: 25 };
        if (score === 2) return { label: 'Fair', color: '#F59E0B', width: 50 };
        if (score === 3) return { label: 'Good', color: '#3B82F6', width: 75 };
        return { label: 'Strong', color: '#10B981', width: 100 };
    };

    const strength = getPasswordStrength(newPassword);

    const handleChangePassword = async () => {
        if (!newPassword) {
            Alert.alert('Error', 'Please enter a new password');
            return;
        }
        if (newPassword.length < 8) {
            Alert.alert('Error', 'Password must be at least 8 characters');
            return;
        }
        // Basic complexity check
        const hasUpper = /[A-Z]/.test(newPassword);
        const hasLower = /[a-z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);
        const hasSpecial = /[@$!%*?&]/.test(newPassword);
        
        if (!(hasUpper && hasLower && hasNumber && hasSpecial)) {
            Alert.alert('Error', 'Password must contain uppercase, lowercase, number, and special character');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        try {
            setChangingPassword(true);
            await apiClient.post('/auth/change-password', { newPassword });
            Alert.alert('Success', 'Your password has been changed successfully.', [
                {
                    text: 'OK', onPress: () => {
                        setNewPassword('');
                        setConfirmPassword('');
                    }
                }
            ]);
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to change password';
            Alert.alert('Error', msg);
        } finally {
            setChangingPassword(false);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            '⚠️ Delete Account',
            'This action is permanent and cannot be undone. All your data, favorites, and history will be deleted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            'Are you absolutely sure?',
                            'Type DELETE to confirm account deletion.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Confirm Delete',
                                    style: 'destructive',
                                    onPress: async () => {
                                        try {
                                            await apiClient.delete('/users/account');
                                            await logout();
                                        } catch (_err) {
                                            Alert.alert('Error', 'Failed to delete account. Please try again.');
                                        }
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    };

    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Privacy & Security</Text>
                <View style={{ width: 38 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={s.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Email Info */}
                    <View style={s.infoCard}>
                        <View style={s.infoIcon}>
                            <Ionicons name="mail-outline" size={20} color="#3B82F6" />
                        </View>
                        <View style={s.infoContent}>
                            <Text style={s.infoLabel}>Email Address</Text>
                            <Text style={s.infoValue}>{user?.email}</Text>
                        </View>
                        <View style={s.verifiedTag}>
                            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                            <Text style={s.verifiedText}>Verified</Text>
                        </View>
                    </View>

                    {/* Change Password */}
                    <View style={s.section}>
                        <View style={s.sectionHeaderRow}>
                            <Ionicons name="lock-closed-outline" size={18} color="#111827" />
                            <Text style={s.sectionTitle}>Change Password</Text>
                        </View>

                        <View style={s.formCard}>
                            {/* New Password */}
                            <View style={s.inputGroup}>
                                <Text style={s.inputLabel}>New Password</Text>
                                <View style={s.inputRow}>
                                    <TextInput
                                        style={s.input}
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        placeholder="Enter new password"
                                        placeholderTextColor="#D1D5DB"
                                        secureTextEntry={!showNew}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity style={s.eyeBtn} onPress={() => setShowNew(!showNew)}>
                                        <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Strength meter */}
                            {newPassword.length > 0 && (
                                <View style={s.strengthWrap}>
                                    <View style={s.strengthBar}>
                                        <View style={[s.strengthFill, { width: `${strength.width}%`, backgroundColor: strength.color }]} />
                                    </View>
                                    <Text style={[s.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                                </View>
                            )}

                            {/* Confirm Password */}
                            <View style={s.inputGroup}>
                                <Text style={s.inputLabel}>Confirm Password</Text>
                                <View style={s.inputRow}>
                                    <TextInput
                                        style={s.input}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        placeholder="Confirm new password"
                                        placeholderTextColor="#D1D5DB"
                                        secureTextEntry={!showConfirm}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                                        <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Match indicator */}
                            {confirmPassword.length > 0 && (
                                <View style={s.matchRow}>
                                    <Ionicons
                                        name={newPassword === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                                        size={16}
                                        color={newPassword === confirmPassword ? '#10B981' : '#EF4444'}
                                    />
                                    <Text style={[s.matchText, {
                                        color: newPassword === confirmPassword ? '#10B981' : '#EF4444'
                                    }]}>
                                        {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                                    </Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[s.changeBtn, changingPassword && s.changeBtnDisabled]}
                                onPress={handleChangePassword}
                                disabled={changingPassword}
                            >
                                {changingPassword ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                                        <Text style={s.changeBtnText}>Update Password</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Password Tips */}
                    <View style={s.tipsCard}>
                        <Text style={s.tipsTitle}>Password Tips</Text>
                        {[
                            'Use at least 8 characters',
                            'Include uppercase and lowercase letters',
                            'Add numbers and special characters',
                            'Avoid common words or patterns',
                        ].map((tip, i) => (
                            <View key={i} style={s.tipRow}>
                                <Ionicons name="checkmark" size={14} color="#10B981" />
                                <Text style={s.tipText}>{tip}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Danger Zone */}
                    <View style={s.dangerSection}>
                        <Text style={s.dangerTitle}>Danger Zone</Text>
                        <View style={s.dangerCard}>
                            <View style={s.dangerInfo}>
                                <Text style={s.dangerLabel}>Delete Account</Text>
                                <Text style={s.dangerDesc}>Permanently remove your account and all data</Text>
                            </View>
                            <TouchableOpacity style={s.dangerBtn} onPress={handleDeleteAccount}>
                                <Text style={s.dangerBtnText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAF9' },
    scrollContent: { padding: 20 },

    /* Header */
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff',
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6',
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

    /* Info Card */
    infoCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 24,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    },
    infoIcon: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    },
    infoContent: { flex: 1, marginLeft: 14 },
    infoLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
    infoValue: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 1 },
    verifiedTag: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    },
    verifiedText: { fontSize: 11, fontWeight: '700', color: '#10B981' },

    /* Section */
    section: { marginBottom: 24 },
    sectionHeaderRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
    },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },

    /* Form */
    formCard: {
        backgroundColor: '#fff', borderRadius: 18, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    },
    inputGroup: { marginBottom: 18 },
    inputLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F9FAFB', borderRadius: 12,
        borderWidth: 1, borderColor: '#E5E7EB',
    },
    input: {
        flex: 1, paddingHorizontal: 16, paddingVertical: 14,
        fontSize: 15, color: '#111827',
    },
    eyeBtn: {
        paddingHorizontal: 14, paddingVertical: 14,
    },

    /* Strength meter */
    strengthWrap: {
        flexDirection: 'row', alignItems: 'center', marginBottom: 18, marginTop: -10, gap: 10,
    },
    strengthBar: {
        flex: 1, height: 4, borderRadius: 2, backgroundColor: '#F3F4F6',
    },
    strengthFill: { height: 4, borderRadius: 2 },
    strengthLabel: { fontSize: 12, fontWeight: '700', width: 50 },

    /* Match */
    matchRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18, marginTop: -10,
    },
    matchText: { fontSize: 12, fontWeight: '600' },

    /* Button */
    changeBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 14,
    },
    changeBtnDisabled: { opacity: 0.6 },
    changeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    /* Tips */
    tipsCard: {
        backgroundColor: '#F0FDF4', borderRadius: 16, padding: 20, marginBottom: 24,
        borderWidth: 1, borderColor: '#BBF7D0',
    },
    tipsTitle: { fontSize: 14, fontWeight: '700', color: '#166534', marginBottom: 12 },
    tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    tipText: { fontSize: 13, color: '#166534', fontWeight: '500' },

    /* Danger */
    dangerSection: { marginBottom: 20 },
    dangerTitle: {
        fontSize: 13, fontWeight: '700', color: '#EF4444',
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginLeft: 4,
    },
    dangerCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: '#FECACA',
    },
    dangerInfo: { flex: 1 },
    dangerLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
    dangerDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    dangerBtn: {
        backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
        borderWidth: 1, borderColor: '#FECACA',
    },
    dangerBtnText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
});
