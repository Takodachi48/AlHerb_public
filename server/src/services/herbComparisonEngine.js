const SCORE_WEIGHTS = Object.freeze({
  symptomMatch: 30,
  dosageClarity: 15,
  preparationFlexibility: 15,
  phytochemicalDiversity: 10,
  evidenceStrength: 20,
  safetyClarity: 10,
});

const PREPARATION_EASE = Object.freeze({
  tea: 3,
  infusion: 3,
  decoction: 3,
  poultice: 2,
  compress: 2,
  syrup: 2,
  powder: 2,
  capsule: 2,
  ointment: 2,
  salve: 2,
  tincture: 1,
  extract: 1,
  essential_oil: 1,
});

const normalizeString = (value = '') => String(value).trim().toLowerCase();

const toUniqueNormalizedArray = (items = []) => {
  const entries = (items || [])
    .map((item) => normalizeString(item))
    .filter(Boolean);
  return [...new Set(entries)];
};

const buildSymptomComparison = (herb1, herb2, symptom) => {
  const symptoms1 = toUniqueNormalizedArray(herb1.symptoms);
  const symptoms2 = toUniqueNormalizedArray(herb2.symptoms);
  const set1 = new Set(symptoms1);
  const set2 = new Set(symptoms2);

  const sharedSymptoms = symptoms1.filter((value) => set2.has(value));
  const uniqueToHerb1 = symptoms1.filter((value) => !set2.has(value));
  const uniqueToHerb2 = symptoms2.filter((value) => !set1.has(value));

  const compareSymptomMatch = (candidateSymptoms, needle) => {
    if (!needle) return { status: 'not_evaluated', label: 'Not evaluated', score: 0 };

    const normalizedNeedle = normalizeString(needle);
    const exactMatch = candidateSymptoms.some((item) => item === normalizedNeedle);
    if (exactMatch) return { status: 'strong', label: 'Strong match', score: 1 };

    const partialMatch = candidateSymptoms.some(
      (item) => item.includes(normalizedNeedle) || normalizedNeedle.includes(item)
    );
    if (partialMatch) return { status: 'partial', label: 'Partial match', score: 0.5 };

    return { status: 'none', label: 'Not listed', score: 0 };
  };

  const symptomMatch = {
    target: symptom || null,
    herb1: compareSymptomMatch(symptoms1, symptom),
    herb2: compareSymptomMatch(symptoms2, symptom),
  };

  return {
    sharedSymptoms,
    uniqueToHerb1,
    uniqueToHerb2,
    symptomMatch,
  };
};

const dosageCompleteness = (dosage = {}) => {
  if (!dosage || typeof dosage !== 'object') return 0;
  const fields = ['min', 'max', 'frequency', 'unit'];
  const filled = fields.filter((field) => normalizeString(dosage[field]).length > 0).length;
  return filled / fields.length;
};

const buildDosageComparison = (herb1, herb2, ageGroup) => {
  const selectedAgeGroup = ['adult', 'child', 'elderly'].includes(ageGroup) ? ageGroup : 'adult';
  const dosage1 = herb1.dosage?.[selectedAgeGroup] || null;
  const dosage2 = herb2.dosage?.[selectedAgeGroup] || null;
  const dosageSourceCount1 = Array.isArray(herb1.dosage?.sources) ? herb1.dosage.sources.length : 0;
  const dosageSourceCount2 = Array.isArray(herb2.dosage?.sources) ? herb2.dosage.sources.length : 0;

  const clarityScore1 = dosageCompleteness(dosage1) * (dosageSourceCount1 > 0 ? 1 : 0.65);
  const clarityScore2 = dosageCompleteness(dosage2) * (dosageSourceCount2 > 0 ? 1 : 0.65);

  return {
    ageGroup: selectedAgeGroup,
    herb1: {
      ...dosage1,
      sourceCount: dosageSourceCount1,
      hasData: clarityScore1 > 0,
      note: clarityScore1 > 0 ? null : 'Insufficient dosage data',
    },
    herb2: {
      ...dosage2,
      sourceCount: dosageSourceCount2,
      hasData: clarityScore2 > 0,
      note: clarityScore2 > 0 ? null : 'Insufficient dosage data',
    },
    clarityScore: {
      herb1: clarityScore1,
      herb2: clarityScore2,
    },
  };
};

const buildPreparationComparison = (herb1, herb2) => {
  const methods1 = toUniqueNormalizedArray((herb1.preparation || []).map((item) => item.method));
  const methods2 = toUniqueNormalizedArray((herb2.preparation || []).map((item) => item.method));
  const set1 = new Set(methods1);
  const set2 = new Set(methods2);

  const sharedMethods = methods1.filter((item) => set2.has(item));
  const uniqueToHerb1 = methods1.filter((item) => !set2.has(item));
  const uniqueToHerb2 = methods2.filter((item) => !set1.has(item));

  const avgEase = (methods) => {
    if (!methods.length) return 0;
    const total = methods.reduce((sum, method) => sum + (PREPARATION_EASE[method] || 1), 0);
    return total / methods.length;
  };

  const flexibilityScore1 = methods1.length ? (methods1.length / 6) + (avgEase(methods1) / 6) : 0;
  const flexibilityScore2 = methods2.length ? (methods2.length / 6) + (avgEase(methods2) / 6) : 0;

  return {
    sharedMethods,
    uniqueToHerb1,
    uniqueToHerb2,
    flexibilityScore: {
      herb1: Math.min(flexibilityScore1, 1),
      herb2: Math.min(flexibilityScore2, 1),
    },
    easeHeuristic: {
      herb1: avgEase(methods1),
      herb2: avgEase(methods2),
    },
  };
};

const buildPhytochemicalComparison = (herb1, herb2) => {
  const compounds1 = Array.isArray(herb1.phytochemicals) ? herb1.phytochemicals : [];
  const compounds2 = Array.isArray(herb2.phytochemicals) ? herb2.phytochemicals : [];

  const categorySet1 = new Set(compounds1.map((item) => normalizeString(item.compound?.category)));
  const categorySet2 = new Set(compounds2.map((item) => normalizeString(item.compound?.category)));
  const sharedCategories = [...categorySet1].filter((category) => categorySet2.has(category));

  const names1 = new Set(compounds1.map((item) => normalizeString(item.compound?.name)).filter(Boolean));
  const names2 = new Set(compounds2.map((item) => normalizeString(item.compound?.name)).filter(Boolean));
  const uniqueCompounds1 = [...names1].filter((name) => !names2.has(name));
  const uniqueCompounds2 = [...names2].filter((name) => !names1.has(name));

  const diversityScore1 = Math.min((categorySet1.size * 0.2) + (names1.size * 0.05), 1);
  const diversityScore2 = Math.min((categorySet2.size * 0.2) + (names2.size * 0.05), 1);

  return {
    sharedCategories,
    uniqueCompounds: {
      herb1: uniqueCompounds1,
      herb2: uniqueCompounds2,
    },
    counts: {
      herb1: names1.size,
      herb2: names2.size,
      categoriesHerb1: categorySet1.size,
      categoriesHerb2: categorySet2.size,
    },
    diversityScore: {
      herb1: diversityScore1,
      herb2: diversityScore2,
    },
  };
};

const getAllSourcesCount = (herb) => {
  const infoSources = Array.isArray(herb.info?.sources) ? herb.info.sources : [];
  const dosageSources = Array.isArray(herb.dosage?.sources) ? herb.dosage.sources : [];
  const merged = [...infoSources, ...dosageSources]
    .map((source) => normalizeString(source?.url || `${source?.title || ''}:${source?.publisher || ''}`))
    .filter(Boolean);
  return new Set(merged).size;
};

const buildEvidenceScore = (herb1, herb2) => {
  const scoreFor = (herb) => {
    const sourceCount = getAllSourcesCount(herb);
    const hasInfoSources = (herb.info?.sources || []).length > 0;
    const hasDosageSources = (herb.dosage?.sources || []).length > 0;
    const wellCited = hasInfoSources && hasDosageSources;
    const score = Math.min((sourceCount / 12) + (wellCited ? 0.25 : 0), 1);

    let badge = 'Limited Sources';
    if (score >= 0.7) badge = 'Well Supported';
    else if (score >= 0.4) badge = 'Moderately Supported';

    return { sourceCount, wellCited, score, badge };
  };

  return {
    herb1: scoreFor(herb1),
    herb2: scoreFor(herb2),
  };
};

const buildSafetyComparison = (herb1, herb2) => {
  const scoreFor = (herb) => {
    const safety = herb.safety || null;
    const contraindications = Array.isArray(herb.contraindications) ? herb.contraindications : [];
    const interactions = Array.isArray(herb.interactions) ? herb.interactions : [];

    const hasSafetyProfile = Boolean(safety);
    const contraindicationCount = contraindications.length;
    const interactionCount = interactions.length;
    const score = Math.min(
      (hasSafetyProfile ? 0.45 : 0) +
      Math.min(contraindicationCount / 8, 0.3) +
      Math.min(interactionCount / 15, 0.25),
      1
    );

    return {
      hasSafetyProfile,
      contraindicationCount,
      interactionCount,
      score,
    };
  };

  return {
    herb1: scoreFor(herb1),
    herb2: scoreFor(herb2),
  };
};

const pickBetter = (score1, score2, threshold = 0.05) => {
  if (Math.abs(score1 - score2) <= threshold) return 'equal';
  return score1 > score2 ? 'herb1' : 'herb2';
};

const buildReasoning = (parts) => {
  const lines = [];
  const symptomWinner = pickBetter(parts.symptomScore.herb1, parts.symptomScore.herb2, 0.01);
  if (symptomWinner !== 'equal') {
    lines.push(
      `${symptomWinner === 'herb1' ? parts.herb1Name : parts.herb2Name} aligns better with the target symptom profile.`
    );
  }

  const evidenceWinner = pickBetter(parts.evidence.herb1.score, parts.evidence.herb2.score, 0.03);
  if (evidenceWinner !== 'equal') {
    lines.push(
      `${evidenceWinner === 'herb1' ? parts.herb1Name : parts.herb2Name} has stronger citation support in the current dataset.`
    );
  }

  const preparationWinner = pickBetter(parts.preparation.flexibilityScore.herb1, parts.preparation.flexibilityScore.herb2, 0.03);
  if (preparationWinner !== 'equal') {
    lines.push(
      `${preparationWinner === 'herb1' ? parts.herb1Name : parts.herb2Name} offers more or easier preparation options.`
    );
  }

  const safetyWinner = pickBetter(parts.safety.herb1.score, parts.safety.herb2.score, 0.03);
  if (safetyWinner !== 'equal') {
    lines.push(
      `${safetyWinner === 'herb1' ? parts.herb1Name : parts.herb2Name} has clearer documented safety context.`
    );
  }

  if (!lines.length) {
    lines.push('Both herbs are close based on currently available data fields.');
  }

  lines.push('This comparison is informational and not medical advice.');
  return lines;
};

const compareHerbs = ({ herb1, herb2, symptom = '', ageGroup = 'adult' }) => {
  const symptomComparison = buildSymptomComparison(herb1, herb2, symptom);
  const dosageComparison = buildDosageComparison(herb1, herb2, ageGroup);
  const preparationComparison = buildPreparationComparison(herb1, herb2);
  const phytochemicalComparison = buildPhytochemicalComparison(herb1, herb2);
  const evidenceScore = buildEvidenceScore(herb1, herb2);
  const safetyScore = buildSafetyComparison(herb1, herb2);

  const symptomScore = {
    herb1: symptomComparison.symptomMatch.herb1.score || Math.min((symptomComparison.sharedSymptoms.length + symptomComparison.uniqueToHerb1.length) / 10, 1),
    herb2: symptomComparison.symptomMatch.herb2.score || Math.min((symptomComparison.sharedSymptoms.length + symptomComparison.uniqueToHerb2.length) / 10, 1),
  };

  const totalScore = {
    herb1:
      symptomScore.herb1 * SCORE_WEIGHTS.symptomMatch +
      dosageComparison.clarityScore.herb1 * SCORE_WEIGHTS.dosageClarity +
      preparationComparison.flexibilityScore.herb1 * SCORE_WEIGHTS.preparationFlexibility +
      phytochemicalComparison.diversityScore.herb1 * SCORE_WEIGHTS.phytochemicalDiversity +
      evidenceScore.herb1.score * SCORE_WEIGHTS.evidenceStrength +
      safetyScore.herb1.score * SCORE_WEIGHTS.safetyClarity,
    herb2:
      symptomScore.herb2 * SCORE_WEIGHTS.symptomMatch +
      dosageComparison.clarityScore.herb2 * SCORE_WEIGHTS.dosageClarity +
      preparationComparison.flexibilityScore.herb2 * SCORE_WEIGHTS.preparationFlexibility +
      phytochemicalComparison.diversityScore.herb2 * SCORE_WEIGHTS.phytochemicalDiversity +
      evidenceScore.herb2.score * SCORE_WEIGHTS.evidenceStrength +
      safetyScore.herb2.score * SCORE_WEIGHTS.safetyClarity,
  };

  const betterOption = pickBetter(totalScore.herb1, totalScore.herb2, 3);

  return {
    sharedSymptoms: symptomComparison.sharedSymptoms,
    uniqueToHerb1: symptomComparison.uniqueToHerb1,
    uniqueToHerb2: symptomComparison.uniqueToHerb2,
    symptomMatch: symptomComparison.symptomMatch,
    dosage: dosageComparison,
    preparation: preparationComparison,
    phytochemicals: phytochemicalComparison,
    evidenceScore,
    safetyScore,
    scoreBreakdown: {
      weights: SCORE_WEIGHTS,
      normalized: {
        symptomMatch: symptomScore,
        dosageClarity: dosageComparison.clarityScore,
        preparationFlexibility: preparationComparison.flexibilityScore,
        phytochemicalDiversity: phytochemicalComparison.diversityScore,
        evidenceStrength: {
          herb1: evidenceScore.herb1.score,
          herb2: evidenceScore.herb2.score,
        },
        safetyClarity: {
          herb1: safetyScore.herb1.score,
          herb2: safetyScore.herb2.score,
        },
      },
      totalScore,
    },
    betterOption,
    reasoning: buildReasoning({
      herb1Name: herb1.name,
      herb2Name: herb2.name,
      symptomScore,
      evidence: evidenceScore,
      preparation: preparationComparison,
      safety: safetyScore,
    }),
    disclaimer: 'This comparison is informational and not medical advice.',
  };
};

module.exports = {
  compareHerbs,
  SCORE_WEIGHTS,
};
