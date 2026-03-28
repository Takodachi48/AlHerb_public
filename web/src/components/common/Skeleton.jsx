import React from 'react';

/* ══════════════════════════════════════════════════════════════
   BASE SKELETON
══════════════════════════════════════════════════════════════ */
const Skeleton = ({
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'animate-pulse bg-surface-secondary rounded';

  const variantClasses = {
    default: 'h-4 w-full',
    text: 'h-4 w-full',
    title: 'h-6 w-3/4',
    card: 'h-44 w-full',
    button: 'h-8 w-28 rounded-full',
    circle: 'rounded-full',
    image: 'aspect-video',
    avatar: 'h-12 w-12 rounded-full',
  };

  const combinedClasses = `${baseClasses} ${variantClasses[variant] || variantClasses.default} ${className}`;

  if (children) {
    return <div className={combinedClasses} {...props}>{children}</div>;
  }
  return <div className={combinedClasses} {...props} />;
};

/* ══════════════════════════════════════════════════════════════
   HERB CARD SKELETON
   Matches HerbCard shell using the same CSS classes.
══════════════════════════════════════════════════════════════ */
export const HerbCardSkeleton = () => (
  <div className="herb-card">
    <div className="herb-card__image-wrap">
      <Skeleton className="w-full h-full rounded-none" />
    </div>
    <div className="herb-card__body">
      <div className="herb-card__names">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Skeleton variant="title" className="flex-1" style={{ height: '18px', margin: 0 }} />
          <Skeleton variant="button" className="w-16 h-5" style={{ borderRadius: '4px' }} />
        </div>
        <Skeleton variant="text" className="w-2/3 mt-1.5" style={{ height: '11px', margin: 0 }} />
      </div>

      <div style={{ marginTop: '5px' }}>
        <Skeleton variant="text" className="w-10 mb-1.5" style={{ height: '8px', margin: 0 }} />
        <div className="herb-card__tags">
          <Skeleton variant="button" className="w-14 h-5" style={{ borderRadius: '6px' }} />
          <Skeleton variant="button" className="w-20 h-5" style={{ borderRadius: '6px' }} />
          <Skeleton variant="button" className="w-16 h-5" style={{ borderRadius: '6px' }} />
        </div>
      </div>

      <div className="herb-card__desc" style={{ marginTop: 'auto' }}>
        <Skeleton variant="text" className="w-full mb-2" style={{ height: '12px', margin: 0 }} />
        <Skeleton variant="text" className="w-full mb-2" style={{ height: '12px', margin: 0 }} />
        <Skeleton variant="text" className="w-3/4" style={{ height: '12px', margin: 0 }} />
      </div>
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════════
   FILTER BAR SKELETON
   Mirrors the sticky hp-filterbar layout for first-load state.
   Import and render above the grid while loading === true.
══════════════════════════════════════════════════════════════ */
export const FilterBarSkeleton = () => (
  <div className="hp-filterbar" aria-hidden="true">
    <div className="hp-filterbar-inner">
      <div className="hp-filterbar-search">
        <Skeleton style={{ height: '38px', borderRadius: '6px', width: '100%' }} />
      </div>
      <div className="hp-filterbar-divider" />
      <div className="hp-filterbar-gender">
        <Skeleton style={{ width: '38px', height: '38px', borderRadius: '6px' }} />
        <Skeleton style={{ width: '38px', height: '38px', borderRadius: '6px' }} />
      </div>
      <div className="hp-filterbar-divider" />
      <div className="hp-filterbar-safety" style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div className="flex justify-between mb-2">
            <Skeleton className="w-10 h-2.5" />
            <Skeleton className="w-16 h-2.5" />
          </div>
          <Skeleton style={{ height: '14px', borderRadius: '4px', width: '100%' }} />
        </div>
        <Skeleton style={{ width: '80px', height: '32px', borderRadius: '6px' }} />
      </div>
    </div>
  </div>
);

export const MetaRowSkeleton = () => (
  <div style={{
    background: 'var(--surface-primary)',
    border: '1.5px solid var(--border-primary)',
    borderLeft: '3px solid var(--border-weak)',
    borderRadius: '6px',
    boxShadow: '4px 4px 0 var(--surface-tertiary)',
    padding: '18px 20px',
    marginBottom: '16px'
  }}>
    <div className="hp-meta-row" aria-hidden="true" style={{ marginBottom: 0 }}>
      <Skeleton className="w-20" style={{ height: '11px' }} />
      <Skeleton className="w-24" style={{ height: '11px' }} />
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════════
   GRID SKELETON
   Uses hp-grid so column count stays in sync with the real grid.
══════════════════════════════════════════════════════════════ */
export const GridSkeleton = ({ count = 6, children }) => (
  <div className="hp-grid">
    {Array.from({ length: count }).map((_, index) => (
      <div key={`skeleton-${index}`} className="io-reveal io-visible" data-io-animation="zoom">
        {children || <HerbCardSkeleton />}
      </div>
    ))}
  </div>
);

export default Skeleton;