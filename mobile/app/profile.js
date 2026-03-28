import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/common/Header';
import statsService from '../services/statsService';
import userActivityService from '../services/userActivityService';
import { debugLog } from '../utils/logger';

// ─── Menu Item ────────────────────────────────────
function MenuItem({ icon, title, subtitle, onPress, isLast, color = '#10B981', bgColor = '#ECFDF5' }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.menuItem, !isLast && styles.menuItemBorder]}
    >
      <View style={[styles.menuIconBox, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.menuArrow}>
        <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
      </View>
    </TouchableOpacity>
  );
}

// ─── Stat Item ────────────────────────────────────
function StatItem({ value, label, icon, color, bgColor }) {
  return (
    <View style={styles.statItem}>
      <View style={[styles.statIconWrap, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text
        style={styles.statLabel}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────
export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    fetchStats();
    // Animate stats card on load
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const [data, scans] = await Promise.all([
        statsService.getUserStats(),
        userActivityService.getScanHistory({ page: 1, limit: 1 }),
      ]);
      setStats(data);
      setScanCount(Number(scans?.pagination?.total || 0));
    } catch (err) {
      debugLog('Stats fetch error:', err.message);
      setScanCount(0);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const initial =
    user?.displayName?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    'U';

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently joined';

  // Utility function to optimize Cloudinary images
  const getOptimizedImageUrl = (url, width = 400) => {
    if (!url || !url.includes('cloudinary.com')) return url;

    // Add Cloudinary optimization parameters
    const optimizedUrl = url.replace('/upload/', `/upload/w_${width},c_fill,q_auto,f_auto,dpr_2/`);
    return optimizedUrl;
  };

  return (
    <View style={styles.container}>
      <Header
        title="Profile"
        showBack={true}
        backgroundColor="#064E3B"
        border={false}
        dark={true}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        bounces={true}
      >
        {/* ─── Enhanced Gradient Header ─── */}
        <LinearGradient
          colors={['#064E3B', '#0F766E', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          {/* Decorative elements */}
          <View style={[styles.headerCircle, { top: -30, right: -30 }]} />
          <View style={[styles.headerCircle, { bottom: 20, left: -20, width: 80, height: 80 }]} />

          {/* User Info */}
          <View style={styles.userInfoSection}>
            <View style={styles.avatarRing}>
              {user?.photoURL ? (
                <Image
                  source={{ uri: getOptimizedImageUrl(user.photoURL, 400) }}
                  style={styles.avatar}
                  onError={(error) => {
                    debugLog('Profile image failed to load, using fallback');
                  }}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              </View>
            </View>
            <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.memberBadge}>
              <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.memberText}>{memberSince}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ─── Stats Card (floating) ─── */}
        <Animated.View style={[styles.statsCard, { opacity: fadeAnim }]}>
          {loadingStats ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator size="small" color="#10B981" />
            </View>
          ) : (
            <View style={styles.statsRow}>
              <StatItem
                value={stats?.favoriteHerbCount ?? 0}
                label="Favorites"
                icon="heart"
                color="#EF4444"
                bgColor="#FEF2F2"
              />
              <View style={styles.statDivider} />
              <StatItem
                value={scanCount}
                label="Scans"
                icon="scan"
                color="#0891B2"
                bgColor="#ECFEFF"
              />
              <View style={styles.statDivider} />
              <StatItem
                value={stats?.totalRecommendations ?? 0}
                label="Recs"
                icon="medical"
                color="#8B5CF6"
                bgColor="#F5F3FF"
              />
              <View style={styles.statDivider} />
              <StatItem
                value={stats?.savedRecommendationCount ?? 0}
                label="Saved"
                icon="bookmark"
                color="#3B82F6"
                bgColor="#EFF6FF"
              />
            </View>
          )}
        </Animated.View>

        {/* ─── Account Section ─── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="person-outline"
              title="Edit Profile"
              subtitle="Name, photo, bio"
              onPress={() => router.push('/edit-profile')}
              color="#3B82F6"
              bgColor="#EFF6FF"
            />
            <MenuItem
              icon="shield-checkmark-outline"
              title="Privacy & Security"
              subtitle="Password, data"
              onPress={() => router.push('/privacy-security')}
              color="#8B5CF6"
              bgColor="#F5F3FF"
            />
            <MenuItem
              icon="notifications-outline"
              title="Notification Settings"
              subtitle="Email, push, and alert preferences"
              onPress={() => router.push({ pathname: '/notifications', params: { mode: 'settings' } })}
              color="#F59E0B"
              bgColor="#FFFBEB"
              isLast
            />
          </View>
        </View>

        {/* ─── My Health Section ─── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>My Health</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="bookmark-outline"
              title="Saved Remedies"
              subtitle="Your personal collection"
              onPress={() => router.push('/saved-remedies')}
              color="#EC4899"
              bgColor="#FDF2F8"
            />
            <MenuItem
              icon="time-outline"
              title="Recommendation History"
              subtitle="Past remedy requests"
              onPress={() => router.push('/recommendation-history')}
              color="#0EA5E9"
              bgColor="#E0F2FE"
            />
            <MenuItem
              icon="camera-outline"
              title="Scan History"
              subtitle="Plant scans and results"
              onPress={() => router.push('/scan-history')}
              color="#14B8A6"
              bgColor="#CCFBF1"
            />
            <MenuItem
              icon="heart-outline"
              title="Favorite Herbs"
              subtitle="Herbs you love"
              onPress={() => router.push('/favorites')}
              color="#EF4444"
              bgColor="#FEF2F2"
            />
            <MenuItem
              icon="git-compare-outline"
              title="Drug Interactions"
              subtitle="Check herb safety"
              onPress={() => router.push('/screens/interactions')}
              color="#F59E0B"
              bgColor="#FFFBEB"
              isLast
            />
          </View>
        </View>

        {/* ─── Support Section ─── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="help-circle-outline"
              title="Help & FAQ"
              subtitle="Get answers"
              onPress={() => router.push('/help-faq')}
              color="#06B6D4"
              bgColor="#ECFEFF"
            />
            <MenuItem
              icon="chatbubble-outline"
              title="Send Feedback"
              subtitle="Tell us how to improve"
              onPress={() => router.push('/send-feedback')}
              color="#10B981"
              bgColor="#ECFDF5"
            />
            <MenuItem
              icon="information-circle-outline"
              title="About AlgoHerbarium"
              subtitle="Version 1.0.0"
              onPress={() => Alert.alert(
                'AlgoHerbarium',
                'Version 1.0.0\n\nA herbal medicine identification and wellness app built with ❤️',
              )}
              color="#6366F1"
              bgColor="#EEF2FF"
              isLast
            />
          </View>
        </View>

        {/* ─── Logout ─── */}
        <View style={styles.sectionWrap}>
          <TouchableOpacity
            style={styles.logoutBtn}
            activeOpacity={0.8}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },

  /* Header */
  headerGradient: {
    paddingBottom: 80,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  headerCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* User Info */
  userInfoSection: {
    alignItems: 'center',
    paddingTop: 8,
  },
  avatarRing: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  avatarInitial: {
    fontSize: 42,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 1,
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  memberText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },

  /* Stats Card */
  statsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 24,
    marginTop: -40,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(6, 78, 59, 0.05)',
  },
  statsLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#F3F4F6',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
    width: '100%',
  },

  /* Sections */
  sectionWrap: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuGroup: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 18,
  },
  menuArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    paddingVertical: 15,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
});

