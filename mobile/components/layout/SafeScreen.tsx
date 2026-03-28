import React, { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
  type Edge,
} from 'react-native-safe-area-context';
import { TAB_BAR_CONTENT_HEIGHT } from '../../app/(tabs)/_layout';

type SafeScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  withKeyboardAvoidingView?: boolean;
  topBackgroundColor?: string;
  withTabBar?: boolean;
};

const DEFAULT_EDGES: Edge[] = ['top', 'left', 'right'];

export default function SafeScreen({
  children,
  style,
  edges = DEFAULT_EDGES,
  withKeyboardAvoidingView = false,
  topBackgroundColor = '#FFFFFF',
  withTabBar = true,
}: SafeScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = withTabBar === false ? 0 : withTabBar
    ? TAB_BAR_CONTENT_HEIGHT + insets.bottom
    : insets.bottom;

  const content = (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.container, style]}
    >
      <View style={[styles.container, { paddingBottom: bottomPadding }]}>
        {children}
      </View>
    </SafeAreaView>
  );

  const wrappedContent = withKeyboardAvoidingView ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
      style={styles.container}
    >
      {content}
    </KeyboardAvoidingView>
  ) : content;

  return (
    <View style={styles.container}>
      {edges.includes('top') && (
        <View style={{ height: insets.top, backgroundColor: topBackgroundColor }} />
      )}
      {wrappedContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});