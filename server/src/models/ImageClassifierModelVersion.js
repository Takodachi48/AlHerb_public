const mongoose = require('mongoose');

const imageClassifierModelVersionSchema = new mongoose.Schema(
  {
    idempotency_key: { type: String, trim: true, index: true, unique: true, sparse: true },
    version: { type: String, required: true, trim: true, index: true },
    model_path: { type: String, trim: true },
    val_accuracy: { type: Number },
    val_loss: { type: Number },
    is_active: { type: Boolean, default: false, index: true },
    trained_at: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
  }
);

imageClassifierModelVersionSchema.index({ trained_at: -1 });

module.exports = mongoose.model('ImageClassifierModelVersion', imageClassifierModelVersionSchema);
