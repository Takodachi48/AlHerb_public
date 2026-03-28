import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
    position: 'relative',
  },

  // Full Screen Map
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  map: {
    flex: 1,
  },

  // Floating Header (Search)
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50, // High zIndex for search bar
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  // Search Container (Clean White)
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // Solid White
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },

  // Horizontal Filters
  filtersContainer: {
    maxHeight: 132,
    marginBottom: 0,
    gap: 6,
  },
  filtersContent: {
    paddingHorizontal: 20,
    paddingRight: 40,
    gap: 8,
    paddingBottom: 10,
  },
  radiusFiltersContent: {
    paddingBottom: 4,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 8,
  },
  radiusChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  radiusChipSelected: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  radiusChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  radiusChipTextSelected: {
    color: '#FFFFFF',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  filterChipSelected: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  filterTextSelected: {
    color: '#FFFFFF',
  },

  // Compass Floating (Clean White, Right Side)
  compassFloating: {
    position: 'absolute',
    // top/bottom set dynamically in component
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 12, // More square-ish
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },

  // Circular map controls: zoom + recenter
  mapControlsStack: {
    position: 'absolute',
    right: 12,
    zIndex: 45,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
      },
      android: {
        elevation: 9,
      },
    }),
  },
  mapControlCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 3,
  },
  mapControlPrimary: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#047857',
    borderWidth: 2,
    borderColor: '#A7F3D0',
  },
  mapControlDivider: {
    height: 1,
    backgroundColor: '#D1FAE5',
    marginHorizontal: 4,
    marginVertical: 4,
  },

  // Info Banner (Clean White)
  infoBannerOverlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#064E3B',
    fontWeight: '500',
  },

  // Horizontal Slider Setup
  bottomSliderContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
    zIndex: 20,
    // The paddingBottom is handled inline for SafeArea + TabBar height
  },
  sliderContent: {
    paddingHorizontal: 20, // More padding
    gap: 12,
    alignItems: 'center',
    paddingBottom: 10,
  },

  // Slider Card (Redigned - "Floating Card" style)
  sliderCard: {
    flexDirection: 'row',
    width: width * 0.8, // 80% screen width
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    alignItems: 'center',
    marginRight: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  sliderCardSelected: {
    borderColor: '#10B981',
    borderWidth: 1.5,
    transform: [{ scale: 1.02 }], // Subtle scale up
  },
  sliderImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  sliderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  sliderSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },

  // New Action Button
  sliderActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  // Empty State
  emptyStateContainer: {
    width: width - 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },

  // Loading Indicator
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  loadingText: {
    marginLeft: 8,
    color: '#10B981',
    fontWeight: '500',
    fontSize: 13,
  },
});
