import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

const HerbInteractionCard = ({ herb, showInteractions = false }) => {
  const router = useRouter();

  const handleViewInteractions = () => {
    router.push(`/screens/interactions?herb=${herb._id}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.herbName}>{herb.name}</Text>
        {herb.scientificName && (
          <Text style={styles.scientificName}>{herb.scientificName}</Text>
        )}
      </View>
      
      {showInteractions && (
        <TouchableOpacity 
          style={styles.interactionButton}
          onPress={handleViewInteractions}
        >
          <Text style={styles.interactionButtonText}>Check Interactions</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 8,
  },
  herbName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  scientificName: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  interactionButton: {
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  interactionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HerbInteractionCard;
