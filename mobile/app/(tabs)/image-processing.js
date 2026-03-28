import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useCameraPermissions,
  CameraView
} from 'expo-camera';
import { BlurView } from 'expo-blur';
import Header from '../../components/common/Header';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing as ReanimatedEasing,
  cancelAnimation
} from 'react-native-reanimated';
import apiClient from '../../services/apiClient';
import { identificationService } from '../../services/apiServices';
import { styles, COLORS } from '../../styles/ImageProcessingScreen.styles';
import hapticUtils from '../../utils/haptics';
import { debugLog } from '../../utils/logger';

export default function ImageProcessingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  // State
  const [isFocused, setIsFocused] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [scanError, setScanError] = useState(null); // { type: 'network'|'timeout'|'failed', message: string }
  const [flashMode, setFlashMode] = useState('off'); // 'off', 'on', 'auto'
  const [facing, setFacing] = useState('back');

  // Details Sheet
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);

  // AI Assistant (Groq)
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [userQuestion, setUserQuestion] = useState('');
  const chatSessionRef = useRef(Date.now().toString());

  // History
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Comparison View
  const [viewMode, setViewMode] = useState('photo'); // 'photo' or 'illustration'

  // Feedback State
  const [feedbackChoice, setFeedbackChoice] = useState(null);
  const [userCorrection, setUserCorrection] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalizeIdentificationToResult = (result) => {
    const classification = result?.classification;
    if (!result || !classification) return null;
    const herbId = classification?.herbId?._id || classification?.herbId || null;

    return {
      id: result?._id || Date.now().toString(),
      herbId,
      name: classification?.commonName || classification?.scientificName || 'Identified Plant',
      commonName: classification?.commonName || '',
      scientificName: classification?.scientificName || 'Unknown Species',
      confidence: Number(classification?.confidence || 0) > 1
        ? Number(classification.confidence) / 100
        : Number(classification?.confidence || 0),
      description: classification?.description || 'Classification complete. Full medicinal context may require a follow-up query.',
      uses: classification?.symptoms || [],
      warnings: [],
      lookAlikes: [],
      illustrationUrl: classification?.illustrationUrl || null,
    };
  };

  const waitForClassification = async (identificationId, maxAttempts = 12, intervalMs = 2500) => {
    let lastRecord = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const statusResponse = await apiClient.get(`/images/plant-identification/${identificationId}`);
      const latest = statusResponse?.data?.data?.identification;
      lastRecord = latest;
      const status = String(latest?.status || '').toLowerCase();

      if (status === 'classified' || status === 'verified') {
        return { record: latest, timedOut: false };
      }
      if (status === 'uncertain') {
        return { record: latest, timedOut: false, uncertain: true };
      }

      if (status === 'rejected') {
        throw new Error('Classification was rejected by the server');
      }

      const notes = String(latest?.notes || '');
      if (notes.toLowerCase().includes('classification failed')) {
        throw new Error(notes);
      }

      if (attempt < maxAttempts) {
        await delay(intervalMs);
      }
    }

    return { record: lastRecord, timedOut: true };
  };

  // Animations
  const scanPos = useSharedValue(0);
  const guidePulse = useSharedValue(1);
  const buttonPulse = useSharedValue(1);

  const scanAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanPos.value * 220 }]
  }));

  const guideAnimatedStyle = useAnimatedStyle(() => ({
    opacity: guidePulse.value,
    transform: [{ scale: 0.95 + guidePulse.value * 0.05 }]
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonPulse.value }]
  }));

  // Track focus to enable/disable camera
  useFocusEffect(
    React.useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  // Initial permission request & load history
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
    loadHistory();
  }, [permission, requestPermission]);

  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem('@scan_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  const saveToHistory = async (newResult) => {
    try {
      const historyItem = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        imageUri: selectedImage.uri,
        herb: newResult,
      };

      const updatedHistory = [historyItem, ...history.slice(0, 49)]; // Keep last 50
      setHistory(updatedHistory);
      await AsyncStorage.setItem('@scan_history', JSON.stringify(updatedHistory));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem('@scan_history');
      setHistory([]);
      Alert.alert('History Cleared', 'All previous scans have been removed.');
    } catch (_e) {
      Alert.alert('Error', 'Failed to clear history.');
    }
  };

  // Scan Animation Loop
  useEffect(() => {
    if (analyzing) {
      // Smooth scanning line movement
      scanPos.value = withRepeat(
        withTiming(1, { duration: 1800, easing: ReanimatedEasing.bezier(0.45, 0.05, 0.55, 0.95) }),
        -1,
        true // Restore smooth bounce for the beam
      );

      // Pulse guide corners
      guidePulse.value = withRepeat(
        withTiming(0.6, { duration: 800, easing: ReanimatedEasing.inOut(ReanimatedEasing.quad) }),
        -1,
        true
      );
    } else {
      cancelAnimation(scanPos);
      cancelAnimation(guidePulse);
      scanPos.value = 0;
      guidePulse.value = 1;
    }
  }, [analyzing, scanPos, guidePulse]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery access is required to upload photos.');
      return;
    }

    try {
      setIsPickerOpen(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled) {
        const image = result.assets[0];
        setSelectedImage(image);
        setResults(null);
      }
    } catch (_e) {
      Alert.alert('Error', 'Failed to pick an image.');
    } finally {
      setIsPickerOpen(false);
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      hapticUtils.medium();
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
      });
      setSelectedImage(photo);
      setResults(null);
    } catch (_e) {
      Alert.alert('Error', 'Failed to capture photo.');
    }
  };

  const analyzeImage = async (imageToAnalyze = selectedImage) => {
    if (!imageToAnalyze || analyzing) return;

    hapticUtils.heavy();
    setAnalyzing(true);
    setResults(null);
    setScanError(null);

    try {
      const formData = new FormData();
      formData.append('image', {
        uri: imageToAnalyze.uri,
        name: imageToAnalyze.fileName || 'photo.jpg',
        type: imageToAnalyze.mimeType || 'image/jpeg',
      });

      debugLog('📤 Sending image for analysis...');

      const response = await apiClient.post('/images/plant-identification', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000,
      });

      debugLog('✅ Analysis complete:', response.data);
      const initialRecord = response?.data?.data?.identification;

      if (!initialRecord?._id) {
        throw new Error('Invalid response structure');
      }

      const initialStatus = String(initialRecord?.status || '').toLowerCase();
      let pollResult = null;

      if (initialStatus === 'pending') {
        pollResult = await waitForClassification(initialRecord._id);
      } else {
        pollResult = { record: initialRecord, timedOut: false };
      }

      // Handle timeout gracefully
      if (pollResult?.timedOut) {
        hapticUtils.error();
        setScanError({
          type: 'timeout',
          message: 'The server is still working on your scan. Please wait a moment and try again.',
        });
        return;
      }

      const finalRecord = pollResult?.record;
      const newResult = normalizeIdentificationToResult(finalRecord);

      if (newResult) {
        hapticUtils.success();
        newResult.isUncertain = pollResult?.uncertain === true;
        setResults([{ herb: newResult }]);
        saveToHistory(newResult);
      } else {
        setScanError({
          type: 'failed',
          message: 'Could not identify the plant. Try a clearer photo with good lighting, focusing on a single leaf.',
        });
      }
    } catch (e) {
      console.error('❌ Analysis failed:', e);
      hapticUtils.error();

      const msg = String(e?.message || '');
      if (!e?.response && (e?.code === 'ECONNABORTED' || e?.code === 'ERR_NETWORK' || msg.includes('Network'))) {
        setScanError({
          type: 'network',
          message: 'Network error. Please check your internet connection and try again.',
        });
      } else if (msg.toLowerCase().includes('classification failed') || msg.toLowerCase().includes('rejected')) {
        setScanError({
          type: 'failed',
          message: 'Our AI could not confidently identify this plant. Try a clearer photo or search the herb library manually.',
        });
      } else {
        setScanError({
          type: 'failed',
          message: 'Something went wrong during analysis. Please try again.',
        });
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const retake = () => {
    setSelectedImage(null);
    setResults(null);
    setScanError(null);
  };

  const openDetails = (result) => {
    setSelectedResult(result);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedResult(null);
    setAiResponse(null);
    setAiLoading(false);
    setUserQuestion('');
    setViewMode('photo');
    setFeedbackChoice(null);
    setUserCorrection('');
    setFeedbackRating(5);
    setFeedbackSubmitted(false);
  };

  const handleSubmitFeedback = async () => {
    if (!selectedResult || feedbackChoice === null) return;

    try {
      setSubmittingFeedback(true);
      await identificationService.submitFeedback(
        selectedResult.herb.id,
        feedbackChoice,
        feedbackRating,
        !feedbackChoice ? userCorrection : undefined
      );
      setFeedbackSubmitted(true);
      hapticUtils.success();
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const askAI = async () => {
    if (!selectedResult || aiLoading) return;

    setAiLoading(true);
    try {
      const herbName = selectedResult.herb.name;
      const prompt = userQuestion.trim()
        ? `Regarding the identified plant ${herbName}: ${userQuestion}. (Please provide a plain text response without markdown bolding or asterisks).`
        : `I just scanned a plant and it was identified as ${herbName}. Can you give me some personalized advice on how to use it safely, its traditional benefits in the Philippines, and any important precautions? Keep it concise and formatted for a mobile screen. Do not use markdown formatting like asterisks for bolding.`;

      const response = await apiClient.post('/chat/send', {
        message: prompt,
        sessionId: chatSessionRef.current,
      });

      if (response.data) {
        const reply = response?.data?.reply || '';
        const cleanContent = reply.replace(/\*\*/g, '');
        setAiResponse(cleanContent);
      }
    } catch (e) {
      console.error('AI Assistant Error:', e);
      Alert.alert('AI Unavailable', 'The AI assistant is currently busy. Please try again later.');
    } finally {
      setAiLoading(false);
    }
  };

  const toggleFlash = () => {
    setFlashMode(current => current === 'off' ? 'on' : 'off');
  };

  const toggleCameraFacing = () => {
    setFacing(current => current === 'back' ? 'front' : 'back');
  };

  if (!selectedImage) {
    if (!permission) {
      return (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={[styles.container, styles.center, { padding: 20 }]}>
          <Ionicons name="camera-outline" size={64} color="#9CA3AF" />
          <Text style={{ marginTop: 24, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' }}>
            Camera Access Required
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 32 }}>
            We need your permission to identify plants using your camera.
          </Text>
          <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
            <Text style={styles.permBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }
  }

  return (
    <View style={!selectedImage ? styles.container : styles.resultsContainer}>
      <StatusBar
        style={isPickerOpen ? "dark" : (!selectedImage ? "light" : "dark")}
        backgroundColor={isPickerOpen ? "#FFFFFF" : "transparent"}
        translucent={!isPickerOpen}
      />

      {!selectedImage ? (
        <View style={styles.cameraFill}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flashMode}
            onCameraReady={() => debugLog('CAMERA', 'Ready')}
            enableTorch={flashMode === 'on'}
          />

          {/* Camera UI Overlays - Hidden during picking to avoid gray flash/stack */}
          {!isPickerOpen && (
            <>
              {/* Top Overlay */}
              <BlurView intensity={30} tint="dark" style={[styles.overlayTop, { paddingTop: insets.top + 10 }]}>
                <View style={styles.topBarContent}>
                  <TouchableOpacity onPress={toggleFlash} style={styles.iconBtn}>
                    <Ionicons
                      name={flashMode === 'on' ? 'flash' : 'flash-off'}
                      size={24}
                      color="#FFF"
                    />
                  </TouchableOpacity>

                  <Text style={styles.overlayTitle}>Plant Scan</Text>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity onPress={toggleCameraFacing} style={styles.iconBtn}>
                      <Ionicons name="camera-reverse-outline" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </BlurView>

              {/* Camera Frame Guide with AI Brackets */}
              <View style={styles.frameContainer}>
                <Animated.View style={[styles.guideContainer, guideAnimatedStyle]}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </Animated.View>
              </View>

              {/* Bottom Controls */}
              <BlurView intensity={0} style={[styles.overlayBottom, { paddingBottom: insets.bottom + 100 }]}>
                {/* Upload Button */}
                <TouchableOpacity onPress={pickImage} style={styles.sideBtn}>
                  <View style={styles.sideBtnCircle}>
                    <Ionicons name="images-outline" size={24} color="#FFF" />
                  </View>
                  <Text style={styles.sideBtnText}>Upload</Text>
                </TouchableOpacity>

                {/* Shutter Button */}
                <TouchableOpacity onPress={capturePhoto} style={styles.shutterOuter}>
                  <View style={styles.shutterInner} />
                </TouchableOpacity>

                {/* Tips/Info Button */}
                <TouchableOpacity
                  onPress={() => Alert.alert('Tips', 'Ensure good lighting and focus on the leaf.')}
                  style={styles.sideBtn}
                >
                  <View style={styles.sideBtnCircle}>
                    <Ionicons name="information-circle-outline" size={24} color="#FFF" />
                  </View>
                  <Text style={styles.sideBtnText}>Tips</Text>
                </TouchableOpacity>
              </BlurView>
            </>
          )}
        </View>
      ) : (
        /* â”€â”€ Preview & Results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        <>
          {/* Header */}
          <Header
            title="Plant Scan"
            showBack={true}
            onBack={retake}
            backgroundColor={COLORS.white}
            border={false}
          />

          <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={!analyzing}>
            {/* Image Card */}
            <View style={styles.imageCard}>
              <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />

              {/* Scanning Animation Overlay */}
              {analyzing && (
                <View style={styles.scanningOverlay}>
                  <Animated.View style={[styles.scanningLine, scanAnimatedStyle]}>
                    <LinearGradient
                      colors={['transparent', 'rgba(16, 185, 129, 0.4)', 'rgba(16, 185, 129, 0.4)', 'transparent']}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                    />
                    {/* Centered green line */}
                    <View style={styles.scanningLineCenter} />
                  </Animated.View>
                </View>
              )}

              <View style={styles.imageActions}>
                <TouchableOpacity onPress={retake} style={styles.retakeBtn} disabled={analyzing}>
                  <Ionicons name="refresh" size={16} color={analyzing ? "#9CA3AF" : "#4B5563"} />
                  <Text style={[styles.retakeText, analyzing && { color: "#9CA3AF" }]}>Retake</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Status Section */}
            {!results && (
              <View style={styles.analyzeSection}>
                <Text style={styles.instructTitle}>
                  {analyzing ? 'Analyzing Image...' : 'Ready to identify?'}
                </Text>
                <Text style={styles.instructText}>
                  {analyzing
                    ? 'Our AI is currently examining the botanical features and patterns to find a match.'
                    : 'Our AI will analyze the botanical structure to suggest potential herbal matches.'
                  }
                </Text>

                {analyzing ? (
                  <View style={[styles.analyzeButton, styles.analyzeDisabled]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <ActivityIndicator color="#FFF" size="small" />
                      <Text style={styles.analyzeBtnText}>Analyzing Image...</Text>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.analyzeButton}
                    onPress={() => analyzeImage()}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="sparkles" size={20} color="#FFF" />
                      <Text style={styles.analyzeBtnText}>Identify Plant</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Scan Error Card */}
            {scanError && !results && (
              <View style={[styles.analyzeSection, { backgroundColor: scanError.type === 'network' ? '#FFF7ED' : '#FEF2F2', borderWidth: 1, borderColor: scanError.type === 'network' ? '#FED7AA' : '#FECACA', borderRadius: 16, marginHorizontal: 16, marginTop: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ionicons name={scanError.type === 'network' ? 'wifi-outline' : scanError.type === 'timeout' ? 'time-outline' : 'alert-circle-outline'} size={22} color={scanError.type === 'network' ? '#EA580C' : '#DC2626'} />
                  <Text style={{ fontWeight: '700', fontSize: 15, color: scanError.type === 'network' ? '#9A3412' : '#991B1B' }}>
                    {scanError.type === 'network' ? 'Connection Issue' : scanError.type === 'timeout' ? 'Still Processing' : 'Could Not Identify'}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 16 }}>{scanError.message}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => analyzeImage()} style={[styles.analyzeButton, { flex: 1, paddingVertical: 10, marginTop: 0, backgroundColor: scanError.type === 'network' ? '#EA580C' : COLORS.emerald }]}>
                    <Ionicons name="refresh" size={16} color="#FFF" />
                    <Text style={[styles.analyzeBtnText, { fontSize: 14 }]}>Try Again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setScanError(null); retake(); }} style={[styles.analyzeButton, { flex: 1, paddingVertical: 10, marginTop: 0, backgroundColor: '#F3F4F6' }]}>
                    <Ionicons name="camera-outline" size={16} color="#374151" />
                    <Text style={[styles.analyzeBtnText, { fontSize: 14, color: '#374151' }]}>Retake Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Results List */}
            {results && (
              <View style={styles.resultsSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Text style={[styles.resultsHeaderTitle, { marginBottom: 0 }]}>Match Breakdown</Text>
                  <View style={[styles.aiBadge, { backgroundColor: '#F3F4F6', marginBottom: 0 }]}>
                    <Text style={[styles.aiBadgeText, { color: '#6B7280' }]}>{results.length} SUGGESTIONS</Text>
                  </View>
                </View>

                {results.map((r, i) => (
                  <Animated.View key={i} entering={FadeInDown.delay(i * 100).springify()}>
                    {/* Uncertain warning banner */}
                    {r.herb.isUncertain && i === 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                        <Ionicons name="warning-outline" size={18} color="#D97706" style={{ marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', fontSize: 13, color: '#92400E' }}>Low Confidence Result</Text>
                          <Text style={{ fontSize: 12, color: '#78350F', lineHeight: 18, marginTop: 2 }}>The AI identified this plant with low confidence. Verify manually before use.</Text>
                        </View>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.resultCard, { borderColor: r.herb.isUncertain ? '#FDE68A' : (i === 0 ? '#10B981' : '#E5E7EB'), borderWidth: i === 0 ? 2 : 1 }]}
                      onPress={() => openDetails(r)}
                      activeOpacity={0.9}
                    >
                      <View style={styles.resultHeader}>
                        <View style={[styles.confidenceBadge, { backgroundColor: i === 0 ? '#ECFDF5' : '#F3F4F6' }]}>
                          <Text style={[styles.confidenceText, { color: i === 0 ? '#059669' : '#6B7280' }]}>
                            {(r.herb.confidence * 100).toFixed(0)}% Accuracy
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                      </View>

                      <Text style={styles.plantName}>{r.herb.commonName || r.herb.name}</Text>
                      <Text style={styles.scientificName}>{r.herb.scientificName}</Text>

                      <Text style={styles.descText} numberOfLines={2}>
                        {r.herb.description}
                      </Text>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      )}

      {/* Details Modal */}
      <Modal visible={detailsOpen} transparent animationType="slide" onRequestClose={closeDetails}>
        <Pressable style={styles.modalBackdrop} onPress={closeDetails} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Plant Analysis</Text>
            <TouchableOpacity onPress={closeDetails} style={styles.closeModalBtn}>
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
            {selectedResult && (
              <>
                <View style={[styles.modalMainHeader, { paddingHorizontal: 20 }]}>
                  <Text style={styles.modalPlantName}>
                    {selectedResult.herb.commonName || selectedResult.herb.name}
                  </Text>
                  <Text style={styles.modalSciName}>
                    {selectedResult.herb.scientificName}
                    {selectedResult.herb.commonName ? ` • ${selectedResult.herb.name}` : ''}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <View style={styles.modalConfidenceBadge}>
                      <Ionicons name="shield-checkmark" size={14} color="#059669" />
                      <Text style={styles.modalConfidenceText}>
                        {(selectedResult.herb.confidence * 100).toFixed(0)}% ACCURACY
                      </Text>
                    </View>
                    <View style={[styles.modalConfidenceBadge, { backgroundColor: '#F3F4F6' }]}>
                      <Ionicons name="leaf-outline" size={14} color="#64748B" />
                      <Text style={[styles.modalConfidenceText, { color: '#64748B' }]}>VERIFIED SPECIES</Text>
                    </View>
                  </View>
                </View>

                {/* About the Species and Health Applications - Moved up per user request */}
                <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
                  <Text style={styles.sectionHead}>Description</Text>
                  <Text style={styles.sectionBody}>{selectedResult.herb.description}</Text>

                  <Text style={styles.sectionHead}>Medicinal Uses</Text>
                  <View style={styles.tagsRow}>
                    {selectedResult.herb.uses?.map((u, i) => (
                      <View key={i} style={[styles.tag, { backgroundColor: '#F1F5F9', borderRadius: 20, paddingHorizontal: 16 }]}>
                        <Text style={[styles.tagText, { fontWeight: '700', color: COLORS.textMain, fontSize: 12 }]}>{u.toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={[styles.modalActions, { marginTop: 10, marginBottom: 20 }]}>
                    <TouchableOpacity
                      style={[styles.actionBtnPrimary, { backgroundColor: COLORS.forestDark }]}
                      onPress={() => {
                        closeDetails();
                        const herbId = selectedResult?.herb?.herbId;
                        if (herbId) {
                          router.push(`/herbs/${herbId}`);
                        } else {
                          router.push({
                            pathname: '/(tabs)/herbs',
                            params: { search: selectedResult.herb.name }
                          });
                        }
                      }}
                    >
                      <Ionicons name="book" size={20} color="#FFF" />
                      <Text style={styles.actionBtnText}>View More Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Visual Verification Toggle */}
                <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
                  <Text style={[styles.sectionHead, { marginBottom: 12 }]}>Visual Verification</Text>
                  <View style={styles.viewToggle}>
                    <TouchableOpacity
                      style={[styles.viewToggleBtn, viewMode === 'photo' && styles.viewToggleBtnActive]}
                      onPress={() => setViewMode('photo')}
                    >
                      <Text style={[styles.viewToggleText, viewMode === 'photo' && styles.viewToggleTextActive]}>Live</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.viewToggleBtn, viewMode === 'botanical' && styles.viewToggleBtnActive]}
                      onPress={() => setViewMode('botanical')}
                    >
                      <Text style={[styles.viewToggleText, viewMode === 'botanical' && styles.viewToggleTextActive]}>Herb Guide</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.viewToggleBtn, viewMode === 'comparison' && styles.viewToggleBtnActive]}
                      onPress={() => setViewMode('comparison')}
                    >
                      <Text style={[styles.viewToggleText, viewMode === 'comparison' && styles.viewToggleTextActive]}>Compare</Text>
                    </TouchableOpacity>
                  </View>

                  {viewMode === 'comparison' ? (
                    <View style={styles.comparisonContainer}>
                      <View style={styles.compHalf}>
                        <Image source={{ uri: selectedImage.uri }} style={styles.compImage} />
                        <View style={[styles.compLabel, { backgroundColor: 'rgba(2, 44, 34, 0.7)' }]}><Text style={styles.compLabelText}>YOUR SCAN</Text></View>
                      </View>
                      <View style={[styles.compDivider, { width: 2, backgroundColor: '#E2E8F0' }]} />
                      <View style={styles.compHalf}>
                        {selectedResult.herb.illustrationUrl ? (
                          <Image source={{ uri: selectedResult.herb.illustrationUrl }} style={styles.compImage} />
                        ) : (
                          <View style={[styles.compImage, styles.center, { backgroundColor: '#F8FAFC' }]}>
                            <Ionicons name="image-outline" size={32} color="#CBD5E1" />
                          </View>
                        )}
                        <View style={[styles.compLabel, { backgroundColor: 'rgba(5, 150, 105, 0.7)' }]}><Text style={styles.compLabelText}>HERB GUIDE</Text></View>
                      </View>
                    </View>
                  ) : viewMode === 'botanical' ? (
                    <View style={[styles.illustrationContainer, { borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: '#E2E8F0' }]}>
                      {selectedResult.herb.illustrationUrl ? (
                        <Image source={{ uri: selectedResult.herb.illustrationUrl }} style={styles.illustrationImage} />
                      ) : (
                        <View style={styles.noIllustration}>
                          <Ionicons name="image-outline" size={48} color="#CBD5E1" />
                          <Text style={styles.noIllustrationText}>Botanical guide coming soon.</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={[styles.illustrationContainer, { borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: '#E2E8F0' }]}>
                      <Image source={{ uri: selectedImage.uri }} style={styles.illustrationImage} />
                      <View style={[styles.compLabel, { bottom: 12, left: 12, backgroundColor: 'rgba(2, 44, 34, 0.7)' }]}>
                        <Text style={styles.compLabelText}>CAPTURED PHOTO</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Safety Warning Section - Look-alikes */}
                {selectedResult.herb.lookAlikes && selectedResult.herb.lookAlikes.length > 0 && (
                  <View style={[styles.safetyCard, { marginHorizontal: 20, marginTop: 20 }]}>
                    <View style={styles.safetyHeader}>
                      <Ionicons name="alert-circle" size={24} color={COLORS.danger} />
                      <Text style={styles.safetyTitle}>Safety: Plant Look-alikes</Text>
                    </View>
                    <Text style={styles.safetyIntro}>Ensure you haven't captured one of these harmful look-alikes:</Text>

                    {selectedResult.herb.lookAlikes.map((look, idx) => (
                      <View key={idx} style={[styles.lookAlikeItem, { borderColor: look.danger === 'Harmful' ? '#FEE2E2' : '#FEF3C7' }]}>
                        <View style={styles.lookAlikeInfo}>
                          <Text style={styles.lookAlikeName}>{look.name}</Text>
                          <View style={[styles.dangerBadge, look.danger === 'Harmful' ? { backgroundColor: COLORS.danger } : { backgroundColor: COLORS.warning }]}>
                            <Text style={styles.dangerText}>{look.danger === 'Harmful' ? 'TOXIC' : 'IRRITANT'}</Text>
                          </View>
                        </View>
                        <Text style={styles.lookAlikeReason}>{look.reason}</Text>
                      </View>
                    ))}
                  </View>
                )}


                <View style={styles.divider} />

                {/* Feedback Section */}
                <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
                  <View style={styles.feedbackSection}>
                    {!feedbackSubmitted ? (
                      <>
                        <Text style={styles.sectionHead}>Was this accurate?</Text>
                        <View style={styles.feedbackChoices}>
                          <TouchableOpacity
                            style={[
                              styles.choiceBtn,
                              feedbackChoice === true && styles.choiceBtnActiveCorrect
                            ]}
                            onPress={() => setFeedbackChoice(true)}
                          >
                            <Ionicons
                              name={feedbackChoice === true ? "checkmark-circle" : "checkmark-circle-outline"}
                              size={18}
                              color={feedbackChoice === true ? "#FFF" : COLORS.emerald}
                            />
                            <Text style={[styles.choiceText, feedbackChoice === true && styles.choiceTextActive]}>Correct</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.choiceBtn,
                              feedbackChoice === false && styles.choiceBtnActiveIncorrect
                            ]}
                            onPress={() => setFeedbackChoice(false)}
                          >
                            <Ionicons
                              name={feedbackChoice === false ? "close-circle" : "close-circle-outline"}
                              size={18}
                              color={feedbackChoice === false ? "#FFF" : COLORS.danger}
                            />
                            <Text style={[styles.choiceText, feedbackChoice === false && styles.choiceTextActive]}>Incorrect</Text>
                          </TouchableOpacity>
                        </View>

                        {feedbackChoice === false && (
                          <View style={styles.correctionContainer}>
                            <Text style={styles.inputLabel}>Correct plant name:</Text>
                            <TextInput
                              style={styles.correctionInput}
                              placeholder="e.g. Sambong, Lagundi..."
                              value={userCorrection}
                              onChangeText={setUserCorrection}
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        )}

                        <View style={styles.ratingContainer}>
                          <Text style={styles.inputLabel}>Rating:</Text>
                          <View style={styles.stars}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <TouchableOpacity key={s} onPress={() => setFeedbackRating(s)}>
                                <Ionicons
                                  name={s <= feedbackRating ? "star" : "star-outline"}
                                  size={24}
                                  color={COLORS.warning}
                                />
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        <TouchableOpacity
                          style={[styles.submitBtn, (feedbackChoice === null || submittingFeedback) && styles.submitBtnDisabled]}
                          onPress={handleSubmitFeedback}
                          disabled={feedbackChoice === null || submittingFeedback}
                        >
                          {submittingFeedback ? (
                            <ActivityIndicator color="#FFF" size="small" />
                          ) : (
                            <Text style={styles.submitBtnText}>Send Feedback</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={styles.successFeedback}>
                        <Ionicons name="checkmark-circle" size={40} color={COLORS.emerald} />
                        <Text style={styles.successFeedbackTitle}>Thank You!</Text>
                        <Text style={styles.successFeedbackText}>We've received your feedback. It helps improve our accuracy.</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.divider} />

                {/* AI Assistant Section */}
                <View style={[styles.aiSection, { marginHorizontal: 20, marginTop: 24 }]}>
                  <View style={styles.aiSectionHeader}>
                    <View style={styles.aiBadge}>
                      <Ionicons name="sparkles" size={14} color="#3B82F6" />
                      <Text style={styles.aiBadgeText}>SMART KNOWLEDGE</Text>
                    </View>
                    <Text style={styles.aiTitle}>Herbalist Assistant</Text>
                  </View>

                  {!aiResponse ? (
                    <>
                      <View style={styles.aiInputContainer}>
                        <TextInput
                          style={styles.aiInput}
                          placeholder={`Ask about ${selectedResult.herb.name}...`}
                          placeholderTextColor="#9CA3AF"
                          value={userQuestion}
                          onChangeText={setUserQuestion}
                          multiline
                        />
                        <View style={styles.aiInputActions}>
                          <TouchableOpacity
                            style={[styles.aiAskBtn, (aiLoading || (!userQuestion.trim())) && styles.aiAskBtnDisabled]}
                            onPress={askAI}
                            disabled={aiLoading || !userQuestion.trim()}
                          >
                            {aiLoading ? (
                              <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                              <Ionicons name="arrow-up" size={18} color={(!userQuestion.trim()) ? "#9CA3AF" : "#FFF"} />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.aiQuickBtnContainer}>
                        <TouchableOpacity
                          style={styles.aiQuickBtn}
                          onPress={() => {
                            const question = `Tell me about the traditional medicinal benefits of ${selectedResult.herb.name} in the Philippines.`;
                            setUserQuestion(question);
                          }}
                        >
                          <Text style={styles.aiQuickBtnText}>💡 Traditional Philippine usage</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <View style={styles.aiResponseBox}>
                      <Text style={styles.aiResponseText}>{aiResponse}</Text>
                      <TouchableOpacity style={styles.aiResetBtn} onPress={() => {
                        setAiResponse(null);
                        setUserQuestion('');
                      }}>
                        <Ionicons name="refresh" size={16} color="#6B7280" />
                        <Text style={styles.aiResetBtnText}>Ask another question</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal visible={historyOpen} animationType="slide" onRequestClose={() => setHistoryOpen(false)}>
        <View style={[styles.container, { backgroundColor: '#F9FAFB' }]}>
          <Header
            title="Scan History"
            leftAction={{ icon: 'close', onPress: () => setHistoryOpen(false) }}
            rightActions={[
              { icon: 'trash-outline', onPress: clearHistory, color: '#EF4444', size: 20 }
            ]}
          />

          {history.length === 0 ? (
            <View style={[styles.center, { flex: 1, backgroundColor: 'transparent' }]}>
              <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>No previous scans yet</Text>
              <Text style={styles.emptySubText}>Identified plants will appear here</Text>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.historyCard}
                  onPress={() => {
                    setSelectedImage({ uri: item.imageUri });
                    setSelectedResult({ herb: item.herb });
                    setResults([{ herb: item.herb }]);
                    setHistoryOpen(false);
                    setDetailsOpen(true);
                  }}
                >
                  <Image source={{ uri: item.imageUri }} style={styles.historyThumb} />
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyName}>{item.herb.commonName || item.herb.name}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(item.timestamp).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}



