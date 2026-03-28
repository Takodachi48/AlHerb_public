import React from 'react';
import PropTypes from 'prop-types';

const PrevIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
  </svg>
);
const NextIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
  </svg>
);

const getVisiblePages = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current <= 3) {
    pages.push(2, 3, 4, '...', total);
  } else if (current >= total - 2) {
    pages.push('...', total - 3, total - 2, total - 1, total);
  } else {
    pages.push('...', current - 1, current, current + 1, '...', total);
  }
  return pages;
};

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  total,
  limit,
  showInfo = true,
}) => {
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const safeCurrent = Math.min(Math.max(1, Number(currentPage) || 1), safeTotalPages);
  const pages = getVisiblePages(safeCurrent, safeTotalPages);
  const start = total === 0 ? 0 : (safeCurrent - 1) * limit + 1;
  const end   = Math.min(safeCurrent * limit, total);

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      {showInfo && (
        <span style={{ fontFamily: 'var(--font-accent)', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}
              className="text-tertiary">
          {start}-{end} of {total}
        </span>
      )}

      <div className="pagination-bar flex items-center gap-0">
        <button
          onClick={() => onPageChange(safeCurrent - 1)}
          disabled={safeCurrent === 1}
          className="page-btn page-btn--arrow"
          aria-label="Previous"
        >
          <PrevIcon />
        </button>

        {safeTotalPages > 2 && pages.map((page, i) =>
          page === '...'
            ? <span key={`e-${i}`} className="page-btn pointer-events-none opacity-50">...</span>
            : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`page-btn ${safeCurrent === page ? 'page-btn--active' : ''}`}
              >
                {page}
              </button>
            )
        )}

        <button
          onClick={() => onPageChange(safeCurrent + 1)}
          disabled={safeCurrent === safeTotalPages}
          className="page-btn page-btn--arrow"
          aria-label="Next"
        >
          <NextIcon />
        </button>
      </div>
    </div>
  );
};

Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  total: PropTypes.number,
  limit: PropTypes.number,
  showInfo: PropTypes.bool,
};

export default Pagination;
