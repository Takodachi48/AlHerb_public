const Location = require('../models/Location');
const LocationReview = require('../models/LocationReview');
const mongoose = require('mongoose');
const NodeCache = require('node-cache');
const { clearCache } = require('../middleware/cacheMiddleware');
const { formatSuccess, formatError } = require('../utils/responseFormatter');
const { enrichLocationDocument, buildCoordinateHash } = require('../services/reverseGeocodingService');
const { attachLocationImageIfMissing } = require('../services/locationImageService');
const SearchService = require('../services/searchService');
const imageService = require('../services/imageService');
const { moderateCommentContent } = require('../services/commentModerationService');

const clusterCache = new NodeCache({ stdTTL: 120, checkperiod: 60, useClones: false });
const LOCATION_LIST_PROJECTION = 'name slug type location herbs description images derivedLocation verified isActive createdAt updatedAt';
const LOCATION_LIST_COMPACT_PROJECTION = 'name slug type location isActive createdAt updatedAt';
const LOCATION_DETAIL_PROJECTION = 'name slug type location herbs description images derivedLocation verified verifiedDate isActive createdAt updatedAt';
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// Get all locations with optional filters
const getLocations = async (req, res) => {
  try {
    const {
      type,
      search,
      herb,
      compact = false,
      isActive,
      page = 1,
      limit = 50,
      skip: skipParam,
      minLat,
      maxLat,
      minLng,
      maxLng,
    } = req.query;

    const limitInt = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    const pageInt = Math.max(1, parseInt(page, 10) || 1);
    const skip = skipParam ? parseInt(skipParam, 10) : (pageInt - 1) * limitInt;
    const useCompact = compact === true || compact === 'true';

    const query = {};

    if (isActive !== undefined && isActive !== '') {
      query.isActive = isActive === 'true' || isActive === true;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    let meiliTotal = null;
    if (search) {
      const meili = await SearchService.searchLocationIds(search, {
        page: pageInt,
        limit: limitInt,
        type: type || 'all',
        status: (isActive === undefined || isActive === '') ? 'all' : ((isActive === 'true' || isActive === true) ? 'active' : 'inactive'),
      }).catch(() => null);

      if (meili) {
        query._id = { $in: meili.ids };
        meiliTotal = meili.total;
      } else {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }
    }

    if (herb) {
      const herbFilters = [];

      if (mongoose.Types.ObjectId.isValid(herb)) {
        herbFilters.push(new mongoose.Types.ObjectId(herb));
      }

      herbFilters.push(herb);
      query['herbs.herbId'] = { $in: herbFilters };
    }

    if (minLat && maxLat && minLng && maxLng) {
      query.location = {
        $geoWithin: {
          $box: [
            [parseFloat(minLng), parseFloat(minLat)],
            [parseFloat(maxLng), parseFloat(maxLat)],
          ],
        },
      };
    }

    const locationsQuery = Location.find(query)
      .select(useCompact ? LOCATION_LIST_COMPACT_PROJECTION : LOCATION_LIST_PROJECTION)
      .sort({ name: 1 })
      .limit(limitInt)
      .skip(skip)
      .lean();

    if (!useCompact) {
      locationsQuery.populate('herbs.herbId', 'name scientificName commonNames');
    }

    const [locations, total] = await Promise.all([
      locationsQuery,
      meiliTotal !== null ? Promise.resolve(meiliTotal) : Location.countDocuments(query),
    ]);

    res.json(formatSuccess({
      locations,
      pagination: {
        total,
        page: pageInt,
        limit: limitInt,
        skip,
        hasMore: total > (skip + limitInt),
      },
    }, 'Locations retrieved successfully'));
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations', details: error.message });
  }
};

// Get nearby locations using geospatial query
const getNearbyLocations = async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 25,
      type,
      herb,
      compact = false,
      limit = 30,
      search,
    } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const limitInt = Math.min(Math.max(1, parseInt(limit, 10) || 30), 100);
    const useCompact = compact === true || compact === 'true';
    const centerLat = parseFloat(lat);
    const centerLng = parseFloat(lng);
    const radiusMeters = parseFloat(radius) * 1000;

    const baseQuery = { isActive: true };

    if (type && type !== 'all') {
      baseQuery.type = type;
    }

    if (search) {
      const meili = await SearchService.searchLocationIds(search, {
        page: 1,
        limit: 200,
        type: type || 'all',
        status: 'active',
      }).catch(() => null);

      if (meili) {
        baseQuery._id = { $in: meili.ids };
      } else {
        baseQuery.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }
    }

    if (herb) {
      const herbFilters = [];
      if (mongoose.Types.ObjectId.isValid(herb)) {
        herbFilters.push(new mongoose.Types.ObjectId(herb));
      }
      herbFilters.push(herb);
      baseQuery['herbs.herbId'] = { $in: herbFilters };
    }

    if (useCompact) {
      const locations = await Location.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [centerLng, centerLat],
            },
            distanceField: 'distanceMeters',
            spherical: true,
            maxDistance: radiusMeters,
            query: baseQuery,
            key: 'location',
          },
        },
        {
          $project: {
            name: 1,
            slug: 1,
            type: 1,
            location: 1,
            isActive: 1,
            createdAt: 1,
            updatedAt: 1,
            distance: {
              $round: [{ $divide: ['$distanceMeters', 1000] }, 1],
            },
          },
        },
        { $limit: limitInt },
      ]);

      return res.json(locations);
    }

    const query = {
      ...baseQuery,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [centerLng, centerLat],
          },
          $maxDistance: radiusMeters,
        },
      },
    };

    const locationsQuery = Location.find(query)
      .select(useCompact ? LOCATION_LIST_COMPACT_PROJECTION : LOCATION_LIST_PROJECTION)
      .limit(limitInt)
      .lean();

    if (!useCompact) {
      locationsQuery.populate('herbs.herbId', 'name scientificName commonNames');
    }

    const locations = await locationsQuery;

    const locationsWithDistance = locations.map((location) => {
      const distance = calculateDistance(
        centerLat,
        centerLng,
        location.location.coordinates[1],
        location.location.coordinates[0],
      );

      return {
        ...location,
        distance: Math.round(distance * 10) / 10,
      };
    });

    return res.json(locationsWithDistance);
  } catch (error) {
    console.error('Error fetching nearby locations:', error);
    return res.status(500).json({ error: 'Failed to fetch nearby locations' });
  }
};

// Get location by ID
const getLocationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid location ID' });
    }

    const [location, reviews, reviewStats] = await Promise.all([
      Location.findById(id)
        .select(LOCATION_DETAIL_PROJECTION)
        .populate('herbs.herbId', 'name scientificName commonNames description images')
        .lean(),
      LocationReview.find({ locationId: id, isActive: true })
        .select('locationId userId comment wouldReturn verified helpful likes dislikes images createdAt updatedAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'displayName photoURL role')
        .lean(),
      LocationReview.getLocationStats(id),
    ]);

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    return res.json({
      ...location,
      reviews: reviews || [],
      reviewStats: reviewStats || null,
    });
  } catch (error) {
    console.error('Error fetching location:', error);
    return res.status(500).json({ error: 'Failed to fetch location' });
  }
};

// Get location reviews (public)
const getLocationReviews = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(formatError('Invalid location ID', 400));
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
    const skip = (page - 1) * limit;

    const [total, reviews] = await Promise.all([
      LocationReview.countDocuments({ locationId: id, isActive: true }),
      LocationReview.find({ locationId: id, isActive: true })
        .select('locationId userId comment wouldReturn verified helpful likes dislikes images createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'displayName photoURL role')
        .lean(),
    ]);

    return res.json(formatSuccess({
      entries: reviews || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: skip + (reviews?.length || 0) < total,
        hasPrevPage: page > 1,
      },
    }, 'Location reviews retrieved successfully'));
  } catch (error) {
    console.error('Error fetching location reviews:', error);
    return res.status(500).json(formatError('Failed to fetch location reviews', 500, error.message));
  }
};

// Create location review (auth required)
const createLocationReview = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(formatError('Invalid location ID', 400));
    }

    const { comment, wouldReturn, caption } = req.body || {};
    if (!comment || typeof comment !== 'string') {
      return res.status(400).json(formatError('Comment is required', 400));
    }

    const location = await Location.findById(id).select('_id isActive');
    if (!location || location.isActive === false) {
      return res.status(404).json(formatError('Location not found', 404));
    }

    const existing = await LocationReview.findOne({ locationId: id, userId: req.user._id }).select('_id');
    if (existing) {
      return res.status(409).json(formatError('You have already reviewed this location', 409));
    }

    const moderated = await moderateCommentContent(comment);
    if (!moderated.sanitizedContent) {
      return res.status(400).json(formatError('Comment content cannot be empty', 400));
    }

    let imagePayload = [];
    if (req.file) {
      const url = await imageService.uploadGeneralImage(req.file);
      imagePayload = [{
        url,
        caption: caption || '',
      }];
    }

    const review = await LocationReview.create({
      locationId: id,
      userId: req.user._id,
      comment: moderated.sanitizedContent,
      wouldReturn: wouldReturn !== undefined ? wouldReturn : true,
      images: imagePayload,
    });

    const populated = await LocationReview.findById(review._id)
      .select('locationId userId comment wouldReturn verified helpful likes dislikes images createdAt updatedAt')
      .populate('userId', 'displayName photoURL role')
      .lean();

    return res.status(201).json(formatSuccess(populated, 'Review created successfully'));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json(formatError('You have already reviewed this location', 409));
    }
    console.error('Error creating location review:', error);
    return res.status(500).json(formatError('Failed to create review', 500, error.message));
  }
};

// Create new location (protected)
const createLocation = async (req, res) => {
  try {
    const locationData = {
      ...req.body,
      createdBy: req.body.createdBy || req.user?._id,
    };

    const location = new Location(locationData);
    await enrichLocationDocument(location);
    await attachLocationImageIfMissing(location);
    await location.save();

    const populatedLocation = await Location.findById(location._id)
      .populate('herbs.herbId', 'name scientificName commonNames');

    clearCache('/locations');
    clearCache('/stats');

    return res.status(201).json(populatedLocation);
  } catch (error) {
    console.error('Error creating location:', error);
    return res.status(500).json({ error: 'Failed to create location' });
  }
};

// Update location (protected)
const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid location ID' });
    }

    const location = await Location.findById(id);

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const previousCoordinates = Array.isArray(location.location?.coordinates)
      ? [...location.location.coordinates]
      : null;

    location.set(updateData);

    const nextCoordinates = Array.isArray(location.location?.coordinates)
      ? [...location.location.coordinates]
      : null;

    const previousHash = previousCoordinates ? buildCoordinateHash(previousCoordinates[1], previousCoordinates[0]) : null;
    const nextHash = nextCoordinates ? buildCoordinateHash(nextCoordinates[1], nextCoordinates[0]) : null;
    const coordinatesChanged = previousHash !== nextHash;
    const missingDerivedLocation = !location.derivedLocation || !location.derivedLocation.country;

    if (coordinatesChanged || missingDerivedLocation) {
      await enrichLocationDocument(location, { forceRefresh: coordinatesChanged });
    }

    if (coordinatesChanged) {
      await attachLocationImageIfMissing(location, { forceRefresh: true });
    } else {
      await attachLocationImageIfMissing(location);
    }

    await location.save();

    await location.populate('herbs.herbId', 'name scientificName commonNames');

    clearCache('/locations');
    clearCache('/stats');

    return res.json(location);
  } catch (error) {
    console.error('Error updating location:', error);
    return res.status(500).json({ error: 'Failed to update location' });
  }
};

// Delete location (protected)
const deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid location ID' });
    }

    const location = await Location.findByIdAndDelete(id);

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    clearCache('/locations');
    clearCache('/stats');

    return res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting location:', error);
    return res.status(500).json({ error: 'Failed to delete location' });
  }
};

// Get unique categories from locations
const getUniqueCategories = async (req, res) => {
  try {
    const categories = await Location.distinct('type', { isActive: true });

    if (!categories || categories.length === 0) {
      return res.json({ categories: ['market', 'shop', 'foraging', 'pharmacy', 'clinic'] });
    }

    return res.json({ categories });
  } catch (error) {
    console.error('Error fetching unique categories:', error);
    return res.json({ categories: ['market', 'shop', 'foraging', 'pharmacy', 'clinic'] });
  }
};

// Get unique statuses from locations
const getUniqueStatuses = async (req, res) => {
  try {
    const statuses = ['active', 'inactive'];
    return res.json({ statuses });
  } catch (error) {
    console.error('Error fetching unique statuses:', error);
    return res.status(500).json({ error: 'Failed to fetch statuses' });
  }
};

// Get location statistics (public)
const getLocationStats = async (req, res) => {
  try {
    const total = await Location.countDocuments({ isActive: true });
    res.json({ locations: total });
  } catch (error) {
    console.error('Error fetching location stats:', error);
    res.status(500).json({ error: 'Failed to fetch location statistics' });
  }
};

// Get clustered map points by bounds + zoom (optimized for map rendering)
const getLocationClusters = async (req, res) => {
  try {
    const {
      swLat,
      swLng,
      neLat,
      neLng,
      zoom = 10,
      type,
      herb,
      compact = false,
      search,
    } = req.query;

    if (!swLat || !swLng || !neLat || !neLng) {
      return res.status(400).json({ error: 'Bounds are required (swLat, swLng, neLat, neLng).' });
    }

    const herbFilters = [];
    let searchLocationIds = null;
    if (herb) {
      if (mongoose.Types.ObjectId.isValid(herb)) {
        herbFilters.push(new mongoose.Types.ObjectId(herb));
      }
      herbFilters.push(herb);
    }
    if (search) {
      const meili = await SearchService.searchLocationIds(search, {
        page: 1,
        limit: 400,
        type: type || 'all',
        status: 'active',
      }).catch(() => null);
      if (meili) {
        searchLocationIds = meili.ids;
      }
    }

    const bounds = {
      southWest: [parseFloat(swLng), parseFloat(swLat)],
      northEast: [parseFloat(neLng), parseFloat(neLat)],
      center: [
        (parseFloat(swLng) + parseFloat(neLng)) / 2,
        (parseFloat(swLat) + parseFloat(neLat)) / 2,
      ],
    };

    const zoomInt = Math.max(1, Math.min(20, parseInt(zoom, 10) || 10));
    const useCompact = compact === true || compact === 'true';
    const cacheKey = JSON.stringify({
      bounds,
      zoom: zoomInt,
      type: type || null,
      herb: herb || null,
      compact: useCompact,
      search: search || null,
      searchLocationIds: searchLocationIds ? searchLocationIds.join(',') : null,
    });

    const cached = clusterCache.get(cacheKey);
    if (cached) {
      return res.json(formatSuccess(cached, 'Location clusters retrieved (cache hit)'));
    }

    const clusters = await Location.getClusters(bounds, zoomInt, {
      type,
      herbIds: herbFilters,
      compact: useCompact,
      search: searchLocationIds ? null : search,
      locationIds: searchLocationIds || null,
    });

    clusterCache.set(cacheKey, clusters);
    return res.json(formatSuccess(clusters, 'Location clusters retrieved successfully'));
  } catch (error) {
    console.error('Error fetching location clusters:', error);
    return res.status(500).json({ error: 'Failed to fetch location clusters' });
  }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = {
  getLocations,
  getNearbyLocations,
  getLocationById,
  getLocationReviews,
  createLocationReview,
  createLocation,
  updateLocation,
  deleteLocation,
  getUniqueCategories,
  getUniqueStatuses,
  getLocationStats,
  getLocationClusters,
};
