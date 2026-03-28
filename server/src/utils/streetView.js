const STREET_VIEW_BASE_URL = 'https://maps.googleapis.com/maps/api/streetview';

const isValidCoordinate = (value) => Number.isFinite(value);

const buildStreetViewUrl = ({
  lat,
  lng,
  apiKey = process.env.GOOGLE_MAPS_API_KEY,
  size = '600x400',
}) => {
  if (!apiKey || !isValidCoordinate(lat) || !isValidCoordinate(lng)) {
    return null;
  }

  const params = new URLSearchParams({
    size,
    location: `${lat},${lng}`,
    key: apiKey,
  });

  return `${STREET_VIEW_BASE_URL}?${params.toString()}`;
};

const createStreetViewImage = ({
  lat,
  lng,
  apiKey = process.env.GOOGLE_MAPS_API_KEY,
  isPrimary = true,
  caption = 'Street View',
}) => {
  const url = buildStreetViewUrl({ lat, lng, apiKey });
  if (!url) {
    return null;
  }

  return {
    url,
    caption,
    isPrimary,
  };
};

const appendStreetViewImage = (locationPayload, options) => {
  const image = createStreetViewImage(options);
  if (!image) {
    return locationPayload;
  }

  const payload = { ...locationPayload };
  payload.images = Array.isArray(payload.images) ? payload.images : [];
  payload.images.push(image);
  return payload;
};

module.exports = {
  buildStreetViewUrl,
  createStreetViewImage,
  appendStreetViewImage,
};
