import React, { useState, useEffect, useCallback } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../context/AuthContext';
import { blogService } from '../../../services/apiServices';
import { uploadImage } from '../../../services/imageUpload';
import Header from '../../../components/common/Header';
import { debugLog } from '../../../utils/logger';

const blogCategories = ['herb_profiles', 'remedies', 'research', 'safety', 'gardening', 'foraging', 'recipes', 'news', 'interviews', 'general'];
const normalizeBlogCategory = (category) => {
  const value = String(category || '').trim();
  return blogCategories.includes(value) ? value : 'general';
};

export default function EditBlogScreen() {
  const router = useRouter();
  const { blogId } = useLocalSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: 'general',
    tags: '',
    featuredImage: null,
  });
  const [originalData, setOriginalData] = useState(null);

  const fetchBlog = useCallback(async () => {
    try {
      setLoading(true);
      const response = await blogService.getBlogById(blogId);
      const blog = response?.data || response;

      if (!blog || typeof blog !== 'object') {
        throw new Error('Invalid blog payload');
      }
      
      setFormData({
        title: blog.title || '',
        excerpt: blog.excerpt || '',
        content: blog.content || '',
        category: normalizeBlogCategory(blog.category),
        tags: blog.tags?.join(', ') || '',
        featuredImage: blog.featuredImage || null,
      });
      
      setOriginalData({
        title: blog.title || '',
        excerpt: blog.excerpt || '',
        content: blog.content || '',
        category: normalizeBlogCategory(blog.category),
        tags: blog.tags?.join(', ') || '',
        featuredImage: blog.featuredImage || null,
        status: blog.status || 'draft',
      });
    } catch (error) {
      console.error('Error fetching blog:', error);
      Alert.alert('Error', 'Failed to load blog data');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [blogId, router]);

  useEffect(() => {
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    fetchBlog();
  }, [fetchBlog, router, user]);

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

  const hasChanges = () => {
    if (!originalData) return false;
    
    return (
      formData.title !== originalData.title ||
      formData.excerpt !== originalData.excerpt ||
      formData.content !== originalData.content ||
      formData.category !== originalData.category ||
      formData.tags !== originalData.tags ||
      formData.featuredImage?.uri !== originalData.featuredImage?.url
    );
  };

  const validateBlogForm = () => {
    const title = formData.title.trim();
    const excerpt = formData.excerpt.trim();
    const content = formData.content.trim();

    if (title.length < 3 || title.length > 200) {
      Alert.alert('Validation', 'Title must be between 3 and 200 characters.');
      return false;
    }
    if (excerpt.length < 10 || excerpt.length > 300) {
      Alert.alert('Validation', 'Excerpt must be between 10 and 300 characters.');
      return false;
    }
    // PUT /blogs/:id currently validates content min length at 50 chars.
    if (content.length < 50) {
      Alert.alert('Validation', 'Content must be at least 50 characters when updating a blog.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateBlogForm()) {
      return;
    }

    if (!hasChanges()) {
      Alert.alert('Info', 'No changes to save');
      return;
    }

    setSaving(true);
    try {
      const blogData = {
        title: formData.title.trim(),
        excerpt: formData.excerpt.trim(),
        content: formData.content.trim(),
        slug: formData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 50),
        category: normalizeBlogCategory(formData.category),
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        status: 'published',
      };

      // Handle featured image
      if (formData.featuredImage?.uri) {
        // New image was selected
        try {
          debugLog('ðŸ“¸ Uploading new image to Cloudinary...');
          const uploadedImage = await uploadImage(formData.featuredImage.uri);
          blogData.featuredImage = uploadedImage;
          debugLog('âœ… New image uploaded successfully:', uploadedImage.url);
        } catch (uploadError) {
          console.error('âŒ New image upload failed:', uploadError);
          Alert.alert('Warning', 'New image upload failed, keeping existing image');
          // Keep existing image if upload fails
          blogData.featuredImage = originalData.featuredImage;
        }
      } else if (originalData?.featuredImage?.url) {
        // Keep existing image
        blogData.featuredImage = originalData.featuredImage;
      }

      const isPublishedOriginal = originalData?.status === 'published';
      if (isPublishedOriginal) {
        // Preserve currently published version and create a new draft revision.
        const revisionDraft = { ...blogData, status: 'draft', revisionOf: blogId };
        await blogService.createBlog(revisionDraft);
        Alert.alert('Revision Saved', 'A new draft revision was created. Submit it for approval from My Blogs when ready.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        await blogService.updateBlog(blogId, blogData);
        Alert.alert('Success', 'Blog post updated successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error('Error updating blog:', error);
      Alert.alert('Error', 'Failed to update blog post');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!validateBlogForm()) {
      return;
    }

    setSaving(true);
    try {
      const blogData = {
        title: formData.title.trim(),
        excerpt: formData.excerpt.trim(),
        content: formData.content.trim(),
        slug: formData.title
          .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50),
        category: normalizeBlogCategory(formData.category),
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        status: 'draft',
      };

      if (formData.featuredImage?.uri) {
        // New image was selected
        try {
          debugLog('ðŸ“¸ Uploading new image to Cloudinary...');
          const uploadedImage = await uploadImage(formData.featuredImage.uri);
          blogData.featuredImage = uploadedImage;
          debugLog('âœ… New image uploaded successfully:', uploadedImage.url);
        } catch (uploadError) {
          console.error('âŒ New image upload failed:', uploadError);
          Alert.alert('Warning', 'New image upload failed, keeping existing image');
          // Keep existing image if upload fails
          blogData.featuredImage = originalData.featuredImage;
        }
      } else if (originalData?.featuredImage?.url) {
        blogData.featuredImage = originalData.featuredImage;
      }

      const isPublishedOriginal = originalData?.status === 'published';
      if (isPublishedOriginal) {
        await blogService.createBlog({ ...blogData, revisionOf: blogId });
        Alert.alert('Revision Saved', 'Draft revision created from published post.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        await blogService.updateBlog(blogId, blogData);
        Alert.alert('Success', 'Draft saved successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      Alert.alert('Error', 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Blog',
      'Are you sure you want to delete this blog post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await blogService.deleteBlog(blogId);
              Alert.alert('Success', 'Blog post deleted successfully!', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error) {
              console.error('Error deleting blog:', error);
              Alert.alert('Error', 'Failed to delete blog post');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header 
        title="Edit Blog" 
        showBack={true} 
        rightActions={[
          { icon: 'trash-outline', onPress: handleDelete, color: '#EF4444' }
        ]}
      />
      <ScrollView style={{ flex: 1 }}>
        {/* Form */}
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
              maxLength={200}
            />
            <Text style={styles.characterCount}>{formData.excerpt.length}/200</Text>
          </View>

          {/* Content */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Content *</Text>
            <TextInput
              style={[styles.input, styles.contentArea]}
              placeholder="Write your blog content here..."
              value={formData.content}
              onChangeText={(text) => setFormData(prev => ({ ...prev, content: text }))}
              multiline
              textAlignVertical="top"
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
                    {category}
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
                <Image 
                  source={{ uri: formData.featuredImage.uri || formData.featuredImage.url }} 
                  style={styles.selectedImage} 
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={32} color="#6B7280" />
                  <Text style={styles.imagePlaceholderText}>Add Featured Image</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.draftButton]}
              onPress={handleSaveDraft}
              disabled={saving}
            >
              <Text style={styles.draftButtonText}>Save Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.publishButton]}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.publishButtonText}>
                  {originalData?.status === 'published' ? 'Save Revision Draft' : 'Update'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = {
  form: {
    padding: 20,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  draftButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  publishButton: {
    backgroundColor: '#10B981',
  },
  draftButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
};


