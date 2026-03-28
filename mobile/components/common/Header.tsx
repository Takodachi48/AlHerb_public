import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../styles/DesignSystem';
import hapticUtils from '../../utils/haptics';

export interface RightAction {
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
  size?: number;
  badge?: boolean | number;
  customElement?: ReactNode;
}

export interface LeftAction {
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  customElement?: ReactNode;
  iconColor?: string;
}

export interface SubtitleIcon {
  name: keyof typeof Ionicons.glyphMap;
  color?: string;
  size?: number;
}

export interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightActions?: RightAction[];
  centerTitle?: boolean;
  subtitle?: string;
  subtitleIcon?: SubtitleIcon;
  backgroundColor?: string;
  border?: boolean;
  leftAction?: LeftAction;
  dark?: boolean;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
}

/**
 * Standard Header Component for Herbal App
 * Ensures consistent safe area placement and styling across all screens.
 */
const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
  rightActions = [],
  centerTitle = true,
  subtitle,
  subtitleIcon,
  backgroundColor = Colors.white,
  border = true,
  leftAction,
  dark = false,
  titleStyle,
  subtitleStyle,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    hapticUtils.selection();
    if (onBack) onBack();
    else router.back();
  };

  const handlePress = (onPress?: () => void) => {
    hapticUtils.selection();
    if (onPress) onPress();
  };

  const iconColor = dark ? Colors.white : Colors.deepForest;
  const textColor = dark ? Colors.white : Colors.deepForest;

  // Calculate top padding to handle translucent status bar on Android and Safe Area on iOS
  const paddingTop = Platform.OS === 'android'
    ? (insets.top > 0 ? insets.top : (StatusBar.currentHeight || 0)) + 2
    : Math.max(insets.top, 4);

  return (
    <View style={[
      s.headerContainer,
      {
        backgroundColor,
        paddingTop,
      },
      border && s.border
    ]}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <View style={s.content}>
        {/* Left Section */}
        <View style={s.leftSection}>
          {showBack ? (
            <TouchableOpacity
              style={[s.iconButton, dark && s.darkButton]}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={iconColor} />
            </TouchableOpacity>
          ) : leftAction ? (
            leftAction.customElement ? (
              leftAction.customElement
            ) : (
              <TouchableOpacity
                style={[s.iconButton, dark && s.darkButton]}
                onPress={() => handlePress(leftAction.onPress)}
                activeOpacity={0.7}
              >
                <Ionicons name={leftAction.icon} size={22} color={iconColor} />
              </TouchableOpacity>
            )
          ) : null}
        </View>

        {/* Title Section */}
        <View style={[s.titleSection, centerTitle ? s.centerTitle : s.leftTitle]}>
          <View style={s.titleRow}>
            {centerTitle === false && leftAction?.icon && !subtitleIcon ? (
              <Ionicons
                name={leftAction.icon}
                size={typeof titleStyle === 'object' && titleStyle && 'fontSize' in titleStyle && typeof titleStyle.fontSize === 'number' ? titleStyle.fontSize + 2 : 18}
                color={leftAction.iconColor || iconColor}
                style={{ marginRight: 8 }}
              />
            ) : null}
            <Text style={[s.title, { color: textColor }, titleStyle]} numberOfLines={1}>{title}</Text>
          </View>
          {subtitle && (
            <View style={s.subtitleRow}>
              {subtitleIcon && (
                <Ionicons
                  name={subtitleIcon.name}
                  size={subtitleIcon.size || 14}
                  color={subtitleIcon.color || Colors.textLight}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text style={[s.subtitle, dark ? { color: 'rgba(255,255,255,0.7)' } : {}, subtitleStyle]}>{subtitle}</Text>
            </View>
          )}
        </View>

        {/* Right Section */}
        <View style={s.rightSection}>
          {rightActions.map((action, index) => (
            action?.customElement ? (
              <View key={index} style={[s.customActionWrap, action.style]}>
                {action.customElement}
              </View>
            ) : (
              <TouchableOpacity
                key={index}
                style={[s.iconButton, dark && s.darkButton, action.style]}
                onPress={() => handlePress(action.onPress)}
                activeOpacity={0.7}
              >
                <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={action.size || 22} color={action.color || iconColor} />
                {action.badge === true && <View style={s.badge} />}
                {typeof action.badge === 'number' && action.badge > 0 && (
                  <View style={s.badgeCount}>
                    <Text style={s.badgeCountText} allowFontScaling={false}>
                      {action.badge > 99 ? '99+' : String(action.badge)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          ))}
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  headerContainer: {
    // paddingTop removed here, moved to inline style using insets
    paddingBottom: 12,
    zIndex: 1000,
  },
  border: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
  },
  leftSection: {
    minWidth: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
  },
  titleSection: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  centerTitle: {
    alignItems: 'center',
  },
  leftTitle: {
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.deepForest,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textLight,
    fontWeight: '600',
  },
  rightSection: {
    minWidth: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 16,
  },
  customActionWrap: {
    marginLeft: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.softWhite,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  darkButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primaryGreen,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  badgeCount: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeCountText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 12,
  },
});

export default Header;
