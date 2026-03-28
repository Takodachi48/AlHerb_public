const mongoose = require('mongoose');

const imageClassifierPredictionSchema = new mongoose.Schema(
  {
    idempotency_key: { type: String, trim: true, index: true, unique: true, sparse: true },
    prediction_id: { type: String, required: true, unique: true, index: true },
    image_url: { type: String, required: true, trim: true },
    predicted_herb_id: { type: Number, required: true },
    predicted_herb_name: { type: String, trim: true },
    predicted_scientific_name: { type: String, trim: true },
    confidence: { type: Number, min: 0, max: 1 },
    top_5_predictions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    model_version: { type: String, trim: true },
    inference_time_ms: { type: Number, min: 0 },
    created_at: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ImageClassifierPrediction', imageClassifierPredictionSchema);
