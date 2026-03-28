import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../styles/DesignSystem';

const highlights = [
  'Personalized recommendations',
  'Saved remedies and scan history',
  'Safety checks and interaction alerts',
  'Community updates and announcements',
];

export default function AuthChoiceScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAF9" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.hero}>
          <Text style={styles.title}>Welcome to AlgoHerbarium</Text>
          <Text style={styles.subtitle}>Choose how you want to continue.</Text>
        </View>

        <View style={styles.card}>
          {highlights.map((item) => (
            <View key={item} style={styles.highlightRow}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.primaryGreen} />
              <Text style={styles.highlightText}>{item}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/auth/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Log In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/auth/register')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Create Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    ...Typography.h1,
    color: Colors.deepForest,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Shadows.neumorphic,
    marginBottom: 20,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
  },
  highlightText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    fontWeight: '600',
  },
  primaryButton: {
    height: 54,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...Shadows.floating,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    height: 54,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.deepForest,
    fontSize: 16,
    fontWeight: '800',
  },
});
