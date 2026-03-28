import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

// Minimalist Commercial-Grade Palette
const Colors = {
  white: '#FFFFFF',
  softWhite: '#FAFAF8',
  deepForest: '#14532D',
  primaryGreen: '#10B981',
  sageGreen: '#D1E7DD',
  textMain: '#1F2937',
  textLight: '#6B7280',
  border: '#EAECF0',
  error: '#EF4444',
  inputBg: '#FFFFFF',
  disabledBg: '#F9FAFB',
};

// Precise 8pt grid metrics
const Metrics = {
  radius: 12,
  padding: 16,
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.softWhite,
  },

  // Header (Refined, Minimalist)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  backButton: {
    padding: 8,
    borderRadius: 8,
    marginLeft: -8, // Offset padding for optical alignment
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
    letterSpacing: -0.5,
  },

  saveButton: {
    backgroundColor: Colors.deepForest, // Commercial Grade Primary
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: Metrics.radius,
  },

  saveButtonDisabled: {
    backgroundColor: Colors.border,
  },

  saveButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },

  // Profile Picture Section
  profilePictureSection: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: Colors.white,
    marginTop: 24,
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },

  profilePictureContainer: {
    position: 'relative',
    marginBottom: 16,
  },

  profilePicture: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },

  profilePicturePlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },

  profilePictureText: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.textLight,
    letterSpacing: -1,
  },

  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.deepForest,
    borderRadius: 16,
    padding: 8,
    borderWidth: 2,
    borderColor: Colors.white,
  },

  changePictureText: {
    fontSize: 13,
    color: Colors.textLight,
    fontWeight: '600',
    marginTop: 8,
  },

  uploadingOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(20, 83, 45, 0.9)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  uploadProgressText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Sections
  section: {
    backgroundColor: Colors.white,
    padding: 24,
    borderRadius: Metrics.radius,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
    letterSpacing: -0.5,
  },

  locateMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  locateMeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.deepForest,
    marginLeft: 4,
  },

  // Input Groups
  inputGroup: {
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8, // Tighter radius for inputs
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.textMain,
    backgroundColor: Colors.inputBg,
    fontWeight: '500',
  },

  inputDisabled: {
    backgroundColor: Colors.disabledBg,
    color: Colors.textLight,
  },

  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },

  characterCount: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'right',
    marginTop: 6,
    fontWeight: '500',
  },

  // DatePicker Button (looks like input)
  datePickerBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.inputBg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  datePickerText: {
    fontSize: 15,
    color: Colors.textMain,
    fontWeight: '500',
  },

  datePickerPlaceholder: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  // Gender Options
  genderOptions: {
    flexDirection: 'row',
    gap: 12,
  },

  genderOption: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },

  genderOptionSelected: {
    backgroundColor: Colors.deepForest,
    borderColor: Colors.deepForest,
  },

  genderOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
  },

  genderOptionTextSelected: {
    color: Colors.white,
  },

  // Modal (Image Picker)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Slightly lighter overlay
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: Metrics.radius,
    padding: 24,
    width: width - 48,
    maxWidth: 320,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: -0.5,
  },

  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },

  modalOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMain,
    marginLeft: 16,
  },

  modalCancel: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
  },

  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMain,
    textAlign: 'center',
    marginLeft: 0,
    flex: 1,
  },
});
