import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Image,
} from 'react-native';

import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { blogService } from '../../services/apiServices';
import { UserBlogCard } from '../../components/blog/UserBlogCard';
import { CommunityBlogCard } from '../../components/blog/CommunityBlogCard';
import Header from '../../components/common/Header';
import { debugLog } from '../../utils/logger';

import { Colors, Radius, Shadows } from '../../styles/DesignSystem';

const blogCategories = ['All', 'herb_profiles', 'remedies', 'research', 'safety', 'gardening', 'foraging', 'recipes', 'news', 'interviews', 'general'];

// Category display names mapping
const categoryDisplayNames = {
  'All': 'All',
  'herb_profiles': 'Herb Profiles',
  'remedies': 'Remedies',
  'research': 'Research',
  'safety': 'Safety',
  'gardening': 'Gardening',
  'foraging': 'Foraging',
  'recipes': 'Recipes',
  'news': 'News',
  'interviews': 'Interviews',
  'general': 'General',
};

const getLikeCount = (blog) => {
  const value = Number(blog?.likeCount || 0);
  return Number.isFinite(value) ? value : 0;
};

const rankTrendingPosts = (blogs = []) =>
  (Array.isArray(blogs) ? blogs : [])
    .filter((blog) => getLikeCount(blog) > 0)
    .sort((a, b) => getLikeCount(b) - getLikeCount(a))
    .slice(0, 5);

function CommunityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('discover');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [blogs, setBlogs] = useState([]);
  const [myBlogs, setMyBlogs] = useState([]);
  const [savedBlogs, setSavedBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [error, setError] = useState(null);
  const pageRef = useRef(1);

  const [trendingBlogs, setTrendingBlogs] = useState([]);

  const fetchSavedBlogs = useCallback(async () => {
    try {
      const response = await blogService.getSavedBlogs(1, 20);
      setSavedBlogs(response.data || []);
    } catch (error) {
      console.error('Error fetching saved blogs:', error);
    }
  }, []);


  const fetchTrendingBlogs = useCallback(async () => {
    try {
      // Fetch a wider pool and enforce "most liked only" on client side.
      // Some backend deployments may ignore sort params.
      const response = await blogService.getCommunityBlogs({
        page: 1,
        limit: 40,
        sort: 'likes',
      });

      const candidates = Array.isArray(response?.data) ? response.data : [];
      setTrendingBlogs(rankTrendingPosts(candidates));
    } catch (error) {
      console.error('Error fetching trending blogs:', error);
    }
  }, []);


  const fetchBlogs = useCallback(async (isRefreshing = false, loadMore = false) => {
    try {
      if (!isRefreshing && !loadMore) setLoading(true);
      if (loadMore) setLoadingMore(true);
      setError(null);

      const currentPage = loadMore ? pageRef.current : 1;
      const requestParams = {
        page: currentPage,
        limit: 10,
        category: selectedCategory !== 'All' ? selectedCategory : null,
        search: searchQuery.trim() || null,
      };

      debugLog('🌐 Fetching blogs with params:', requestParams);

      debugLog('📄 Current page:', currentPage, 'Load more:', loadMore, 'Refreshing:', isRefreshing);

      const response = await blogService.getCommunityBlogs(requestParams);

      const newBlogs = response.data || [];
      const totalItems = response.pagination?.total || 0;

      debugLog('✅ Blogs fetched successfully');
      debugLog('📊 Total blogs available:', totalItems);
      debugLog('📦 Blogs received:', newBlogs.length);
      debugLog('🏷️ Current category filter:', selectedCategory);

      if (loadMore) {
        // Filter out duplicates when appending
        setBlogs(prev => {
          const combined = [...prev, ...newBlogs];
          const uniqueBlogs = combined.filter((blog, index, self) =>
            index === self.findIndex(b => b._id === blog._id)
          );
          const nextPage = currentPage + 1;
          pageRef.current = nextPage;
          debugLog('🔄 Load more: Added', newBlogs.length, 'blogs, total unique:', uniqueBlogs.length);
          setHasMore(uniqueBlogs.length < totalItems);
          return uniqueBlogs;
        });
        debugLog('📄 Page updated to:', pageRef.current, 'Has more:', hasMore);
      } else {
        setBlogs(newBlogs);
        pageRef.current = 2;
        setHasMore(newBlogs.length < totalItems);
        debugLog('🆕 Fresh fetch: Set', newBlogs.length, 'blogs, has more:', newBlogs.length < totalItems);
      }
    } catch (error) {
      console.error('❌ Error fetching blogs:', error);
      setError('Failed to load blogs. Please check your connection.');
      if (!loadMore) setBlogs([]);
    } finally {
      setLoading(false);
      if (isRefreshing) setRefreshing(false);
      if (loadMore) setLoadingMore(false);
    }
  }, [selectedCategory, searchQuery, hasMore]);

  const fetchMyBlogs = useCallback(async () => {
    try {
      const response = await blogService.getMyBlogs();
      // Handle different response structures
      const blogsData = response.data || response || [];
      setMyBlogs(Array.isArray(blogsData) ? blogsData : blogsData.blogs || []);
    } catch (error) {
      console.error('Error fetching my blogs:', error);
      // Set empty array on error to prevent crashes
      setMyBlogs([]);
    }
  }, []);

  useEffect(() => {
    fetchTrendingBlogs();
    if (user) {
      fetchMyBlogs();
      fetchSavedBlogs();
    }
  }, [fetchTrendingBlogs, fetchMyBlogs, fetchSavedBlogs, user]);

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'my-blogs') {
      fetchMyBlogs();
      return;
    }
    if (activeTab === 'saved') {
      fetchSavedBlogs();
    }
  }, [activeTab, user, fetchMyBlogs, fetchSavedBlogs]);

  // Combined effect for category and search changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (activeTab === 'discover') {
        fetchBlogs();
      }
    }, searchQuery.trim() ? 500 : 0);

    return () => clearTimeout(timeoutId);
  }, [activeTab, searchQuery, fetchBlogs]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore && !searchQuery) {
      fetchBlogs(false, true);
    }
  }, [hasMore, loadingMore, searchQuery, fetchBlogs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchBlogs(true),
      user ? fetchMyBlogs() : Promise.resolve(),
      user ? fetchSavedBlogs() : Promise.resolve()
    ]);
    setRefreshing(false);
  }, [fetchBlogs, fetchMyBlogs, fetchSavedBlogs, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchBlogs(true),
        user ? fetchMyBlogs() : Promise.resolve(),
        user ? fetchSavedBlogs() : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchBlogs, fetchMyBlogs, fetchSavedBlogs, user]);


  const handleCreateBlog = () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    router.push('/community/create-blog');
  };

  const handleBlogPress = (blog) => {
    const routeKey = blog?._id || blog?.slug;
    if (!routeKey) return;
    router.push(`/blog/${routeKey}`);
  };

  const handleEditBlog = (blog) => {
    router.push(`/community/edit-blog/${blog._id}`);
  };

  const handleArchiveBlog = async (blog) => {
    try {
      if (!blog?._id) return;
      await blogService.archiveBlog(blog._id);
      await fetchMyBlogs();
    } catch (error) {
      console.error('Error archiving blog:', error);
      alert('Failed to archive blog. Please try again.');
    }
  };

  const handleUnarchiveBlog = async (blog) => {
    try {
      if (!blog?._id) return;
      await blogService.unarchiveBlog(blog._id);
      await fetchMyBlogs();
    } catch (error) {
      console.error('Error unarchiving blog:', error);
      alert('Failed to unarchive blog. Please try again.');
    }
  };

  const handleSubmitForApproval = async (blog) => {
    try {
      if (!blog?._id) return;
      await blogService.requestBlogApproval(blog._id);
      await fetchMyBlogs();
    } catch (error) {
      console.error('Error requesting blog approval:', error);
      alert(error?.message || 'Failed to request approval. Please try again.');
    }
  };

  const renderSkeleton = () => (
    <View style={s.skeletonCard}>
      <View style={s.skeletonHeader}>
        <View style={s.skeletonAvatar} />
        <View>
          <View style={s.skeletonName} />
          <View style={s.skeletonTime} />
        </View>
      </View>
      <View style={s.skeletonTitle} />
      <View style={s.skeletonImage} />
    </View>
  );

  const renderTrendingSection = () => {
    if (trendingBlogs.length === 0) return null;
    return (
      <View style={s.trendingSection}>
        <View style={s.sectionHeader}>
          <Ionicons name="flame" size={20} color="#EF4444" />
          <Text style={s.sectionTitle}>Trending Now</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.trendingList}
        >
          {trendingBlogs.map(blog => (
            <TouchableOpacity
              key={blog._id}
              style={s.trendingBlogCard}
              onPress={() => handleBlogPress(blog)}
            >
              <Image source={{ uri: blog.featuredImage?.url }} style={s.trendingImage} />
              <View style={s.trendingInfo}>
                <Text style={s.trendingTitle} numberOfLines={2}>{blog.title}</Text>
                <View style={s.trendingStats}>
                  <View style={s.statItem}>
                    <Ionicons name="heart" size={12} color="#EF4444" />
                    <Text style={s.trendingStatText}>{blog.likeCount || 0}</Text>
                  </View>
                  <View style={s.statItem}>
                    <Ionicons name="chatbubble" size={12} color="#3B82F6" />
                    <Text style={s.trendingStatText}>{blog.comments?.length || 0}</Text>
                  </View>
                </View>

              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderBlogPost = ({ item }) => (
    <CommunityBlogCard
      item={item}
      onPress={() => handleBlogPress(item)}
      onLike={handleLikeBlog}
      onBookmark={handleBookmarkBlog}
    />
  );



  const renderMyBlog = ({ item }) => (
    <UserBlogCard
      item={item}
      onPress={() => handleBlogPress(item)}
      onEdit={() => handleEditBlog(item)}
      onArchive={() => handleArchiveBlog(item)}
      onUnarchive={() => handleUnarchiveBlog(item)}
      onSubmitForApproval={() => handleSubmitForApproval(item)}
    />
  );

  const handleBookmarkBlog = async (blogId, isBookmarked) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const previousBlogs = blogs;
    const previousTrending = trendingBlogs;

    const optimisticUpdate = (prevBlogs) =>
      prevBlogs.map((blog) =>
        blog._id === blogId ? { ...blog, isBookmarked } : blog
      );

    setBlogs(optimisticUpdate);
    setTrendingBlogs((prev) => rankTrendingPosts(optimisticUpdate(prev)));

    try {
      const response = await blogService.toggleBlogBookmark(blogId);
      if (response?.localOnly) {
        return;
      }
      const nextBookmarked = Boolean(response?.bookmarked);
      const nextBookmarkCount = Number(response?.bookmarkCount || 0);
      const nextLiked = typeof response?.isLiked === 'boolean' ? response.isLiked : undefined;
      const nextLikesCount = Number(response?.likesCount || 0);

      const applyServerState = (prevBlogs) =>
        prevBlogs.map((blog) => {
          if (blog._id !== blogId) return blog;
          return {
            ...blog,
            isBookmarked: nextBookmarked,
            bookmarkCount: nextBookmarkCount,
            ...(typeof nextLiked === 'boolean' ? { isLiked: nextLiked } : {}),
            ...(Number.isFinite(nextLikesCount) ? { likeCount: nextLikesCount } : {}),
          };
        });

      setBlogs(applyServerState);
      setTrendingBlogs((prev) => rankTrendingPosts(applyServerState(prev)));

      // Refresh saved blogs list
      fetchSavedBlogs();
    } catch (error) {
      console.error('Error bookmarking blog:', error);
      setBlogs(previousBlogs);
      setTrendingBlogs(previousTrending);
    }
  };


  const handleLikeBlog = async (blogId) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const previousBlogs = blogs;
    const previousTrending = trendingBlogs;

    const optimisticUpdate = (prevBlogs) =>
      prevBlogs.map((blog) => {
        if (blog._id !== blogId) return blog;
        const currentLikes = Number(blog.likeCount || 0);
        const isCurrentlyLiked = Boolean(blog.isLiked);
        return {
          ...blog,
          likeCount: isCurrentlyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1,
          isLiked: !isCurrentlyLiked,
        };
      });

    setBlogs(optimisticUpdate);
    setTrendingBlogs((prev) => rankTrendingPosts(optimisticUpdate(prev)));

    try {
      const response = await blogService.toggleBlogLike(blogId);
      if (response?.localOnly) {
        return;
      }
      const nextLiked = Boolean(response?.liked);
      const nextLikesCount = Number(response?.likesCount || 0);
      const nextBookmarked = typeof response?.isBookmarked === 'boolean' ? response.isBookmarked : undefined;
      const nextBookmarkCount = Number(response?.bookmarkCount || 0);

      const applyServerState = (prevBlogs) =>
        prevBlogs.map((blog) => {
          if (blog._id !== blogId) return blog;
          return {
            ...blog,
            isLiked: nextLiked,
            likeCount: nextLikesCount,
            ...(typeof nextBookmarked === 'boolean' ? { isBookmarked: nextBookmarked } : {}),
            ...(Number.isFinite(nextBookmarkCount) ? { bookmarkCount: nextBookmarkCount } : {}),
          };
        });

      setBlogs(applyServerState);
      setTrendingBlogs((prev) => rankTrendingPosts(applyServerState(prev)));
    } catch (error) {
      console.error('Error liking blog:', error);
      setBlogs(previousBlogs);
      setTrendingBlogs(previousTrending);
    }
  };


  // No early loading return here to allow skeletons and filters to show


  if (error && blogs.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.softWhite }}>
        <Header title="Community" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="cloud-offline-outline" size={64} color="#EF4444" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#1F2937', marginTop: 16, marginBottom: 8 }}>Connection Error</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 }}>{error}</Text>
          <TouchableOpacity
            style={{
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: Colors.primaryGreen,
              borderRadius: 8,
            }}
            onPress={() => fetchBlogs()}
          >
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#FFFFFF',
            }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.softWhite }}>
      <Header
        title="Community"
        rightActions={[
          { icon: 'search', onPress: () => setShowSearch(!showSearch), size: 20 },
          { icon: 'add', onPress: handleCreateBlog, color: Colors.white, style: { backgroundColor: Colors.deepForest, ...Shadows.floating }, size: 24 }
        ]}
      />

      {/* Search Bar */}
      {showSearch && (
        <View style={s.searchContainer}>
          <View style={s.searchBar}>
            <Ionicons name="search" size={20} color={Colors.textLight} />
            <TextInput
              style={s.searchInput}
              placeholder="Search community posts..."
              placeholderTextColor={Colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={showSearch}
            />
            {searching && (
              <ActivityIndicator size="small" color={Colors.primaryGreen} />
            )}
            {searchQuery && !searching && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Tab Navigation */}
      <View style={s.tabContainer}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'discover' && s.tabActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[s.tabText, activeTab === 'discover' && s.tabTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
        {user && (
          <TouchableOpacity
            style={[s.tab, activeTab === 'my-blogs' && s.tabActive]}
            onPress={() => setActiveTab('my-blogs')}
          >
            <Text style={[s.tabText, activeTab === 'my-blogs' && s.tabTextActive]}>
              My Blogs
            </Text>
          </TouchableOpacity>
        )}
        {user && (
          <TouchableOpacity
            style={[s.tab, activeTab === 'saved' && s.tabActive]}
            onPress={() => setActiveTab('saved')}
          >
            <Text style={[s.tabText, activeTab === 'saved' && s.tabTextActive]}>
              Saved
            </Text>
          </TouchableOpacity>
        )}
      </View>


      {/* Category Filter (only for discover tab) */}
      {activeTab === 'discover' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.categoriesContainer}
          style={s.categoriesWrapper}
        >
          {blogCategories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                s.categoryChip,
                selectedCategory === category && s.categoryChipSelected
              ]}
              onPress={() => {
                setSelectedCategory(category);
                pageRef.current = 1;
                setBlogs([]);
                setHasMore(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                s.categoryText,
                selectedCategory === category && s.categoryTextSelected
              ]}>
                {categoryDisplayNames[category] || category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Content */}
      {activeTab === 'discover' ? (
        <FlatList
          data={loading ? [1, 2, 3] : blogs}
          renderItem={loading ? renderSkeleton : renderBlogPost}
          keyExtractor={(item, index) => loading ? `skeleton-${index}` : item._id}
          ListHeaderComponent={!loading && !searchQuery ? renderTrendingSection : null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.deepForest} />
          }
          contentContainerStyle={s.blogList}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={s.loadingMore}>
                <ActivityIndicator size="small" color={Colors.primaryGreen} />
                <Text style={s.loadingMoreText}>Loading more...</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={!loading && (
            <View style={s.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={Colors.lightGray} />
              <Text style={s.emptyTitle}>No blogs yet</Text>
              <Text style={s.emptyText}>Be the first to share your herbal experience!</Text>
              <TouchableOpacity style={s.emptyButton} onPress={handleCreateBlog}>
                <Text style={s.emptyButtonText}>Create Your First Blog</Text>
              </TouchableOpacity>
            </View>
          )}
        />

      ) : activeTab === 'my-blogs' ? (
        <FlatList
          data={myBlogs}
          renderItem={renderMyBlog}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.deepForest} />
          }
          contentContainerStyle={s.blogList}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Ionicons name="create-outline" size={64} color={Colors.lightGray} />
              <Text style={s.emptyTitle}>No blogs yet</Text>
              <Text style={s.emptyText}>Start writing about your herbal journey!</Text>
              <TouchableOpacity style={s.emptyButton} onPress={handleCreateBlog}>
                <Text style={s.emptyButtonText}>Create Your First Blog</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={savedBlogs}
          renderItem={renderBlogPost}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.deepForest} />
          }
          contentContainerStyle={s.blogList}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Ionicons name="bookmark-outline" size={64} color={Colors.lightGray} />
              <Text style={s.emptyTitle}>No saved blogs</Text>
              <Text style={s.emptyText}>Tap the bookmark icon on any post to save it for later.</Text>
            </View>
          }
        />
      )}

      <View style={{ height: 40 }} />
    </View>
  );
}

const s = StyleSheet.create({
  searchContainer: {
    backgroundColor: Colors.white,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.softWhite,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: Colors.textMain,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 24,
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    ...Shadows.small,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primaryGreen,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: Colors.primaryGreen,
    fontWeight: '800',
  },
  categoriesWrapper: {
    backgroundColor: Colors.softWhite,
    height: 67, // Fixed height to prevent shifting
  },
  categoriesContainer: {
    paddingHorizontal: 24,
    alignItems: 'center', // Center chips vertically
    height: 55,
  },
  categoryChip: {
    height: 38, // Fixed chip height
    paddingHorizontal: 16,
    justifyContent: 'center', // Center text
    borderRadius: Radius.pill,
    backgroundColor: Colors.white,
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#F1F5F9',
    ...Shadows.small,
  },
  categoryChipSelected: {
    backgroundColor: Colors.deepForest,
    borderColor: Colors.deepForest,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    minWidth: 40, // Ensure text has enough space
  },
  categoryTextSelected: {
    color: Colors.white,
    fontWeight: '800',
  },
  blogList: {
    paddingVertical: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.deepForest,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginHorizontal: 48,
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: Colors.primaryGreen,
    borderRadius: Radius.pill,
    ...Shadows.floating,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingMoreText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
  },
  trendingSection: {
    marginBottom: 16,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.deepForest,
    marginLeft: 8,
  },
  trendingList: {
    paddingHorizontal: 24,
  },
  trendingBlogCard: {
    width: 160,
    marginRight: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    ...Shadows.small,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  trendingImage: {
    width: '100%',
    height: 90,
    backgroundColor: Colors.lightGray,
  },
  trendingInfo: {
    padding: 10,
  },
  trendingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
    lineHeight: 18,
    height: 36,
  },
  trendingStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendingStatText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },
  skeletonCard: {
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: Radius.lg,
    marginBottom: 16,
    marginHorizontal: 24,
    ...Shadows.neumorphic,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.lightGray,
    marginRight: 14,
  },
  skeletonName: {
    width: 120,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.lightGray,
    marginBottom: 8,
  },
  skeletonTime: {
    width: 80,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.lightGray,
  },
  skeletonTitle: {
    width: '100%',
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.lightGray,
    marginBottom: 12,
  },
  skeletonImage: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    backgroundColor: Colors.lightGray,
  },
});


export default CommunityScreen;

