const mongoose = require('mongoose');

const imageClassifierFeedbackSchema = new mongoose.Schema(
  {
    idempotency_key: { type: String, trim: true, index: true, unique: true, sparse: true },
    prediction_id: { type: String, required: true, index: true },
    correct_herb_id: { type: Number, required: true },
    correct_herb_name: { type: String, required: true, trim: true },
    correct_scientific_name: { type: String, required: true, trim: true },
    user_id: { type: String, trim: true, default: null },
    feedback_type: { type: String, trim: true, default: 'correction' },
    used_for_training: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ImageClassifierFeedback', imageClassifierFeedbackSchema);
