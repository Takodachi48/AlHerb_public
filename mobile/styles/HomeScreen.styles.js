import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  scrollContent: {
    paddingBottom: 120,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  greeting: { color: '#999' },
  userName: { fontSize: 26, fontWeight: '700' },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchCard: { marginHorizontal: 20, marginBottom: 16 },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E8E6',
  },
  input: { marginLeft: 8, flex: 1 },

  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkText: { color: '#7CB342', fontWeight: '600' },

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E6',
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTitle: { fontWeight: '700' },
  actionSubtitle: { fontSize: 12, color: '#777' },

  herbCard: {
    width: 220,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E8E8E6',
  },
  herbName: { fontWeight: '700', fontSize: 16 },
  herbDescription: { color: '#777', marginVertical: 6 },
  benefitsContainer: { flexDirection: 'row', gap: 6 },
  benefitTag: {
    backgroundColor: '#FAFAF8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  benefitText: { fontSize: 11 },

  interactionCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  interactionTitle: { fontSize: 16, fontWeight: '700' },
  interactionDescription: { fontSize: 13, marginVertical: 8 },
  interactionActions: { flexDirection: 'row', gap: 10 },
  interactionButton: {
    flex: 1,
    backgroundColor: '#7CB342',
    padding: 10,
    borderRadius: 8,
  },
  interactionButtonText: { color: '#FFF', textAlign: 'center' },
  interactionButtonOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#7CB342',
    padding: 10,
    borderRadius: 8,
  },
  interactionButtonOutlineText: {
    color: '#7CB342',
    textAlign: 'center',
  },

  blogCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E6',
  },
  blogMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  blogCategory: { color: '#7CB342', fontWeight: '700', fontSize: 11 },
  blogRead: { fontSize: 11, color: '#AAA' },
  blogTitle: { fontWeight: '700', marginVertical: 4 },
  blogExcerpt: { fontSize: 13, color: '#777' },

  disclaimerCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E6',
  },
  disclaimerTitle: { fontWeight: '700', marginBottom: 6 },
  disclaimerText: { fontSize: 12, color: '#777' },
});
