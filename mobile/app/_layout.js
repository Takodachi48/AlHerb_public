import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { View, ActivityIndicator, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Provider } from 'react-redux';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { Colors, Radius, Shadows, Spacing, Typography } from '../styles/DesignSystem';
import { store } from '../store';
import hapticUtils from '../utils/haptics';
import { configureConsoleLogging, debugLog } from '../utils/logger';
import { NotificationProvider, useNotification } from '../context/NotificationContext';
import NotificationBanner from '../components/common/NotificationBanner';
import '../global.css';

configureConsoleLogging();

// Professional Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  handleReset = () => {
    hapticUtils.medium();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <View style={errorStyles.iconContainer}>
            <Ionicons name="alert-circle" size={80} color={Colors.deepForest} />
          </View>
          <Text style={errorStyles.title}>Oops! Something went wrong</Text>
          <Text style={errorStyles.subtitle}>We encountered an unexpected error. Don't worry, your data is safe.</Text>

          <View style={errorStyles.errorBox}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={errorStyles.errorText}>
                {this.state.error?.toString()}
              </Text>
            </ScrollView>
          </View>

          <TouchableOpacity
            onPress={this.handleReset}
            style={errorStyles.button}
            activeOpacity={0.8}
          >
            <Text style={errorStyles.buttonText}>Restart Application</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.softWhite,
  },
  iconContainer: {
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: Colors.sageGreen,
    borderRadius: Radius.xl,
    ...Shadows.neumorphic,
  },
  title: {
    ...Typography.h2,
    color: Colors.deepForest,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    color: Colors.textSecondary,
  },
  errorBox: {
    width: '100%',
    maxHeight: 200,
    backgroundColor: Colors.lightGray,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  errorText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  button: {
    width: '100%',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.deepForest,
    borderRadius: Radius.pill,
    alignItems: 'center',
    ...Shadows.floating,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

function AuthNavigator() {
  const { user, loading, hasSeenOnboarding } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  debugLog('🔍 AuthNavigator render - loading:', loading, 'user:', !!user, 'hasSeenOnboarding:', hasSeenOnboarding, 'segments:', segments);

  useEffect(() => {
    if (loading) return;

    // Small delay to ensure navigation is mounted
    const timeout = setTimeout(() => {
      const inAuthGroup = segments[0] === 'auth';
      const inOnboarding = segments[0] === 'onboarding';

      debugLog('🔍 AuthNavigator navigation check - inAuthGroup:', inAuthGroup, 'inOnboarding:', inOnboarding, 'user:', !!user, 'hasSeenOnboarding:', hasSeenOnboarding, 'segments:', segments);

      // Priority 1: Show onboarding to logged-in users who haven't seen it
      if (user && !hasSeenOnboarding && !inOnboarding) {
        debugLog('🔍 Redirecting logged-in user to onboarding');
        router.replace('/onboarding');
        return;
      }

      // Priority 2: For logged-in users who have seen onboarding, go to home
      if (user && hasSeenOnboarding && (inAuthGroup || inOnboarding || segments.length === 0)) {
        debugLog('🔍 Redirecting logged-in user to home');
        router.replace('/(tabs)');
        return;
      }

      // Priority 3: Show onboarding to new users who haven't seen it
      if (!user && !hasSeenOnboarding && !inOnboarding) {
        debugLog('🔍 Redirecting new user to onboarding');
        router.replace('/onboarding');
        return;
      }

      // Priority 4: Redirect to login for users who haven't logged in but have seen onboarding
      if (!user && !inAuthGroup && hasSeenOnboarding && !inOnboarding) {
        debugLog('🔍 Redirecting to login');
        router.replace('/auth/login');
        return;
      }

      // Priority 5: Handle edge case - logged-in user on onboarding who has seen it
      if (user && hasSeenOnboarding && inOnboarding) {
        debugLog('🔍 Logged-in user on onboarding, redirecting to home');
        router.replace('/(tabs)');
        return;
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [user, loading, hasSeenOnboarding, segments, router]);

  const [showSlowLoading, setShowSlowLoading] = useState(false);

  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => setShowSlowLoading(true), 10000); // Show help after 10s
    } else {
      setShowSlowLoading(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    debugLog('🔍 AuthNavigator showing loading spinner');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAF9', padding: 20 }}>
        <ActivityIndicator size="large" color="#10B981" />
        {showSlowLoading && (
          <View style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ color: '#64748B', marginBottom: 10, textAlign: 'center' }}>
              Taking longer than expected...
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/auth/login')}
              style={{ padding: 10, backgroundColor: '#E2E8F0', borderRadius: 8 }}
            >
              <Text style={{ color: '#333', fontWeight: '600' }}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="chatbot" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="privacy-security" />
      <Stack.Screen name="saved-remedies" />
      <Stack.Screen name="recommendation-history" />
      <Stack.Screen name="scan-history" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="help-faq" />
      <Stack.Screen name="send-feedback" />
      <Stack.Screen name="remedy-detail" />
      <Stack.Screen name="recommendation" />
      <Stack.Screen name="herbs/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="blog/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

// App-wide shell: renders the banner over every screen using notification context
function AppShell({ children }) {
  const { bannerNotification, dismissBanner } = useNotification();
  return (
    <>
      {children}
      <NotificationBanner notification={bannerNotification} onDismiss={dismissBanner} />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <Provider store={store}>
          <AuthProvider>
            <SafeAreaProvider initialMetrics={initialWindowMetrics}>
              <NotificationProvider>
                <AppShell>
                  <StatusBar style="auto" />
                  <AuthNavigator />
                </AppShell>
              </NotificationProvider>
            </SafeAreaProvider>
          </AuthProvider>
        </Provider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}


