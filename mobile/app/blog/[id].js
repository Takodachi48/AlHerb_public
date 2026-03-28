import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    StyleSheet,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,

} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { blogService } from '../../services/apiServices';
import Header from '../../components/common/Header';
import { debugLog } from '../../utils/logger';

import { Colors, Shadows, Radius } from '../../styles/DesignSystem';

export default function BlogArticleScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { user } = useAuth();
    const [article, setArticle] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [submittingReply, setSubmittingReply] = useState(false);
    const [error, setError] = useState(null);
    const [resolvedBlogId, setResolvedBlogId] = useState(null);
    const [replyingToId, setReplyingToId] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentText, setEditingCommentText] = useState('');
    const [expandedReplies, setExpandedReplies] = useState({});
    const [commentLikeBusy, setCommentLikeBusy] = useState({});
    const [blogLikeBusy, setBlogLikeBusy] = useState(false);

    const normalizeComment = useCallback(function normalizeComment(comment) {
        if (!comment || typeof comment !== 'object') return null;
        const isRemoved = Boolean(comment.isDeleted || comment.isRemoved);
        const fallbackRemovalNote = isRemoved
            ? (comment.removedBy === 'admin' || comment.removedBy === 'moderator'
                ? 'Comment removed by admin/moderator'
                : 'Comment removed by user')
            : '';
        return {
            ...comment,
            author: comment.author || null,
            content: isRemoved
                ? (comment.removalNote || fallbackRemovalNote)
                : (typeof comment.content === 'string' ? comment.content : ''),
            createdAt: comment.createdAt || new Date().toISOString(),
            likeCount: Number(comment.likeCount || 0),
            isLiked: Boolean(comment.isLiked),
            isRemoved,
            replies: Array.isArray(comment.replies)
                ? comment.replies.map(normalizeComment).filter(Boolean)
                : [],
        };
    }, []);

    const canManageComment = (comment) => {
        if (!user || !comment) return false;
        const ownerId = comment?.author?._id || comment?.author?.id || null;
        return ownerId === user._id || user.role === 'admin' || user.role === 'moderator';
    };

    const loadComments = useCallback(async (blogId) => {
        try {
            const commentsData = await blogService.getBlogComments(blogId);
            // Backend returns { entries: [...] } in the data property
            const rawComments = Array.isArray(commentsData?.entries)
                ? commentsData.entries
                : (Array.isArray(commentsData) ? commentsData : []);
            setComments(rawComments.map(normalizeComment).filter(Boolean));
        } catch (err) {
            debugLog('❌ Error loading comments:', err);
        }
    }, [normalizeComment]);

    const renderAvatar = (photoUrl, style, iconSize = 18) => {
        if (photoUrl) {
            return <Image source={{ uri: photoUrl }} style={style} />;
        }

        return (
            <View style={[style, s.avatarFallback]}>
                <Ionicons name="person" size={iconSize} color="#6B7280" />
            </View>
        );
    };

    useEffect(() => {
        const fetchArticle = async () => {
            if (!id) {
                debugLog('❌ No blog ID provided');
                return;
            }

            try {
                debugLog('🔍 Starting blog detail fetch for ID:', id);
                setLoading(true);
                setError(null);

                const data = await blogService.getBlogById(id);
                debugLog('✅ Blog data received:', data);
                // Handle nested response structure
                const blogData = data.data || data; // Use data.data if it exists, otherwise use data directly
                debugLog('🔍 Processed blog data:', blogData);
                debugLog('🔍 Author data:', blogData.author);
                debugLog('🔍 Author name:', blogData.author?.name);
                debugLog('🔍 Author avatar:', blogData.author?.avatar);
                debugLog('🔍 Author displayName:', blogData.author?.displayName);
                setArticle(blogData);
                setResolvedBlogId(blogData?._id || null);

                // Fetch comments
                const commentBlogId = blogData?._id || id;
                debugLog('Fetching comments for blog ID:', commentBlogId);
                await loadComments(commentBlogId);
            } catch (err) {
                console.error('❌ Error fetching blog article:', err);
                console.error('❌ Error response:', err.response);
                console.error('❌ Error status:', err.response?.status);
                console.error('❌ Error data:', err.response?.data);
                setError('Failed to load article.');
            } finally {
                setLoading(false);
            }
        };

        fetchArticle();
    }, [id, loadComments]);

    const handleAddComment = async () => {
        if (!user) {
            debugLog('❌ User not logged in for comment');
            router.push('/auth/login');
            return;
        }

        if (!newComment.trim()) {
            debugLog('❌ Empty comment submitted');
            return;
        }

        const targetBlogId = resolvedBlogId || id;
        debugLog('Adding comment to blog:', targetBlogId);
        debugLog('🔍 Comment content:', newComment.trim());

        setSubmittingComment(true);
        try {
            const commentData = {
                content: newComment.trim(),
                blogId: targetBlogId,
            };

            const response = await blogService.addBlogComment(targetBlogId, commentData);
            debugLog('✅ Comment added successfully:', response.data);
            setNewComment('');
            await loadComments(targetBlogId);
        } catch (error) {
            console.error('❌ Error adding comment:', error);
            console.error('❌ Error response:', error.response);
            Alert.alert('Error', 'Failed to add comment');
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleReply = async (parentId) => {
        if (!user) {
            debugLog('❌ User not logged in for reply');
            router.push('/auth/login');
            return;
        }

        const content = String(replyText || '').trim();
        if (!content) {
            debugLog('❌ Empty reply submitted');
            return;
        }

        const targetBlogId = resolvedBlogId || id;
        debugLog('⤴️ Posting reply to parent:', parentId);
        debugLog('   Blog ID:', targetBlogId);

        setSubmittingReply(true);
        try {
            const commentData = {
                content,
                blogId: targetBlogId,
                parentId,
            };

            const response = await blogService.addBlogComment(targetBlogId, commentData);
            debugLog('✅ Reply added successfully:', response);
            setReplyText('');
            setReplyingToId(null);
            await loadComments(targetBlogId);
        } catch (error) {
            console.error('❌ Error adding reply:', error);
            console.error('❌ Error details:', error.response?.data);
            Alert.alert('Error', 'Failed to add reply. ' + (error.response?.data?.message || ''));
        } finally {
            setSubmittingReply(false);
        }
    };

    const handleSaveEdit = async (commentId) => {
        const content = String(editingCommentText || '').trim();
        if (!content) return;

        const targetBlogId = resolvedBlogId || id;
        try {
            await blogService.updateBlogComment(commentId, content);
            setEditingCommentId(null);
            setEditingCommentText('');
            await loadComments(targetBlogId);
        } catch {
            Alert.alert('Error', 'Failed to update comment');
        }
    };

    const handleDeleteComment = async (commentId) => {
        Alert.alert(
            'Remove Comment',
            'Are you sure you want to remove this comment?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        const targetBlogId = resolvedBlogId || id;
                        try {
                            await blogService.deleteBlogComment(commentId);
                            await loadComments(targetBlogId);
                        } catch {
                            Alert.alert('Error', 'Failed to remove comment');
                        }
                    }
                }
            ]
        );
    };

    const toggleCommentLikeLocal = (items, commentId, liked, likeCount) => (
        items.map((item) => {
            if (item._id === commentId) {
                return { ...item, isLiked: liked, likeCount };
            }

            if (Array.isArray(item.replies) && item.replies.length > 0) {
                return { ...item, replies: toggleCommentLikeLocal(item.replies, commentId, liked, likeCount) };
            }

            return item;
        })
    );

    const findComment = (items, commentId) => {
        for (const item of items) {
            if (item._id === commentId) return item;
            if (Array.isArray(item.replies) && item.replies.length > 0) {
                const nested = findComment(item.replies, commentId);
                if (nested) return nested;
            }
        }
        return null;
    };

    const handleToggleCommentLike = async (commentId) => {
        if (!user || commentLikeBusy[commentId]) return;
        const current = findComment(comments, commentId);
        if (!current || current.isRemoved) return;

        const nextLiked = !Boolean(current.isLiked);
        const nextCount = nextLiked
            ? Number(current.likeCount || 0) + 1
            : Math.max(0, Number(current.likeCount || 0) - 1);

        setCommentLikeBusy((prev) => ({ ...prev, [commentId]: true }));
        setComments((prev) => toggleCommentLikeLocal(prev, commentId, nextLiked, nextCount));

        try {
            const response = await blogService.toggleCommentLike(commentId);
            const payload = response?.data || response || {};
            if (payload?.commentId) {
                setComments((prev) => toggleCommentLikeLocal(
                    prev,
                    payload.commentId,
                    Boolean(payload.liked),
                    Number(payload.likeCount || 0)
                ));
            }
        } catch (err) {
            debugLog('❌ Error toggling comment like:', err);
            setComments((prev) => toggleCommentLikeLocal(prev, commentId, Boolean(current.isLiked), Number(current.likeCount || 0)));
        } finally {
            setCommentLikeBusy((prev) => ({ ...prev, [commentId]: false }));
        }
    };

    const handleToggleBlogLike = async () => {
        if (!user || !article || blogLikeBusy) return;

        const blogId = resolvedBlogId || (article._id ? String(article._id) : null);
        if (!blogId) return;

        const currentLiked = Boolean(article.isLiked);
        const currentCount = Number(article.likeCount || 0);

        const nextLiked = !currentLiked;
        const nextCount = nextLiked ? currentCount + 1 : Math.max(0, currentCount - 1);

        // Optimistic update
        setArticle(prev => ({
            ...prev,
            isLiked: nextLiked,
            likeCount: nextCount
        }));
        setBlogLikeBusy(true);

        try {
            const response = await blogService.toggleBlogLike(blogId);
            const payload = response?.data || response || {};

            if (payload && typeof payload.liked === 'boolean') {
                setArticle(prev => ({
                    ...prev,
                    isLiked: payload.liked,
                    likeCount: Number(payload.likesCount || payload.likeCount || nextCount)
                }));
            }
        } catch (error) {
            console.error('❌ Error toggling blog like:', error);
            // Rollback on error
            setArticle(prev => ({
                ...prev,
                isLiked: currentLiked,
                likeCount: currentCount
            }));
        } finally {
            setBlogLikeBusy(false);
        }
    };

    const renderComment = (comment, depth = 0) => {
        const isEditing = editingCommentId === comment._id;
        const canManage = canManageComment(comment);
        const replies = Array.isArray(comment.replies) ? comment.replies : [];
        const hasReplies = replies.length > 0;
        const showReplies = expandedReplies[comment._id] === true;

        return (
            <View key={comment._id} style={[s.commentCard, depth > 0 && s.replyCommentCard]}>
                <View style={s.commentHeader}>
                    {renderAvatar(comment.author?.photoURL, s.commentAvatar, 16)}
                    <View style={s.commentAuthorInfo}>
                        <Text style={s.commentAuthor}>{comment.author?.displayName || 'User'}</Text>
                        <Text style={s.commentDate}>{new Date(comment.createdAt).toLocaleDateString()}</Text>
                    </View>
                </View>

                {isEditing && !comment.isRemoved ? (
                    <>
                        <TextInput
                            style={s.commentInput}
                            value={editingCommentText}
                            onChangeText={setEditingCommentText}
                            multiline
                            placeholder="Update comment..."
                            placeholderTextColor={Colors.textLight}
                        />
                        <View style={s.commentActions}>
                            <TouchableOpacity style={s.inlineActionBtn} onPress={() => handleSaveEdit(comment._id)}>
                                <Text style={s.inlineActionText}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={s.inlineActionBtn}
                                onPress={() => {
                                    setEditingCommentId(null);
                                    setEditingCommentText('');
                                }}
                            >
                                <Text style={s.inlineActionText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <Text style={[s.commentContent, comment.isRemoved && s.commentRemoved]}>
                        {comment.content}
                    </Text>
                )}

                {!comment.isRemoved && (
                    <View style={s.commentActions}>
                        <TouchableOpacity
                            style={s.actionIconBtn}
                            onPress={() => handleToggleCommentLike(comment._id)}
                            disabled={Boolean(commentLikeBusy[comment._id])}
                        >
                            <Ionicons name={comment.isLiked ? "heart" : "heart-outline"} size={16} color={comment.isLiked ? "#EF4444" : Colors.textSecondary} />
                            <Text style={[s.actionIconText, comment.isLiked && { color: "#EF4444" }]}>
                                {commentLikeBusy[comment._id] ? '...' : (comment.likeCount || 0)}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={s.actionIconBtn}
                            onPress={() => {
                                setReplyingToId(comment._id);
                                setReplyText('');
                            }}
                        >
                            <Ionicons name="arrow-undo-outline" size={16} color={Colors.textSecondary} />
                            <Text style={s.actionIconText}>Reply</Text>
                        </TouchableOpacity>

                        {canManage && (
                            <>
                                {comment.author?._id === user?._id && (
                                    <TouchableOpacity
                                        style={s.actionIconBtn}
                                        onPress={() => {
                                            setEditingCommentId(comment._id);
                                            setEditingCommentText(comment.content);
                                        }}
                                    >
                                        <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
                                        <Text style={s.actionIconText}>Edit</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity style={s.actionIconBtn} onPress={() => handleDeleteComment(comment._id)}>
                                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                    <Text style={s.actionIconDangerText}>Delete</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}

                {replyingToId === comment._id && !comment.isRemoved && (
                    <View style={s.replyBox}>
                        <TextInput
                            style={s.commentInput}
                            placeholder="Write a reply..."
                            placeholderTextColor={Colors.textLight}
                            value={replyText}
                            onChangeText={setReplyText}
                            multiline
                        />
                        <View style={s.commentActions}>
                            <TouchableOpacity
                                style={[s.actionIconBtn, submittingReply && { opacity: 0.7 }]}
                                onPress={() => handleReply(comment._id)}
                                disabled={submittingReply}
                            >
                                <Ionicons name="send" size={16} color={Colors.primaryGreen} />
                                <Text style={[s.actionIconText, { color: Colors.primaryGreen }]}>{submittingReply ? 'Sending...' : 'Post Reply'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={s.actionIconBtn}
                                onPress={() => {
                                    setReplyingToId(null);
                                    setReplyText('');
                                }}
                            >
                                <Ionicons name="close" size={16} color={Colors.textSecondary} />
                                <Text style={s.actionIconText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {hasReplies && (
                    <TouchableOpacity
                        style={s.actionIconBtn}
                        onPress={() => setExpandedReplies((prev) => ({ ...prev, [comment._id]: !prev[comment._id] }))}
                    >
                        <Ionicons name={showReplies ? "chevron-up" : "chevron-down"} size={16} color={Colors.primaryGreen} />
                        <Text style={[s.actionIconText, { color: Colors.primaryGreen }]}>
                            {showReplies ? `Hide Replies (${replies.length})` : `Show Replies (${replies.length})`}
                        </Text>
                    </TouchableOpacity>
                )}

                {showReplies && replies.map((reply) => renderComment(reply, depth + 1))}
            </View>
        );
    };


    if (loading) {
        return (
            <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primaryGreen} />
            </View>
        );
    }

    if (error || !article) {
        return (
            <View style={s.errorContainer}>
                <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
                <Text style={s.errorText}>{error || 'Article not found'}</Text>
                <TouchableOpacity
                    style={s.retryButton}
                    onPress={() => router.back()}
                >
                    <Text style={s.retryButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={s.container}>
            <Header
                title="Article"
                showBack={true}
                rightActions={[
                    { icon: 'share-outline', onPress: () => { }, size: 22 }
                ]}
            />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView showsVerticalScrollIndicator={false}>
                    {article.featuredImage?.url && (
                        <Image
                            source={{ uri: article.featuredImage.url }}
                            style={s.mainImage}
                            resizeMode="cover"
                        />
                    )}

                    <View style={s.content}>
                        <View style={s.categoryBadge}>
                            <Text style={s.categoryText}>{article.category?.replace('_', ' ') || 'Herbal'}</Text>
                        </View>

                        <Text style={s.title}>{article.title}</Text>

                        <View style={s.authorSection}>
                            {renderAvatar(article.author?.photoURL, s.authorAvatar, 20)}
                            <View>
                                <Text style={s.authorName}>{article.author?.displayName || 'Community Member'}</Text>
                                <Text style={s.publishDate}>
                                    {new Date(article.publishedAt || article.createdAt).toLocaleDateString()} • {article.readTime || '5 min read'}
                                </Text>
                            </View>
                        </View>

                        <Text style={s.articleBody}>{article.content || article.excerpt || 'No content available.'}</Text>

                        {/* Engagement Section */}
                        <View style={s.articleEngagement}>
                            <TouchableOpacity
                                style={[s.likeButton, article.isLiked && s.likedButton]}
                                onPress={handleToggleBlogLike}
                                disabled={blogLikeBusy}
                            >
                                <Ionicons
                                    name={article.isLiked ? "heart" : "heart-outline"}
                                    size={22}
                                    color={article.isLiked ? Colors.white : Colors.textMain}
                                />
                                <Text style={[s.likeButtonText, article.isLiked && s.likedButtonText]}>
                                    {article.isLiked ? 'Liked' : 'Like'} ({article.likeCount || 0})
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={s.shareButton}>
                                <View style={s.engagementIcon}>
                                    <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
                                    <Text style={s.engagementText}>{comments.length}</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Comments Section */}
                        <View style={s.commentsSection}>
                            <Text style={s.sectionTitle}>Comments ({comments.length})</Text>

                            <View style={s.commentInputContainer}>
                                <TextInput
                                    style={s.commentInput}
                                    placeholder="Share your thoughts..."
                                    placeholderTextColor={Colors.textLight}
                                    value={newComment}
                                    onChangeText={setNewComment}
                                    multiline
                                />
                                <TouchableOpacity
                                    style={[s.submitButton, submittingComment && { opacity: 0.7 }]}
                                    onPress={handleAddComment}
                                    disabled={submittingComment}
                                >
                                    {submittingComment ? (
                                        <ActivityIndicator size="small" color={Colors.white} />
                                    ) : (
                                        <Ionicons name="send" size={20} color={Colors.white} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {comments.filter(Boolean).map((comment) => renderComment(comment))}
                        </View>
                    </View>
                    <View style={{ height: 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
    },
    mainImage: {
        width: '100%',
        height: 240,
        backgroundColor: Colors.lightGray,
    },
    content: {
        padding: 24,
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.sageGreen,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: Radius.pill,
        marginBottom: 16,
    },
    categoryText: {
        fontSize: 12,
        fontWeight: '800',
        color: Colors.deepForest,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: Colors.textMain,
        lineHeight: 34,
        marginBottom: 20,
    },
    authorSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    authorAvatar: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: Colors.lightGray,
        marginRight: 14,
    },
    authorName: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.textMain,
    },
    publishDate: {
        fontSize: 13,
        color: Colors.textLight,
        marginTop: 2,
    },
    articleBody: {
        fontSize: 16,
        lineHeight: 26,
        color: Colors.textSecondary,
        marginBottom: 32,
    },
    commentsSection: {
        marginTop: 24,
        paddingTop: 32,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors.deepForest,
        marginBottom: 24,
    },
    commentInputContainer: {
        flexDirection: 'row',
        marginBottom: 32,
        alignItems: 'flex-start',
    },
    commentInput: {
        flex: 1,
        backgroundColor: Colors.softWhite,
        borderRadius: Radius.md,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: Colors.textMain,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        minHeight: 50,
        maxHeight: 120,
    },
    submitButton: {
        width: 50,
        height: 50,
        borderRadius: Radius.md,
        backgroundColor: Colors.primaryGreen,
        marginLeft: 12,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadows.floating,
    },
    commentCard: {
        marginBottom: 16,
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: Radius.lg,
        ...Shadows.light,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
    },
    replyCommentCard: {
        marginTop: 8,
        marginLeft: 24,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primaryGreen,
        borderRadius: Radius.md,
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.03)',
        padding: 12,
        ...Shadows.none,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    commentAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.lightGray,
        marginRight: 10,
    },
    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E5E7EB',
    },
    commentAuthorInfo: {
        justifyContent: 'center',
    },
    commentAuthor: {
        fontSize: 14,
        fontWeight: '800',
        color: Colors.textMain,
    },
    commentDate: {
        fontSize: 12,
        color: Colors.textLight,
        marginTop: 2,
    },
    commentContent: {
        fontSize: 15,
        lineHeight: 22,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    commentRemoved: {
        fontStyle: 'italic',
        color: Colors.textLight,
    },
    commentActions: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
        marginTop: 12,
    },
    actionIconBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: Radius.sm,
        backgroundColor: 'transparent',
    },
    actionIconText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.textSecondary,
        marginLeft: 4,
    },
    actionIconDangerText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#EF4444',
        marginLeft: 4,
    },
    inlineActionBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
    },
    inlineActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    replyBox: {
        marginTop: 12,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.white,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: Colors.white,
    },
    errorText: {
        fontSize: 16,
        color: '#EF4444',
        textAlign: 'center',
        marginTop: 16,
    },
    retryButton: {
        marginTop: 24,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: Colors.primaryGreen,
        borderRadius: Radius.pill,
    },
    retryButtonText: {
        color: Colors.white,
        fontWeight: '800',
    },
    articleEngagement: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 20,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
        marginBottom: 32,
    },
    likeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.softWhite,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        marginRight: 16,
    },
    likedButton: {
        backgroundColor: '#EF4444',
        borderColor: '#EF4444',
    },
    likeButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.textMain,
        marginLeft: 8,
    },
    likedButtonText: {
        color: Colors.white,
    },
    shareButton: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    engagementIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 16,
    },
    engagementText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginLeft: 6,
    },
});




