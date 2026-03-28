import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Image,
  ScrollView,
  ImageBackground,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { useAuth } from '../../context/AuthContext';
import statsService from '../../services/statsService';
import { blogService } from '../../services/apiServices';
import Header from '../../components/common/Header';
import { Colors, Radius, Shadows, Typography, SharedStyles } from '../../styles/DesignSystem';
import hapticUtils from '../../utils/haptics';
import { debugLog } from '../../utils/logger';
import notificationCenterService from '../../services/notificationCenterService';
import userActivityService from '../../services/userActivityService';
import { useNotification } from '../../context/NotificationContext';

const { width } = Dimensions.get('window');
const FEATURE_CARD_WIDTH = (width - 64) / 2;

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return {
      text: 'Good morning',
      icon: 'sunny',
      iconColor: '#B45309',
      iconGradient: ['#FEF3C7', '#FDE68A'],
    };
  }
  if (hour < 17) {
    return {
      text: 'Good afternoon',
      icon: 'partly-sunny',
      iconColor: '#C2410C',
      iconGradient: ['#FFEDD5', '#FDBA74'],
    };
  }
  return {
    text: 'Good evening',
    icon: 'moon',
    iconColor: '#4338CA',
    iconGradient: ['#E0E7FF', '#C7D2FE'],
  };
};

const getLastActiveLabel = (value) => {
  if (!value) return 'No activity yet';
  const activeDate = new Date(value);
  if (Number.isNaN(activeDate.getTime())) return 'No activity yet';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const activeDay = new Date(activeDate.getFullYear(), activeDate.getMonth(), activeDate.getDate());
  const diffDays = Math.floor((today.getTime() - activeDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 6) return `${diffDays} days ago`;
  return activeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getMemberSinceLabel = (value) => {
  if (!value) return 'New member';
  const joined = new Date(value);
  if (Number.isNaN(joined.getTime())) return 'New member';
  return joined.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const formatActivityTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.floor(diffMs / (60 * 1000)));
    return `${mins}m ago`;
  }
  if (diffMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)));
    return `${hours}h ago`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatStatCount = (value) => Number(value || 0).toLocaleString('en-US');

const buildResumeActivity = (scanEntry, recommendationEntry) => {
  const scanTime = new Date(scanEntry?.createdAt || 0).getTime() || 0;
  const recommendationTime = new Date(recommendationEntry?.createdAt || 0).getTime() || 0;
  if (!scanTime && !recommendationTime) return null;

  if (scanTime >= recommendationTime) {
    const title = scanEntry?.commonName || scanEntry?.scientificName || 'Recent plant scan';
    const subtitle = scanEntry?.scientificName && scanEntry?.commonName
      ? scanEntry.scientificName
      : 'Continue from your latest scan result.';
    return {
      type: 'scan',
      tag: 'Latest Scan',
      icon: 'scan-outline',
      title,
      subtitle,
      ctaLabel: scanEntry?.herbId ? 'Open Herb' : 'Open History',
      route: scanEntry?.herbId ? `/herbs/${scanEntry.herbId}` : '/scan-history',
      timeLabel: formatActivityTime(scanEntry?.createdAt),
    };
  }

  const symptoms = Array.isArray(recommendationEntry?.symptoms)
    ? recommendationEntry.symptoms.filter(Boolean)
    : [];
  const symptomPreview = symptoms.slice(0, 2).join(', ');
  const topHerb = recommendationEntry?.topHerbs?.[0]?.name;

  return {
    type: 'recommendation',
    tag: 'Latest Recommendation',
    icon: 'medkit-outline',
    title: symptomPreview ? `For ${symptomPreview}` : 'Recent remedy request',
    subtitle: topHerb
      ? `Top herb: ${topHerb}`
      : `${Number(recommendationEntry?.recommendationCount || 0)} remedies suggested`,
    ctaLabel: 'View History',
    route: '/recommendation-history',
    timeLabel: formatActivityTime(recommendationEntry?.createdAt),
  };
};

const features = [
  {
    id: 1,
    title: 'Symptoms',
    desc: 'Find personalized remedies',
    icon: 'medical',
    color: Colors.primaryGreen,
    route: '/recommendation',
    image: require('../../assets/symptoms_bg.png')
  },
  {
    id: 4,
    title: 'Safety',
    desc: 'Check drug interactions',
    icon: 'shield-checkmark',
    color: '#059669',
    route: '/screens/interactions',
    image: require('../../assets/safety_bg.png')
  },
  {
    id: 5,
    title: 'Post Blog',
    desc: 'Share your discovery',
    icon: 'add-circle',
    color: '#10B981',
    route: '/community/create-blog',
    fullWidth: true,
    image: require('../../assets/blog_post_bg.png')
  },
];

// ────────── SUB-COMPONENTS ──────────

const ActionCard = ({ item, onSelect }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = (toValue) => {
    if (toValue < 1) hapticUtils.light();
    Animated.spring(scale, { toValue, friction: 50, tension: 100, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{
      transform: [{ scale }],
      width: item.fullWidth ? '100%' : FEATURE_CARD_WIDTH,
      marginBottom: 16
    }}>
      <TouchableOpacity
        style={styles.professionalActionCard}
        onPressIn={() => handlePress(0.97)}
        onPressOut={() => handlePress(1)}
        onPress={() => {
          hapticUtils.selection();
          onSelect(item.route);
        }}
        activeOpacity={0.9}
      >
        <ImageBackground
          source={item.image}
          style={styles.actionImageBg}
          imageStyle={styles.actionImageStyle}
        >
          <LinearGradient
            colors={['rgba(20, 83, 45, 0.45)', 'rgba(20, 83, 45, 0.88)']}
            style={styles.actionOverlay}
          >
            <View style={[styles.actionIconModern, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name={item.icon} size={18} color={Colors.white} />
            </View>
            <View>
              <Text style={styles.actionTitleModern}>{item.title}</Text>
              <Text style={styles.actionSubModern} numberOfLines={1}>{item.desc}</Text>
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ArticleRow = ({ article, index, onSelect }) => {
  return (
    <TouchableOpacity
      style={styles.modernArticleCard}
      onPress={() => {
        hapticUtils.selection();
        onSelect(article);
      }}
      activeOpacity={0.8}
    >
      <View style={styles.articleInfo}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{article.category || 'Herb Knowledge'}</Text>
        </View>
        <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
        <View style={styles.articleMeta}>
          <Ionicons name="time-outline" size={14} color={Colors.textLight} />
          <Text style={styles.articleTime}>{article.readTime} min read</Text>
        </View>
      </View>
      <Image
        source={{ uri: article.featuredImage?.url || 'https://picsum.photos/400/200?random=' + index }}
        style={styles.articleThumbnail}
      />
    </TouchableOpacity>
  );
};
const MiniStatCard = ({ item }) => {
  return (
    <View style={[styles.miniStatCard, { backgroundColor: item.bg }]}>
      <View style={[styles.miniStatIconWrap, { backgroundColor: item.color + '15' }]}>
        <Ionicons name={item.icon} size={14} color={item.color} />
      </View>
      <View style={styles.miniStatTextWrap}>
        <Text style={styles.miniStatValue}>{item.value}</Text>
        <Text style={styles.miniStatLabel} numberOfLines={1}>{item.label}</Text>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const s = styles;
  const router = useRouter();
  const { user } = useAuth();
  const [currentTip, setCurrentTip] = useState(0);

  const [userStats, setUserStats] = useState(null);
  const [dailyTips, setDailyTips] = useState([]);
  const [recentArticles, setRecentArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [scanCount, setScanCount] = useState(0);
  const [resumeActivity, setResumeActivity] = useState(null);
  const [greeting] = useState(getGreeting());
  const firstName = (user?.displayName || '').trim().split(/\s+/)[0] || 'there';
  const greetingLine = `${greeting.text},`;
  const displayName = firstName === 'there' ? 'Herbal Explorer' : firstName;

  // Animation & Interaction states
  const heroScale = useRef(new Animated.Value(1)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  // Reanimated states for high-end feel
  const reFloatAnim = useSharedValue(0);

  useEffect(() => {
    reFloatAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);

  const animatedFabContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(reFloatAnim.value, [0, 1], [0, -10]) }
    ],
  }));

  const scrollY = useRef(new Animated.Value(0)).current;

  const sectionAnims = useRef(
    Array.from({ length: 7 }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    if (!loading) {
      Animated.stagger(80, sectionAnims.map(anim =>
        Animated.spring(anim, {
          toValue: 1,
          tension: 50,
          friction: 9,
          useNativeDriver: true,
        })
      )).start();
    }
  }, [loading, sectionAnims]);

  const { unreadCount, refreshUnreadCount } = useNotification();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const promises = [];
      if (user) {
        promises.push(
          statsService.getUserStats()
            .then(data => setUserStats(data))
            .catch(err => debugLog('Stats:', err.message))
        );
        promises.push(
          Promise.all([
            userActivityService.getScanHistory({ page: 1, limit: 1 }).catch(() => null),
            userActivityService.getRecommendationHistory({ page: 1, limit: 1 }).catch(() => null),
          ])
            .then(([scanResponse, recommendationResponse]) => {
              const latestScan = Array.isArray(scanResponse?.items) ? scanResponse.items[0] : null;
              const latestRecommendation = Array.isArray(recommendationResponse?.items)
                ? recommendationResponse.items[0]
                : null;

              setScanCount(Number(scanResponse?.pagination?.total || 0));
              setResumeActivity(buildResumeActivity(latestScan, latestRecommendation));
            })
            .catch(() => {
              setScanCount(0);
              setResumeActivity(null);
            })
        );
      } else {
        setScanCount(0);
        setResumeActivity(null);
      }

      promises.push(
        blogService.getAllBlogs(1, 3)
          .then(res => {
            const blogs = res?.data?.blogs || res?.data || [];
            setRecentArticles(Array.isArray(blogs) ? blogs.slice(0, 3) : []);
          })
          .catch(err => debugLog('Articles:', err.message))
      );
      promises.push(refreshUnreadCount());
      await Promise.all(promises);
      setDailyTips(statsService.getDailyTips());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [refreshUnreadCount, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
    }, [refreshUnreadCount]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleResumePress = useCallback(() => {
    if (!resumeActivity?.route) return;
    hapticUtils.selection();
    router.push(resumeActivity.route);
  }, [resumeActivity, router]);

  useEffect(() => {
    if (dailyTips.length === 0) return;
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % dailyTips.length);
    }, 15000); // 15s interval for less distraction

    return () => clearInterval(interval);
  }, [dailyTips.length]);

  const lastActiveValue = getLastActiveLabel(userStats?.lastActiveDate);
  const memberSinceValue = getMemberSinceLabel(userStats?.joinDate);
  const totalRecommendations = Number(userStats?.totalRecommendations ?? 0);
  const savedRecommendationCount = Number(userStats?.savedRecommendationCount ?? 0);
  const favoriteHerbCount = Number(userStats?.favoriteHerbCount ?? 0);
  const trackedActions = scanCount + totalRecommendations + savedRecommendationCount + favoriteHerbCount;

  const primaryStats = [
    {
      key: 'scans',
      label: 'Scans',
      value: formatStatCount(scanCount),
      icon: 'scan',
      hint: 'All-time',
      bg: '#ECFDF5',
      color: '#059669', // Emerald
    },
    {
      key: 'recommendations',
      label: 'Remedies',
      value: formatStatCount(totalRecommendations),
      icon: 'medkit',
      hint: 'Generated',
      bg: '#F0FDF4',
      color: '#166534', // Forest
    },
  ];

  const secondaryStats = [
    {
      key: 'saved',
      label: 'Saved Remedies',
      value: formatStatCount(savedRecommendationCount),
      icon: 'bookmark',
      bg: '#F7FEE7',
      color: '#4D7C0F', // Lime
    },
    {
      key: 'favorites',
      label: 'Favorite Herbs',
      value: formatStatCount(favoriteHerbCount),
      icon: 'heart',
      bg: '#F0FDFA',
      color: '#0D9488', // Teal
    },

  ];

  const statusStats = [
    {
      key: 'active',
      label: 'Last active',
      value: lastActiveValue,
      icon: 'pulse',
      bg: '#F5F3FF',
      color: '#6D28D9',
    },
    {
      key: 'member',
      label: 'Member since',
      value: memberSinceValue,
      icon: 'calendar-outline',
      bg: '#FFF7ED',
      color: '#C2410C',
    },
  ];

  const AnimSection = ({ index, children, style }) => (
    <Animated.View style={[style, {
      opacity: sectionAnims[index],
      transform: [{
        translateY: sectionAnims[index].interpolate({
          inputRange: [0, 1], outputRange: [30, 0]
        })
      }]
    }]}>
      {children}
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.deepForest} />
        <Text style={s.loadingText}>Crafting your herbal dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={SharedStyles.container}>
      <Header
        title={`Hello, ${displayName}!`}
        titleStyle={{ fontSize: 20, fontWeight: '900', color: Colors.deepForest, letterSpacing: -0.5 }}
        subtitle={greetingLine.replace(',', '')}
        subtitleStyle={{ fontSize: 12, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 1 }}
        centerTitle={false}
        leftAction={{
          customElement: (
            <TouchableOpacity
              onPress={() => router.push('/profile')}
              style={s.avatarWrapper}
              activeOpacity={0.8}
            >
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={s.avatarImg} />
              ) : (
                <View style={s.avatarEmpty}>
                  <Text style={s.avatarInitial}>{user?.displayName?.charAt(0) || 'H'}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        }}
        rightActions={[
          {
            icon: 'notifications-outline',
            onPress: () => router.push('/notifications'),
            badge: unreadCount,
          }
        ]}
      />
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.deepForest} />
        }
      >
        {/* ────────── 1. GREETING (Moved to Header) ────────── */}

        {/* ────────── 2. HERO SCAN CARD (Primary CTA - Top Position) ────────── */}
        <AnimSection index={1} style={s.heroContainer}>
          <Animated.View style={{ transform: [{ scale: heroScale }] }}>
            <TouchableOpacity
              style={s.heroCtaCard}
              activeOpacity={0.9}
              onPressIn={() => {
                hapticUtils.light();
                Animated.spring(heroScale, { toValue: 0.98, useNativeDriver: true }).start();
              }}
              onPressOut={() => Animated.spring(heroScale, { toValue: 1, useNativeDriver: true }).start()}
              onPress={() => {
                hapticUtils.medium();
                router.push('/(tabs)/image-processing');
              }}
            >
              <View style={s.heroBg}>
                <View style={s.heroContent}>
                  <View style={{ flex: 1, paddingRight: 16 }}>
                    <View style={s.heroBadge}>
                      <Ionicons name="flash" size={10} color={Colors.white} style={{ marginRight: 4 }} />
                      <Text style={s.heroBadgeText}>Primary Action</Text>
                    </View>
                    <Text style={s.heroTitleText}>Identify Any Plant</Text>
                    <Text style={s.heroSubText}>Discover uses instantly</Text>
                  </View>
                  <Animated.View style={[s.heroIconBox, {
                    transform: [{ rotate: scrollY.interpolate({ inputRange: [0, 200], outputRange: ['0deg', '15deg'], extrapolate: 'clamp' }) }]
                  }]}>
                    <Ionicons name="camera" size={32} color={Colors.white} />
                  </Animated.View>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>

          <View style={s.compactStatsContainer}>
            <View style={s.statsHeaderRow}>
              <Ionicons name="stats-chart" size={12} color={Colors.textLight} />
              <Text style={s.statsHeaderText}>
                Last active {lastActiveValue} • Joined {memberSinceValue}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.statsScrollContent}
              snapToInterval={140}
              decelerationRate="fast"
            >
              {[...primaryStats, ...secondaryStats].map((stat) => (
                <MiniStatCard key={stat.key} item={stat} />
              ))}
            </ScrollView>
          </View>
        </AnimSection>

        {/* ────────── 4. MINIMALIST QUICK ACTIONS (2x2 Grid) ────────── */}
        {resumeActivity ? (
          <AnimSection index={2} style={s.resumeSection}>
            <TouchableOpacity style={s.resumeCard} onPress={handleResumePress} activeOpacity={0.88}>
              <View style={s.resumeTopRow}>
                <View style={s.resumeTag}>
                  <Text style={s.resumeTagText}>{resumeActivity.tag}</Text>
                </View>
                <Text style={s.resumeTimeText}>{resumeActivity.timeLabel}</Text>
              </View>

              <View style={s.resumeMainRow}>
                <View style={s.resumeIconWrap}>
                  <Ionicons name={resumeActivity.icon} size={18} color={Colors.deepForest} />
                </View>
                <View style={s.resumeTextWrap}>
                  <Text style={s.resumeTitle} numberOfLines={1}>{resumeActivity.title}</Text>
                  <Text style={s.resumeSubtitle} numberOfLines={2}>{resumeActivity.subtitle}</Text>
                </View>
                <View style={s.resumeAction}>
                  <Text style={s.resumeActionText}>{resumeActivity.ctaLabel}</Text>
                  <Ionicons name="arrow-forward" size={13} color={Colors.deepForest} />
                </View>
              </View>
            </TouchableOpacity>
          </AnimSection>
        ) : null}
        <AnimSection index={3} style={s.actionsSectionModern}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitleText}>Quick Tools</Text>
          </View>
          <View style={s.minimalActionGrid}>
            {features.map((item) => (
              <ActionCard
                key={item.id}
                item={item}
                onSelect={(route) => router.push(route)}
              />
            ))}
          </View>
        </AnimSection>

        {/* ────────── 5. RECENT ARTICLES ────────── */}
        {recentArticles.length > 0 && (
          <AnimSection index={4} style={s.articlesSection}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitleText}>Community Blogs</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/community')}>
                <Text style={s.seeAllCta}>Read More</Text>
              </TouchableOpacity>
            </View>
            <View style={s.articleList}>
              {recentArticles.map((article, idx) => (
                <ArticleRow
                  key={idx}
                  article={article}
                  index={idx}
                  onSelect={(item) => router.push(`/blog/${item._id}`)}
                />
              ))}
            </View>
          </AnimSection>
        )}

        {/* ────────── 6. DAILY WISDOM ────────── */}
        {dailyTips.length > 0 && (
          <AnimSection index={5} style={s.wisdomSection}>
            <View style={s.wisdomCardMinimal}>
              <View style={s.wisdomHead}>
                <Ionicons name="leaf-outline" size={16} color={Colors.deepForest} />
                <Text style={s.wisdomLabel}>Daily Insight</Text>
              </View>
              <Text style={s.wisdomBody}>
                "{dailyTips[currentTip]}"
              </Text>
            </View>
          </AnimSection>
        )}

        <View style={{ height: 160 }} />
      </Animated.ScrollView>

      {/* ────────── AI CHAT FAB (Lottie Animation - "As Is") ────────── */}
      <Reanimated.View style={[styles.chatFabContainer, animatedFabContainerStyle]}>
        <Animated.View style={[{ transform: [{ scale: fabScale }] }]}>
          <TouchableOpacity
            style={styles.chatFabTransparent}
            activeOpacity={0.7}
            onPressIn={() => Animated.spring(fabScale, { toValue: 1.1, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(fabScale, { toValue: 1, useNativeDriver: true }).start()}
            onPress={() => router.push('/chatbot')}
          >
            <LottieView
              source={require('../../assets/ai_chatbot.json')}
              autoPlay
              loop
              style={{ width: 150, height: 150 }}
            />
          </TouchableOpacity>
        </Animated.View>
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 16, paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.softWhite },
  loadingText: { marginTop: 16, ...Typography.body, color: Colors.deepForest },

  /* Header Refined */
  avatarWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
  },
  avatarImg: { width: 42, height: 42, borderRadius: 12 },
  avatarEmpty: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.sageGreen, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '800', color: Colors.deepForest },

  /* Hero */
  heroContainer: { paddingHorizontal: 24, marginBottom: 32 },
  heroCtaCard: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.floating },
  heroBg: { padding: 24, backgroundColor: Colors.deepForest },
  heroContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, alignSelf: 'flex-start', marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  heroBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  heroTitleText: { color: Colors.white, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  heroSubText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4, fontWeight: '500' },
  heroIconBox: { width: 62, height: 62, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },

  /* Compact Stats */
  compactStatsContainer: {
    marginTop: 12,
  },
  statsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  statsHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  statsScrollContent: {
    gap: 12,
    paddingRight: 24,
  },
  miniStatCard: {
    paddingLeft: 10,
    paddingRight: 16,
    height: 60,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    minWidth: 110,
    borderColor: 'rgba(0,0,0,0.03)',
    ...Shadows.neumorphic,
  },
  miniStatIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStatValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.deepForest,
    lineHeight: 18,
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },

  /* Continue Card */
  resumeSection: { paddingHorizontal: 24, marginBottom: 24 },
  resumeCard: {
    backgroundColor: '#F8FFFB',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#DDEEE3',
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Shadows.neumorphic,
  },
  resumeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resumeTag: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#CFE9DA',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resumeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  resumeTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  resumeMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resumeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F6ED',
  },
  resumeTextWrap: {
    flex: 1,
  },
  resumeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.deepForest,
    marginBottom: 2,
  },
  resumeSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  resumeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#D1E9DA',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resumeActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.deepForest,
  },

  /* Modern Actions (Quick Tools) */
  actionsSectionModern: { marginBottom: 32, paddingHorizontal: 24 },
  minimalActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  professionalActionCard: {
    height: 90,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.neumorphic,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  actionImageBg: {
    flex: 1,
  },
  actionImageStyle: {
    opacity: 0.9,
  },
  actionOverlay: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
    gap: 8,
  },
  actionIconModern: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitleModern: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.2,
  },
  actionSubModern: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: -2,
  },

  /* Articles (Modernized) */
  articlesSection: { paddingHorizontal: 24, marginBottom: 32 },
  articleList: { gap: 14 },
  modernArticleCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: 12,
    ...Shadows.neumorphic,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  articleInfo: { flex: 1, paddingRight: 12, justifyContent: 'center' },
  categoryBadge: { backgroundColor: Colors.sageGreen, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 8 },
  categoryText: { fontSize: 10, fontWeight: '800', color: Colors.deepForest, letterSpacing: 0.5 },
  articleTitle: { fontSize: 16, fontWeight: '700', color: Colors.textMain, lineHeight: 22, marginBottom: 8 },
  articleMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  articleTime: { fontSize: 12, fontWeight: '500', color: Colors.textLight },
  articleThumbnail: { width: 80, height: 80, borderRadius: Radius.md, backgroundColor: Colors.lightGray },

  /* Headers */
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 24, marginBottom: 20 },
  sectionTitleText: { fontSize: 20, fontWeight: '800', color: Colors.deepForest, letterSpacing: -0.5 },
  seeAllCta: { fontSize: 14, fontWeight: '700', color: Colors.deepForest },

  /* Wisdom (Professional) */
  wisdomSection: { paddingHorizontal: 24, paddingBottom: 24 },
  wisdomCardMinimal: { backgroundColor: '#F8FAFC', padding: 24, borderRadius: Radius.lg, borderWidth: 1, borderColor: '#E2E8F0', ...Shadows.neumorphic },
  wisdomHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  wisdomLabel: { fontSize: 13, fontWeight: '800', color: Colors.deepForest, textTransform: 'uppercase', letterSpacing: 1 },
  wisdomBody: { fontSize: 16, lineHeight: 24, color: Colors.textSecondary, fontStyle: 'italic', fontWeight: '500' },

  /* Chat FAB */
  chatFabContainer: {
    position: 'absolute',
    bottom: 100,
    right: -10,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatFabTransparent: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatFabGradient: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pulseRing: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(59, 130, 246, 0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.6)',
  },
});
