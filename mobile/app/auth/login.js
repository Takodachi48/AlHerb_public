import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
// Import GoogleSignin conditionally inside the function to prevent Expo Go crashes
import Constants from 'expo-constants';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, signInWithGoogleAsync } from '../../services/firebase';
import { styles } from '../../styles/LoginScreen.styles';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { debugLog } from '../../utils/logger';

// Google Sign-In configuration moved inside handleGoogleSignIn to be conditional
const getExtraEnv = (key) => {
  const value = Constants.expoConfig?.extra?.env?.[key];
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const passwordInputRef = useRef(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const { login, googleLogin } = useAuth();

  // Setup Expo Auth Session for Google Sign-In in Expo Go
  const [, , promptAsync] = Google.useAuthRequest({
    expoClientId:
      getExtraEnv('EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID') ||
      process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    androidClientId:
      getExtraEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID') ||
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId:
      getExtraEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID') ||
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId:
      getExtraEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID') ||
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    responseType: 'id_token',
  });

  const runExpoGoogleFlow = async () => {
    const result = await promptAsync();
    if (result.type !== 'success') {
      throw new Error('Google sign-in was cancelled or did not complete.');
    }

    const idToken = result?.params?.id_token || result?.authentication?.idToken;
    if (!idToken) {
      throw new Error('Google sign-in failed to provide an ID token.');
    }

    const { token } = await signInWithGoogleAsync(result);
    const authResult = await googleLogin(token);
    if (authResult && authResult.success) {
      Alert.alert('Success', 'Welcome to AlgoHerbarium!');
    }
  };

  const handleGoogleSignIn = async () => {
    // Check if running in Expo Go
    if (Constants.appOwnership === 'expo') {
      try {
        setGoogleLoading(true);
        await runExpoGoogleFlow();
      } catch (error) {
        console.error('Expo Go Google Sign-In Error:', error);
        Alert.alert('Login Failed', error.message || 'Something went wrong with Google Sign-In in Expo Go');
      } finally {
        setGoogleLoading(false);
      }
      return;
    }

    setGoogleLoading(true);
    try {
      // Load GoogleSignin only if NOT in Expo Go
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');

      // Configure it just-in-time
      GoogleSignin.configure({
        webClientId:
          getExtraEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID') ||
          process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        offlineAccess: true,
      });

      await GoogleSignin.hasPlayServices();
      try {
        await GoogleSignin.signOut();
      } catch (_e) {
        // user might not be signed in, ignore
      }
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        throw new Error('No ID token found');
      }

      // Sign into Firebase
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseToken = await userCredential.user.getIdToken();

      // Backend verify
      const result = await googleLogin(firebaseToken);
      if (result && result.success) {
        Alert.alert('Success', 'Welcome to AlgoHerbarium!');
      }
    } catch (error) {
      if (error.code === 'SIGN_IN_CANCELLED') {
        debugLog('User cancelled the login flow');
      } else if (error.code === 'IN_PROGRESS') {
        debugLog('Sign in is in progress already');
      } else if (String(error?.message || '').includes('DEVELOPER_ERROR')) {
        try {
          debugLog('Native Google Sign-In DEVELOPER_ERROR detected, trying Expo Auth Session fallback...');
          await runExpoGoogleFlow();
        } catch (fallbackError) {
          console.error('Google Sign-In Fallback Error:', fallbackError);
          Alert.alert(
            'Login Failed',
            fallbackError.message || 'Google Sign-In configuration is invalid for this build.'
          );
        }
      } else {
        console.error('Google Sign-In Error:', error);
        Alert.alert('Login Failed', error.message || 'Something went wrong');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const result = await login(formData.email.trim().toLowerCase(), formData.password, formData.rememberMe);
      if (result && result.success) {
        Alert.alert('Success', 'Welcome to AlgoHerbarium!');
      }
    } catch (error) {
      if (error.message === 'ACCOUNT_DEACTIVATED') {
        Alert.alert('Account Deactivated', 'Your account has been deactivated. Please contact support.');
      } else {
        Alert.alert('Login Failed', error.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading || googleLoading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAF9" />

      {/* Background gradient shape */}
      <View style={styles.gradientBg} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.herbIcon}>
            <Image source={require('../../assets/logo.jpg')} style={styles.logoImage} />
          </View>
          <Text style={styles.mainTitle}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue with AlgoHerbarium</Text>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputContainer, errors.email && styles.inputError]}>
              <MaterialCommunityIcons name="email-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                blurOnSubmit={false}
                editable={!isLoading}
                value={formData.email}
                onChangeText={(value) => handleChange('email', value)}
              />
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputContainer, errors.password && styles.inputError]}>
              <MaterialCommunityIcons name="lock-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                ref={passwordInputRef}
                secureTextEntry={!showPassword}
                autoComplete="password"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                editable={!isLoading}
                value={formData.password}
                onChangeText={(value) => handleChange('password', value)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          {/* Remember Me & Forgot Password */}
          <View style={styles.footerOptions}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => handleChange('rememberMe', !formData.rememberMe)}
              disabled={isLoading}
            >
              <View style={[styles.checkbox, formData.rememberMe && styles.checkboxChecked]}>
                {formData.rememberMe && <MaterialCommunityIcons name="check" size={14} color="#FFF" />}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity disabled={isLoading}>
              <Text style={styles.forgotPassword}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.divider} />
          </View>

          {/* Google Sign-In Button */}
          <TouchableOpacity
            style={[styles.googleButton, isLoading && styles.googleButtonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            {googleLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="google" size={20} color="#DB4437" style={styles.googleIcon} />
                <Text style={styles.googleButtonText}>Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.signUpRow}>
            <Text style={styles.signUpText}>Don't have an account?</Text>
            <TouchableOpacity
              disabled={isLoading}
              onPress={() => router.push('/auth/register')}
            >
              <Text style={styles.signUpLink}>Create account</Text>
            </TouchableOpacity>
          </View>
        </View>

        {__DEV__ && (
          <TouchableOpacity
            style={{ alignItems: 'center', paddingVertical: 12 }}
            onPress={() => {
              Alert.alert(
                'Server Settings',
                'Select an option to configure the API URL:',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset to Default',
                    onPress: () => {
                      const { setCustomApiUrl } = require('../../services/apiClient');
                      setCustomApiUrl(null).then(() => Alert.alert('Reset', 'API URL reset to default.'));
                    }
                  }
                ]
              );
            }}
          >
            <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 12, textAlign: 'center' }}>
              Server Settings
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

