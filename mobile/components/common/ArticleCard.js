import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { styles } from '../../styles/HerbsScreen.styles';

export const ArticleCard = ({ item }) => {
    const router = useRouter();

    return (
        <TouchableOpacity
            style={styles.articleCard}
            onPress={() => router.push(`/blog/${item._id || item.id}`)}
            activeOpacity={0.7}
        >
            <Image source={{ uri: item.featuredImage?.url || item.image || item.imageUrl }} style={styles.articleImage} />
            <View style={styles.articleContent}>
                <View style={styles.articleMeta}>
                    <Text style={styles.articleCategory}>{item.category}</Text>
                    <Text style={styles.articleReadTime}>{item.readTime}</Text>
                </View>
                <Text style={styles.articleTitle}>{item.title}</Text>
                <Text style={styles.articleExcerpt} numberOfLines={3}>
                    {item.excerpt}
                </Text>
                <Text style={styles.articleDate}>{item.date}</Text>
            </View>
        </TouchableOpacity>
    );
};
