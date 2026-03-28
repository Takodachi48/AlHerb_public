import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const InteractionSummary = ({ summary }) => {
  if (!summary) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Interaction Summary</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.label}>Total Interactions:</Text>
        <Text style={styles.value}>{summary.totalInteractions}</Text>
      </View>
      {summary.highRiskCount > 0 && (
        <View style={styles.summaryRow}>
          <Text style={[styles.label, styles.highRisk]}>High Risk:</Text>
          <Text style={[styles.value, styles.highRisk]}>{summary.highRiskCount}</Text>
        </View>
      )}
      {summary.moderateRiskCount > 0 && (
        <View style={styles.summaryRow}>
          <Text style={[styles.label, styles.moderateRisk]}>Moderate Risk:</Text>
          <Text style={[styles.value, styles.moderateRisk]}>{summary.moderateRiskCount}</Text>
        </View>
      )}
      {summary.lowRiskCount > 0 && (
        <View style={styles.summaryRow}>
          <Text style={[styles.label, styles.lowRisk]}>Low Risk:</Text>
          <Text style={[styles.value, styles.lowRisk]}>{summary.lowRiskCount}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    color: '#374151',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  highRisk: {
    color: '#EF4444',
  },
  moderateRisk: {
    color: '#F59E0B',
  },
  lowRisk: {
    color: '#10B981',
  },
});

export default InteractionSummary;
