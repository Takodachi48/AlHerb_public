jest.mock('../models/Symptom', () => ({
  checkRedFlags: jest.fn(),
}));

jest.mock('../models/Herb', () => ({
  findBySymptoms: jest.fn(),
  filterSafeForUser: jest.fn(),
}));

jest.mock('../models/Contraindication', () => ({
  getAbsolutelyContraindicated: jest.fn(),
  checkForUser: jest.fn(),
}));

jest.mock('../models/HerbInteraction', () => ({
  getDangerousHerbsForDrugs: jest.fn(),
  checkCombination: jest.fn(),
  checkDrugs: jest.fn(),
}));

jest.mock('../models/HerbSafety', () => ({
  assessForUser: jest.fn(),
}));

jest.mock('../models/Recommendation', () => ({
  create: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const HerbController = require('../controllers/herbController');
const Symptom = require('../models/Symptom');
const Herb = require('../models/Herb');
const Contraindication = require('../models/Contraindication');
const HerbInteraction = require('../models/HerbInteraction');
const HerbSafety = require('../models/HerbSafety');
const Recommendation = require('../models/Recommendation');
const { logger } = require('../utils/logger');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Recommendation flow completeness', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('hard-stops recommendations when red-flag symptoms are present', async () => {
    Symptom.checkRedFlags.mockResolvedValue([
      { name: 'Chest Pain', medicalAttentionNote: 'Seek urgent medical care.' },
    ]);

    const req = {
      body: {
        symptoms: ['Chest Pain'],
        userProfile: {},
      },
    };
    const res = createRes();

    await HerbController.recommendHerbs(req, res);

    expect(Herb.findBySymptoms).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledTimes(1);

    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.status).toBe('blocked_red_flag');
    expect(responseBody.data.results).toEqual([]);
    expect(responseBody.data.redFlags).toHaveLength(1);
  });

  it('returns success for non-red-flag requests without tryRecommendationEngine runtime errors', async () => {
    Symptom.checkRedFlags.mockResolvedValue([]);
    Herb.findBySymptoms.mockResolvedValue([
      {
        _id: 'h1',
        slug: 'herb-one',
        name: 'Herb One',
        scientificName: 'Herbus one',
        description: 'One',
        symptoms: ['headache'],
        properties: ['analgesic'],
        phytochemicals: [],
        images: [],
      },
    ]);
    Contraindication.getAbsolutelyContraindicated.mockResolvedValue([]);
    HerbInteraction.getDangerousHerbsForDrugs.mockResolvedValue([]);
    Herb.filterSafeForUser.mockResolvedValue([{ _id: 'h1' }]);
    HerbSafety.assessForUser.mockResolvedValue({ safe: true, warnings: [], blockers: [] });
    HerbInteraction.checkCombination.mockResolvedValue([]);
    Contraindication.checkForUser.mockResolvedValue([]);
    HerbInteraction.checkDrugs.mockResolvedValue([]);

    jest.spyOn(HerbController, 'tryRecommendationEngine').mockResolvedValue({
      available: false,
      scores: new Map(),
    });

    const req = {
      user: { _id: 'user-1' },
      body: {
        symptoms: ['headache'],
        topN: 1,
        recordRecommendation: false,
        userProfile: { conditions: [], medications: [] },
      },
    };
    const res = createRes();

    await HerbController.recommendHerbs(req, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledTimes(1);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.status).toBe('ok');
    expect(responseBody.data.results).toHaveLength(1);
  });

  it('records blocked red-flag requests without runtime errors when recording is enabled', async () => {
    Symptom.checkRedFlags.mockResolvedValue([
      { name: 'Chest Pain', medicalAttentionNote: 'Seek urgent medical care.' },
    ]);
    Recommendation.create.mockResolvedValue({ _id: 'rec-blocked-1' });

    const req = {
      user: { _id: 'user-1' },
      body: {
        symptoms: ['Chest Pain'],
        recordRecommendation: true,
        userProfile: { conditions: [], medications: [] },
      },
    };
    const res = createRes();

    await HerbController.recommendHerbs(req, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledTimes(1);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.status).toBe('blocked_red_flag');
    expect(Recommendation.create).toHaveBeenCalledTimes(1);
  });

  it('auto-filters major combination conflicts and records recommendation when enabled', async () => {
    Symptom.checkRedFlags.mockResolvedValue([]);
    Herb.findBySymptoms.mockResolvedValue([
      {
        _id: 'h1',
        slug: 'herb-one',
        name: 'Herb One',
        scientificName: 'Herbus one',
        description: 'One',
        symptoms: ['headache'],
        properties: ['analgesic'],
        phytochemicals: [],
        images: [],
      },
      {
        _id: 'h2',
        slug: 'herb-two',
        name: 'Herb Two',
        scientificName: 'Herbus two',
        description: 'Two',
        symptoms: ['headache'],
        properties: ['analgesic'],
        phytochemicals: [],
        images: [],
      },
      {
        _id: 'h3',
        slug: 'herb-three',
        name: 'Herb Three',
        scientificName: 'Herbus three',
        description: 'Three',
        symptoms: ['headache'],
        properties: ['analgesic'],
        phytochemicals: [],
        images: [],
      },
    ]);
    Contraindication.getAbsolutelyContraindicated.mockResolvedValue([]);
    HerbInteraction.getDangerousHerbsForDrugs.mockResolvedValue([]);
    Herb.filterSafeForUser.mockResolvedValue([{ _id: 'h1' }, { _id: 'h2' }, { _id: 'h3' }]);
    HerbSafety.assessForUser.mockResolvedValue({ safe: true, warnings: [], blockers: [] });
    HerbInteraction.checkCombination.mockResolvedValue([
      {
        _id: 'interaction-1',
        herbId: 'h1',
        interactsWith: { herbId: 'h2' },
        severity: 'major',
        effect: 'Potential adverse interaction',
        recommendation: 'Avoid combination',
      },
    ]);
    Contraindication.checkForUser.mockResolvedValue([]);
    HerbInteraction.checkDrugs.mockResolvedValue([]);
    Recommendation.create.mockResolvedValue({ _id: 'rec-1' });

    jest.spyOn(HerbController, 'tryRecommendationEngine').mockResolvedValue({
      available: false,
      scores: new Map(),
    });

    const req = {
      user: { _id: 'user-1' },
      body: {
        symptoms: ['headache'],
        topN: 2,
        recordRecommendation: true,
        userProfile: {
          gender: 'female',
          conditions: [],
          medications: [],
        },
      },
    };
    const res = createRes();

    await HerbController.recommendHerbs(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const responseBody = res.json.mock.calls[0][0];

    expect(responseBody.success).toBe(true);
    expect(responseBody.data.status).toBe('ok');
    expect(responseBody.data.results).toHaveLength(2);
    expect(responseBody.data.results.map((item) => item.herb._id)).toEqual(['h1', 'h3']);
    expect(responseBody.data.excluded.combinationConflicts).toHaveLength(1);
    expect(responseBody.data.excluded.combinationConflicts[0]).toMatchObject({
      excludedHerbId: 'h2',
      conflictsWithHerbId: 'h1',
      severity: 'major',
    });

    expect(HerbInteraction.checkCombination).toHaveBeenCalledWith(['h1', 'h2', 'h3']);
    expect(Recommendation.create).toHaveBeenCalledTimes(1);
    expect(Recommendation.create.mock.calls[0][0]).toMatchObject({
      user: 'user-1',
      symptoms: ['headache'],
      gender: 'female',
    });
  });

  it('keeps response successful when recommendation recording fails and logs a warning', async () => {
    Symptom.checkRedFlags.mockResolvedValue([]);
    Herb.findBySymptoms.mockResolvedValue([
      {
        _id: 'h1',
        slug: 'herb-one',
        name: 'Herb One',
        scientificName: 'Herbus one',
        description: 'One',
        symptoms: ['headache'],
        properties: ['analgesic'],
        phytochemicals: [],
        images: [],
      },
    ]);
    Contraindication.getAbsolutelyContraindicated.mockResolvedValue([]);
    HerbInteraction.getDangerousHerbsForDrugs.mockResolvedValue([]);
    Herb.filterSafeForUser.mockResolvedValue([{ _id: 'h1' }]);
    HerbSafety.assessForUser.mockResolvedValue({ safe: true, warnings: [], blockers: [] });
    HerbInteraction.checkCombination.mockResolvedValue([]);
    Contraindication.checkForUser.mockResolvedValue([]);
    HerbInteraction.checkDrugs.mockResolvedValue([]);
    Recommendation.create.mockRejectedValue(new Error('db write failed'));

    jest.spyOn(HerbController, 'tryRecommendationEngine').mockResolvedValue({
      available: false,
      scores: new Map(),
    });

    const req = {
      user: { _id: 'user-1' },
      body: {
        symptoms: ['headache'],
        topN: 1,
        recordRecommendation: true,
        userProfile: { conditions: [], medications: [] },
      },
    };
    const res = createRes();

    await HerbController.recommendHerbs(req, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledTimes(1);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.status).toBe('ok');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to record recommendation request'));
  });
});
