import React from 'react';
import PropTypes from 'prop-types';

const FilterBox = ({
  options = [],
  selectedValue,
  onSelect,
  columns = 2,
  className = '',
}) => (
  <div className={`grid gap-1 ${className}`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
    {options.map((opt, i) => {
      const active = selectedValue === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={`filter-btn ${active ? 'filter-btn--active' : ''}`}
        >
          <div className="flex items-center gap-2">
            {opt.icon && (
              <span className="flex-shrink-0 text-sm leading-none">{opt.icon}</span>
            )}
            <span>{opt.label}</span>
          </div>
        </button>
      );
    })}
  </div>
);

FilterBox.propTypes = {
  options: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.node,
  })).isRequired,
  selectedValue: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  columns: PropTypes.number,
  className: PropTypes.string,
};

export default FilterBox;
