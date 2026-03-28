import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import IconToggleButton from '../common/IconToggleButton';

/* Inline SVG placeholder so there's no external asset dependency */
const PLACEHOLDER_SVG = `data:image/svg+xml;base64,${btoa(
  '<svg width="400" height="240" xmlns="http://www.w3.org/2000/svg">' +
  '<rect width="100%" height="100%" fill="#e8e5de"/>' +
  '<text x="50%" y="48%" text-anchor="middle" dy=".35em" fill="#b0ada6" ' +
  'font-family="system-ui,sans-serif" font-size="11" letter-spacing="3">NO IMAGE</text>' +
  '</svg>'
)}`;

const toCloudinarySizedUrl = (url, width) => {
  if (!url || typeof url !== 'string') return url;
  const marker = '/upload/';
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return url;

  const transform = `f_auto,q_auto,dpr_auto,w_${width},c_limit`;
  const prefix = url.slice(0, markerIndex + marker.length);
  const suffix = url.slice(markerIndex + marker.length);

  // Keep existing transformations but prepend delivery optimization.
  if (suffix.startsWith('f_') || suffix.startsWith('q_') || suffix.startsWith('w_') || suffix.startsWith('c_')) {
    return `${prefix}${transform}/${suffix}`;
  }

  return `${prefix}${transform}/${suffix}`;
};

const resolvePrimaryImageUrl = (herb) => {
  const primaryImage = (Array.isArray(herb?.images) ? herb.images : [])
    .map((img) => {
      if (!img) return null;
      if (typeof img === 'string') return { url: img, isPrimary: false };
      return { url: img.url, isPrimary: Boolean(img.isPrimary) };
    })
    .filter((img) => Boolean(img?.url))
    .reduce((best, img) => (!best || img.isPrimary ? img : best), null);

  return primaryImage?.url || herb?.image || PLACEHOLDER_SVG;
};

/**
 * HerbCard
 *
 * Props:
 *   herb          { _id, name, scientificName, commonNames, images, image,
 *                   symptoms, properties, description }
 *   onViewDetails (herb) => void
 *   className     string (optional)
 *
 * All styles come from .herb-card* in Components.css.
 * Drop-in replacement for the old HerbCard that used Card + Tailwind.
 */
const HerbCard = ({
  herb,
  onViewDetails,
  onToggleFavorite,
  isFavorite = false,
  favoriteBusy = false,
  safetyTag = '',
  className = '',
}) => {
  const displayName = useMemo(
    () => herb?.commonNames?.[0] || herb?.name || 'Unknown Herb',
    [herb?.commonNames, herb?.name]
  );
  const imageUrl = useMemo(() => resolvePrimaryImageUrl(herb), [herb]);
  const optimizedImageUrl = useMemo(() => toCloudinarySizedUrl(imageUrl, 640), [imageUrl]);
  const optimizedImageSrcSet = useMemo(() => [
    `${toCloudinarySizedUrl(imageUrl, 320)} 320w`,
    `${toCloudinarySizedUrl(imageUrl, 480)} 480w`,
    `${toCloudinarySizedUrl(imageUrl, 640)} 640w`,
    `${toCloudinarySizedUrl(imageUrl, 960)} 960w`,
  ].join(', '), [imageUrl]);
  const uses = useMemo(() => herb?.symptoms || herb?.properties || [], [herb?.symptoms, herb?.properties]);
  const visibleUses = useMemo(() => uses.slice(0, 3), [uses]);
  const description = herb?.description || 'No description available.';
  const isFeatured = Boolean(herb?.isFeatured);

  const handleActivate = useCallback(() => onViewDetails?.(herb), [onViewDetails, herb]);
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') handleActivate();
  }, [handleActivate]);
  const handleFavoriteToggle = useCallback((event) => {
    event.stopPropagation();
    onToggleFavorite?.(herb);
  }, [onToggleFavorite, herb]);

  if (!herb) return null;

  return (
    <div
      className={`herb-card ${className}`.trim()}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${displayName}`}
    >
      <div className="herb-card__image-wrap">
        {typeof onToggleFavorite === 'function' && (
          <IconToggleButton
            preset="favorite-ghost"
            toggled={isFavorite}
            ariaLabel={isFavorite ? `Remove ${displayName} from favorites` : `Add ${displayName} to favorites`}
            onClick={handleFavoriteToggle}
            disabled={favoriteBusy}
            loading={favoriteBusy}
            size="md"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 3,
              borderColor: 'rgba(255,255,255,0.3)',
            }}
            inactiveStyle={{
              color: 'var(--color-neutral-primary-disabled)',
            }}
          />
        )}
        <img
          src={optimizedImageUrl}
          srcSet={optimizedImageSrcSet}
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          alt={displayName}
          className="herb-card__image"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          draggable={false}
        />
        <div className="herb-card__image-overlay" aria-hidden="true">
          <span className="herb-card__image-hint">View Details {'->'}</span>
        </div>
      </div>

      <div className="herb-card__body">
        <div className="herb-card__names">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <h3 className="herb-card__title">{displayName}</h3>
            {isFeatured && (
              <span
                style={{
                  border: '1px solid rgba(127,168,127,.35)',
                  background: 'rgba(127,168,127,.12)',
                  color: 'var(--text-brand)',
                  fontSize: 10,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  borderRadius: 4,
                  padding: '2px 6px',
                  whiteSpace: 'nowrap',
                }}
              >
                Featured
              </span>
            )}
          </div>
          {herb.scientificName && (
            <p className="herb-card__subtitle">{herb.scientificName}</p>
          )}
        </div>

        {visibleUses.length > 0 && (
          <div>
            <p className="herb-card__tags-label">Uses</p>
            <div className="herb-card__tags" style={{ marginTop: '5px' }}>
              {visibleUses.map((use, i) => (
                <span key={i} className="herb-card__tag">{use}</span>
              ))}
            </div>
          </div>
        )}

        {safetyTag ? (
          <p className="herb-card__tags-label" style={{ marginTop: 8 }}>{safetyTag}</p>
        ) : null}
        <p className="herb-card__desc">{description}</p>
      </div>
    </div>
  );
};

HerbCard.propTypes = {
  herb: PropTypes.shape({
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string,
    scientificName: PropTypes.string,
    commonNames: PropTypes.array,
    images: PropTypes.array,
    image: PropTypes.string,
    symptoms: PropTypes.array,
    properties: PropTypes.array,
    description: PropTypes.string,
  }).isRequired,
  onViewDetails: PropTypes.func.isRequired,
  onToggleFavorite: PropTypes.func,
  isFavorite: PropTypes.bool,
  favoriteBusy: PropTypes.bool,
  safetyTag: PropTypes.string,
  className: PropTypes.string,
};

const areCardPropsEqual = (prev, next) => {
  if (
    prev.herb === next.herb
    && prev.isFavorite === next.isFavorite
    && prev.favoriteBusy === next.favoriteBusy
    && prev.safetyTag === next.safetyTag
    && prev.className === next.className
    && prev.onViewDetails === next.onViewDetails
    && prev.onToggleFavorite === next.onToggleFavorite
  ) {
    return true;
  }

  const prevHerb = prev.herb || {};
  const nextHerb = next.herb || {};
  const prevUses = (prevHerb.symptoms || prevHerb.properties || []).slice(0, 3).join('|');
  const nextUses = (nextHerb.symptoms || nextHerb.properties || []).slice(0, 3).join('|');

  return (
    prev.isFavorite === next.isFavorite
    && prev.favoriteBusy === next.favoriteBusy
    && prev.safetyTag === next.safetyTag
    && prev.className === next.className
    && prev.onViewDetails === next.onViewDetails
    && prev.onToggleFavorite === next.onToggleFavorite
    && prevHerb._id === nextHerb._id
    && prevHerb.name === nextHerb.name
    && prevHerb.scientificName === nextHerb.scientificName
    && prevHerb.description === nextHerb.description
    && prevHerb.isFeatured === nextHerb.isFeatured
    && (prevHerb.commonNames?.[0] || '') === (nextHerb.commonNames?.[0] || '')
    && resolvePrimaryImageUrl(prevHerb) === resolvePrimaryImageUrl(nextHerb)
    && prevUses === nextUses
  );
};

export default React.memo(HerbCard, areCardPropsEqual);
