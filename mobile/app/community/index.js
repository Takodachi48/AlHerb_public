import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { blogService } from '../../services/apiServices';
import { UserBlogCard } from '../../components/blog/UserBlogCard';
import { CommunityBlogCard } from '../../components/blog/CommunityBlogCard';
import { debugLog } from '../../utils/logger';

const blogCategories = [
  { key: 'All', label: 'All' },
  { key: 'general', label: 'Personal Stories' },
  { key: 'herb_profiles', label: 'Herb Profiles' },
  { key: 'remedies', label: 'Remedies' },
  { key: 'research', label: 'Research' },
  { key: 'safety', label: 'Safety' },
  { key: 'gardening', label: 'Gardening' },
  { key: 'foraging', label: 'Foraging' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'news', label: 'News' },
  { key: 'interviews', label: 'Interviews' },
];

export default function CommunityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('discover');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [blogs, setBlogs] = useState([]);
  const [myBlogs, setMyBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBlogs = useCallback(async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);
      debugLog('🔍 Fetching blogs with category:', selectedCategory);
      const response = await blogService.getCommunityBlogs({
        page: 1,
        limit: 10,
        category: selectedCategory !== 'All' ? selectedCategory : null,
      });
      debugLog('📡 Received blogs:', response.data?.length || 0, 'items');
      debugLog('📡 First blog title:', response.data?.[0]?.title || 'No blogs');
      
      // Force state update with timeout
      setTimeout(() => {
        setBlogs(response.data || []);
      }, 50);
    } catch (error) {
      console.error('Error fetching blogs:', error);
    } finally {
      setLoading(false);
      if (isRefreshing) setRefreshing(false);
    }
  }, [selectedCategory]);

  const fetchMyBlogs = useCallback(async () => {
    try {
      const response = await blogService.getMyBlogs();
      setMyBlogs(response.data);
    } catch (error) {
      console.error('Error fetching my blogs:', error);
    }
  }, []);

  useEffect(() => {
    fetchBlogs();
    if (user) {
      fetchMyBlogs();
    }
  }, [fetchBlogs, fetchMyBlogs, user]);

  // Refetch blogs when category changes
  useEffect(() => {
    if (activeTab === 'discover') {
      fetchBlogs();
    }
  }, [activeTab, fetchBlogs]);

  const handleCreateBlog = () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    router.push('/community/create-blog');
  };

  const handleEditBlog = (blogId) => {
    router.push(`/community/edit-blog/${blogId}`);
  };

  const handleDeleteBlog = async (blogId) => {
    try {
      await blogService.deleteBlog(blogId);
      fetchMyBlogs(); // Refresh my blogs
    } catch (error) {
      console.error('Error deleting blog:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBlogs(true);
  };

  const renderBlogItem = ({ item }) => {
    if (activeTab === 'my-posts') {
      return (
        <UserBlogCard
          item={item}
          onPress={() => router.push(`/blog/${item._id}`)}
          onEdit={() => handleEditBlog(item._id)}
          onDelete={() => handleDeleteBlog(item._id)}
        />
      );
    }
    return (
      <CommunityBlogCard
        item={item}
        onPress={() => router.push(`/blog/${item._id}`)}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading community posts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Floating Action Button */}
      <TouchableOpacity style={styles.floatingCreateButton} onPress={handleCreateBlog}>
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.activeTab]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.activeTabText]}>
            Discover
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-posts' && styles.activeTab]}
          onPress={() => setActiveTab('my-posts')}
        >
          <Text style={[styles.tabText, activeTab === 'my-posts' && styles.activeTabText]}>
            My Posts
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      {activeTab === 'discover' && (
        <View>
          {/* Debug Info */}
          <View style={{paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#f0f0f0'}}>
            <Text style={{fontSize: 12, color: '#666'}}>Selected: {selectedCategory}</Text>
          </View>
          
          <View style={styles.categoryContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScrollContent}
            >
              {blogCategories.map((category, index) => (
                <TouchableOpacity
                  key={`${category.key}-${index}`}
                  style={[
                    styles.categoryChip,
                    selectedCategory === category.key && styles.selectedCategoryChip,
                  ]}
                  onPress={() => {
                    debugLog('🏷️ Category PRESSED:', category.key, category.label);
                    debugLog('🏷️ Current selectedCategory before:', selectedCategory);
                    setSelectedCategory(category.key);
                    debugLog('🏷️ SelectedCategory after set:', category.key);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === category.key && styles.selectedCategoryText,
                    ]}
                    numberOfLines={1}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Content */}
      <FlatList
        data={activeTab === 'my-posts' ? myBlogs : blogs}
        renderItem={renderBlogItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {activeTab === 'my-posts' ? 'No posts yet' : 'No community posts'}
            </Text>
            <Text style={styles.emptyDescription}>
              {activeTab === 'my-posts'
                ? 'Create your first post to share with the community'
                : 'Be the first to share your herbal knowledge'}
            </Text>
            {activeTab === 'my-posts' && (
              <TouchableOpacity style={styles.createPostButton} onPress={handleCreateBlog}>
                <Text style={styles.createPostButtonText}>Create Post</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  floatingCreateButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#10B981',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#10B981',
  },
  categoryContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoryScrollContent: {
    paddingRight: 20,
  },
  categoryChip: {
    width: 100,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCategoryChip: {
    backgroundColor: '#10B981',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  listContainer: {
    padding: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  createPostButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createPostButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

