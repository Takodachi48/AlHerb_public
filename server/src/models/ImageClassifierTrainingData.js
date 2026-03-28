const mongoose = require('mongoose');

const imageClassifierTrainingDataSchema = new mongoose.Schema(
  {
    idempotency_key: { type: String, trim: true, index: true, unique: true, sparse: true },
    image_url: { type: String, required: true, trim: true },
    herb_id: { type: Number, required: true },
    herb_name: { type: String, required: true, trim: true },
    scientific_name: { type: String, required: true, trim: true },
    source: { type: String, trim: true, default: 'feedback' },
    is_new: { type: Boolean, default: true, index: true },
    used_in_training: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now, index: true },
    last_used_at: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

imageClassifierTrainingDataSchema.index({ is_new: 1, created_at: -1 });

module.exports = mongoose.model('ImageClassifierTrainingData', imageClassifierTrainingDataSchema);
