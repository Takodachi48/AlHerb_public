const mongoose = require('mongoose');

const phytochemicalAssignmentSchema = new mongoose.Schema({
  phytochemicalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Phytochemical',
    required: true,
    index: true,
  },
  herbId: {
    type: String,
    ref: 'Herb',
    required: true,
    index: true,
  },
  herbPart: {
    type: String,
    enum: ['leaf', 'root', 'flower', 'bark', 'whole_plant'],
    required: true,
  },
  concentrationValue: {
    type: Number,
    required: true,
    min: 0,
  },
  concentrationUnit: {
    type: String,
    enum: ['%', 'mg/g', 'mg/kg', 'ppm', 'ug/g'],
    required: true,
  },
  sourceReference: {
    type: String,
    trim: true,
    default: '',
  },
  sourceReferenceNormalized: {
    type: String,
    trim: true,
    default: '',
  },
  extractionType: {
    type: String,
    trim: true,
    default: '',
  },
  confidenceLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
  status: {
    type: String,
    enum: ['active', 'superseded', 'archived'],
    default: 'active',
    index: true,
  },
  revisionNote: {
    type: String,
    trim: true,
    default: '',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

phytochemicalAssignmentSchema.index(
  { phytochemicalId: 1, herbId: 1, herbPart: 1, sourceReferenceNormalized: 1 },
  { unique: true }
);
phytochemicalAssignmentSchema.index({ phytochemicalId: 1, status: 1, updatedAt: -1 });
phytochemicalAssignmentSchema.index({ herbId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('PhytochemicalAssignment', phytochemicalAssignmentSchema);
