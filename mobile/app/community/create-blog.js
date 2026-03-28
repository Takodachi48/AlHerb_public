import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { blogService } from '../../services/apiServices';
import { uploadImage } from '../../services/imageUpload';
import Header from '../../components/common/Header';

const blogCategories = ['herb_profiles', 'remedies', 'research', 'safety', 'gardening', 'foraging', 'recipes', 'news', 'interviews', 'general'];

export default function CreateBlogScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showFormattingHelp, setShowFormattingHelp] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: 'general',
    tags: '',
    featuredImage: null,
  });
  const [isPreview, setIsPreview] = useState(false);


  useEffect(() => {
    if (!user) {
      router.replace('/auth/login');
      return;
    }
  }, [user, router]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        setFormData(prev => ({ ...prev, featuredImage: result.assets[0] }));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const insertFormatting = (tag) => {
    const { start, end } = selection;
    const selectedText = formData.content.substring(start, end);

    let formattedText = '';

    switch (tag) {
      case 'bold':
        formattedText = `**${selectedText || 'bold text'}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText || 'italic text'}*`;
        break;
      case 'heading':
        formattedText = `\n## ${selectedText || 'Heading'}\n`;
        break;
      case 'list':
        formattedText = `\nâ€¢ ${selectedText || 'List item'}`;
        break;
      case 'link':
        formattedText = `[${selectedText || 'link text'}](https://)`;
        break;
      default:
        formattedText = selectedText;
    }

    const newContent = formData.content.substring(0, start) + formattedText + formData.content.substring(end);
    setFormData(prev => ({ ...prev, content: newContent }));

    // Optionally focus or set new selection here if needed, 
    // but in RN it's tricky to trigger focus back without a ref.
  };


  const validateBlogForm = () => {
    const title = formData.title.trim();
    const excerpt = formData.excerpt.trim();
    const content = formData.content.trim();
    if (title.length < 3) {
      Alert.alert('Validation', 'Title must be at least 3 characters.');
      return false;
    }
    if (excerpt.length < 10) {
      Alert.alert('Validation', 'Excerpt must be at least 10 characters.');
      return false;
    }
    if (content.length < 10) {
      Alert.alert('Validation', 'Content must be at least 10 characters.');
      return false;
    }
    return true;
  };
  const buildBlogData = async (status = 'draft') => {
    const slug = formData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    const blogData = {
      title: formData.title.trim(),
      excerpt: formData.excerpt.trim(),
      content: formData.content.trim(),
      slug,
      category: formData.category,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      status,
    };
    if (formData.featuredImage?.uri) {
      try {
        const uploadedImage = await uploadImage(formData.featuredImage.uri);
        blogData.featuredImage = uploadedImage;
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
      }
    }
    return blogData;
  };
  const handleSaveDraft = async () => {
    if (!validateBlogForm()) {
      return;
    }
    setLoading(true);
    try {
      const blogData = await buildBlogData('draft');
      await blogService.createBlog(blogData);
      Alert.alert('Success', 'Draft saved successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving draft:', error);
      Alert.alert('Error', error?.message || 'Failed to save draft');
    } finally {
      setLoading(false);
    }
  };
  const handleRequestApproval = async () => {
    if (!validateBlogForm()) {
      return;
    }
    setLoading(true);
    try {
      const blogData = await buildBlogData('draft');
      const created = await blogService.createBlog(blogData);
      const blogId = created?._id || created?.id || created?.data?._id;
      if (!blogId) {
        throw new Error('Draft created but missing blog ID');
      }
      await blogService.requestBlogApproval(blogId);
      Alert.alert('Submitted', 'Blog submitted for approval.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error requesting approval:', error);
      Alert.alert('Error', error?.message || 'Failed to request approval');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <Header 
        title={isPreview ? 'Preview Blog' : 'Create Blog'}
        showBack={true}
        rightActions={[
          { 
            icon: isPreview ? "create-outline" : "eye-outline", 
            onPress: () => setIsPreview(!isPreview),
            color: '#10B981',
            size: 22
          }
        ]}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView style={{ flex: 1 }}>
        {isPreview ? (
          <View style={styles.previewContainer}>
            {formData.featuredImage && (
              <Image source={{ uri: formData.featuredImage.uri }} style={styles.previewImage} />
            )}
            <Text style={styles.previewTitle}>{formData.title || 'Untitled Blog'}</Text>
            <View style={styles.previewMeta}>
              <Text style={styles.previewCategory}>{(formData.category || 'general').replace('_', ' ').toUpperCase()}</Text>
              <Text style={styles.previewAuthor}>By {user.displayName || 'You'}</Text>
            </View>
            {formData.excerpt ? <Text style={styles.previewExcerpt}>{formData.excerpt}</Text> : null}
            <View style={styles.previewDivider} />
            <Text style={styles.previewBody}>{formData.content || 'No content yet...'}</Text>
          </View>
        ) : (
          <View style={styles.form}>
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your blog title..."
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                maxLength={100}
              />
              <Text style={styles.characterCount}>{formData.title.length}/100</Text>
            </View>

            {/* Excerpt */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Excerpt *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Brief description of your blog..."
                value={formData.excerpt}
                onChangeText={(text) => setFormData(prev => ({ ...prev, excerpt: text }))}
                multiline
                maxLength={300}
              />
              <Text style={styles.characterCount}>{formData.excerpt.length}/300</Text>
            </View>

            {/* Content */}
            <View style={styles.inputGroup}>
              <View style={styles.contentHeader}>
                <Text style={styles.label}>Content *</Text>
                <TouchableOpacity
                  style={styles.helpButton}
                  onPress={() => setShowFormattingHelp(!showFormattingHelp)}
                >
                  <Ionicons name="help-circle-outline" size={18} color="#6B7280" />
                  <Text style={styles.helpButtonText}>Formatting Help</Text>
                </TouchableOpacity>
              </View>

              {/* Formatting Toolbar */}
              <View style={styles.formattingBar}>
                <TouchableOpacity
                  style={styles.formatButton}
                  onPress={() => insertFormatting('bold')}
                >
                  <Text style={styles.formatButtonBold}>B</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.formatButton}
                  onPress={() => insertFormatting('italic')}
                >
                  <Text style={styles.formatButtonItalic}>I</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.formatButton}
                  onPress={() => insertFormatting('heading')}
                >
                  <Text style={styles.formatButtonHeading}>H</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.formatButton}
                  onPress={() => insertFormatting('list')}
                >
                  <Ionicons name="list-outline" size={18} color="#4B5563" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.formatButton}
                  onPress={() => insertFormatting('link')}
                >
                  <Ionicons name="link-outline" size={18} color="#4B5563" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, styles.contentArea]}
                placeholder="Write your blog content here..."
                value={formData.content}
                onChangeText={(text) => setFormData(prev => ({ ...prev, content: text }))}
                multiline
                textAlignVertical="top"
                onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                selection={selection}
              />
            </View>

            {/* Category */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryContainer}>
                {blogCategories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryButton,
                      formData.category === category && styles.categoryButtonSelected
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, category }))}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      formData.category === category && styles.categoryButtonTextSelected
                    ]}>
                      {category.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Tags */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tags</Text>
              <TextInput
                style={styles.input}
                placeholder="Add tags separated by commas..."
                value={formData.tags}
                onChangeText={(text) => setFormData(prev => ({ ...prev, tags: text }))}
              />
            </View>

            {/* Featured Image */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Featured Image</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {formData.featuredImage ? (
                  <Image source={{ uri: formData.featuredImage.uri }} style={styles.selectedImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="image-outline" size={32} color="#6B7280" />
                    <Text style={styles.imagePlaceholderText}>Add Featured Image</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {!isPreview && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.draftButton]}
            onPress={handleSaveDraft}
            disabled={loading}
          >
            <Text style={styles.draftButtonText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.publishButton]}
            onPress={handleRequestApproval}
            disabled={loading}
          >
            <View style={styles.publishButtonContent}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.publishButtonText}>Request Approval</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = {
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#14532D', // Deep Forest
  },
  publishButton: {
    backgroundColor: '#10B981', // Primary Green
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
    marginLeft: 8,
    minHeight: 52, // Fixed height to prevent glitch
    justifyContent: 'center',
  },
  publishButtonContent: {
    height: 24, // Fixed inner height for content
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  draftButton: {
    backgroundColor: '#F3F4F6',
    flex: 1,
    marginRight: 8,
  },
  draftButtonText: {
    color: '#4B5563',
    fontWeight: '700',
    fontSize: 16,
  },
  publishButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  form: {
    padding: 20,
    paddingBottom: 0,
  },
  previewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  previewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 4,
  },

  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  contentArea: {
    height: 200,
    textAlignVertical: 'top',
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  helpButtonText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  formattingBar: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formatButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  formatButtonBold: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  formatButtonItalic: {
    fontSize: 16,
    fontWeight: '600',
    fontStyle: 'italic',
    color: '#1F2937',
  },
  formatButtonHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },

  characterCount: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 4,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginRight: 8,
    marginBottom: 8,
  },
  categoryButtonSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  categoryButtonTextSelected: {
    color: '#FFFFFF',
  },
  imagePicker: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 8,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  previewContainer: {
    padding: 20,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 12,
  },
  previewMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 1,
  },
  previewAuthor: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  previewExcerpt: {
    fontSize: 16,
    color: '#4B5563',
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 20,
    paddingLeft: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#E5E7EB',
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 20,
  },
  previewBody: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 26,
  },
};


