import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/common/Header';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../services/apiClient';

const FEEDBACK_TYPES = [
  'Bug Report',
  'Feature Request',
  'Recommendation Quality',
  'Scanner Accuracy',
  'General Feedback',
];

export default function SendFeedbackScreen() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [name, setName] = useState(user?.displayName || '');
  const contactType = 'email';
  const [contactValue, setContactValue] = useState(user?.email || '');
  const [feedbackType, setFeedbackType] = useState(FEEDBACK_TYPES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Missing field', 'Please enter your name.');
      return false;
    }
    if (!contactValue.trim()) {
      Alert.alert('Missing field', 'Please enter your email.');
      return false;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(contactValue.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return false;
    }
    if (message.trim().length < 5) {
      Alert.alert('Message too short', 'Please provide at least 5 characters.');
      return false;
    }
    return true;
  };

  const submitFeedback = async () => {
    if (!validateForm()) return;

    try {
      setSending(true);
      const payloadMessage =
        `Type: ${feedbackType}\n` +
        `${subject.trim() ? `Subject: ${subject.trim()}\n` : ''}` +
        `\n${message.trim()}`;

      await apiClient.post('/inquiries', {
        name: name.trim(),
        contactType,
        contactValue: contactValue.trim(),
        message: payloadMessage,
      });

      setSubject('');
      setMessage('');
      Alert.alert('Feedback sent', 'Thanks for helping us improve AlgoHerbarium.');
    } catch (error) {
      const serverMessage = error?.response?.data?.message;
      Alert.alert('Submission failed', serverMessage || 'Unable to send feedback right now.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Send Feedback" showBack />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Share bugs, suggestions, or quality issues. Your feedback helps us improve the app.
          </Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={contactValue}
              onChangeText={setContactValue}
              placeholder="name@email.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Feedback Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.typeChipRow}>
                {FEEDBACK_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, feedbackType === type && styles.typeChipActive]}
                    onPress={() => setFeedbackType(type)}
                  >
                    <Text style={[styles.typeChipText, feedbackType === type && styles.typeChipTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Short summary"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe your feedback in detail..."
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, sending && styles.submitBtnDisabled]}
            onPress={submitFeedback}
            disabled={sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send-outline" size={16} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Submit Feedback</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 30,
  },
  intro: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 14,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
  },
  messageInput: {
    minHeight: 120,
  },
  typeChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  typeChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#86EFAC',
  },
  typeChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: '#166534',
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: 8,
    backgroundColor: '#2D8A4E',
    borderRadius: 10,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
