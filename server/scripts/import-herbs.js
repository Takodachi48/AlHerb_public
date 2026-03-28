/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config();

const Herb = require('../src/models/Herb');
const Phytochemical = require('../src/models/Phytochemical');
const PhytochemicalAssignment = require('../src/models/PhytochemicalAssignment');
const User = require('../src/models/User');
const PhytochemicalAdminService = require('../src/services/phytochemicalAdminService');
const {
  parseArgs,
  readRows,
  splitList,
  parseBoolean,
  escapeRegex,
} = require('./import-helpers');

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/herb-app';

const normalizeMethod = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  const allowed = [
    'tea', 'tincture', 'capsule', 'powder', 'ointment',
    'essential_oil', 'compress', 'poultice', 'decoction',
    'infusion', 'syrup', 'salve',
  ];
  if (allowed.includes(normalized)) return normalized;
  if (normalized.includes('essential')) return 'essential_oil';
  if (normalized.includes('decoction')) return 'decoction';
  if (normalized.includes('infusion')) return 'infusion';
  if (normalized.includes('tincture')) return 'tincture';
  if (normalized.includes('syrup')) return 'syrup';
  if (normalized.includes('poultice')) return 'poultice';
  if (normalized.includes('compress')) return 'compress';
  if (normalized.includes('tea')) return 'tea';
  if (normalized.includes('powder')) return 'powder';
  if (normalized.includes('capsule')) return 'capsule';
  if (normalized.includes('ointment')) return 'ointment';
  return '';
};

const excelDateToJsDate = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Excel serial day number with epoch offset.
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const normalizeCategory = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('alkaloid')) return 'alkaloids';
  if (normalized.includes('flavonoid')) return 'flavonoids';
  if (normalized.includes('terpene')) return 'terpenoids';
  if (normalized.includes('phenol')) return 'phenolic_compounds';
  if (normalized.includes('glycoside')) return 'glycosides';
  if (normalized.includes('essential oil') || normalized.includes('volatile')) return 'essential_oils';
  if (normalized.includes('tannin')) return 'tannins';
  if (normalized.includes('saponin')) return 'saponins';
  return 'other';
};

const normalizeKey = (value = '') => String(value)
  .toLowerCase()
  .replace(/([a-z0-9])([A-Z])/g, '$1$2')
  .replace(/[^a-z0-9]/g, '');

const buildRowGetter = (row) => {
  const normalized = new Map();
  const normalizedKeys = [];
  Object.entries(row).forEach(([key, value]) => {
    const nk = normalizeKey(key);
    normalized.set(nk, value);
    normalizedKeys.push(nk);
  });

  return (...aliases) => {
    for (const alias of aliases) {
      if (!alias) continue;
      const normalizedAlias = normalizeKey(alias);
      let value = normalized.get(normalizedAlias);
      if (value === undefined || value === null || value === '') {
        const fuzzyKey = normalizedKeys.find((key) => key.startsWith(normalizedAlias) || key.includes(normalizedAlias));
        if (fuzzyKey) {
          value = normalized.get(fuzzyKey);
        }
      }
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return '';
  };
};

const parsePhytochemicalRowData = (get) => {
  const names = splitList(
    get('phytochemicals', 'phytochemical_names', 'phytochemical_name')
  );
  const categories = splitList(get('phytochemical_categories', 'phytochemical_category'));
  const benefits = splitList(get('phytochemical_benefits', 'phytochemical_benefit', 'phytochemical_descriptions'));
  const concentrations = splitList(get('phytochemical_concentration', 'phytochemical_concentrations'));
  const parts = splitList(
    get(
      'phytochemical_parts',
      'phytochemical_part',
      'phytochemical_part_source',
      'phytochemical_part_sources',
      'phytochemical_partsource'
    )
  );

  const entries = [];
  const maxListLen = Math.max(names.length, categories.length, benefits.length, concentrations.length, parts.length);
  for (let i = 0; i < maxListLen; i += 1) {
    const name = names[i];
    if (!name) continue;
    entries.push({
      name,
      category: categories[i] || '',
      benefit: benefits[i] || '',
      concentration: concentrations[i] || '',
      partSource: parts[i] || '',
    });
  }

  // Indexed columns: phytochemicals[0].name, phytochemical_name_1, etc.
  for (let i = 0; i < 50; i += 1) {
    const oneBased = i + 1;
    const name = get(
      `phytochemicals[${i}].name`,
      `phytochemical[${i}].name`,
      `phytochemical_name_${oneBased}`,
      `phytochemical${oneBased}name`
    );
    if (!name) continue;

    entries.push({
      name: String(name).trim(),
      category: String(get(
        `phytochemicals[${i}].category`,
        `phytochemical[${i}].category`,
        `phytochemical_category_${oneBased}`,
        `phytochemical${oneBased}category`
      ) || '').trim(),
      benefit: String(get(
        `phytochemicals[${i}].benefit`,
        `phytochemical[${i}].benefit`,
        `phytochemicals[${i}].description`,
        `phytochemical_description_${oneBased}`
      ) || '').trim(),
      concentration: String(get(
        `phytochemicals[${i}].concentration`,
        `phytochemical[${i}].concentration`,
        `phytochemical_concentration_${oneBased}`,
        `phytochemical${oneBased}concentration`
      ) || '').trim(),
      partSource: String(get(
        `phytochemicals[${i}].partSource`,
        `phytochemical[${i}].partSource`,
        `phytochemicals[${i}].part`,
        `phytochemical_part_${oneBased}`,
        `phytochemical${oneBased}part`
      ) || '').trim(),
    });
  }

  const dedup = new Map();
  entries.forEach((entry) => {
    const key = `${entry.name.toLowerCase()}|${entry.partSource.toLowerCase()}|${entry.concentration.toLowerCase()}`;
    if (!dedup.has(key)) dedup.set(key, entry);
  });

  return Array.from(dedup.values());
};

const resolveDefaultImportFile = () => {
  const candidates = [
    path.resolve(process.cwd(), '..', 'data for importing (excel)', 'herb_data.xlsx'),
    path.resolve(process.cwd(), '..', 'data for importing (excel)', 'herb data.xlsx'),
    path.resolve(__dirname, '..', '..', 'data for importing (excel)', 'herb_data.xlsx'),
    path.resolve(__dirname, '..', '..', 'data for importing (excel)', 'herb data.xlsx'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
};

const findExistingHerb = async ({ idValue, slug, scientificName, name }) => {
  if (idValue) {
    const byId = await Herb.findById(idValue);
    if (byId) return byId;
  }

  if (slug) {
    const bySlug = await Herb.findOne({ slug });
    if (bySlug) return bySlug;
  }

  const scientificRegex = new RegExp(`^${escapeRegex(scientificName)}$`, 'i');
  const byScientific = await Herb.findOne({ scientificName: scientificRegex });
  if (byScientific) return byScientific;

  const nameRegex = new RegExp(`^${escapeRegex(name)}$`, 'i');
  return Herb.findOne({ name: nameRegex });
};

const generateRandomHerbId = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = crypto.randomBytes(12).toString('hex');
    // eslint-disable-next-line no-await-in-loop
    const exists = await Herb.exists({ _id: candidate });
    if (!exists) return candidate;
  }
  throw new Error('Unable to generate unique herb _id');
};

const normalizeExplicitHerbId = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^[0-9a-f]{24}$/i.test(raw) ? raw.toLowerCase() : '';
};

const buildFlexibleNameRegex = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!normalized) return null;

  const pattern = normalized
    .split(/\s+/)
    .map((token) => escapeRegex(token))
    .join('[\\s_-]+');
  return new RegExp(`^${pattern}$`, 'i');
};

const resolveHerbForAssignment = async (get) => {
  const herbIdRaw = String(get(
    'herbId',
    'herb_id',
    'herbId (herb _id string)'
  ) || '').trim();
  const herbSlugRaw = String(get('herbSlug', 'herb_slug') || '').trim().toLowerCase();
  const herbScientificRaw = String(get(
    'herbScientificName',
    'herb_scientific_name',
    'scientificName',
    'scientific_name'
  ) || '').trim();
  const herbNameRaw = String(get('herbName', 'herb_name') || '').trim();

  if (herbIdRaw) {
    const byId = await Herb.findById(herbIdRaw).select('_id').lean();
    if (byId?._id) return byId;

    // Many assignment sheets still store herb slug/name in "herbId".
    const bySlugFromId = await Herb.findOne({ slug: herbIdRaw.toLowerCase() }).select('_id').lean();
    if (bySlugFromId?._id) return bySlugFromId;

    const scientificFromIdRegex = new RegExp(`^${escapeRegex(herbIdRaw)}$`, 'i');
    const byScientificFromId = await Herb.findOne({ scientificName: scientificFromIdRegex }).select('_id').lean();
    if (byScientificFromId?._id) return byScientificFromId;

    const nameFromIdRegex = new RegExp(`^${escapeRegex(herbIdRaw)}$`, 'i');
    const byNameFromId = await Herb.findOne({ name: nameFromIdRegex }).select('_id').lean();
    if (byNameFromId?._id) return byNameFromId;

    const flexibleFromIdRegex = buildFlexibleNameRegex(herbIdRaw);
    if (flexibleFromIdRegex) {
      const byScientificFromFlexible = await Herb.findOne({ scientificName: flexibleFromIdRegex }).select('_id').lean();
      if (byScientificFromFlexible?._id) return byScientificFromFlexible;

      const byNameFromFlexible = await Herb.findOne({ name: flexibleFromIdRegex }).select('_id').lean();
      if (byNameFromFlexible?._id) return byNameFromFlexible;
    }
  }

  if (herbSlugRaw) {
    const bySlug = await Herb.findOne({ slug: herbSlugRaw }).select('_id').lean();
    if (bySlug?._id) return bySlug;
  }

  if (herbScientificRaw) {
    const scientificRegex = new RegExp(`^${escapeRegex(herbScientificRaw)}$`, 'i');
    const byScientific = await Herb.findOne({ scientificName: scientificRegex }).select('_id').lean();
    if (byScientific?._id) return byScientific;
  }

  if (herbNameRaw) {
    const nameRegex = new RegExp(`^${escapeRegex(herbNameRaw)}$`, 'i');
    const byName = await Herb.findOne({ name: nameRegex }).select('_id').lean();
    if (byName?._id) return byName;
  }

  return null;
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file || resolveDefaultImportFile();
  const sheet = args.sheet || 'Herbs';
  const assignmentSheet = args.assignmentSheet || 'PhytochemicalAssignment';
  const dryRun = Boolean(args.dryRun);

  if (!fs.existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }

  const rows = readRows(file, sheet);
  if (!rows.length) {
    console.log('No rows to import.');
    return;
  }

  await mongoose.connect(dbUri);
  console.log('Connected to MongoDB');

  try {
    const defaultUser = await User.findOne({ role: 'admin' }).select('_id').lean()
      || await User.findOne({}).select('_id').lean();

    if (!defaultUser?._id) {
      throw new Error('No users found. At least one user is required for createdBy.');
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let rowErrors = 0;
    let assignmentInserted = 0;
    let assignmentUpdated = 0;
    let assignmentSkipped = 0;
    let assignmentErrors = 0;
    const assignmentSkipReasons = {};

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const get = buildRowGetter(row);
      const rowNum = index + 2;
      try {
        const idValue = normalizeExplicitHerbId(get('id', '_id'));
        const name = String(get('name') || '').trim();
        const scientificName = String(get('scientific_name', 'scientificName') || '').trim();
        const slug = String(get('slug') || '').trim().toLowerCase();

        if (!name || !scientificName) {
          skipped += 1;
          continue;
        }

        let herb = await findExistingHerb({
          idValue,
          slug,
          scientificName,
          name,
        });
        const isUpdate = Boolean(herb);

        if (!herb) {
          const generatedId = idValue || await generateRandomHerbId();
          herb = new Herb({
            _id: generatedId,
            name,
            scientificName,
            slug: slug || undefined,
            createdBy: defaultUser._id,
          });
        }

        herb.name = name;
        herb.scientificName = scientificName;
        herb.slug = slug || herb.slug;
        herb.family = String(get('family') || '').trim();
        herb.isActive = parseBoolean(get('is_active', 'isActive'), herb.isActive ?? true);
        herb.isFeatured = parseBoolean(get('is_featured', 'isFeatured'), herb.isFeatured ?? false);
        herb.createdBy = herb.createdBy || defaultUser._id;

        herb.commonNames = splitList(get('common_names', 'commonNames', 'commonNames (comma-separated)'));
        herb.description = String(get('description') || '').trim() || undefined;
        herb.partsUsed = splitList(get('parts_used', 'partsUsed', 'partsUsed (comma-separated)'));
        herb.properties = splitList(get('properties', 'properties (comma-separated)'));
        herb.symptoms = splitList(get('symptoms', 'symptoms (comma-separated)'));

        const infoSourceUrl = String(get('info_source_url', 'info.sources[0].url') || '').trim();
        const infoSourceTitle = String(get('info_source_title', 'info.sources[0].title') || '').trim();
        if (infoSourceUrl || infoSourceTitle) {
          herb.info = herb.info || { sources: [] };
          herb.info.sources = [{
            url: infoSourceUrl || 'https://example.invalid',
            title: infoSourceTitle,
            publisher: String(get('info_source_publisher', 'info.sources[0].publisher') || '').trim(),
            accessedAt: excelDateToJsDate(get('info_source_accessed_at', 'info.sources[0].accessedAt')) || new Date(),
          }];
          const infoSource2Url = String(get('info.sources[1].url') || '').trim();
          const infoSource2Title = String(get('info.sources[1].title') || '').trim();
          if (infoSource2Url || infoSource2Title) {
            herb.info.sources.push({
              url: infoSource2Url || 'https://example.invalid',
              title: infoSource2Title,
              publisher: String(get('info.sources[1].publisher') || '').trim(),
              accessedAt: new Date(),
            });
          }
        } else {
          herb.info = { sources: [] };
          herb.description = undefined;
        }

        const dosageSourceUrl = String(get('dosage_source_url', 'dosage.sources[0].url') || '').trim();
        const dosageSourceTitle = String(get('dosage_source_title', 'dosage.sources[0].title') || '').trim();
        const adultMin = String(get('dosage_adult_min', 'dosage.adult.min') || '').trim();
        const childMin = String(get('dosage_child_min', 'dosage.child.min') || '').trim();
        const elderlyMin = String(get('dosage_elderly_min', 'dosage.elderly.min') || '').trim();
        const hasDosage = adultMin || childMin || elderlyMin;

        if (hasDosage) {
          herb.dosage = {
            adult: {
              min: adultMin,
              max: String(get('dosage_adult_max', 'dosage.adult.max') || '').trim(),
              unit: String(get('dosage_adult_unit', 'dosage.adult.unit') || '').trim(),
              frequency: String(get('dosage_adult_frequency', 'dosage.adult.frequency') || '').trim(),
            },
            child: {
              min: childMin,
              max: String(get('dosage_child_max', 'dosage.child.max') || '').trim(),
              unit: String(get('dosage_child_unit', 'dosage.child.unit') || '').trim(),
              frequency: String(get('dosage_child_frequency', 'dosage.child.frequency') || '').trim(),
            },
            elderly: {
              min: elderlyMin,
              max: String(get('dosage_elderly_max', 'dosage.elderly.max') || '').trim(),
              unit: String(get('dosage_elderly_unit', 'dosage.elderly.unit') || '').trim(),
              frequency: String(get('dosage_elderly_frequency', 'dosage.elderly.frequency') || '').trim(),
            },
            sources: [],
          };

          if (dosageSourceUrl || dosageSourceTitle) {
            herb.dosage.sources = [{
              url: dosageSourceUrl || 'https://example.invalid',
              title: dosageSourceTitle,
              publisher: String(get('dosage_source_publisher', 'dosage.sources[0].publisher') || '').trim(),
              accessedAt: excelDateToJsDate(get('dosage_source_accessed_at', 'dosage.sources[0].accessedAt')) || new Date(),
            }];
          } else {
            herb.dosage = undefined;
          }
        } else {
          herb.dosage = undefined;
        }

        const preparationEntries = [];
        for (let i = 0; i < 6; i += 1) {
          const rawMethod = String(get(`preparation[${i}].method`, i === 0 ? 'preparation_method' : '') || '').trim();
          const method = normalizeMethod(rawMethod);
          if (!method) continue;
          preparationEntries.push({
            method,
            instructions: String(get(`preparation[${i}].instructions`, i === 0 ? 'preparation_instructions' : '') || '').trim(),
            ratio: String(get(`preparation[${i}].ratio`, i === 0 ? 'preparation_ratio' : '') || '').trim(),
          });
        }
        const uniquePreparationEntries = [];
        const preparationSeen = new Set();
        for (const entry of preparationEntries) {
          const key = `${entry.method}|${entry.instructions}|${entry.ratio}`.toLowerCase();
          if (preparationSeen.has(key)) continue;
          preparationSeen.add(key);
          uniquePreparationEntries.push(entry);
        }
        herb.preparation = uniquePreparationEntries;

        herb.growingInfo = {
          climate: String(get('growing_climate', 'growingInfo.climate') || '').trim(),
          soil: String(get('growing_soil', 'growingInfo.soil') || '').trim(),
          sunlight: String(get('growing_sunlight', 'growingInfo.sunlight') || '').trim(),
          water: String(get('growing_water', 'growingInfo.water') || '').trim(),
          harvesting: String(get('growing_harvesting', 'growingInfo.harvesting') || '').trim(),
        };

        const compoundEntries = parsePhytochemicalRowData(get);

        const phytochemicalRefs = [];
        for (let i = 0; i < compoundEntries.length; i += 1) {
          const compoundName = compoundEntries[i].name;
          // eslint-disable-next-line no-await-in-loop
          let compound = await Phytochemical.findOne({
            name: new RegExp(`^${escapeRegex(compoundName)}$`, 'i'),
          });

          if (!compound) {
            // eslint-disable-next-line no-await-in-loop
            compound = await Phytochemical.create({
              name: compoundName,
              category: normalizeCategory(compoundEntries[i].category),
              description: compoundEntries[i].benefit || '',
              isActive: true,
            });
          }

          phytochemicalRefs.push({
            compound: compound._id,
            concentration: compoundEntries[i].concentration || '',
            partSource: compoundEntries[i].partSource || '',
          });
        }
        herb.phytochemicals = phytochemicalRefs;

        if (dryRun) {
          if (isUpdate) updated += 1;
          else inserted += 1;
          continue;
        }

        await herb.save();
        if (isUpdate) updated += 1;
        else inserted += 1;
      } catch (error) {
        console.log(`Row ${rowNum}: ${error.message}`);
        rowErrors += 1;
      }
    }

    console.log(`Herb import complete: inserted=${inserted}, updated=${updated}, skipped=${skipped}, errors=${rowErrors}, dryRun=${dryRun}`);

    // Optional second pass: import phytochemical assignments tab.
    let assignmentRows = [];
    try {
      assignmentRows = readRows(file, assignmentSheet);
    } catch (error) {
      console.log(`Assignment sheet "${assignmentSheet}" not found, skipping assignment import.`);
    }

    if (assignmentRows.length > 0) {
      for (let index = 0; index < assignmentRows.length; index += 1) {
        const row = assignmentRows[index];
        const get = buildRowGetter(row);
        const rowNum = index + 2;
        const skipAssignment = (reason) => {
          assignmentSkipped += 1;
          assignmentSkipReasons[reason] = (assignmentSkipReasons[reason] || 0) + 1;
          console.log(`Assignment row ${rowNum}: skipped (${reason})`);
        };
        try {
          const rawHerbId = String(get('herbId', 'herb_id', 'herbId (herb _id string)') || '').trim();
          // eslint-disable-next-line no-await-in-loop
          const herb = await resolveHerbForAssignment(get);
          const phytochemicalRaw = String(get(
            'phytochemicalId',
            'phytochemical_id',
            'phytochemicalName',
            'phytochemical_name',
            'phytochemical',
            'phytochemicalId (phytochemical name resolved to ObjectId)',
            'phytochemicalId (phytochemical name',
            'phytochemicalId (phytochemical name → resolved to ObjectId)'
          ) || '').trim();
          const herbPart = String(get('herbPart', 'part') || '').trim().toLowerCase();
          const concentrationValue = Number(get('concentrationValue'));
          const concentrationUnit = String(get('concentrationUnit') || '').trim();

          if (!herb?._id || !phytochemicalRaw) {
            skipAssignment('missing_or_unresolved_herb_or_phytochemical');
            continue;
          }
          const herbId = String(herb._id);
          if (!['leaf', 'root', 'flower', 'bark', 'whole_plant'].includes(herbPart)) {
            skipAssignment(`invalid_herb_part:${herbPart || 'empty'}`);
            continue;
          }
          if (!Number.isFinite(concentrationValue) || concentrationValue < 0) {
            skipAssignment(`invalid_concentration_value:${String(get('concentrationValue') || '') || 'empty'}`);
            continue;
          }
          if (!['%', 'mg/g', 'mg/kg', 'ppm', 'ug/g'].includes(concentrationUnit)) {
            skipAssignment(`invalid_concentration_unit:${concentrationUnit || 'empty'}`);
            continue;
          }

          let phytochemical;
          if (/^[0-9a-fA-F]{24}$/.test(phytochemicalRaw)) {
            // eslint-disable-next-line no-await-in-loop
            phytochemical = await Phytochemical.findById(phytochemicalRaw).lean();
          } else {
            // eslint-disable-next-line no-await-in-loop
            phytochemical = await Phytochemical.findOne({
              name: new RegExp(`^${escapeRegex(phytochemicalRaw)}$`, 'i'),
            }).lean();
          }

          if (!phytochemical) {
            if (dryRun) {
              phytochemical = { _id: 'dry-run-new-phytochemical' };
            } else {
              // eslint-disable-next-line no-await-in-loop
              const created = await Phytochemical.create({
                name: phytochemicalRaw,
                category: 'other',
                isActive: true,
              });
              phytochemical = created.toObject();
            }
          }

          const sourceReference = String(get('sourceReference') || '').trim();
          const sourceReferenceNormalized = sourceReference.toLowerCase();
          const herbIdCandidates = Array.from(new Set([herbId, rawHerbId].filter(Boolean)));

          let assignmentId = '';
          // eslint-disable-next-line no-await-in-loop
          const existing = await PhytochemicalAssignment.findOne({
            phytochemicalId: phytochemical._id,
            herbId: { $in: herbIdCandidates },
            herbPart,
            sourceReferenceNormalized,
          }).select('_id').lean();
          if (existing?._id) assignmentId = String(existing._id);

          const payload = {
            assignmentId,
            phytochemicalId: phytochemical._id,
            herbId,
            herbPart,
            concentrationValue,
            concentrationUnit,
            sourceReference,
            extractionType: String(get('extractionType') || '').trim(),
            confidenceLevel: String(get('confidenceLevel') || 'medium').trim().toLowerCase() || 'medium',
            notes: String(get('notes') || '').trim(),
            status: String(get('status') || 'active').trim().toLowerCase() || 'active',
            revisionNote: 'Imported from Excel assignment sheet',
          };

          if (dryRun) {
            if (assignmentId) assignmentUpdated += 1;
            else assignmentInserted += 1;
            continue;
          }

          // eslint-disable-next-line no-await-in-loop
          await PhytochemicalAdminService.saveAssignment(payload, defaultUser._id);
          if (assignmentId) assignmentUpdated += 1;
          else assignmentInserted += 1;
        } catch (error) {
          console.log(`Assignment row ${rowNum}: ${error.message}`);
          assignmentErrors += 1;
        }
      }

      console.log(`Assignment import complete: inserted=${assignmentInserted}, updated=${assignmentUpdated}, skipped=${assignmentSkipped}, errors=${assignmentErrors}, dryRun=${dryRun}`);
      if (assignmentSkipped > 0) {
        console.log(`Assignment skip reason breakdown: ${JSON.stringify(assignmentSkipReasons)}`);
      }
    } else {
      console.log('No assignment rows to import.');
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

run().catch((error) => {
  console.error('Import failed:', error.message);
  process.exit(1);
});


