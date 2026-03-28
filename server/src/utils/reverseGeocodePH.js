const centers = require('../data/phAdminCenters');

const toRadians = (value) => (value * Math.PI) / 180;

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const reverseGeocodePH = ({ lat, lng, maxDistanceKm = 80 }) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  let best = null;

  for (const center of centers) {
    const [centerLng, centerLat] = center.coordinates;
    const distanceKm = haversineKm(lat, lng, centerLat, centerLng);

    if (!best || distanceKm < best.distanceKm) {
      best = { ...center, distanceKm };
    }
  }

  if (!best || best.distanceKm > maxDistanceKm) {
    return null;
  }

  return {
    city: best.city,
    province: best.province,
    region: best.region,
    distanceKm: Number(best.distanceKm.toFixed(2)),
  };
};

module.exports = {
  reverseGeocodePH,
};
