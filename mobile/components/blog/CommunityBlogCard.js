import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Share, Alert, Modal, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { blogService } from '../../services/apiServices';
import { debugLog } from '../../utils/logger';

import { Colors, Shadows, Radius } from '../../styles/DesignSystem';

export const CommunityBlogCard = ({ item, onPress, onLike, onBookmark }) => {
    const [isBookmarked, setIsBookmarked] = useState(item.isBookmarked || false);
    const [bookmarkCount, setBookmarkCount] = useState(item.bookmarkCount || 0);
    const [isLiked, setIsLiked] = useState(item.isLiked || false);
    const [likeCount, setLikeCount] = useState(item.likeCount || 0);
    const [showLikesModal, setShowLikesModal] = useState(false);
    const [likedUsers, setLikedUsers] = useState([]);
    const [loadingLikes, setLoadingLikes] = useState(false);

    // Debug: Log the actual item data
    debugLog('🔍 CommunityBlogCard item data:', JSON.stringify(item, null, 2));
    debugLog('🔍 Author data:', item.author);
    debugLog('🔍 Author displayName:', item.author?.displayName);
    debugLog('🔍 Author photoURL:', item.author?.photoURL);

    // Sync state with props when item changes
    useEffect(() => {
        setIsLiked(item.isLiked || false);
        setLikeCount(item.likeCount || 0);
        setIsBookmarked(item.isBookmarked || false);
        setBookmarkCount(item.bookmarkCount || 0);
    }, [item]);

    const fetchLikedUsers = async () => {
        if (likeCount === 0) return;

        setLoadingLikes(true);
        try {
            // Use blogService instead of direct fetch
            const response = await blogService.getBlogLikes(item._id);
            debugLog('✅ API response:', response);
            debugLog('✅ Liked users:', response.users);
            setLikedUsers(response.users || []);
        } catch (error) {
            console.error('Error fetching liked users:', error);
            setLikedUsers([]);
        } finally {
            setLoadingLikes(false);
        }
    };

    const handleShowLikes = () => {
        debugLog('🔍 Opening likes modal for blog:', item._id);
        setShowLikesModal(true);
        fetchLikedUsers();
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();

        const isToday = date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();

        if (isToday) return 'Today';

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = date.getDate() === yesterday.getDate() &&
            date.getMonth() === yesterday.getMonth() &&
            date.getFullYear() === yesterday.getFullYear();

        if (isYesterday) return 'Yesterday';

        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return date.toLocaleDateString();
    };


    const handleShare = async () => {
        try {
            const result = await Share.share({
                message: `Check out this amazing post: "${item.title}"\n\n${item.excerpt}\n\nRead more on Herbal Community app!`,
                url: `herbal-app://blog/${item._id}`, // Deep link to the blog
                title: item.title,
            });

            if (result.action === Share.sharedAction) {
                debugLog('Blog shared successfully');
            }
        } catch (error) {
            console.error('Error sharing blog:', error);
            Alert.alert('Share Error', 'Unable to share this post. Please try again.');
        }
    };

    const handleBookmark = (e) => {
        e.stopPropagation();
        setIsBookmarked(!isBookmarked);
        setBookmarkCount(prev => isBookmarked ? Math.max(0, prev - 1) : prev + 1);
        if (onBookmark) {
            onBookmark(item._id, !isBookmarked);
        }
    };

    const handleLike = (e) => {
        e.stopPropagation();
        setIsLiked(!isLiked);
        setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
        onLike(item._id);
    };

    return (
        <View style={styles.cardContainer}>
            <TouchableOpacity
                style={styles.card}
                onPress={onPress}
                activeOpacity={0.9}
            >
                {/* Header: Author & Options */}
                <View style={styles.authorHeader}>
                    <View style={styles.authorGroup}>
                        <Image
                            source={{
                                uri: item.author?.photoURL || `https://i.pravatar.cc/150?img=${item.author?._id || '1'}`
                            }}
                            style={styles.avatar}
                        />
                        <View>
                            <Text style={styles.name}>{item.author?.displayName || 'Community Member'}</Text>
                            <Text style={styles.time}>{formatDate(item.publishedAt)} • {item.category?.replace('_', ' ')}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.moreOptions}>
                        <Ionicons name="ellipsis-horizontal" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>

                {/* Main Content Area */}
                <View style={styles.contentArea}>
                    <Text style={styles.blogTitle} numberOfLines={2}>{item.title}</Text>
                    {item.excerpt ? (
                        <Text style={styles.blogExcerpt} numberOfLines={3}>{item.excerpt}</Text>
                    ) : null}
                </View>

                {/* Featured Image - Full Width */}
                {item.featuredImage?.url && (
                    <Image
                        source={{ uri: item.featuredImage.url }}
                        style={styles.mainImage}
                        resizeMode="cover"
                    />
                )}

                {/* Engagement Section */}
                <View style={styles.engagementBar}>
                    <View style={styles.leftActions}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.likeActionBtn]}
                            onPress={handleLike}
                        >
                            <Ionicons
                                name={isLiked ? "heart" : "heart-outline"}
                                size={26}
                                color={isLiked ? "#EF4444" : "#1F2937"}
                            />
                            <Text style={[
                                styles.actionLabel,
                                isLiked && styles.likedLabel
                            ]}>
                                {isLiked ? 'Liked' : 'Like'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
                            <Ionicons name="chatbubble-outline" size={24} color="#1F2937" />
                            <Text style={styles.actionLabel}>Comment</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                            <Ionicons name="paper-plane-outline" size={24} color="#1F2937" />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={handleBookmark}
                    >
                        <Ionicons
                            name={isBookmarked ? "bookmark" : "bookmark-outline"}
                            size={24}
                            color={isBookmarked ? "#10B981" : "#1F2937"}
                        />
                        <Text style={[
                            styles.actionLabel,
                            isBookmarked && styles.savedLabel
                        ]}>
                            {isBookmarked ? 'Saved' : 'Save'}
                        </Text>
                    </TouchableOpacity>

                </View>

                {/* Engagement Info */}
                <View style={styles.engagementInfo}>
                    <TouchableOpacity style={styles.likesInfo} onPress={handleShowLikes}>
                        <Text style={styles.likesText}>
                            <Text style={styles.boldText}>{likeCount.toLocaleString()}</Text> {likeCount === 1 ? 'like' : 'likes'}
                        </Text>
                    </TouchableOpacity>

                    {/* <Text style={styles.dotSeparator}>•</Text>
                    <View style={styles.likesInfo}>
                        <Text style={styles.likesText}>
                            <Text style={styles.boldText}>{(item.analytics?.views || 0).toLocaleString()}</Text> {(item.analytics?.views || 0) === 1 ? 'view' : 'views'}
                        </Text>
                    </View> */}

                    {(item.commentCount > 0 || item.comments?.length > 0) && (
                        <>
                            <Text style={styles.dotSeparator}>•</Text>
                            <TouchableOpacity style={styles.likesInfo} onPress={onPress}>
                                <Text style={styles.likesText}>
                                    <Text style={styles.boldText}>{(item.commentCount || item.comments.length).toLocaleString()}</Text> {(item.commentCount || item.comments.length) === 1 ? 'comment' : 'comments'}
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {bookmarkCount > 0 && (
                        <>
                            <Text style={styles.dotSeparator}>•</Text>
                            <View style={styles.likesInfo}>
                                <Text style={styles.likesText}>
                                    <Text style={styles.boldText}>{bookmarkCount.toLocaleString()}</Text> {bookmarkCount === 1 ? 'save' : 'saves'}
                                </Text>
                            </View>
                        </>
                    )}

                    <Text style={styles.dotSeparator}>•</Text>
                    <View style={styles.likesInfo}>
                        <Text style={styles.likesText}>
                            <Text style={styles.boldText}>{(item.analytics?.views || 0).toLocaleString()}</Text> {(item.analytics?.views || 0) === 1 ? 'view' : 'views'}
                        </Text>
                    </View>

                </View>

                {/* Comment Summary */}
                {(item.commentCount > 0 || item.comments?.length > 0) && (
                    <TouchableOpacity style={styles.commentsLink} onPress={onPress}>
                        <Text style={styles.commentsText}>View all {item.commentCount || item.comments.length} comments</Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>

            {/* Modal remains same or integrated better */}
            <Modal
                visible={showLikesModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowLikesModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Likes</Text>
                            <TouchableOpacity onPress={() => setShowLikesModal(false)}>
                                <Ionicons name="close" size={24} color="#1F2937" />
                            </TouchableOpacity>
                        </View>

                        {loadingLikes ? (
                            <ActivityIndicator size="small" color="#10B981" style={{ margin: 20 }} />
                        ) : (
                            <FlatList
                                data={likedUsers}
                                keyExtractor={(user) => user._id}
                                renderItem={({ item: user }) => (
                                    <View style={styles.modalUserRow}>
                                        <Image
                                            source={{ uri: user.photoURL || `https://i.pravatar.cc/150?img=${user._id}` }}
                                            style={styles.modalAvatar}
                                        />
                                        <Text style={styles.modalUserName}>{user.displayName}</Text>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = {
    cardContainer: {
        marginBottom: 16,
        backgroundColor: Colors.white,
        marginHorizontal: 16,
        borderRadius: Radius.lg,
        ...Shadows.neumorphic,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
    },
    card: {
        paddingVertical: 12,
    },
    authorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    authorGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 12,
        marginRight: 12,
        backgroundColor: Colors.lightGray,
    },
    name: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.textMain,
    },
    time: {
        fontSize: 12,
        color: Colors.textLight,
        marginTop: 2,
    },
    moreOptions: {
        padding: 4,
    },
    contentArea: {
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    blogTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.textMain,
        lineHeight: 24,
        marginBottom: 6,
    },
    blogExcerpt: {
        fontSize: 14,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    mainImage: {
        width: '100%',
        aspectRatio: 1.5,
        backgroundColor: Colors.lightGray,
    },
    engagementBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    leftActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    actionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.textSecondary,
        marginLeft: 6,
    },
    likedLabel: {
        color: '#EF4444',
    },
    savedLabel: {
        color: Colors.primaryGreen,
    },

    likesInfo: {
        marginBottom: 6,
    },
    engagementInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 6,
        gap: 8,
    },
    dotSeparator: {
        fontSize: 14,
        color: Colors.textLight,
        marginBottom: 6,
    },
    likesText: {
        fontSize: 14,
        color: Colors.textMain,
    },
    boldText: {
        fontWeight: '700',
    },
    commentsLink: {
        paddingHorizontal: 16,
        marginTop: 4,
        marginBottom: 8,
    },
    commentsText: {
        fontSize: 14,
        color: Colors.textLight,
        fontWeight: '500',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(20, 83, 45, 0.4)', // Deep forest tinted overlay
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '85%',
        backgroundColor: Colors.white,
        borderRadius: Radius.lg,
        maxHeight: '60%',
        padding: 24,
        ...Shadows.floating,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.deepForest,
    },
    modalUserRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalAvatar: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: Colors.lightGray,
        marginRight: 14,
    },
    modalUserName: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.textMain,
    },
};
