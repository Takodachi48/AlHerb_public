import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { styles } from '../../styles/BlogScreen.styles';
import { ArticleCard } from '../../components/common/ArticleCard';
import Header from '../../components/common/Header';

const blogCategories = ['All', 'Health Tips', 'Recipes', 'Research', 'Lifestyle'];

const featuredPost = {
  id: 'featured',
  title: 'The Science Behind Herbal Medicine: What Modern Research Says',
  excerpt: 'Discover the latest scientific studies supporting traditional herbal remedies and their effectiveness in modern healthcare.',
  author: 'Dr. Sarah Chen',
  readTime: '8 min read',
  publishedAt: '2024-01-15',
  category: 'Research',
  featured: true,
};

const blogPosts = [
  {
    id: '1',
    title: '10 Everyday Herbs for Natural Immunity Boost',
    excerpt: 'Learn about common kitchen herbs that can strengthen your immune system naturally.',
    author: 'Maria Rodriguez',
    readTime: '5 min read',
    publishedAt: '2024-01-12',
    category: 'Health Tips',
    featured: false,
  },
  {
    id: '2',
    title: 'Turmeric Golden Milk: Ancient Recipe, Modern Benefits',
    excerpt: 'A delicious and warming drink that combines traditional Ayurvedic wisdom with contemporary wellness needs.',
    author: 'Chef James Park',
    readTime: '4 min read',
    publishedAt: '2024-01-10',
    category: 'Recipes',
    featured: false,
  },
  {
    id: '3',
    title: 'Creating Your Home Herbal Apothecary',
    excerpt: 'Build your personal collection of medicinal herbs and learn how to store and use them effectively.',
    author: 'Emma Thompson',
    readTime: '6 min read',
    publishedAt: '2024-01-08',
    category: 'Lifestyle',
    featured: false,
  },
  {
    id: '4',
    title: 'The Gut-Brain Connection: Herbs for Mental Clarity',
    excerpt: 'Explore how certain herbs can support both digestive health and cognitive function.',
    author: 'Dr. Michael Lee',
    readTime: '7 min read',
    publishedAt: '2024-01-05',
    category: 'Health Tips',
    featured: false,
  },
];

export default function BlogScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredPosts = blogPosts.filter(post =>
    selectedCategory === 'All' || post.category === selectedCategory
  );

  const handlePostPress = (post) => {
    router.push(`/blog/${post.id}`);
  };

  const renderBlogPost = ({ item: post }) => (
    <ArticleCard item={post} />
  );

  return (
    <View style={styles.container}>
      <Header title="Herbal Blog" showBack={true} />

      {/* Featured Post */}
      <TouchableOpacity
        style={styles.featuredCard}
        onPress={() => handlePostPress(featuredPost)}
        activeOpacity={0.8}
      >
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredText}>Featured Article</Text>
        </View>

        <Text style={styles.featuredTitle} numberOfLines={2}>
          {featuredPost.title}
        </Text>
        <Text style={styles.featuredExcerpt} numberOfLines={3}>
          {featuredPost.excerpt}
        </Text>

        <View style={styles.featuredMeta}>
          <Text style={styles.featuredAuthor}>By {featuredPost.author}</Text>
          <Text style={styles.featuredReadTime}>{featuredPost.readTime}</Text>
        </View>
      </TouchableOpacity>

      {/* Categories */}
      <View style={styles.categoriesSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {blogCategories?.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipSelected
              ]}
              onPress={() => setSelectedCategory(category)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextSelected
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Blog Posts */}
      <View style={styles.postsSection}>
        <Text style={styles.sectionTitle}>Latest Articles</Text>
        <FlatList
          data={filteredPosts}
          renderItem={renderBlogPost}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.postsList}
        />
      </View>

      {/* Newsletter Signup */}
      <View style={styles.newsletterCard}>
        <View style={styles.newsletterContent}>
          <Text style={styles.newsletterEmoji}>📧</Text>
          <Text style={styles.newsletterTitle}>Stay Informed</Text>
          <Text style={styles.newsletterText}>
            Get weekly herbal health tips and new article notifications
          </Text>
          <TouchableOpacity style={styles.newsletterButton}>
            <Text style={styles.newsletterButtonText}>Subscribe</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
