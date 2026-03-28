import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Light gray background for the scroll view
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorSubText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Hero Section
  heroImage: {
    width: width,
    height: 400,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 24,
    paddingBottom: 50,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  headerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)', // iOS only
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  // Scientific Name on Image
  heroContent: {
    marginBottom: 30,
  },
  scientificName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontStyle: 'italic',
    marginBottom: 8,
    fontWeight: '600',
    backgroundColor: 'rgba(16, 185, 129, 0.9)', // Green accent background
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    overflow: 'hidden',
  },
  herbNameHero: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
    letterSpacing: -1,
    lineHeight: 48,
  },

  // Main Content Sheet
  contentSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: -40, // Deeper overlap
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },

  // Tags Row
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tagText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },

  // Section Styles
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: -0.5,
  },

  // Card Styles
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 0, // Remove padding to let content flow
    shadowColor: 'transparent', // Remove shadow for flatter look
    elevation: 0,
    marginBottom: 0,
  },

  // Benefits
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 16,
  },
  checkIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  benefitText: {
    fontSize: 16,
    color: '#065F46',
    lineHeight: 24,
    fontWeight: '500',
    flex: 1,
  },

  // Preparation
  prepCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  prepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  prepMethodTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 10,
    textTransform: 'capitalize',
  },
  prepInstructions: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 26,
  },
  prepRatio: {
    fontSize: 14,
    color: '#10B981',
    marginTop: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },

  // Safety Alerts
  alertBox: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  alertRed: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  alertYellow: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    color: '#374151',
  },
  textRed: { color: '#991B1B' },
  textYellow: { color: '#92400E' },

  // Phytochemicals
  chemChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 2,
  },
  chemCat: {
    fontSize: 11,
    color: '#6366F1',
  },
  chemRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // Bottom Action Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 20,
  },
  favButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  favButtonActive: {
    backgroundColor: '#FEE2E2',
  },
  findButton: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    height: 50,
  },
  findButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },

  // Research Section
  researchCard: {
    backgroundColor: '#F0F9FF', // Soft blue
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 12,
  },
  researchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  researchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0369A1',
    marginLeft: 10,
  },
  researchFinding: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  findingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0EA5E9',
    marginTop: 8,
    marginRight: 12,
  },
  findingText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    flex: 1,
  },
  researchDivider: {
    height: 1,
    backgroundColor: '#BAE6FD',
    marginVertical: 16,
    opacity: 0.5,
  },
  researchSourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  researchSourceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
  },
  studyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  studyLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0284C7',
    marginLeft: 8,
    flex: 1,
  },
  studySource: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginLeft: 32, // align with text
  },

  // Related Blogs Section
  blogItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  blogThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
  },
  blogInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  blogItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  blogItemExcerpt: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  blogItemMeta: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'center',
  },
  blogAuthorThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 6,
  },
  blogAuthorName: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
