const mongoose = require('mongoose');

/**
 * Phytochemical
 * The scientific foundation layer. Defines a compound once;
 * herbs reference it by ObjectId.
 *
 * This model drives:
 *   - HerbInteraction.mechanism (which compound causes the interaction)
 *   - HerbSafety (compound-level safety profiles inherited by herbs)
 *   - Phase 2: Herb.safetyProfile (denormalized summary computed from this)
 */
const phytochemicalSchema = new mongoose.Schema({

  // ── Identity ──────────────────────────────────────────────────
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
    // e.g. "Gingerol", "Quercetin", "Coumarin", "Berberine"
  },

  alternateNames: [{ type: String, trim: true }],
  // e.g. ["6-gingerol", "[6]-Gingerol"]

  category: {
    type: String,
    required: true,
    enum: [
      'alkaloids',
      'flavonoids',
      'terpenoids',
      'phenolic_compounds',
      'glycosides',
      'essential_oils',
      'tannins',
      'saponins',
      'other',
    ],
    index: true,
  },

  description: {
    type: String,
    // Plain-language summary of what the compound is and does
  },

  // ── Pharmacological Effects ───────────────────────────────────
  // What the compound actually does in the body — used to explain
  // why an herb works for a given symptom / condition
  effects: [{
    type: String,
    trim: true,
    // e.g. "anti-inflammatory", "anticoagulant", "CYP3A4 inhibitor",
    //      "sedative", "estrogenic", "antioxidant"
  }],

  // ── Drug Interactions ─────────────────────────────────────────
  // Compound-level drug interactions. HerbInteraction records reference
  // these to explain the mechanism behind a herb-drug interaction.
  drugInteractions: [{
    drugClass: {
      type: String,
      required: true,
      // e.g. "Anticoagulants", "SSRIs", "CYP3A4 substrates"
    },
    genericNames: [String],
    // e.g. ["warfarin", "clopidogrel"]
    effect: {
      type: String,
      required: true,
      // e.g. "Potentiates anticoagulant effect, increasing bleeding risk"
    },
    severity: {
      type: String,
      enum: ['minor', 'moderate', 'major', 'contraindicated'],
      required: true,
    },
    mechanism: {
      type: String,
      // e.g. "Inhibits platelet aggregation via COX-1 pathway"
    },
    evidence: {
      level: {
        type: String,
        enum: ['theoretical', 'case_report', 'observational', 'clinical_trial', 'traditional_use'],
        default: 'theoretical',
      },
      quality: {
        type: String,
        enum: ['low', 'moderate', 'high'],
      },
    },
    sources: [{ citation: String, pubmedId: String, url: String, year: Number }],
  }],

  // ── Safety Profiles ───────────────────────────────────────────
  // Compound-level safety. Herb-level HerbSafety records are derived
  // from (or at minimum informed by) these profiles.
  safety: {
    pregnancy: {
      status: {
        type: String,
        enum: ['safe', 'caution', 'avoid', 'unknown'],
        default: 'unknown',
      },
      notes: String,
      sources: [{ citation: String, url: String }],
    },

    breastfeeding: {
      status: {
        type: String,
        enum: ['safe', 'caution', 'avoid', 'unknown'],
        default: 'unknown',
      },
      notes: String,
      sources: [{ citation: String, url: String }],
    },

    children: {
      status: {
        type: String,
        enum: ['safe', 'caution', 'avoid', 'unknown'],
        default: 'unknown',
      },
      minAge: Number,
      notes: String,
    },

    elderly: {
      status: {
        type: String,
        enum: ['safe', 'caution', 'avoid', 'unknown'],
        default: 'unknown',
      },
      notes: String,
    },

    male: {
      status: {
        type: String,
        enum: ['safe', 'caution', 'avoid', 'unknown'],
        default: 'unknown',
      },
      notes: String,
    },

    female: {
      status: {
        type: String,
        enum: ['safe', 'caution', 'avoid', 'unknown'],
        default: 'unknown',
      },
      notes: String,
    },

    // Conditions this compound is contraindicated or cautioned for
    medicalConditions: [{
      condition: { type: String, required: true },
      recommendation: {
        type: String,
        enum: ['safe', 'caution', 'avoid'],
        required: true,
      },
      notes: String,
      sources: [{ citation: String, url: String }],
    }],

    // Known allergic cross-reactivities at the compound level
    allergyRisk: [{
      allergen: String,
      severity: {
        type: String,
        enum: ['mild', 'moderate', 'severe'],
      },
      notes: String,
    }],

    sideEffects: [{
      effect: String,
      frequency: { type: String, enum: ['common', 'uncommon', 'rare'] },
      severity: { type: String, enum: ['mild', 'moderate', 'severe'] },
    }],

    overdoseRisk: {
      level: { type: String, enum: ['low', 'moderate', 'high'], default: 'low' },
      symptoms: [String],
      treatment: String,
    },
  },

  // ── Sources ───────────────────────────────────────────────────
  sources: [{
    citation: String,
    pubmedId: String,
    url: String,
    year: Number,
  }],

  // ── Audit ─────────────────────────────────────────────────────
  verified: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedDate: Date,
  isActive: { type: Boolean, default: true },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────

phytochemicalSchema.index({ name: 'text', alternateNames: 'text', effects: 'text' });
phytochemicalSchema.index({ 'drugInteractions.drugClass': 1 });
phytochemicalSchema.index({ 'drugInteractions.severity': 1 });

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * PURE LOGIC
 * Given a list of compound ObjectIds (from Herb.phytochemicals),
 * return all drug interactions at or above a severity threshold.
 * Called by the interaction checker to build the herb-level drug interaction list.
 *
 * @param {ObjectId[]} compoundIds
 * @param {string} minSeverity - 'minor' | 'moderate' | 'major' | 'contraindicated'
 * @returns {Promise<Array>}
 */
phytochemicalSchema.statics.getDrugInteractionsForCompounds = function (
  compoundIds,
  minSeverity = 'moderate'
) {
  const severityOrder = ['minor', 'moderate', 'major', 'contraindicated'];
  const minIdx = severityOrder.indexOf(minSeverity);
  const thresholdIdx = minIdx >= 0 ? minIdx : severityOrder.indexOf('moderate');

  return this.find({
    _id: { $in: compoundIds },
    isActive: true,
  })
    .select('name drugInteractions')
    .lean()
    .then((compounds) => compounds
      .map((compound) => ({
        name: compound.name,
        drugInteractions: (compound.drugInteractions || []).filter((interaction) => (
          severityOrder.indexOf(interaction.severity) >= thresholdIdx
        )),
      }))
      .filter((compound) => compound.drugInteractions.length > 0));
};

/**
 * PURE LOGIC
 * Given a list of compound ObjectIds, return the most restrictive
 * safety profile across all compounds — used to derive Herb.safetyProfile
 * in the Phase 2 background sync job.
 *
 * Priority order: avoid > caution > safe > unknown
 *
 * @param {ObjectId[]} compoundIds
 * @returns {Promise<object>} Merged safety summary
 */
phytochemicalSchema.statics.deriveSafetyProfile = async function (compoundIds) {
  const compounds = await this.find({
    _id: { $in: compoundIds },
    isActive: true,
  }).select('safety').lean();

  const priority = { avoid: 3, caution: 2, safe: 1, unknown: 0 };

  const merge = (statuses) => {
    const valid = statuses.filter(Boolean);
    if (!valid.length) return 'unknown';
    return valid.reduce((worst, current) =>
      (priority[current] || 0) > (priority[worst] || 0) ? current : worst
    , 'unknown');
  };

  const allConditions = new Map();

  for (const compound of compounds) {
    for (const cond of compound.safety?.medicalConditions || []) {
      const key = (cond.condition || '').trim().toLowerCase();
      if (!key) continue;
      const existing = allConditions.get(key);
      if (!existing || priority[cond.recommendation] > priority[existing.recommendation]) {
        allConditions.set(key, cond);
      }
    }
  }

  return {
    pregnancy:      merge(compounds.map(c => c.safety?.pregnancy?.status)),
    breastfeeding:  merge(compounds.map(c => c.safety?.breastfeeding?.status)),
    children:       merge(compounds.map(c => c.safety?.children?.status)),
    elderly:        merge(compounds.map(c => c.safety?.elderly?.status)),
    male:           merge(compounds.map(c => c.safety?.male?.status)),
    female:         merge(compounds.map(c => c.safety?.female?.status)),
    medicalConditions: [...allConditions.values()],
    lastComputedAt: new Date(),
  };
};

/**
 * PURE LOGIC
 * Find all compounds that interact with a given drug name or class.
 * Used to explain which compound in an herb is responsible for a drug interaction.
 *
 * @param {string} drugName
 * @returns {Promise<Array>}
 */
phytochemicalSchema.statics.findByDrug = function (drugName) {
  const regex = new RegExp(drugName, 'i');
  return this.find({
    isActive: true,
    $or: [
      { 'drugInteractions.drugClass': regex },
      { 'drugInteractions.genericNames': regex },
    ],
  })
    .select('name category drugInteractions')
    .lean()
    .then((compounds) => compounds
      .map((compound) => ({
        name: compound.name,
        category: compound.category,
        drugInteractions: (compound.drugInteractions || []).filter((interaction) => (
          regex.test(interaction.drugClass || '') ||
          (interaction.genericNames || []).some((genericName) => regex.test(genericName || ''))
        )),
      }))
      .filter((compound) => compound.drugInteractions.length > 0));
};

module.exports = mongoose.model('Phytochemical', phytochemicalSchema);
