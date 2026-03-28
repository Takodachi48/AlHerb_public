import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/EditProfileScreen.styles';
import Header from '../components/common/Header';
import { Colors } from '../styles/DesignSystem';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import apiClient from '../services/apiClient';
import { debugLog } from '../utils/logger';

export default function EditProfileScreen() {
  const { user, updateUser } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    dateOfBirth: '',
    gender: '',
    location: {
      city: '',
      province: '',
      region: '',
    },
    profile: {
      bio: '',
    },
  });
  const [originalData, setOriginalData] = useState({});
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState(null);

  useEffect(() => {
    if (user) {
      const userData = {
        displayName: user.displayName || '',
        email: user.email || '',
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
        gender: user.gender || '',
        location: {
          city: user.location?.city || '',
          province: user.location?.province || '',
          region: user.location?.region || '',
        },
        profile: {
          bio: user.profile?.bio || '',
        },
      };
      setFormData(userData);
      setOriginalData(userData);
    }
  }, [user]);

  const hasChanges = () => {
    return pendingImageUri !== null || JSON.stringify(formData) !== JSON.stringify(originalData);
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || (formData.dateOfBirth ? new Date(formData.dateOfBirth) : new Date());
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      handleInputChange('dateOfBirth', dateString);
    }
  };

  const handleLocateMe = async () => {
    setLocating(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      let reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      if (reverseGeocode && reverseGeocode.length > 0) {
        const place = reverseGeocode[0];
        setFormData(prev => ({
          ...prev,
          location: {
            ...prev.location,
            city: place.city || place.subregion || place.district || place.name || '',
            province: place.region || place.country || '',
            region: place.country || ''
          }
        }));
      } else {
        Alert.alert('Location Alert', 'Could not resolve address details. Please enter manually.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to fetch location. Make sure GPS is enabled.');
    } finally {
      setLocating(false);
    }
  };

  const requestImagePermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Sorry, we need camera roll permissions to make this work!'
      );
      return false;
    }
    return true;
  };

  const pickImage = async (source) => {
    const hasPermission = await requestImagePermission();
    if (!hasPermission) return;

    let result;
    if (source === 'camera') {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
    }

    if (!result.canceled && result.assets && result.assets[0]) {
      setPendingImageUri(result.assets[0].uri);
    }
    setShowImageOptions(false);
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      router.back();
      return;
    }

    setLoading(true);
    let uploadedPhotoUrl = null;
    
    // Show loading feedback
    debugLog('🔄 Starting profile update process...');

    try {
      // 1. Upload new image if chosen
      if (pendingImageUri) {
        debugLog('🖼️ Starting image upload process...');
        setUploadProgress(10); // Start progress
        
        const imageFormData = new FormData();
        imageFormData.append('avatar', {
          uri: pendingImageUri,
          type: 'image/jpeg',
          name: 'profile.jpg',
        });

        debugLog('🖼️ Upload URL:', apiClient.defaults.baseURL + '/images/avatar');
        setUploadProgress(25); // Form data prepared

        try {
          debugLog('📤 Uploading image to server...');
          setUploadProgress(50); // Upload started
          
          debugLog('📊 Image details:', {
            uri: pendingImageUri,
            size: 'will be determined by server',
            type: 'image/jpeg'
          });
          
          const imageResponse = await apiClient.post('/images/avatar', imageFormData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            timeout: 30000, // 30 second timeout for image upload
          });

          setUploadProgress(75); // Upload completed
          debugLog('✅ Upload response received:', imageResponse.data);

          if (imageResponse.data.success) {
            uploadedPhotoUrl = imageResponse.data.data.photoURL;
            setUploadProgress(100); // Upload successful
            debugLog('🎉 Image uploaded successfully! New URL:', uploadedPhotoUrl);
            
            // Check if it's a Cloudinary URL and log optimization info
            if (uploadedPhotoUrl.includes('cloudinary.com')) {
              debugLog('☁️ Cloudinary upload detected - image will be automatically optimized');
              debugLog('📐 Cloudinary transformations: auto-quality, auto-format, face detection');
            }
          } else {
            console.warn('⚠️ Upload response indicates failure:', imageResponse.data);
            throw new Error(imageResponse.data.message || 'Image upload failed');
          }
        } catch (imgError) {
          console.error('❌ Image Upload Error:', imgError);
          if (imgError.response) {
            console.error('📡 Server responded with error:', {
              status: imgError.response.status,
              data: imgError.response.data,
              headers: imgError.response.headers
            });
          } else if (imgError.request) {
            console.error('📡 No response received:', imgError.request);
          } else {
            console.error('💥 Error setting up request:', imgError.message);
          }
          throw imgError; // rethrow to be caught by the outer catch block
        }
      }

      // 2. Persist profile updates (only server-supported fields)
      const hasTextChanges = JSON.stringify(formData) !== JSON.stringify(originalData);
      const profilePayload = {};
      const displayName = String(formData.displayName || '').trim();
      const city = String(formData.location?.city || '').trim();
      const region = String(formData.location?.region || '').trim();
      const province = String(formData.location?.province || '').trim();

      if (displayName) {
        profilePayload.displayName = displayName;
      }

      if (formData.dateOfBirth) {
        profilePayload.dateOfBirth = formData.dateOfBirth;
      }

      if (formData.gender === 'male' || formData.gender === 'female') {
        profilePayload.gender = formData.gender;
      }

      if (city || region || province) {
        profilePayload.location = {};
        if (city) profilePayload.location.city = city;
        if (region) profilePayload.location.region = region;
        if (province) profilePayload.location.province = province;
      }

      if (uploadedPhotoUrl) {
        profilePayload.photoURL = uploadedPhotoUrl;
      }

      if (hasTextChanges || uploadedPhotoUrl) {
        debugLog('[profile] Starting profile text update...');
        const response = await apiClient.put('/users/profile', profilePayload);
        debugLog('[profile] Profile update response:', response.data);
        if (response.data.success) {
          await updateUser(response.data.data || profilePayload);
        }
      }

      Alert.alert('Success', 'Profile updated successfully!');
      router.back();
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to update profile'
      );
    } finally {
      setLoading(false);
      setUploadProgress(0); // Reset progress
    }
  };

  const initial =
    user?.displayName?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    'U';

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
        title="Edit Profile" 
        showBack={true}
        rightActions={[
          { 
            icon: 'checkmark-outline', 
            onPress: handleSave, 
            color: hasChanges() ? Colors.primaryGreen : Colors.gray,
            style: !hasChanges() ? { opacity: 0.5 } : {}
          }
        ]}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture Section */}
        <View style={styles.profilePictureSection}>
          <TouchableOpacity
            style={styles.profilePictureContainer}
            onPress={() => setShowImageOptions(true)}
            disabled={loading}
          >
            {pendingImageUri || user?.photoURL ? (
              <Image 
                source={{ uri: pendingImageUri || getOptimizedImageUrl(user.photoURL, 400) }} 
                style={styles.profilePicture}
                onError={(error) => {
                  debugLog('Profile image failed to load in edit mode');
                }}
              />
            ) : (
              <View style={styles.profilePicturePlaceholder}>
                <Text style={styles.profilePictureText}>{initial}</Text>
              </View>
            )}
            {!loading && (
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={20} color="#FFFFFF" />
              </View>
            )}
            {loading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                {uploadProgress > 0 && (
                  <Text style={styles.uploadProgressText}>{Math.round(uploadProgress)}%</Text>
                )}
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.changePictureText}>
            {loading ? 'Uploading...' : 'Tap to change photo'}
          </Text>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={formData.displayName}
              onChangeText={(value) => handleInputChange('displayName', value)}
              placeholder="Enter your name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={formData.email}
              editable={false}
              placeholder="Email cannot be changed"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={formData.dateOfBirth ? styles.datePickerText : styles.datePickerPlaceholder}>
                {formData.dateOfBirth || "YYYY-MM-DD"}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#1F2937" />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={formData.dateOfBirth ? new Date(formData.dateOfBirth) : new Date()}
                mode="date"
                display="default"
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderOptions}>
              {['male', 'female'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.genderOption,
                    formData.gender === option && styles.genderOptionSelected,
                  ]}
                  onPress={() => handleInputChange('gender', option)}
                >
                  <Text
                    style={[
                      styles.genderOptionText,
                      formData.gender === option && styles.genderOptionTextSelected,
                    ]}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Location Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Location</Text>
            <TouchableOpacity
              style={styles.locateMeBtn}
              onPress={handleLocateMe}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator size="small" color="#14532D" />
              ) : (
                <>
                  <Ionicons name="location-outline" size={14} color="#14532D" />
                  <Text style={styles.locateMeBtnText}>Locate Me</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={formData.location.city}
              onChangeText={(value) => handleInputChange('location.city', value)}
              placeholder="Enter your city"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Province/State</Text>
            <TextInput
              style={styles.input}
              value={formData.location.province}
              onChangeText={(value) => handleInputChange('location.province', value)}
              placeholder="Enter your province/state"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Region</Text>
            <TextInput
              style={styles.input}
              value={formData.location.region}
              onChangeText={(value) => handleInputChange('location.region', value)}
              placeholder="Enter your region"
            />
          </View>
        </View>

        {/* Bio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Me</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.profile.bio}
              onChangeText={(value) => handleInputChange('profile.bio', value)}
              placeholder="Tell us about yourself..."
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.characterCount}>
              {formData.profile.bio.length}/500
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Image Options Modal */}
      <Modal
        visible={showImageOptions}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowImageOptions(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Photo</Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => pickImage('camera')}
            >
              <Ionicons name="camera" size={24} color="#10B981" />
              <Text style={styles.modalOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => pickImage('library')}
            >
              <Ionicons name="images" size={24} color="#10B981" />
              <Text style={styles.modalOptionText}>Choose from Library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalOption, styles.modalCancel]}
              onPress={() => setShowImageOptions(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}




