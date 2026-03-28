import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Shadows, Radius } from '../../styles/DesignSystem';

export const UserBlogCard = ({ item, onPress, onEdit, onArchive, onUnarchive, onSubmitForApproval }) => {
    const [menuOpen, setMenuOpen] = useState(false);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'published': return '#10B981';
            case 'draft': return '#F59E0B';
            case 'review': return '#3B82F6';
            default: return '#6B7280';
        }
    };

    const isDraft = item?.status === 'draft';
    const isArchived = item?.status === 'archived';

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <TouchableOpacity
                style={styles.menuTrigger}
                onPress={(event) => {
                    event?.stopPropagation?.();
                    setMenuOpen((prev) => !prev);
                }}
            >
                <Ionicons name="ellipsis-vertical" size={18} color={Colors.textLight} />
            </TouchableOpacity>

            {menuOpen && (
                <View style={styles.menuPopover}>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={(event) => {
                            event?.stopPropagation?.();
                            setMenuOpen(false);
                            onEdit?.();
                        }}
                    >
                        <Ionicons name="create-outline" size={16} color={Colors.textMain} />
                        <Text style={styles.menuItemText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={(event) => {
                            event?.stopPropagation?.();
                            setMenuOpen(false);
                            if (isArchived) {
                                onUnarchive?.();
                            } else {
                                onArchive?.();
                            }
                        }}
                    >
                        <Ionicons name={isArchived ? 'refresh-outline' : 'archive-outline'} size={16} color={Colors.textMain} />
                        <Text style={styles.menuItemText}>{isArchived ? 'Unarchive' : 'Archive'}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                </Text>
                <Text style={styles.excerpt} numberOfLines={2}>
                    {item.excerpt}
                </Text>

                {item.featuredImage?.url && (
                    <Image source={{ uri: item.featuredImage.url }} style={styles.featuredImage} />
                )}
            </View>

            {/* Stats */}
            <View style={styles.stats}>
                <View style={styles.statItem}>
                    <Ionicons name="eye-outline" size={16} color="#6B7280" />
                    <Text style={styles.statText}>{item.analytics?.views || 0}</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="heart-outline" size={16} color="#6B7280" />
                    <Text style={styles.statText}>{item.likeCount || 0}</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="chatbubble-outline" size={16} color="#6B7280" />
                    <Text style={styles.statText}>{item.commentCount || item.comments?.length || 0}</Text>
                </View>
                <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
            </View>

            {isDraft && (
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.submitButton]}
                        onPress={(event) => {
                            event?.stopPropagation?.();
                            onSubmitForApproval?.();
                        }}
                    >
                        <Ionicons name="send-outline" size={16} color="#FFFFFF" />
                        <Text style={[styles.actionButtonText, styles.submitButtonText]}>Submit for Approval</Text>
                    </TouchableOpacity>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = {
    card: {
        backgroundColor: Colors.white,
        borderRadius: Radius.lg,
        marginBottom: 16,
        padding: 20,
        ...Shadows.neumorphic,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        position: 'relative',
    },
    menuTrigger: {
        position: 'absolute',
        top: 12,
        right: 10,
        padding: 8,
        borderRadius: 16,
        zIndex: 5,
    },
    menuPopover: {
        position: 'absolute',
        top: 42,
        right: 12,
        backgroundColor: Colors.white,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        ...Shadows.small,
        zIndex: 10,
        minWidth: 156,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    menuItemText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textMain,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: Radius.pill,
        marginBottom: 14,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    content: {
        marginBottom: 14,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.textMain,
        marginBottom: 8,
        lineHeight: 24,
    },
    excerpt: {
        fontSize: 14,
        color: Colors.textSecondary,
        lineHeight: 20,
        marginBottom: 14,
    },
    featuredImage: {
        width: '100%',
        height: 140,
        borderRadius: Radius.md,
        marginTop: 10,
        backgroundColor: Colors.lightGray,
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        marginBottom: 14,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 18,
    },
    statText: {
        fontSize: 13,
        color: Colors.textLight,
        marginLeft: 6,
        fontWeight: '600',
    },
    dateText: {
        fontSize: 12,
        color: Colors.textLight,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        flex: 1,
        justifyContent: 'center',
    },
    submitButton: {
        backgroundColor: Colors.primaryGreen,
        borderColor: Colors.primaryGreen,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.deepForest,
        marginLeft: 8,
    },
    submitButtonText: {
        color: '#FFFFFF',
    },
};
