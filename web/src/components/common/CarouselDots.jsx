import React from 'react';

/**
 * CarouselDots
 *
 * Props:
 *   total        number   — total number of slides
 *   activeIndex  number   — currently active slide index
 *   onChange     fn       — (index: number) => void
 *   className    string
 */
const CarouselDots = ({
  total,
  activeIndex,
  onChange,
  className = '',
}) => {
  if (total <= 1) return null;

  return (
    <div
      className={`cdots-root ${className}`.trim()}
      role="tablist"
      aria-label="Slide navigation"
    >
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-label={`Go to slide ${i + 1}`}
          aria-selected={activeIndex === i}
          className={`cdots-dot${activeIndex === i ? ' cdots-dot--active' : ''}`}
          onClick={() => onChange(i)}
        >
          <span className="cdots-pip" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
};

export default CarouselDots;