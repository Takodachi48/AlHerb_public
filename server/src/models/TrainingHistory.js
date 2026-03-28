const mongoose = require('mongoose');

const trainingHistorySchema = new mongoose.Schema({
  modelType: {
    type: String,
    enum: ['recommendation', 'image_classification', 'sentiment_analysis'],
    required: true,
    index: true,
  },
  version: {
    type: String,
    required: true,
    index: true,
  },
  trainingType: {
    type: String,
    enum: ['full', 'incremental', 'fine_tuning'],
    required: true,
  },
  trigger: {
    type: String,
    enum: ['manual', 'automatic', 'scheduled'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  dataset: {
    totalSamples: {
      type: Number,
      required: true,
    },
    trainingSamples: {
      type: Number,
      required: true,
    },
    validationSamples: {
      type: Number,
      required: true,
    },
    testSamples: {
      type: Number,
      required: true,
    },
    dataSources: [{
      type: {
        type: String,
        enum: ['user_feedback', 'expert_curated', 'research_papers', 'synthetic'],
      },
      count: Number,
      quality: {
        type: String,
        enum: ['high', 'medium', 'low'],
      },
    }],
    preprocessing: {
      cleaned: Number,
      outliers: Number,
      duplicates: Number,
    },
  },
  parameters: {
    algorithm: String,
    hyperparameters: mongoose.Schema.Types.Mixed,
    features: [String],
    targetVariable: String,
    crossValidation: {
      folds: Number,
      strategy: String,
    },
  },
  performance: {
    training: {
      accuracy: Number,
      precision: Number,
      recall: Number,
      f1Score: Number,
      loss: Number,
      epochs: Number,
    },
    validation: {
      accuracy: Number,
      precision: Number,
      recall: Number,
      f1Score: Number,
      loss: Number,
    },
    test: {
      accuracy: Number,
      precision: Number,
      recall: Number,
      f1Score: Number,
      loss: Number,
    },
    baseline: {
      accuracy: Number,
      precision: Number,
      recall: Number,
      f1Score: Number,
    },
  },
  execution: {
    startTime: {
      type: Date,
      required: true,
    },
    endTime: Date,
    duration: Number,
    resources: {
      cpu: String,
      memory: String,
      gpu: String,
      instanceType: String,
    },
    environment: {
      pythonVersion: String,
      framework: String,
      dependencies: [String],
    },
  },
  artifacts: {
    modelPath: String,
    modelSize: Number,
    metadataPath: String,
    logsPath: String,
    checkpoints: [String],
    visualizations: [{
      type: {
        type: String,
        enum: ['confusion_matrix', 'roc_curve', 'learning_curve', 'feature_importance'],
      },
      path: String,
    }],
  },
  comparison: {
    previousVersion: String,
    improvement: {
      accuracy: Number,
      precision: Number,
      recall: Number,
      f1Score: Number,
    },
    regression: {
      detected: Boolean,
      details: String,
    },
  },
  feedback: {
    userFeedbackCount: Number,
    averageRating: Number,
    issues: [String],
    suggestions: [String],
  },
  deployment: {
    isDeployed: {
      type: Boolean,
      default: false,
    },
    deploymentDate: Date,
    rollbackVersion: String,
    rollbackReason: String,
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
    },
  },
  notes: {
    type: String,
    maxlength: 2000,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for model version lookup
trainingHistorySchema.index({ modelType: 1, version: -1 });

// Index for status tracking
trainingHistorySchema.index({ status: 1, createdAt: -1 });

// Index for trigger analysis
trainingHistorySchema.index({ trigger: 1, createdAt: -1 });

// Update the updatedAt field before saving
trainingHistorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate duration if endTime is set
  if (this.execution.endTime && this.execution.startTime) {
    this.execution.duration = this.execution.endTime - this.execution.startTime;
  }
  
  next();
});

// Static method to find training history by model type
trainingHistorySchema.statics.findByModelType = function(modelType, limit = 20) {
  return this.find({ modelType, isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('createdBy', 'displayName email');
};

// Static method to find latest version for model type
trainingHistorySchema.statics.findLatestVersion = function(modelType) {
  return this.findOne({ modelType, status: 'completed', isActive: true })
    .sort({ version: -1 });
};

// Static method to get training statistics
trainingHistorySchema.statics.getTrainingStats = function(modelType = null, days = 30) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const matchCondition = {
    createdAt: { $gte: cutoffDate },
    isActive: true,
  };
  
  if (modelType) {
    matchCondition.modelType = modelType;
  }
  
  return this.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: '$modelType',
        totalTrainings: { $sum: 1 },
        successfulTrainings: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        averageAccuracy: { $avg: '$performance.test.accuracy' },
        averageDuration: { $avg: '$execution.duration' },
        averageDatasetSize: { $avg: '$dataset.totalSamples' },
      },
    },
  ]);
};

// Static method to find failed trainings
trainingHistorySchema.statics.findFailedTrainings = function(days = 7) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({
    status: 'failed',
    createdAt: { $gte: cutoffDate },
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'displayName email');
};

// Static method to get performance trends
trainingHistorySchema.statics.getPerformanceTrends = function(modelType, limit = 10) {
  return this.find({
    modelType,
    status: 'completed',
    isActive: true,
  })
    .sort({ version: -1 })
    .limit(limit)
    .select('version performance.test accuracy createdAt')
    .lean();
};

// Method to mark as completed
trainingHistorySchema.methods.markCompleted = function(performanceMetrics, artifacts) {
  this.status = 'completed';
  this.execution.endTime = new Date();
  this.performance = { ...this.performance, ...performanceMetrics };
  if (artifacts) {
    this.artifacts = { ...this.artifacts, ...artifacts };
  }
  return this.save();
};

// Method to mark as failed
trainingHistorySchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.execution.endTime = new Date();
  this.notes = (this.notes || '') + '\nError: ' + error;
  return this.save();
};

// Method to deploy model
trainingHistorySchema.methods.deploy = function(environment = 'production') {
  this.deployment.isDeployed = true;
  this.deployment.deploymentDate = new Date();
  this.deployment.environment = environment;
  return this.save();
};

// Method to rollback deployment
trainingHistorySchema.methods.rollback = function(reason) {
  this.deployment.isDeployed = false;
  this.deployment.rollbackReason = reason;
  this.deployment.rollbackDate = new Date();
  return this.save();
};

// Method to get performance summary
trainingHistorySchema.methods.getPerformanceSummary = function() {
  return {
    accuracy: this.performance.test.accuracy,
    precision: this.performance.test.precision,
    recall: this.performance.test.recall,
    f1Score: this.performance.test.f1Score,
    improvement: this.comparison.improvement,
    duration: this.execution.duration,
    datasetSize: this.dataset.totalSamples,
  };
};

module.exports = mongoose.model('TrainingHistory', trainingHistorySchema);
