const mongoose = require('mongoose');

const LOCATION_TYPES = ['market', 'foraging', 'shop', 'pharmacy', 'clinic'];

const createSlug = (value = '') => value
  .toString()
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9-]/g, '')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

const herbSubSchema = new mongoose.Schema({
  herbId: {
    type: String,
    ref: 'Herb',
    required: true,
  },
  notes: {
    type: String,
    trim: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const imageSubSchema = new mongoose.Schema({
  url: {
    type: String,
    trim: true,
  },
  caption: {
    type: String,
    trim: true,
  },
  isPrimary: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

const derivedLocationSubSchema = new mongoose.Schema({
  city: {
    type: String,
    trim: true,
    default: '',
  },
  province: {
    type: String,
    trim: true,
    default: '',
  },
  country: {
    type: String,
    trim: true,
    default: '',
  },
  postcode: {
    type: String,
    trim: true,
    default: '',
  },
  provider: {
    type: String,
    enum: ['nominatim', 'geoapify', 'opencage'],
    default: 'nominatim',
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
  },
  type: {
    type: String,
    enum: LOCATION_TYPES,
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(coords) {
          if (!Array.isArray(coords) || coords.length !== 2) {
            return false;
          }

          const [lng, lat] = coords;
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
            return false;
          }

          if (lng < 116 || lng > 127) {
            return false;
          }

          if (lat < 4 || lat > 21) {
            return false;
          }

          const lngPrecision = lng.toString().split('.')[1]?.length || 0;
          const latPrecision = lat.toString().split('.')[1]?.length || 0;

          return lngPrecision <= 6 && latPrecision <= 6;
        },
        message: 'Coordinates must be within the Philippines and use up to 6 decimal places.',
      },
    },
  },
  herbs: {
    type: [herbSubSchema],
    default: [],
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  images: {
    type: [imageSubSchema],
    default: [],
  },
  derivedLocation: {
    type: derivedLocationSubSchema,
    default: undefined,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  verifiedDate: Date,
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

locationSchema.index({ location: '2dsphere' });
locationSchema.index({ type: 1 });
locationSchema.index({ isActive: 1, type: 1, name: 1 });
locationSchema.index({ 'herbs.herbId': 1 });
locationSchema.index({ name: 'text', description: 'text' });

locationSchema.pre('validate', async function preValidate(next) {
  if (!this.isModified('name')) {
    return next();
  }

  const baseSlug = createSlug(this.name);
  let candidate = baseSlug;
  let suffix = 1;

  while (candidate) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await this.constructor.findOne({
      slug: candidate,
      _id: { $ne: this._id },
    }).select('_id');

    if (!existing) {
      this.slug = candidate;
      break;
    }

    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  if (!this.slug) {
    this.slug = `${Date.now()}`;
  }

  return next();
});

locationSchema.pre('save', function preSave(next) {
  if (this.verified && !this.verifiedDate) {
    this.verifiedDate = new Date();
  }

  if (!this.verified) {
    this.verifiedDate = undefined;
  }

  next();
});

locationSchema.statics.findNear = function findNear(coordinates, maxDistance = 10000) {
  return this.find({
    isActive: true,
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates,
        },
        $maxDistance: maxDistance,
      },
    },
  });
};

locationSchema.statics.findByType = function findByType(type) {
  return this.find({ type, isActive: true });
};

locationSchema.statics.findWithHerbs = function findWithHerbs(herbIds = []) {
  const ids = Array.isArray(herbIds) ? herbIds : [herbIds];
  return this.find({
    isActive: true,
    'herbs.herbId': { $in: ids },
  });
};

locationSchema.statics.findWithinBounds = function findWithinBounds(southWest, northEast) {
  return this.find({
    isActive: true,
    location: {
      $geoWithin: {
        $box: [southWest, northEast],
      },
    },
  });
};

locationSchema.statics.getClusters = async function getClusters(bounds, zoom = 10, filters = {}) {
  const geohashPrecision = zoom >= 16 ? 4 : zoom >= 13 ? 3 : zoom >= 10 ? 2 : zoom >= 7 ? 1 : 0;
  const useCompact = filters.compact === true || filters.compact === 'true';
  const geoQuery = {
    isActive: true,
  };

  if (filters.type && filters.type !== 'all') {
    geoQuery.type = filters.type;
  }

  if (Array.isArray(filters.herbIds) && filters.herbIds.length > 0) {
    geoQuery['herbs.herbId'] = { $in: filters.herbIds };
  }

  if (Array.isArray(filters.locationIds) && filters.locationIds.length > 0) {
    geoQuery._id = { $in: filters.locationIds };
  }

  if (filters.search) {
    geoQuery.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } },
    ];
  }

  const clusterLocationProjection = useCompact
    ? {
      _id: '$_id',
      name: '$name',
      type: '$type',
      location: '$location',
    }
    : {
      _id: '$_id',
      name: '$name',
      type: '$type',
      location: '$location',
      images: '$images',
      derivedLocation: '$derivedLocation',
    };

  return this.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: bounds.center,
        },
        distanceField: 'distance',
        spherical: true,
        key: 'location',
        query: geoQuery,
      },
    },
    {
      $addFields: {
        lng: { $arrayElemAt: ['$location.coordinates', 0] },
        lat: { $arrayElemAt: ['$location.coordinates', 1] },
      },
    },
    {
      $match: {
        lng: { $gte: bounds.southWest[0], $lte: bounds.northEast[0] },
        lat: { $gte: bounds.southWest[1], $lte: bounds.northEast[1] },
      },
    },
    {
      $addFields: {
        geohash: {
          $concat: [
            { $toString: { $round: ['$lng', geohashPrecision] } },
            ':',
            { $toString: { $round: ['$lat', geohashPrecision] } },
          ],
        },
      },
    },
    {
      $group: {
        _id: '$geohash',
        count: { $sum: 1 },
        centerLng: { $avg: '$lng' },
        centerLat: { $avg: '$lat' },
        locations: {
          $push: clusterLocationProjection,
        },
      },
    },
    {
      $project: {
        _id: 0,
        geohash: '$_id',
        count: 1,
        center: {
          type: 'Point',
          coordinates: ['$centerLng', '$centerLat'],
        },
        locations: 1,
      },
    },
  ]);
};

locationSchema.methods.getPrimaryImage = function getPrimaryImage() {
  const primaryImage = this.images.find((image) => image.isPrimary);
  return primaryImage ? primaryImage.url : (this.images[0] ? this.images[0].url : null);
};

locationSchema.methods.updateHerbAvailability = function updateHerbAvailability(herbId, updateData = {}) {
  const herbIndex = this.herbs.findIndex((herb) => herb.herbId.toString() === herbId.toString());

  if (herbIndex !== -1) {
    Object.assign(this.herbs[herbIndex], updateData, { lastUpdated: new Date() });
  } else {
    this.herbs.push({
      herbId,
      ...updateData,
      lastUpdated: new Date(),
    });
  }

  return this.save();
};

locationSchema.methods.removeHerb = function removeHerb(herbId) {
  this.herbs = this.herbs.filter((herb) => herb.herbId.toString() !== herbId.toString());
  return this.save();
};

locationSchema.virtual('rating', {
  ref: 'LocationReview',
  localField: '_id',
  foreignField: 'locationId',
});

locationSchema.virtual('herbCount').get(function herbCount() {
  return this.herbs ? this.herbs.length : 0;
});

locationSchema.set('toJSON', { virtuals: true });
locationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Location', locationSchema);
