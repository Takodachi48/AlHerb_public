import React, { useMemo, useRef, useState } from 'react';
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
import { styles } from '../../styles/RegisterScreen.styles';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const { register } = useAuth();

  // Password strength validation
  const passwordStrength = useMemo(() => {
    const pwd = formData.password;
    return {
      hasLength: pwd.length >= 8,
      hasUppercase: /[A-Z]/.test(pwd),
      hasLowercase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecial: /[!@#$%^&*]/.test(pwd),
    };
  }, [formData.password]);

  const isPasswordStrong = Object.values(passwordStrength).filter(Boolean).length >= 3;

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Full name is required';
    } else if (formData.displayName.trim().length < 2) {
      newErrors.displayName = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!isPasswordStrong) {
      newErrors.password = 'Password is not strong enough';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const result = await register(
        formData.email.trim().toLowerCase(),
        formData.password,
        formData.displayName.trim()
      );
      if (result && result.success) {
        // Navigate to email verification screen
        router.replace('/auth/verify-email');
      }
    } catch (error) {
      Alert.alert(
        'Registration Failed',
        error.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

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
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 },
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
          <Text style={styles.mainTitle}>Create Account</Text>
          <Text style={styles.subtitle}>Create your AlgoHerbarium account</Text>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Display Name Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Full Name</Text>
              {errors.displayName && (
                <Text style={styles.errorText}>{errors.displayName}</Text>
              )}
            </View>
            <View
              style={[
                styles.inputContainer,
                errors.displayName && styles.inputError,
              ]}
            >
              <MaterialCommunityIcons name="account-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => emailInputRef.current?.focus()}
                blurOnSubmit={false}
                editable={!loading}
                value={formData.displayName}
                onChangeText={(value) => handleChange('displayName', value)}
              />
            </View>
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Email</Text>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>
            <View
              style={[styles.inputContainer, errors.email && styles.inputError]}
            >
              <MaterialCommunityIcons name="email-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                ref={emailInputRef}
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
                editable={!loading}
                value={formData.email}
                onChangeText={(value) => handleChange('email', value)}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>
            <View
              style={[
                styles.inputContainer,
                errors.password && styles.inputError,
              ]}
            >
              <MaterialCommunityIcons name="lock-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                ref={passwordInputRef}
                style={styles.input}
                placeholder="Create a strong password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                autoComplete="password-new"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                blurOnSubmit={false}
                editable={!loading}
                value={formData.password}
                onChangeText={(value) => handleChange('password', value)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>

            {/* Password Requirements */}
            {formData.password.length > 0 && (
              <View style={styles.requirementsContainer}>
                <Text style={styles.requirementTitle}>Password Strength</Text>

                <View style={styles.requirement}>
                  <View style={styles.requirementCheck}>
                    <MaterialCommunityIcons
                      name={passwordStrength.hasLength ? "check-circle" : "circle-outline"}
                      size={14}
                      color={passwordStrength.hasLength ? "#10B981" : "#CBD5E1"}
                    />
                  </View>
                  <Text style={styles.requirementText}>At least 8 characters</Text>
                </View>

                <View style={styles.requirement}>
                  <View style={styles.requirementCheck}>
                    <MaterialCommunityIcons
                      name={passwordStrength.hasUppercase ? "check-circle" : "circle-outline"}
                      size={14}
                      color={passwordStrength.hasUppercase ? "#10B981" : "#CBD5E1"}
                    />
                  </View>
                  <Text style={styles.requirementText}>One uppercase letter</Text>
                </View>

                <View style={styles.requirement}>
                  <View style={styles.requirementCheck}>
                    <MaterialCommunityIcons
                      name={passwordStrength.hasLowercase ? "check-circle" : "circle-outline"}
                      size={14}
                      color={passwordStrength.hasLowercase ? "#10B981" : "#CBD5E1"}
                    />
                  </View>
                  <Text style={styles.requirementText}>One lowercase letter</Text>
                </View>

                <View style={styles.requirement}>
                  <View style={styles.requirementCheck}>
                    <MaterialCommunityIcons
                      name={passwordStrength.hasNumber ? "check-circle" : "circle-outline"}
                      size={14}
                      color={passwordStrength.hasNumber ? "#10B981" : "#CBD5E1"}
                    />
                  </View>
                  <Text style={styles.requirementText}>One number</Text>
                </View>

                <View style={styles.requirement}>
                  <View style={styles.requirementCheck}>
                    <MaterialCommunityIcons
                      name={passwordStrength.hasSpecial ? "check-circle" : "circle-outline"}
                      size={14}
                      color={passwordStrength.hasSpecial ? "#10B981" : "#CBD5E1"}
                    />
                  </View>
                  <Text style={styles.requirementText}>
                    One special character (!@#$%^&*)
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Confirm Password</Text>
              {errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>
            <View
              style={[
                styles.inputContainer,
                errors.confirmPassword && styles.inputError,
              ]}
            >
              <MaterialCommunityIcons name="lock-check-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                ref={confirmPasswordInputRef}
                style={styles.input}
                placeholder="Re-enter your password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showConfirmPassword}
                autoComplete="password-new"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                editable={!loading}
                value={formData.confirmPassword}
                onChangeText={(value) => handleChange('confirmPassword', value)}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
              >
                <MaterialCommunityIcons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Create Account Button */}
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading || !isPasswordStrong || !formData.confirmPassword || formData.confirmPassword !== formData.password}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.createButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          {/* Sign In Link */}
          <View style={styles.signInRow}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity
              disabled={loading}
              onPress={() => router.push('/auth/login')}
            >
              <Text style={styles.signInLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Terms Section */}
        <View style={styles.termsSection}>
          <Text style={styles.termsText}>
            By creating an account, you agree to our
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
            <TouchableOpacity disabled={loading}>
              <Text style={styles.termsLink}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.termsDot}>•</Text>
            <TouchableOpacity disabled={loading}>
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
