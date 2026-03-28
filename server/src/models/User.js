const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator', 'expert'],
    default: 'user',
  },
  authProvider: {
    type: String,
    enum: ['local', 'google', 'facebook', 'apple', 'unknown'],
    default: 'unknown',
  },
  photoURL: {
    type: String,
    default: null,
  },
  bannerURL: {
    type: String,
    default: null,
  },
  dateOfBirth: {
    type: Date,
    default: null,
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    default: null,
  },
  location: {
    city: {
      type: String,
      default: '',
    },
    province: {
      type: String,
      default: '',
    },
    region: {
      type: String,
      default: '',
    },
  },
  preferences: {
    notifications: {
      system: {
        type: Boolean,
        default: true,
      },
      blog: {
        type: Boolean,
        default: true,
      },
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
    },
    language: {
      type: String,
      default: 'en',
    },
    theme: {
      type: String,
      enum: ['theme1', 'theme2', 'theme8'],
      default: 'theme1',
    },
    darkMode: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light',
    },
    chatbot: {
      enabled: {
        type: Boolean,
        default: true,
      },
    },
  },
  medicalInfo: {
    allergies: [{
      type: String,
      trim: true,
    }],
    medications: [{
      name: String,
      dosage: String,
      frequency: String,
    }],
    conditions: [{
      type: String,
      trim: true,
    }],
  },
  profile: {
    bio: {
      type: String,
      maxlength: 500,
    },
    favoriteHerbs: [{
      type: String,
      ref: 'Herb',
    }],
    savedRecommendations: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recommendation',
    }],
    savedRemedies: [{
      herbId: {
        type: String,
        required: true,
        trim: true,
      },
      herbName: {
        type: String,
        default: '',
      },
      scientificName: {
        type: String,
        default: '',
      },
      dosageInfo: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      preparation: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      effectiveness: {
        type: Number,
        default: 0,
      },
      matchedSymptoms: [{
        type: String,
        trim: true,
      }],
      evidence: {
        type: String,
        default: '',
      },
      notes: {
        type: String,
        default: '',
      },
      selectedAge: {
        type: String,
        default: '',
      },
      selectedGender: {
        type: String,
        default: '',
      },
      searchMode: {
        type: String,
        default: 'symptom',
      },
      diseaseName: {
        type: String,
        default: '',
      },
      savedAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  pushTokens: {
    type: [String],
    default: [],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// ==================== INDEXES ====================

// Basic indexes (unique constraints already create indexes)
// uid and email already have unique indexes

// Performance indexes for frequently queried fields
userSchema.index({ isActive: 1 }); // For filtering active users
userSchema.index({ role: 1 }); // For admin queries
userSchema.index({ lastLoginAt: -1 }); // For analytics queries (recent logins)

// Compound indexes for common query patterns
userSchema.index({ isActive: 1, role: 1 }); // Admin user management
userSchema.index({ isActive: 1, lastLoginAt: -1 }); // Active user analytics
userSchema.index({ 'location.city': 1, isActive: 1 }); // Location-based queries
userSchema.index({ createdAt: -1 }); // Recent user registration queries

// Text search index for user search functionality
userSchema.index({
  displayName: 'text',
  email: 'text',
  'location.city': 'text',
  'location.province': 'text'
});

// Method to get user's age
userSchema.methods.getAge = function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Static method to find user by UID
userSchema.statics.findByUID = function (uid) {
  return this.findOne({ uid, isActive: true });
};

// Static method to find user by email
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

module.exports = mongoose.model('User', userSchema);
