const asCleanString = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const pushUnique = (target, value) => {
  const cleaned = asCleanString(value);
  if (!cleaned) return;

  const exists = target.some((entry) => entry.toLowerCase() === cleaned.toLowerCase());
  if (!exists) {
    target.push(cleaned);
  }
};

const getCoordinateText = (location) => {
  const coordinates = Array.isArray(location?.location?.coordinates)
    ? location.location.coordinates
    : null;

  const lng = Number(coordinates?.[0] ?? location?.longitude);
  const lat = Number(coordinates?.[1] ?? location?.latitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

export const formatLocationAddress = (location, fallback = 'Address not specified') => {
  if (!location || typeof location !== 'object') return fallback;

  const directAddress = location.address;
  if (typeof directAddress === 'string' && directAddress.trim()) {
    return directAddress.trim();
  }

  const parts = [];
  if (directAddress && typeof directAddress === 'object') {
    pushUnique(parts, directAddress.street);
    pushUnique(parts, directAddress.barangay);
    pushUnique(parts, directAddress.city);
    pushUnique(parts, directAddress.municipality);
    pushUnique(parts, directAddress.province);
    pushUnique(parts, directAddress.region);
    pushUnique(parts, directAddress.country);
  }

  const derived = location.derivedLocation;
  if (derived && typeof derived === 'object') {
    pushUnique(parts, derived.city);
    pushUnique(parts, derived.province);
    pushUnique(parts, derived.country);
  }

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return fallback;
};

export const formatLocationCoordinates = (location, fallback = '') => {
  const coordinateText = getCoordinateText(location);
  if (!coordinateText) return fallback;
  return `Coordinates: ${coordinateText}`;
};
