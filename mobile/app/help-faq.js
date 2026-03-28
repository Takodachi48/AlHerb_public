import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Header from '../components/common/Header';

const FAQ_ITEMS = [
  {
    id: 'faq-1',
    category: 'Recommendations',
    question: 'How do I get remedy recommendations?',
    answer:
      'Open Find Remedies, choose one or more symptoms, complete Step 2 profile details, and tap Get Recommendations. The app will only show herbs that have matching symptom data and pass safety checks based on the profile you entered.',
  },
  {
    id: 'faq-2',
    category: 'Recommendations',
    question: 'Why are some symptoms not included in the result?',
    answer:
      'A symptom appears in results only when at least one herb has matching records for that symptom. If you selected 2 symptoms and only 1 has matches, the app shows "Showing results for..." so you know which symptom was used.',
  },
  {
    id: 'faq-3',
    category: 'Recommendations',
    question: 'What does effectiveness 1-5 mean?',
    answer:
      'Effectiveness is a comparative ranking score in the recommendation list, not a medical guarantee. It helps sort likely options from stronger to weaker matches based on symptom fit, available safety signals, and model ranking output.',
  },
  {
    id: 'faq-4',
    category: 'Recommendations',
    question: 'Why does personalized dosage sometimes show unavailable?',
    answer:
      'Personalized dosage depends on complete dosage data for the herb and your selected age group. If the herb record does not include dosage for that group, the app shows dosage unavailable instead of guessing a value.',
  },
  {
    id: 'faq-5',
    category: 'Scanning',
    question: 'How do I improve plant scan accuracy?',
    answer:
      'Use bright natural light, fill most of the frame with one plant, keep the camera steady, and include key plant features like leaf shape, flower, stem, or fruit. Avoid heavily blurred, dark, or distant images.',
  },
  {
    id: 'faq-6',
    category: 'Scanning',
    question: 'Where can I see my previous scans?',
    answer:
      'Go to Profile > Scan History. You can review earlier image-based identifications and open details from there.',
  },
  {
    id: 'faq-7',
    category: 'Safety',
    question: 'Why do I see limited safety data for some herbs?',
    answer:
      'Not all herb records currently include full safety fields. If detailed safety metadata is missing, the app shows a fallback safety notice and still recommends consulting a licensed health professional before use.',
  },
  {
    id: 'faq-8',
    category: 'Safety',
    question: 'Does this app replace medical advice?',
    answer:
      'No. The app is informational only. Always consult a healthcare professional before starting treatment.',
  },
  {
    id: 'faq-9',
    category: 'Profile',
    question: 'What is the difference between "For Me" and "For Others"?',
    answer:
      '"For Me" uses your saved profile details and locks required profile fields in Step 2 for consistency. "For Others" lets you input details manually each time for a different person.',
  },
  {
    id: 'faq-10',
    category: 'Profile',
    question: 'How do I edit my profile details?',
    answer:
      'Open Profile > Edit Profile and update your personal and health-related fields. If required details are incomplete, recommendation for "For Me" may prompt you to finish your profile first.',
  },
  {
    id: 'faq-11',
    category: 'Saved Items',
    question: 'Can I save the same herb for different symptoms?',
    answer:
      'Yes. Saved remedies are tracked by herb plus context, so the same herb can appear in multiple saved entries when tied to different symptoms or recommendation sessions.',
  },
  {
    id: 'faq-12',
    category: 'Notifications',
    question: 'What notifications can I receive?',
    answer:
      'The app can show notifications for community blog posts, announcements, updates, and other system messages. You can review notification items from the app notification area.',
  },
  {
    id: 'faq-13',
    category: 'Community',
    question: 'How can I post in Community?',
    answer:
      'Go to Community, tap create post, write your content, then submit. Depending on current moderation settings, posts may appear immediately or after review.',
  },
  {
    id: 'faq-14',
    category: 'Feedback',
    question: 'How should I submit a useful bug report?',
    answer:
      'In Send Feedback, include clear steps to reproduce, what you expected, what happened instead, and your device/platform if possible. This helps us resolve issues faster.',
  },
];

export default function HelpFaqScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(FAQ_ITEMS[0]?.id || null);

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ_ITEMS;
    return FAQ_ITEMS.filter((item) => {
      const haystack = `${item.category} ${item.question} ${item.answer}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  return (
    <View style={styles.container}>
      <Header title="Help & FAQ" showBack />

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search help topics..."
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!query && (
          <TouchableOpacity
            style={styles.aiCard}
            onPress={() => router.push('/chatbot')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#0F766E', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aiGradient}
            >
              <View style={styles.aiInfo}>
                <Text style={styles.aiTitle}>Can't find your answer?</Text>
                <Text style={styles.aiSubtitle}>Ask our AI Herbal Assistant anything!</Text>
              </View>
              <View style={styles.aiIconBtn}>
                <Ionicons name="sparkles" size={20} color="#0F766E" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {filteredFaqs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="help-circle-outline" size={42} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No matching FAQ</Text>
            <Text style={styles.emptyText}>Try a different keyword.</Text>
          </View>
        ) : (
          filteredFaqs.map((item) => {
            const isOpen = openId === item.id;
            return (
              <View key={item.id} style={styles.faqCard}>
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => setOpenId(isOpen ? null : item.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.faqHeaderText}>
                    <Text style={styles.categoryText}>{item.category}</Text>
                    <Text style={styles.questionText}>{item.question}</Text>
                  </View>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#6B7280"
                  />
                </TouchableOpacity>
                {isOpen ? <Text style={styles.answerText}>{item.answer}</Text> : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  searchWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 24,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  faqHeaderText: {
    flex: 1,
    paddingRight: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  answerText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
  },
  aiCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  aiGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
  },
  aiInfo: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  aiSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  aiIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
