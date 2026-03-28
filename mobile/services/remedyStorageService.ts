import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@saved_remedies';

export interface SavedRemedy {
  id: string;
  herbId: string;
  saveKey?: string;
  savedAt: string;
  [key: string]: any;
}

const normalizeSymptomList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const set = new Set<string>();
  value.forEach((item) => {
    const text = String(item || '').trim();
    if (!text) return;
    set.add(text.toLowerCase());
  });
  return Array.from(set).sort();
};

const normalizeText = (value: unknown): string =>
  String(value || '')
    .toLowerCase()
    .trim();

const buildRemedySaveKey = (remedy: any): string => {
  const herbId = String(remedy?.herbId || '').trim();
  const searchMode = normalizeText(remedy?.searchMode || 'symptom') || 'symptom';
  const selectedAge = normalizeText(remedy?.selectedAge || '');
  const selectedGender = normalizeText(remedy?.selectedGender || '');
  const diseaseName = searchMode === 'disease' ? normalizeText(remedy?.diseaseName || '') : '';
  const symptoms = normalizeSymptomList(
    Array.isArray(remedy?.selectedSymptoms) && remedy.selectedSymptoms.length > 0
      ? remedy.selectedSymptoms
      : remedy?.matchedSymptoms,
  );

  return [
    herbId,
    searchMode,
    selectedAge,
    selectedGender,
    diseaseName,
    symptoms.join('|'),
  ].join('::');
};

const remedyStorageService = {
    getRemedySaveKey(remedy: any): string {
        return buildRemedySaveKey(remedy);
    },

    // Save a remedy
    async saveRemedy(remedy: any): Promise<SavedRemedy> {
        try {
            const existing = await this.getSavedRemedies();
            const saveKey = this.getRemedySaveKey(remedy);
            const duplicate = existing.find((item) => item.saveKey === saveKey);

            if (duplicate) {
                return duplicate;
            }

            const newRemedy: SavedRemedy = {
                ...remedy,
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                saveKey,
                savedAt: new Date().toISOString(),
            };
            const updated = [newRemedy, ...existing];
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return newRemedy;
        } catch (error) {
            console.error('Error saving remedy:', error);
            throw error;
        }
    },

    // Get all saved remedies
    async getSavedRemedies(): Promise<SavedRemedy[]> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            const parsed = data ? JSON.parse(data) : [];
            const list = Array.isArray(parsed) ? parsed : [];

            let changed = false;
            const normalized = list.map((item, index) => {
                const normalizedItem: SavedRemedy = {
                    ...item,
                    id: String(item?.id || item?._id || `${Date.now()}_${index}`),
                    herbId: String(item?.herbId || item?.herb?._id || ''),
                    saveKey: String(item?.saveKey || buildRemedySaveKey(item)),
                    savedAt: item?.savedAt || new Date().toISOString(),
                };
                if (
                    normalizedItem.id !== item?.id ||
                    normalizedItem.herbId !== item?.herbId ||
                    normalizedItem.saveKey !== item?.saveKey ||
                    normalizedItem.savedAt !== item?.savedAt
                ) {
                    changed = true;
                }
                return normalizedItem;
            });

            if (changed) {
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
            }

            return normalized;
        } catch (error) {
            console.error('Error loading saved remedies:', error);
            return [];
        }
    },

    // Remove a saved remedy by id
    async removeRemedy(id: string): Promise<boolean> {
        try {
            const existing = await this.getSavedRemedies();
            const updated = existing.filter(r => r.id !== id);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return true;
        } catch (error) {
            console.error('Error removing remedy:', error);
            throw error;
        }
    },

    async findSavedRemedy(remedy: any): Promise<SavedRemedy | null> {
        const existing = await this.getSavedRemedies();
        const saveKey = this.getRemedySaveKey(remedy);
        const match = existing.find((item) => item.saveKey === saveKey);
        return match || null;
    },

    // Check if a remedy is saved for a given herb + symptoms combo
    async isRemedySaved(remedyOrHerbId: any): Promise<boolean> {
        const existing = await this.getSavedRemedies();

        if (typeof remedyOrHerbId === 'string') {
            const herbId = String(remedyOrHerbId).trim();
            return existing.some((item) => item.herbId === herbId);
        }

        const saveKey = this.getRemedySaveKey(remedyOrHerbId);
        return existing.some((item) => item.saveKey === saveKey);
    },

    // Clear all saved remedies
    async clearAll(): Promise<void> {
        await AsyncStorage.removeItem(STORAGE_KEY);
    },
};

export default remedyStorageService;
