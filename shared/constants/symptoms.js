// Common symptoms categorized by body system for the Herbal Medicine System
export const SYMPTOM_CATEGORIES = {
  DIGESTIVE: 'digestive',
  RESPIRATORY: 'respiratory',
  PAIN: 'pain',               // Combines musculoskeletal + general pain
  SKIN: 'skin',
  SLEEP_STRESS: 'sleep_stress', // Combines sleep & mild mental symptoms
  MENSTRUAL: 'menstrual',
  GENERAL_WELLNESS: 'general_wellness',
};

export const COMMON_SYMPTOMS = {
  [SYMPTOM_CATEGORIES.DIGESTIVE]: [
    'indigestion',
    'bloating',
    'gas',
    'constipation',
    'diarrhea',
    'nausea',
    'vomiting',
    'acid reflux',
    'stomach pain',
    'abdominal cramps',
    'heartburn',
    'loss of appetite',
  ],
  [SYMPTOM_CATEGORIES.RESPIRATORY]: [
    'cough',
    'sore throat',
    'congestion',
    'runny nose',
    'sinus pressure',
    'postnasal drip',
    'mild shortness of breath',
  ],
  [SYMPTOM_CATEGORIES.PAIN]: [
    'headache',
    'migraine',
    'muscle pain',
    'joint pain',
    'back pain',
    'neck pain',
    'muscle cramps',
    'stiffness',
    'inflammation',
    'sprains',
    'strains',
    'general pain',
  ],
  [SYMPTOM_CATEGORIES.SKIN]: [
    'acne',
    'eczema',
    'psoriasis',
    'rash',
    'dry skin',
    'itching',
    'hives',
    'sunburn',
    'wounds',
    'bruises',
  ],
  [SYMPTOM_CATEGORIES.SLEEP_STRESS]: [
    'insomnia',
    'difficulty sleeping',
    'stress',
    'mild anxiety',
    'nervousness',
    'brain fog',
    'difficulty concentrating',
    'mood swings',
    'irritability',
  ],
  [SYMPTOM_CATEGORIES.MENSTRUAL]: [
    'menstrual cramps',
    'PMS',
    'irregular periods',
    'menopause symptoms',
    'low libido',
  ],
  [SYMPTOM_CATEGORIES.GENERAL_WELLNESS]: [
    'fatigue',
    'weakness',
    'appetite changes',
    'sleep disturbances',
    'mild fever',
  ],
};

export const SEVERITY_LEVELS = {
  MILD: 'mild',
  MODERATE: 'moderate',
};

export const DURATION_TYPES = {
  ACUTE: 'acute',
  CHRONIC: 'chronic',
  EPISODIC: 'episodic',
};

export function getSymptomsByCategory(category) {
  return COMMON_SYMPTOMS[category] || [];
}

export function getAllSymptoms() {
  return Object.values(COMMON_SYMPTOMS).flat();
}

export function getSymptomCategory(symptom) {
  for (const [category, symptoms] of Object.entries(COMMON_SYMPTOMS)) {
    if (symptoms.includes(symptom)) {
      return category;
    }
  }
  return null;
}

export function isValidSymptom(symptom) {
  return getAllSymptoms().includes(symptom);
}

export function getSymptomCategories() {
  return Object.values(SYMPTOM_CATEGORIES);
}
