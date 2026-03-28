const SiteAsset = require('../models/SiteAsset');
const AppConfig = require('../models/AppConfig');
const { getTurnstileEnabled, setTurnstileEnabled } = require('../services/featureFlagService');

const LANDING_CAROUSEL_NAME_PREFIX = 'landing_carousel_';
const LANDING_SECTION_NAME_PREFIX = 'landing_section_';
const LANDING_WELCOME_ANIM_NAME_PREFIX = 'landing_welcome_animated_';
const LANDING_SECTIONS = ['welcome', 'recent', 'about', 'more', 'contact'];
const MODES = ['light', 'dark'];
const LEGACY_WELCOME_NAME = 'landing_welcome';
const WELCOME_MEDIA_MODE_CONFIG_KEY = 'landing_welcome_media_mode';
const LOADING_PROGRESS_BACKGROUND_NAME = 'loading_progress_background';
const LOADING_PROGRESS_BACKGROUND_LIGHT_NAME = 'loading_progress_background_light';
const LOADING_PROGRESS_BACKGROUND_DARK_NAME = 'loading_progress_background_dark';

const extractCloudinaryPublicId = (url = '') => {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('res.cloudinary.com')) return null;

  const match = trimmed.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?(?:\?.*)?$/);
  return match ? match[1] : null;
};

const getSectionAssetName = (section, mode) => `${LANDING_SECTION_NAME_PREFIX}${section}_${mode}`;

const createEmptySections = () => {
  const sections = {};
  for (const section of LANDING_SECTIONS) {
    sections[section] = {
      light: { id: null, url: null, publicId: null },
      dark: { id: null, url: null, publicId: null },
    };
  }
  return sections;
};

const getWelcomeAnimatedAssetName = (mode, index) =>
  `${LANDING_WELCOME_ANIM_NAME_PREFIX}${mode}_${index + 1}`;

const buildLandingPayload = async () => {
  const [
    backgroundDocs,
    welcomeAnimatedDocs,
    carouselDocs,
    loadingProgressBackgroundDoc,
    loadingProgressBackgroundLightDoc,
    loadingProgressBackgroundDarkDoc,
    legacyWelcomeDoc,
    turnstileEnabled,
    welcomeMediaModeConfig,
  ] = await Promise.all([
    SiteAsset.find({
      type: 'background',
      name: { $regex: `^${LANDING_SECTION_NAME_PREFIX}` },
      isActive: true,
    }).sort({ updatedAt: -1 }),
    SiteAsset.find({
      type: 'background',
      name: { $regex: `^${LANDING_WELCOME_ANIM_NAME_PREFIX}` },
      isActive: true,
    }).sort({ order: 1 }),
    SiteAsset.find({
      type: 'carousel',
      name: { $regex: `^${LANDING_CAROUSEL_NAME_PREFIX}` },
      isActive: true,
    }).sort({ order: 1 }),
    SiteAsset.findOne({
      type: 'background',
      name: LOADING_PROGRESS_BACKGROUND_NAME,
      isActive: true,
    }).sort({ updatedAt: -1 }),
    SiteAsset.findOne({
      type: 'background',
      name: LOADING_PROGRESS_BACKGROUND_LIGHT_NAME,
      isActive: true,
    }).sort({ updatedAt: -1 }),
    SiteAsset.findOne({
      type: 'background',
      name: LOADING_PROGRESS_BACKGROUND_DARK_NAME,
      isActive: true,
    }).sort({ updatedAt: -1 }),
    SiteAsset.findOne({
      type: 'background',
      name: LEGACY_WELCOME_NAME,
      isActive: true,
    }).sort({ updatedAt: -1 }),
    getTurnstileEnabled(),
    AppConfig.findOne({ key: WELCOME_MEDIA_MODE_CONFIG_KEY }),
  ]);

  const sections = createEmptySections();

  for (const doc of backgroundDocs) {
    const match = doc.name.match(/^landing_section_([a-z0-9-]+)_(light|dark)$/);
    if (!match) continue;

    const [, section, mode] = match;
    if (!sections[section]) {
      sections[section] = {
        light: { id: null, url: null, publicId: null },
        dark: { id: null, url: null, publicId: null },
      };
    }

    sections[section][mode] = {
      id: doc._id,
      url: doc.cloudinaryUrl,
      publicId: doc.publicId,
    };
  }

  if (!sections.welcome.light.url && legacyWelcomeDoc?.cloudinaryUrl) {
    sections.welcome.light = {
      id: legacyWelcomeDoc._id,
      url: legacyWelcomeDoc.cloudinaryUrl,
      publicId: legacyWelcomeDoc.publicId,
    };
  }

  const configuredMediaMode = welcomeMediaModeConfig?.value;
  const welcomeMediaMode = configuredMediaMode === 'animated' ? 'animated' : 'static';
  const welcomeAnimatedRaw = welcomeAnimatedDocs.map((doc) => ({
    id: doc._id,
    name: doc.name,
    url: doc.cloudinaryUrl,
    order: doc.order,
    publicId: doc.publicId,
  }));
  const welcomeAnimated = { light: [], dark: [] };
  for (const item of welcomeAnimatedRaw) {
    const match = item.name.match(/^landing_welcome_animated_(light|dark)_(\d+)$/);
    if (!match) {
      // Backward compatibility with old naming: treat as light mode.
      welcomeAnimated.light.push(item);
      continue;
    }

    const mode = match[1];
    welcomeAnimated[mode].push(item);
  }
  welcomeAnimated.light.sort((a, b) => a.order - b.order);
  welcomeAnimated.dark.sort((a, b) => a.order - b.order);

  sections.welcome = {
    ...sections.welcome,
    mediaMode: welcomeMediaMode,
    animated: welcomeAnimated,
  };

  return {
    sections,
    carousel: carouselDocs.map((doc) => ({
      id: doc._id,
      name: doc.name,
      url: doc.cloudinaryUrl,
      order: doc.order,
      publicId: doc.publicId,
    })),
    loadingProgress: {
      background: {
        light: loadingProgressBackgroundLightDoc
          ? {
              id: loadingProgressBackgroundLightDoc._id,
              url: loadingProgressBackgroundLightDoc.cloudinaryUrl,
              publicId: loadingProgressBackgroundLightDoc.publicId,
            }
          : loadingProgressBackgroundDoc
            ? {
                id: loadingProgressBackgroundDoc._id,
                url: loadingProgressBackgroundDoc.cloudinaryUrl,
                publicId: loadingProgressBackgroundDoc.publicId,
              }
            : { id: null, url: null, publicId: null },
        dark: loadingProgressBackgroundDarkDoc
          ? {
              id: loadingProgressBackgroundDarkDoc._id,
              url: loadingProgressBackgroundDarkDoc.cloudinaryUrl,
              publicId: loadingProgressBackgroundDarkDoc.publicId,
            }
          : { id: null, url: null, publicId: null },
      },
    },
    loadingProgressBackgroundUrl:
      loadingProgressBackgroundLightDoc?.cloudinaryUrl
      || loadingProgressBackgroundDoc?.cloudinaryUrl
      || loadingProgressBackgroundDarkDoc?.cloudinaryUrl
      || null,
    // Backward-compatible field for older frontend callers.
    welcomeBackgroundUrl: sections?.welcome?.light?.url || null,
    turnstileEnabled,
    updatedAt: new Date().toISOString(),
  };
};

const normalizeSectionPayload = (sectionsInput = {}) => {
  const normalized = {};

  for (const [section, sectionValue] of Object.entries(sectionsInput || {})) {
    if (!sectionValue || typeof sectionValue !== 'object') continue;

    const lightUrl = (sectionValue.lightUrl || '').trim();
    const darkUrl = (sectionValue.darkUrl || '').trim();

    normalized[section] = { lightUrl, darkUrl };
  }

  return normalized;
};

const validateLandingInput = (body = {}) => {
  const sections = normalizeSectionPayload(body.sections || {});
  const carouselInput = Array.isArray(body.carouselUrls) ? body.carouselUrls : [];
  const carouselUrls = carouselInput
    .map((url) => (typeof url === 'string' ? url.trim() : ''))
    .filter(Boolean);

  const welcomeLightUrl = sections?.welcome?.lightUrl || '';
  const welcomeDarkUrl = sections?.welcome?.darkUrl || '';
  const rawWelcomeMode = body?.welcomeMedia?.mode;
  const welcomeMode = rawWelcomeMode === 'animated' ? 'animated' : 'static';
  const animatedLightInput = Array.isArray(body?.welcomeMedia?.animatedLightUrls)
    ? body.welcomeMedia.animatedLightUrls
    : (Array.isArray(body?.welcomeMedia?.animatedUrls) ? body.welcomeMedia.animatedUrls : []);
  const animatedDarkInput = Array.isArray(body?.welcomeMedia?.animatedDarkUrls)
    ? body.welcomeMedia.animatedDarkUrls
    : [];
  const welcomeAnimatedLightUrls = animatedLightInput
    .map((url) => (typeof url === 'string' ? url.trim() : ''))
    .filter(Boolean);
  const welcomeAnimatedDarkUrls = animatedDarkInput
    .map((url) => (typeof url === 'string' ? url.trim() : ''))
    .filter(Boolean);
  const loadingProgressBackgroundLightUrl = typeof body?.loadingProgress?.backgroundLightUrl === 'string'
    ? body.loadingProgress.backgroundLightUrl.trim()
    : (typeof body?.loadingProgress?.background?.lightUrl === 'string'
      ? body.loadingProgress.background.lightUrl.trim()
      : (typeof body?.loadingProgress?.backgroundUrl === 'string'
        ? body.loadingProgress.backgroundUrl.trim()
        : ''));
  const loadingProgressBackgroundDarkUrl = typeof body?.loadingProgress?.backgroundDarkUrl === 'string'
    ? body.loadingProgress.backgroundDarkUrl.trim()
    : (typeof body?.loadingProgress?.background?.darkUrl === 'string'
      ? body.loadingProgress.background.darkUrl.trim()
      : '');

  if (welcomeMode === 'static') {
    if (!welcomeLightUrl) {
      return { error: 'sections.welcome.lightUrl is required when welcome mode is static' };
    }

    if (!welcomeDarkUrl) {
      return { error: 'sections.welcome.darkUrl is required when welcome mode is static' };
    }
  }

  if (welcomeMode === 'animated') {
    if (welcomeAnimatedLightUrls.length < 1 || welcomeAnimatedLightUrls.length > 4) {
      return { error: 'welcomeMedia.animatedLightUrls must contain between 1 and 4 Cloudinary URLs' };
    }

    if (welcomeAnimatedDarkUrls.length < 1 || welcomeAnimatedDarkUrls.length > 4) {
      return { error: 'welcomeMedia.animatedDarkUrls must contain between 1 and 4 Cloudinary URLs' };
    }

    const animatedLightPublicIds = welcomeAnimatedLightUrls.map(extractCloudinaryPublicId);
    if (animatedLightPublicIds.some((id) => !id)) {
      return { error: 'All welcomeMedia.animatedLightUrls must be valid Cloudinary URLs' };
    }

    const animatedDarkPublicIds = welcomeAnimatedDarkUrls.map(extractCloudinaryPublicId);
    if (animatedDarkPublicIds.some((id) => !id)) {
      return { error: 'All welcomeMedia.animatedDarkUrls must be valid Cloudinary URLs' };
    }
  }

  for (const [section, modes] of Object.entries(sections)) {
    for (const mode of MODES) {
      const url = modes?.[`${mode}Url`] || '';
      if (!url) continue;
      if (!extractCloudinaryPublicId(url)) {
        return { error: `sections.${section}.${mode}Url must be a valid Cloudinary URL` };
      }
    }
  }

  if (loadingProgressBackgroundLightUrl && !extractCloudinaryPublicId(loadingProgressBackgroundLightUrl)) {
    return { error: 'loadingProgress.backgroundLightUrl must be a valid Cloudinary URL' };
  }

  if (loadingProgressBackgroundDarkUrl && !extractCloudinaryPublicId(loadingProgressBackgroundDarkUrl)) {
    return { error: 'loadingProgress.backgroundDarkUrl must be a valid Cloudinary URL' };
  }

  if (!carouselUrls.length) {
    return { error: 'At least one carousel URL is required' };
  }

  const carouselPublicIds = carouselUrls.map(extractCloudinaryPublicId);
  if (carouselPublicIds.some((id) => !id)) {
    return { error: 'All carousel URLs must be valid Cloudinary URLs' };
  }

  return {
    sections,
    carouselUrls,
    carouselPublicIds,
    welcomeMode,
    welcomeAnimatedLightUrls,
    welcomeAnimatedDarkUrls,
    loadingProgressBackgroundLightUrl,
    loadingProgressBackgroundDarkUrl,
    turnstileEnabled: typeof body.turnstileEnabled === 'boolean' ? body.turnstileEnabled : undefined,
  };
};

const getLandingAssetsPublic = async (req, res) => {
  const payload = await buildLandingPayload();
  return res.json(payload);
};

const getLandingAssetsAdmin = async (req, res) => {
  const payload = await buildLandingPayload();
  return res.json(payload);
};

const saveLandingAssets = async (req, res) => {
  const validated = validateLandingInput(req.body);
  if (validated.error) {
    return res.status(400).json({ error: validated.error });
  }

  const {
    sections,
    carouselUrls,
    carouselPublicIds,
    welcomeMode,
    welcomeAnimatedLightUrls,
    welcomeAnimatedDarkUrls,
    loadingProgressBackgroundLightUrl,
    loadingProgressBackgroundDarkUrl,
    turnstileEnabled,
  } = validated;

  const operations = [];
  const activeBackgroundNames = [];

  for (const [section, modes] of Object.entries(sections)) {
    for (const mode of MODES) {
      const url = modes?.[`${mode}Url`] || '';
      if (!url) continue;

      const name = getSectionAssetName(section, mode);
      activeBackgroundNames.push(name);

      operations.push({
        updateOne: {
          filter: { type: 'background', name },
          update: {
            $set: {
              type: 'background',
              name,
              description: `Landing ${section} section ${mode} background`,
              cloudinaryUrl: url,
              publicId: extractCloudinaryPublicId(url),
              isActive: true,
              order: 0,
            },
          },
          upsert: true,
        },
      });
    }
  }

  operations.push(
    ...carouselUrls.map((url, index) => ({
      updateOne: {
        filter: { type: 'carousel', name: `${LANDING_CAROUSEL_NAME_PREFIX}${index + 1}` },
        update: {
          $set: {
            type: 'carousel',
            name: `${LANDING_CAROUSEL_NAME_PREFIX}${index + 1}`,
            description: `Landing carousel item ${index + 1}`,
            cloudinaryUrl: url,
            publicId: carouselPublicIds[index],
            isActive: true,
            order: index,
          },
        },
        upsert: true,
      },
    })),
  );

  if (loadingProgressBackgroundLightUrl) {
    operations.push({
      updateOne: {
        filter: { type: 'background', name: LOADING_PROGRESS_BACKGROUND_LIGHT_NAME },
        update: {
          $set: {
            type: 'background',
            name: LOADING_PROGRESS_BACKGROUND_LIGHT_NAME,
            description: 'Light mode background image for fullscreen/fullpage loading progress variants',
            cloudinaryUrl: loadingProgressBackgroundLightUrl,
            publicId: extractCloudinaryPublicId(loadingProgressBackgroundLightUrl),
            isActive: true,
            order: 0,
          },
        },
        upsert: true,
      },
    });

    // Keep legacy single-key asset synced for backward compatibility.
    operations.push({
      updateOne: {
        filter: { type: 'background', name: LOADING_PROGRESS_BACKGROUND_NAME },
        update: {
          $set: {
            type: 'background',
            name: LOADING_PROGRESS_BACKGROUND_NAME,
            description: 'Legacy background image for fullscreen/fullpage loading progress variants',
            cloudinaryUrl: loadingProgressBackgroundLightUrl,
            publicId: extractCloudinaryPublicId(loadingProgressBackgroundLightUrl),
            isActive: true,
            order: 0,
          },
        },
        upsert: true,
      },
    });
  }

  if (loadingProgressBackgroundDarkUrl) {
    operations.push({
      updateOne: {
        filter: { type: 'background', name: LOADING_PROGRESS_BACKGROUND_DARK_NAME },
        update: {
          $set: {
            type: 'background',
            name: LOADING_PROGRESS_BACKGROUND_DARK_NAME,
            description: 'Dark mode background image for fullscreen/fullpage loading progress variants',
            cloudinaryUrl: loadingProgressBackgroundDarkUrl,
            publicId: extractCloudinaryPublicId(loadingProgressBackgroundDarkUrl),
            isActive: true,
            order: 0,
          },
        },
        upsert: true,
      },
    });
  }

  const welcomeAnimatedLightPublicIds = welcomeAnimatedLightUrls.map(extractCloudinaryPublicId);
  const welcomeAnimatedDarkPublicIds = welcomeAnimatedDarkUrls.map(extractCloudinaryPublicId);
  operations.push(
    ...welcomeAnimatedLightUrls.map((url, index) => ({
      updateOne: {
        filter: { type: 'background', name: getWelcomeAnimatedAssetName('light', index) },
        update: {
          $set: {
            type: 'background',
            name: getWelcomeAnimatedAssetName('light', index),
            description: `Landing welcome animated light item ${index + 1}`,
            cloudinaryUrl: url,
            publicId: welcomeAnimatedLightPublicIds[index],
            isActive: welcomeMode === 'animated',
            order: index,
          },
        },
        upsert: true,
      },
    })),
    ...welcomeAnimatedDarkUrls.map((url, index) => ({
      updateOne: {
        filter: { type: 'background', name: getWelcomeAnimatedAssetName('dark', index) },
        update: {
          $set: {
            type: 'background',
            name: getWelcomeAnimatedAssetName('dark', index),
            description: `Landing welcome animated dark item ${index + 1}`,
            cloudinaryUrl: url,
            publicId: welcomeAnimatedDarkPublicIds[index],
            isActive: welcomeMode === 'animated',
            order: index,
          },
        },
        upsert: true,
      },
    })),
  );

  if (operations.length > 0) {
    await SiteAsset.bulkWrite(operations, { ordered: true });
  }

  const activeCarouselNames = carouselUrls.map((_, index) => `${LANDING_CAROUSEL_NAME_PREFIX}${index + 1}`);

  await SiteAsset.updateMany(
    {
      type: 'carousel',
      $and: [
        { name: { $regex: `^${LANDING_CAROUSEL_NAME_PREFIX}` } },
        { name: { $nin: activeCarouselNames } },
      ],
    },
    { $set: { isActive: false } },
  );

  if (activeBackgroundNames.length > 0) {
    await SiteAsset.updateMany(
      {
        type: 'background',
        $and: [
          { name: { $regex: `^${LANDING_SECTION_NAME_PREFIX}` } },
          { name: { $nin: activeBackgroundNames } },
        ],
      },
      { $set: { isActive: false } },
    );
  }

  const activeWelcomeAnimatedNames = [
    ...welcomeAnimatedLightUrls.map((_, index) => getWelcomeAnimatedAssetName('light', index)),
    ...welcomeAnimatedDarkUrls.map((_, index) => getWelcomeAnimatedAssetName('dark', index)),
  ];
  await SiteAsset.updateMany(
    {
      type: 'background',
      $and: [
        { name: { $regex: `^${LANDING_WELCOME_ANIM_NAME_PREFIX}` } },
        { name: { $nin: activeWelcomeAnimatedNames } },
      ],
    },
    { $set: { isActive: false } },
  );

  if (welcomeMode === 'static') {
    await SiteAsset.updateMany(
      {
        type: 'background',
        name: { $regex: `^${LANDING_WELCOME_ANIM_NAME_PREFIX}` },
      },
      { $set: { isActive: false } },
    );
  }

  await AppConfig.findOneAndUpdate(
    { key: WELCOME_MEDIA_MODE_CONFIG_KEY },
    {
      $set: {
        key: WELCOME_MEDIA_MODE_CONFIG_KEY,
        value: welcomeMode,
        description: 'Landing welcome media mode (static|animated)',
      },
    },
    { upsert: true, new: true }
  );

  if (typeof turnstileEnabled === 'boolean') {
    await setTurnstileEnabled(turnstileEnabled);
  }

  const payload = await buildLandingPayload();
  return res.json(payload);
};

module.exports = {
  getLandingAssetsPublic,
  getLandingAssetsAdmin,
  saveLandingAssets,
};
