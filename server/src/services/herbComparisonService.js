const cache = require('../config/cache');
const Herb = require('../models/Herb');
const HerbSafety = require('../models/HerbSafety');
const Contraindication = require('../models/Contraindication');
const HerbInteraction = require('../models/HerbInteraction');
const { compareHerbs } = require('./herbComparisonEngine');

const COMPARISON_CACHE_TTL_SECONDS = 300;
const HERB_COMPARE_SELECT = [
  '_id',
  'name',
  'slug',
  'scientificName',
  'description',
  'images',
  'symptoms',
  'properties',
  'dosage',
  'preparation',
  'phytochemicals',
  'info.sources',
  'isActive',
].join(' ');

const normalizeQueryValue = (value = '') => String(value || '').trim().toLowerCase();

const buildCacheKey = ({ herb1, herb2, symptom, ageGroup, includeSafety }) =>
  [
    'herb_compare',
    normalizeQueryValue(herb1),
    normalizeQueryValue(herb2),
    normalizeQueryValue(symptom || ''),
    normalizeQueryValue(ageGroup || 'adult'),
    includeSafety ? 'with_safety' : 'basic',
  ].join(':');

const getPrimaryImage = (images = []) => {
  if (!Array.isArray(images) || images.length === 0) return null;
  const primary = images.find((image) => image?.isPrimary && image?.url);
  return primary?.url || images[0]?.url || null;
};

const enrichSafetyData = async (herbs) => {
  if (!Array.isArray(herbs) || herbs.length === 0) return herbs;
  const herbIds = herbs.map((item) => item._id);

  const [safetyRecords, contraindications, interactions] = await Promise.all([
    HerbSafety.find({ herbId: { $in: herbIds } })
      .select('herbId pregnancy breastfeeding children elderly medicalConditions sideEffects verified')
      .lean(),
    Contraindication.find({ herbId: { $in: herbIds }, isActive: true })
      .select('herbId condition severity reason')
      .lean(),
    HerbInteraction.find({ herbId: { $in: herbIds }, isActive: true })
      .select('herbId interactsWith interactionType effect severity recommendation mechanism')
      .populate('mechanism.compound', 'name category')
      .lean(),
  ]);

  const safetyByHerb = new Map(safetyRecords.map((item) => [String(item.herbId), item]));
  const contraindicationsByHerb = contraindications.reduce((map, item) => {
    const key = String(item.herbId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());

  const interactionsByHerb = interactions.reduce((map, item) => {
    const key = String(item.herbId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());

  return herbs.map((herb) => {
    const herbId = String(herb._id);
    return {
      ...herb,
      safety: safetyByHerb.get(herbId) || null,
      contraindications: contraindicationsByHerb.get(herbId) || [],
      interactions: interactionsByHerb.get(herbId) || [],
    };
  });
};

class HerbComparisonService {
  static async compare({ herb1, herb2, symptom = '', ageGroup = 'adult', includeSafety = false }) {
    if (!herb1 || !herb2) {
      throw new Error('Both herb1 and herb2 are required');
    }

    const slug1 = normalizeQueryValue(herb1);
    const slug2 = normalizeQueryValue(herb2);
    if (slug1 === slug2) {
      throw new Error('Please provide two different herbs to compare');
    }

    const cacheKey = buildCacheKey({ herb1: slug1, herb2: slug2, symptom, ageGroup, includeSafety });
    const cached = cache.get(cacheKey);
    if (cached) return cached;

  const herbs = await Herb.find({
      isActive: true,
      slug: { $in: [slug1, slug2] },
    })
      .select(HERB_COMPARE_SELECT)
      .populate('phytochemicals.compound', 'name category effects')
      .lean();

    if (herbs.length !== 2) {
      throw new Error('One or both herbs were not found or inactive');
    }

    const hydratedHerbs = includeSafety ? await enrichSafetyData(herbs) : herbs;
    const bySlug = new Map(hydratedHerbs.map((item) => [item.slug, item]));
    const herbOne = bySlug.get(slug1);
    const herbTwo = bySlug.get(slug2);
    if (!herbOne || !herbTwo) {
      throw new Error('Unable to resolve both herbs for comparison');
    }

    const comparison = compareHerbs({
      herb1: herbOne,
      herb2: herbTwo,
      symptom,
      ageGroup,
    });

    const responsePayload = {
      herb1: {
        id: herbOne._id,
        slug: herbOne.slug,
        name: herbOne.name,
        scientificName: herbOne.scientificName,
        description: herbOne.description,
        symptoms: herbOne.symptoms || [],
        properties: herbOne.properties || [],
        dosage: herbOne.dosage || {},
        preparation: herbOne.preparation || [],
        phytochemicals: herbOne.phytochemicals || [],
        sourceCount: comparison.evidenceScore.herb1.sourceCount,
        evidenceBadge: comparison.evidenceScore.herb1.badge,
        image: getPrimaryImage(herbOne.images),
        safety: includeSafety ? (herbOne.safety || null) : undefined,
        contraindications: includeSafety ? (herbOne.contraindications || []) : undefined,
        interactions: includeSafety ? (herbOne.interactions || []) : undefined,
      },
      herb2: {
        id: herbTwo._id,
        slug: herbTwo.slug,
        name: herbTwo.name,
        scientificName: herbTwo.scientificName,
        description: herbTwo.description,
        symptoms: herbTwo.symptoms || [],
        properties: herbTwo.properties || [],
        dosage: herbTwo.dosage || {},
        preparation: herbTwo.preparation || [],
        phytochemicals: herbTwo.phytochemicals || [],
        sourceCount: comparison.evidenceScore.herb2.sourceCount,
        evidenceBadge: comparison.evidenceScore.herb2.badge,
        image: getPrimaryImage(herbTwo.images),
        safety: includeSafety ? (herbTwo.safety || null) : undefined,
        contraindications: includeSafety ? (herbTwo.contraindications || []) : undefined,
        interactions: includeSafety ? (herbTwo.interactions || []) : undefined,
      },
      comparison,
    };

    cache.set(cacheKey, responsePayload, COMPARISON_CACHE_TTL_SECONDS);
    return responsePayload;
  }
}

module.exports = HerbComparisonService;
