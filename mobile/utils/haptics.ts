import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Utility for providing consistent haptic feedback across the app.
 * Automatically handles platform checks.
 */
const hapticUtils = {
    /**
     * Light tap - used for subtle feedback (e.g., selection change, scroll ticks)
     */
    light: (): void => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    },

    /**
     * Medium tap - used for standard interactions (e.g., button presses, toggles)
     */
    medium: (): void => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    },

    /**
     * Heavy tap - used for major interactions (e.g., capture, deletion)
     */
    heavy: (): void => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
    },

    /**
     * Success feedback - triple pulse or distinct success pattern
     */
    success: (): void => {
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    },

    /**
     * Error feedback - rapid pulses or distinct error pattern
     */
    error: (): void => {
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    },

    /**
     * Warning feedback
     */
    warning: (): void => {
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
    },

    /**
     * Selection feedback - specific to selection changes
     */
    selection: (): void => {
        if (Platform.OS !== 'web') {
            Haptics.selectionAsync();
        }
    }
};

export default hapticUtils;
