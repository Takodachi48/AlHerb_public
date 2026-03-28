const mongoose = require('mongoose');

/**
 * HerbSafety
 * One record per herb. Manually curated herb-level safety data.
 *
 * Relationship to Phytochemical:
 *   - Phytochemical.safety is the compound-level source of truth
 *   - This model stores the herb-level summary (which may be more
 *     conservative than individual compounds, or include herb-specific
 *     notes not captured at compound level)
 *   - Phase 2: Herb.safetyProfile is the fast denormalized cache used
 *     at query time; this model is the authoritative herb-level record
 *
 * Used by: PURE LOGIC (safety gate in recommendation pipeline)
 * NOT used by ML model directly
 */
const herbSafetySchema = new mongoose.Schema({
  herbId: {
    type: String,
    ref: 'Herb',
    required: true,
    unique: true,
    index: true,
  },

  // ── Compound References ───────────────────────────────────────
  // Tracks which phytochemicals drove the safety assessments below.
  // Allows traceability: "why is this herb flagged for pregnancy?"
  derivedFromCompounds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Phytochemical',
  }],

  // ── Population Safety ─────────────────────────────────────────
  // Herb-level status. May be more conservative than any single
  // compound — some combinations produce risks the compounds don't
  // individually carry (e.g. additive uterotonic effects).
  pregnancy: {
    status: {
      type: String,
      enum: ['safe', 'caution', 'avoid', 'unknown'],
      default: 'unknown',
    },
    notes: String,
    // Which compounds are responsible (subset of derivedFromCompounds)
    causativeCompounds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Phytochemical' }],
    sources: [{ citation: String, url: String }],
  },

  breastfeeding: {
    status: {
      type: String,
      enum: ['safe', 'caution', 'avoid', 'unknown'],
      default: 'unknown',
    },
    notes: String,
    causativeCompounds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Phytochemical' }],
    sources: [{ citation: String, url: String }],
  },

  children: {
    status: {
      type: String,
      enum: ['safe', 'caution', 'avoid', 'unknown'],
      default: 'unknown',
    },
    minAge: { type: Number }, // years
    notes: String,
    causativeCompounds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Phytochemical' }],
    sources: [{ citation: String, url: String }],
  },

  elderly: {
    status: {
      type: String,
      enum: ['safe', 'caution', 'avoid', 'unknown'],
      default: 'unknown',
    },
    notes: String,
    causativeCompounds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Phytochemical' }],
  },

  male: {
    status: {
      type: String,
      enum: ['safe', 'caution', 'avoid', 'unknown'],
      default: 'unknown',
    },
    notes: String,
    causativeCompounds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Phytochemical' }],
    sources: [{ citation: String, url: String }],
  },

  female: {
    status: {
      type: String,
      enum: ['safe', 'caution', 'avoid', 'unknown'],
      default: 'unknown',
    },
    notes: String,
    causativeCompounds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Phytochemical' }],
    sources: [{ citation: String, url: String }],
  },

  // ── Medical Condition Cautions ────────────────────────────────
  // Condition-level safety cautions (not absolute contraindications —
  // those live in the Contraindication model with cited sources).
  // Derived from Phytochemical.safety.medicalConditions, may be
  // augmented with herb-specific notes.
  medicalConditions: [{
    condition: { type: String, required: true },
    recommendation: {
      type: String,
      enum: ['safe', 'caution', 'avoid'],
      required: true,
    },
    notes: String,
    // Which compound(s) cause this condition interaction
    causativeCompounds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Phytochemical' }],
  }],

  // ── Allergy Flags ─────────────────────────────────────────────
  // Compound-level allergen data flows up here.
  // Herb may also have whole-plant allergy risks (e.g. pollen,
  // latex cross-reactivity) independent of individual compounds.
  allergies: [{
    allergen: String,
    severity: { type: String, enum: ['mild', 'moderate', 'severe'] },
    causativeCompound: { type: mongoose.Schema.Types.ObjectId, ref: 'Phytochemical' },
    notes: String,
  }],

  // ── Side Effects ──────────────────────────────────────────────
  sideEffects: [{
    effect: String,
    frequency: { type: String, enum: ['common', 'uncommon', 'rare'] },
    severity:  { type: String, enum: ['mild', 'moderate', 'severe'] },
    causativeCompound: { type: mongoose.Schema.Types.ObjectId, ref: 'Phytochemical' },
  }],

  // ── Overdose ──────────────────────────────────────────────────
  overdoseRisk: {
    level:     { type: String, enum: ['low', 'moderate', 'high'], default: 'low' },
    symptoms:  [String],
    treatment: String,
  },

  // ── Audit ─────────────────────────────────────────────────────
  verified:     { type: Boolean, default: false },
  verifiedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedDate: Date,
  lastReviewed: Date,

}, { timestamps: true });

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * PURE LOGIC
 * Full safety assessment for a user profile against a specific herb.
 * Returns structured blockers (hard stops) and warnings (show but allow).
 *
 * Called after Phase 2 fast-filter (Herb.filterSafeForUser) to do the
 * full deep check on remaining candidates.
 *
 * @param {string} herbId
 * @param {object} userProfile
 *   { age, isPregnant, isBreastfeeding, conditions[], medications[], allergies[] }
 * @returns {Promise<{ safe: boolean, warnings: string[], blockers: string[] }>}
 */
herbSafetySchema.statics.assessForUser = async function (herbId, userProfile) {
  const safety = await this.findOne({ herbId })
    .populate('pregnancy.causativeCompounds', 'name')
    .populate('breastfeeding.causativeCompounds', 'name')
    .populate('children.causativeCompounds', 'name')
    .populate('elderly.causativeCompounds', 'name')
    .populate('male.causativeCompounds', 'name')
    .populate('female.causativeCompounds', 'name')
    .populate('medicalConditions.causativeCompounds', 'name')
    .populate('allergies.causativeCompound', 'name');

  if (!safety) return { safe: true, warnings: [], blockers: [] };

  const warnings = [];
  const blockers = [];

  const compoundNote = (compounds) => {
    if (!compounds?.length) return '';
    const names = compounds.map(c => c.name).join(', ');
    return ` (due to: ${names})`;
  };

  // Pregnancy
  if (userProfile.isPregnant) {
    if (safety.pregnancy.status === 'avoid') {
      blockers.push(
        `Avoid during pregnancy${compoundNote(safety.pregnancy.causativeCompounds)}. ${safety.pregnancy.notes || ''}`.trim()
      );
    } else if (safety.pregnancy.status === 'caution') {
      warnings.push(
        `Use with caution during pregnancy${compoundNote(safety.pregnancy.causativeCompounds)}. ${safety.pregnancy.notes || ''}`.trim()
      );
    }
  }

  // Breastfeeding
  if (userProfile.isBreastfeeding) {
    if (safety.breastfeeding.status === 'avoid') {
      blockers.push(
        `Avoid while breastfeeding${compoundNote(safety.breastfeeding.causativeCompounds)}. ${safety.breastfeeding.notes || ''}`.trim()
      );
    } else if (safety.breastfeeding.status === 'caution') {
      warnings.push(
        `Use with caution while breastfeeding${compoundNote(safety.breastfeeding.causativeCompounds)}. ${safety.breastfeeding.notes || ''}`.trim()
      );
    }
  }

  // Children
  if (userProfile.age !== undefined && userProfile.age < 18) {
    if (safety.children.status === 'avoid') {
      blockers.push(
        `Not recommended for children${compoundNote(safety.children.causativeCompounds)}. ${safety.children.notes || ''}`.trim()
      );
    } else if (safety.children.minAge && userProfile.age < safety.children.minAge) {
      blockers.push(`Not suitable for children under ${safety.children.minAge} years.`);
    } else if (safety.children.status === 'caution') {
      warnings.push(
        `Use with caution in children${compoundNote(safety.children.causativeCompounds)}. ${safety.children.notes || ''}`.trim()
      );
    }
  }

  // Elderly
  if (userProfile.age !== undefined && userProfile.age >= 65) {
    if (safety.elderly.status === 'avoid') {
      blockers.push(
        `Avoid in elderly patients${compoundNote(safety.elderly.causativeCompounds)}. ${safety.elderly.notes || ''}`.trim()
      );
    } else if (safety.elderly.status === 'caution') {
      warnings.push(
        `Use with caution in elderly patients${compoundNote(safety.elderly.causativeCompounds)}. ${safety.elderly.notes || ''}`.trim()
      );
    }
  }

  // Medical conditions
  if (userProfile.conditions?.length) {
    for (const cond of safety.medicalConditions) {
      const matched = userProfile.conditions.some(c =>
        c.toLowerCase().includes(cond.condition.toLowerCase())
      );
      if (!matched) continue;
      const conditionCompounds = compoundNote(cond.causativeCompounds);

      if (cond.recommendation === 'avoid') {
        blockers.push(
          `Contraindicated with ${cond.condition}${conditionCompounds}. ${cond.notes || ''}`.trim()
        );
      } else if (cond.recommendation === 'caution') {
        warnings.push(
          `Use with caution if you have ${cond.condition}${conditionCompounds}. ${cond.notes || ''}`.trim()
        );
      }
    }
  }

  // Gender-specific safety profile
  const normalizedGender = String(userProfile.gender || '').toLowerCase();
  if (normalizedGender === 'male') {
    if (safety.male?.status === 'avoid') {
      blockers.push(
        `Not recommended for male users${compoundNote(safety.male.causativeCompounds)}. ${safety.male.notes || ''}`.trim()
      );
    } else if (safety.male?.status === 'caution') {
      warnings.push(
        `Use with caution for male users${compoundNote(safety.male.causativeCompounds)}. ${safety.male.notes || ''}`.trim()
      );
    }
  }

  if (normalizedGender === 'female') {
    if (safety.female?.status === 'avoid') {
      blockers.push(
        `Not recommended for female users${compoundNote(safety.female.causativeCompounds)}. ${safety.female.notes || ''}`.trim()
      );
    } else if (safety.female?.status === 'caution') {
      warnings.push(
        `Use with caution for female users${compoundNote(safety.female.causativeCompounds)}. ${safety.female.notes || ''}`.trim()
      );
    }
  }

  // Allergies
  if (userProfile.allergies?.length) {
    for (const allergy of safety.allergies) {
      const matched = userProfile.allergies.some(a =>
        a.toLowerCase().includes(allergy.allergen?.toLowerCase())
      );
      if (matched) {
        const allergyCompound = allergy.causativeCompound?.name ? ` (due to: ${allergy.causativeCompound.name})` : '';
        blockers.push(
          `Possible allergy risk: ${allergy.allergen}${allergyCompound} (${allergy.severity || 'unknown severity'}). ${allergy.notes || ''}`.trim()
        );
      }
    }
  }

  return {
    safe:     blockers.length === 0,
    warnings: warnings.filter(Boolean),
    blockers: blockers.filter(Boolean),
  };
};

module.exports = mongoose.model('HerbSafety', herbSafetySchema);
