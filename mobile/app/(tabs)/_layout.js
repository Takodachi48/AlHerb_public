import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius } from '../../styles/DesignSystem';

const SHOW_TAB_LABELS = true;

function TabBarSurface() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={s.tabBarSurface}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={32} tint="light" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={s.tabBarOverlay} />
      </View>
    </View>
  );
}

function TabGlyph({ icon, activeIcon, label, focused, showLabel = SHOW_TAB_LABELS }) {
  const glyphName = focused && activeIcon ? activeIcon : icon;
  const accentColor = focused ? Colors.deepForest : '#64748B';

  return (
    <View style={[s.tabItem, !showLabel && s.tabItemIconOnly]}>
      <View style={s.tabIconWrap}>
        <Ionicons name={glyphName} size={showLabel ? 21 : 22} color={accentColor} />
      </View>
      {showLabel ? <Text style={[s.tabLabel, focused && s.tabLabelActive]} numberOfLines={1}>{label}</Text> : null}
    </View>
  );
}

function ScanGlyph({ focused, showLabel = SHOW_TAB_LABELS }) {
  return (
    <View style={[s.scanActionWrap, !showLabel && s.scanActionWrapIconOnly]}>
      <View style={s.scanFabWrap}>
        <Ionicons name="scan" size={22} color={focused ? Colors.white : 'rgba(255,255,255,0.84)'} />
      </View>
      {showLabel ? <Text style={[s.tabLabel, focused && s.tabLabelActive]}>Scan</Text> : null}
    </View>
  );
}

export const TAB_BAR_CONTENT_HEIGHT = SHOW_TAB_LABELS ? 60 : 50;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + insets.bottom;

  const baseTabBarStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: tabBarHeight,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: 0,
    paddingBottom: Math.max(insets.bottom, 6),
    paddingTop: 6,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : Colors.white,
    overflow: 'visible',
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false, // 🔹 Removed Header as requested

        // 🔹 Floating Tab Bar
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: 'rgba(255,255,255,0.92)',
                  borderTopLeftRadius: Radius.xl,
                  borderTopRightRadius: Radius.xl,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                },
              ]}
            />
          )
        ),
        tabBarStyle: baseTabBarStyle,
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 0,
        },
        tabBarActiveTintColor: Colors.deepForest,
        tabBarInactiveTintColor: '#64748B',
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <TabGlyph
              icon="home-outline"
              activeIcon="home"
              label="Home"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="herbs"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <TabGlyph
              icon="leaf-outline"
              activeIcon="leaf"
              label="Library"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="image-processing"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => <ScanGlyph focused={focused} showLabel={false} />,
        }}
      />
      <Tabs.Screen
        name="herb-map"
        options={({ route }) => ({
          title: 'Map',
          tabBarLabel: '',
          tabBarStyle: (() => {
            const hideParam = route?.params?.hideTabBar;
            const shouldHide = hideParam === true || hideParam === 'true' || hideParam === 1 || hideParam === '1';
            return shouldHide ? { display: 'none' } : baseTabBarStyle;
          })(),
          tabBarIcon: ({ focused }) => (
            <TabGlyph
              icon="map-outline"
              activeIcon="map"
              label="Map"
              focused={focused}
            />
          ),
        })}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <TabGlyph
              icon="people-outline"
              activeIcon="people"
              label="Feed"
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItem: {
    width: '100%',
    maxWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    paddingVertical: 6,
  },
  tabItemIconOnly: {
    width: 57,
    gap: 0,
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: Colors.deepForest,
  },
  tabBarSurface: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: '#FFFFFF',
  },
  tabBarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.88)' : '#FFFFFF',
  },
  scanActionWrap: {
    width: '100%',
    maxWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: -12,
  },
  scanActionWrapIconOnly: {
    width: '100%',
    gap: 0,
    marginTop: -8,
  },
  scanFabWrap: {
    width: 57,
    height: 56,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.deepForest,
    borderWidth: 2,
    borderColor: '#F8FBF9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
});