import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAF8', // Slightly lighter and fresher
    paddingTop: 44,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAF8',
  },
  containerWithStickyAction: {
    paddingBottom: 120,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    paddingTop: 8, // Reduced from 14 to accommodate status bar
  },
  backArrow: {
    width: 40,
    height: 40,
    borderRadius: 14, // Slightly rounder
    backgroundColor: '#F0F7F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45, 138, 78, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2E1A',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },

  // ─── Progress Bar ───
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24, // More padding
    paddingHorizontal: 40,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
  },
  progressCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E4EAE4',
    marginBottom: 6,
  },
  progressCircleActive: {
    backgroundColor: '#2D8A4E',
    shadowColor: '#2D8A4E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  progressCircleDone: {
    backgroundColor: '#2D8A4E',
  },
  progressNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA89C',
  },
  progressNumberActive: {
    color: '#FFF',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA89C',
  },
  progressLabelActive: {
    color: '#2D8A4E',
  },
  progressLine: {
    height: 2,
    flex: 1,
    backgroundColor: '#E4EAE4',
    marginBottom: 18,
    marginHorizontal: -8,
  },
  progressLineDone: {
    backgroundColor: '#2D8A4E',
  },

  // ─── Sections ───
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A2E1A',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#7A8A7A',
    marginBottom: 24,
    lineHeight: 20,
  },
  subsection: {
    marginBottom: 28,
  },
  smallTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2E1A',
    marginBottom: 12,
  },
  modeSelectorWrap: {
    marginBottom: 16,
  },
  modeSelectorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5F705F',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  modeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modePill: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CFE7D5',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modePillActive: {
    backgroundColor: '#2D8A4E',
    borderColor: '#2D8A4E',
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D8A4E',
  },
  modePillTextActive: {
    color: '#FFF',
  },

  // ─── Symptom Cards ───
  symptomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  symptomCard: {
    flexBasis: '47%',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 14,
    minHeight: 100, // Slightly taller for better content distribution
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#2D8A4E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  symptomCardSelected: {
    backgroundColor: '#2D8A4E',
    borderColor: '#2D8A4E',
    shadowColor: '#2D8A4E',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  symptomIcon: {
    fontSize: 24,
    marginBottom: 10, // More breathing room
  },
  symptomCardText: {
    fontSize: 13,
    color: '#1A2E1A',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 18,
  },
  symptomCardTextSelected: {
    color: '#FFF',
  },
  symptomCategory: {
    fontSize: 10,
    color: '#9CA89C',
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  symptomCategorySelected: {
    color: 'rgba(255,255,255,0.7)',
  },

  // ─── Disease Search ───
  searchContainer: {
    marginBottom: 24,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E4EAE4',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 12,
  },
  newSearchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A2E1A',
    paddingVertical: 2,
  },
  clearButton: {
    marginLeft: 12,
    padding: 4,
  },
  symptomSearchMeta: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7C6E',
    fontWeight: '600',
  },
  symptomSearchEmpty: {
    backgroundColor: '#F4F8F4',
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#DCE8DD',
    alignItems: 'center',
    marginBottom: 14,
  },
  symptomSearchEmptyTitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#1A2E1A',
    fontWeight: '700',
  },
  symptomSearchEmptyText: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7C6E',
    textAlign: 'center',
    lineHeight: 18,
  },
  searchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  searchLoadingText: {
    fontSize: 13,
    color: '#7A8A7A',
    fontWeight: '500',
  },
  autocompleteResults: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4EAE4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    maxHeight: 240,
    zIndex: 20,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F0',
  },
  autocompleteItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  autocompleteItemMain: {
    flex: 1,
  },
  autocompleteItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2E1A',
    marginBottom: 2,
  },
  autocompleteItemCategory: {
    fontSize: 12,
    color: '#9CA89C',
    fontWeight: '500',
  },
  // ─── Popular Diseases ───
  popularSection: {
    marginBottom: 24,
  },
  popularTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2E1A',
    marginBottom: 16,
  },
  popularTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  popularCard: {
    flexBasis: '30%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    minHeight: 90,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  popularIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  popularName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A2E1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  popularCategory: {
    fontSize: 10,
    color: '#9CA89C',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ─── Selected Disease Display ───
  selectedDiseaseCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    shadowColor: '#2D8A4E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  selectedDiseaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedDiseaseIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#2D8A4E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#2D8A4E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedDiseaseIconText: {
    fontSize: 24,
  },
  selectedDiseaseInfo: {
    flex: 1,
  },
  selectedDiseaseLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  selectedDiseaseName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2D8A4E',
    marginBottom: 2,
  },
  selectedDiseaseCategory: {
    fontSize: 12,
    color: '#1B5E20',
    fontWeight: '500',
  },
  changeDiseaseButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D8A4E',
  },
  diseaseInfoSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#C8E6C9',
  },
  diseaseInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A2E1A',
    marginBottom: 8,
  },
  diseaseInfoText: {
    fontSize: 13,
    color: '#2D8A4E',
    lineHeight: 20,
    fontWeight: '500',
  },
  addSymptomButton: {
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2D8A4E',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  addSymptomButtonText: {
    color: '#2D8A4E',
    fontSize: 14,
    fontWeight: '700',
  },

  // ─── Option Buttons (Age / Gender) ───
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12, // Increased gap for better separation
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allow wrapping as fallback
    gap: 10,
  },
  optionButton: {
    flexBasis: '48%', // Default to 2-column grid
    backgroundColor: '#FFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1.5, // Slightly thinner for cleaner look
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2D8A4E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 100, // Balanced height
  },
  genderOption: {
    flexBasis: '48%', // 2-column for gender
  },
  pregnancyOption: {
    flexBasis: '48%',
    minHeight: 88,
  },
  profileInput: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E4EAE4',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A2E1A',
  },
  profileInputHelp: {
    marginTop: 8,
    fontSize: 12,
    color: '#7A8A7A',
    lineHeight: 17,
  },
  optionButtonLocked: {
    opacity: 0.7,
  },
  optionButtonSelected: {
    backgroundColor: '#2D8A4E',
    borderColor: '#2D8A4E',
    shadowColor: '#2D8A4E',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  optionIcon: {
    fontSize: 26, // Slightly larger icon
    marginBottom: 8,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A2E1A',
    textAlign: 'center',
    lineHeight: 16,
  },
  optionTextSelected: {
    color: '#FFF',
  },
  profileIncompleteCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  profileIncompleteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  profileIncompleteTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  profileIncompleteText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
    marginBottom: 10,
    fontWeight: '600',
  },
  profileIncompleteButton: {
    backgroundColor: '#D97706',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  profileIncompleteButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  profileLockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  profileLockedText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '700',
  },

  // ─── Action Buttons ───
  nextButton: {
    backgroundColor: '#2D8A4E',
    borderRadius: 18,
    height: 60, // Consistent height
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2D8A4E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  stickyActionBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5ECE6',
    shadowColor: '#1A2E1A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  stickyActionMeta: {
    flex: 1,
    paddingRight: 10,
  },
  stickyActionReviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  stickyActionCount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D8A4E',
  },
  stickyActionHint: {
    fontSize: 11,
    color: '#6C7E6F',
  },
  stickyContinueButton: {
    minWidth: 132,
    backgroundColor: '#2D8A4E',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stickyContinueButtonDisabled: {
    backgroundColor: '#A8B5AC',
  },
  stickyContinueButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  backButtonWide: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 18,
    height: 56,
    borderWidth: 2,
    borderColor: '#E4EAE4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonWideText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2E1A',
  },
  recommendButton: {
    flex: 2,
    backgroundColor: '#2D8A4E',
    borderRadius: 18,
    height: 56, // Fixed height for alignment with back button
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2D8A4E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  recommendButtonDisabled: {
    opacity: 0.4,
  },
  recommendButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },

  // ─── Results ───
  resultHeaderCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  resultHeaderTop: {
    marginBottom: 14,
  },
  resultTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2E1A',
  },
  resultTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultCountBadge: {
    backgroundColor: '#2D8A4E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  resultCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#2D8A4E',
    fontWeight: '600',
  },
  resultBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B5E20',
  },
  modeBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1565C0',
  },

  // ─── Results Summary ───
  resultsSummaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2E1A',
    marginBottom: 16,
  },
  summaryTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  pipelineInfoCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DCEFE2',
  },
  pipelineInfoText: {
    fontSize: 12,
    color: '#1A2E1A',
    fontWeight: '700',
  },
  pipelineWarningText: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 6,
    lineHeight: 17,
    fontWeight: '600',
  },
  partialResultsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  partialResultsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  partialResultsTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D9488',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  partialResultsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  partialChipMatched: {
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  partialChipMatchedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D8A4E',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#7A8A7A',
    fontWeight: '600',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E4EAE4',
  },

  // ─── Herb Results Card ───
  herbCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#1A2E1A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  herbHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', // Center for better icon/text alignment
    marginBottom: 16,
  },
  herbNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  herbIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  herbIconText: {
    fontSize: 22,
  },
  herbName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2E1A',
    lineHeight: 22,
    flexShrink: 1,
  },
  herbScientific: {
    fontSize: 13,
    color: '#7A8A7A',
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 16,
    flexShrink: 1,
  },
  herbRankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2D8A4E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2D8A4E',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  herbRankText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFF',
  },

  // ─── Enhanced Effectiveness Bar ───
  effectivenessContainer: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  effectivenessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  effectivenessScore: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  effectivenessRatingLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  propertyTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  propertyTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7E6F',
    letterSpacing: 1,
    backgroundColor: '#F0F4F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  effectivenessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  effectivenessLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7E6F',
    letterSpacing: 1,
  },
  effectivenessTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F0F4F0',
    overflow: 'hidden',
  },
  effectivenessFill: {
    height: '100%',
    borderRadius: 4,
  },
  effectivenessValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A2E1A',
  },
  effectivenessRating: {
    fontSize: 12,
    color: '#7A8A7A',
    fontWeight: '600',
  },

  // ─── Herb Details ───
  herbDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
    marginTop: 20,
  },
  detailBox: {
    minWidth: '45%',
    flexGrow: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  detailBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7A8A7A',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailBoxValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A2E1A',
    lineHeight: 18,
  },

  // ─── Matched Symptoms ───
  matchedSymptomsContainer: {
    marginTop: 4,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  matchedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  matchedSymptomsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D8A4E',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  matchedSymptomsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  matchedTag: {
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  matchedTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D8A4E',
  },

  // ─── Action Links ───
  actionLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F0',
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  actionLinkDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E4EAE4',
  },
  actionLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A2E1A',
  },
  // ─── Scientific Evidence ───
  evidenceContainer: {
    marginTop: 12,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F0F9FF', // Soft medical blue
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D0E8FF',
  },
  evidenceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  evidenceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1', // Primary blue
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  evidenceNotes: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '500',
  },
  evidenceLink: {
    color: '#0EA5E9',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  evidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  evidenceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  safetyContainer: {
    marginTop: 8,
    marginBottom: 20,
    padding: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  safetyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  safetyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  safetyItemText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
    marginBottom: 4,
    fontWeight: '500',
  },
  statusCardBlocked: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
  },
  statusText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
    fontWeight: '500',
  },
  statusList: {
    marginTop: 8,
  },
  statusListItem: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
    marginBottom: 2,
  },
  // ─── No Results / Empty ───
  noResultsCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  noResultsIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  noResultsText: {
    fontSize: 16,
    color: '#7A8A7A',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  noResultsSubtext: {
    fontSize: 13,
    color: '#9CA89C',
    textAlign: 'center',
  },

  // ─── Disclaimer ───
  disclaimerCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginTop: 20,
    marginBottom: 16,
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  disclaimerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  disclaimerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9A3412',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#9A3412',
    lineHeight: 19,
    fontWeight: '600',
  },

  // ─── Search Transition Buttons ───
  newSearchButton: {
    backgroundColor: '#2D8A4E',
    borderRadius: 16,
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2D8A4E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  newSearchButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    width: '100%',
  },
  newSearchIcon: {
    marginRight: 8,
  },

  // ─── Loading / Error ───
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  loadingText: {
    fontSize: 16,
    color: '#1A2E1A',
    marginTop: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 13,
    color: '#7A8A7A',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 15,
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#2D8A4E',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // ─── Modals ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2E1A',
    marginBottom: 16,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E4EAE4',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    color: '#1A2E1A',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#F0F4F0',
  },
  addButton: {
    backgroundColor: '#2D8A4E',
  },
  cancelButtonText: {
    color: '#1A2E1A',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedSymptomsModalCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    width: '92%',
    maxWidth: 420,
    maxHeight: '76%',
  },
  selectedSymptomsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  selectedSymptomsModalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1A2E1A',
  },
  closeModalButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F4F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedSymptomsModalSubtitle: {
    fontSize: 13,
    color: '#6B7B6D',
    marginBottom: 14,
  },
  selectedSymptomsList: {
    maxHeight: 320,
  },
  selectedSymptomsEmptyText: {
    fontSize: 13,
    color: '#7A8A7A',
    textAlign: 'center',
    paddingVertical: 24,
  },
  selectedSymptomsListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2EE',
  },
  selectedSymptomsListText: {
    flex: 1,
    fontSize: 14,
    color: '#1A2E1A',
    fontWeight: '600',
    paddingRight: 8,
  },
  selectedSymptomsRemoveButton: {
    padding: 2,
  },
  selectedSymptomsModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  clearSelectedButton: {
    flex: 1,
    backgroundColor: '#F4F7F4',
    borderRadius: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearSelectedButtonDisabled: {
    opacity: 0.45,
  },
  clearSelectedButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#324433',
  },
  doneSelectedButton: {
    flex: 1,
    backgroundColor: '#2D8A4E',
    borderRadius: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneSelectedButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },

  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCardOverlay: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    paddingHorizontal: 48,
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ─── View Mode Toggle ───
styles.viewModeToggle = {
  flexDirection: 'row',
  backgroundColor: '#EEF8F1',
  borderRadius: 12,
  padding: 4,
  marginBottom: 16,
  alignSelf: 'center',
};
styles.viewModeBtn = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 8,
  paddingHorizontal: 16,
  borderRadius: 10,
  gap: 6,
};
styles.viewModeBtnActive = {
  backgroundColor: '#10B981',
  shadowColor: '#10B981',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 2,
};
styles.viewModeText = {
  fontSize: 13,
  fontWeight: '700',
  color: '#10B981',
};
styles.viewModeTextActive = {
  color: '#FFFFFF',
};

// ─── Active Category Header ───
styles.activeCategoryHeader = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
  paddingHorizontal: 4,
};
styles.activeCategoryTitle = {
  fontSize: 14,
  fontWeight: '800',
  color: '#1A2E1A',
};
styles.clearFilterText = {
  fontSize: 13,
  fontWeight: '700',
  color: '#10B981',
};

// ─── Inline Profile Fix Styles ───
styles.inlineFixContainer = {
  marginTop: 15,
  gap: 15,
};
styles.inlineInputGroup = {
  gap: 8,
};
styles.categoryScroll = {
  marginBottom: 20,
};

styles.categoryScrollContent = {
  paddingHorizontal: 20,
  gap: 12,
  paddingBottom: 5, // For shadow
};

styles.categoryCard = {
  width: 100,
  height: 100,
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  padding: 12,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1,
  borderColor: '#E5E7EB',
  // Subtle shadow
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
};

styles.categoryCardActive = {
  backgroundColor: '#ECFDF5',
  borderColor: '#2D8A4E',
  borderWidth: 2,
  elevation: 4,
  shadowOpacity: 0.1,
};

styles.categoryIconWrap = {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: '#F3F4F6',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 8,
};

styles.categoryIconWrapActive = {
  backgroundColor: '#2D8A4E',
};

styles.categoryCardLabel = {
  fontSize: 11,
  fontWeight: '700',
  color: '#4B5563',
  textAlign: 'center',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

styles.categoryCardLabelActive = {
  color: '#065F46',
};
styles.inlineDateBtn = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#F9FAFB',
  borderWidth: 1.5,
  borderColor: '#E5E7EB',
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 12,
};
styles.inlineDateText = {
  fontSize: 15,
  fontWeight: '600',
  color: '#1F2937',
};
styles.inlineDatePlaceholder = {
  fontSize: 15,
  color: '#9CA3AF',
};
styles.inlineGenderRow = {
  flexDirection: 'row',
  gap: 10,
};
styles.inlineGenderBtn = {
  flex: 1,
  backgroundColor: '#F9FAFB',
  borderWidth: 1.5,
  borderColor: '#E5E7EB',
  borderRadius: 12,
  paddingVertical: 12,
  alignItems: 'center',
};
styles.inlineGenderBtnActive = {
  backgroundColor: '#E8F5E9',
  borderColor: '#10B981',
};
styles.inlineGenderText = {
  fontSize: 14,
  fontWeight: '600',
  color: '#6B7280',
};
styles.inlineGenderTextActive = {
  color: '#10B981',
};
styles.inlineSaveBtn = {
  backgroundColor: '#10B981',
  borderRadius: 14,
  height: 52,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 5,
  shadowColor: '#10B981',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.2,
  shadowRadius: 8,
  elevation: 4,
};
styles.inlineSaveBtnDisabled = {
  backgroundColor: '#D1D5DB',
  shadowOpacity: 0,
  elevation: 0,
};
styles.inlineSaveBtnText = {
  fontSize: 15,
  fontWeight: '800',
  color: '#FFFFFF',
};

// ─── Advanced Section styles ───
styles.advancedToggle = {
  backgroundColor: '#FFF',
  borderRadius: 18,
  padding: 16,
  marginBottom: 24,
  borderWidth: 1.5,
  borderColor: '#DCE8DD',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  shadowColor: '#2D8A4E',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 5,
  elevation: 2,
};
styles.advancedToggleContent = {
  flex: 1,
};
styles.advancedToggleTitle = {
  fontSize: 15,
  fontWeight: '700',
  color: '#1A2E1A',
  marginBottom: 2,
};
styles.advancedToggleSummary = {
  fontSize: 12,
  color: '#6B7C6E',
  fontWeight: '600',
};
styles.advancedSection = {
  marginTop: -8,
  marginBottom: 16,
  paddingTop: 8,
};
