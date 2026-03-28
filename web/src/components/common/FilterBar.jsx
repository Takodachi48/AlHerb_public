import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import SearchBar from './SearchBar';
import DiscreteSlider from './DiscreteSlider';
import IconToggleButton from './IconToggleButton';
import Button from './Button';
import '../../styles/Components.css';

const FilterBar = ({
  localSearch,
  onSearchChange,
  activeGender,
  onGenderToggle,
  safetyFilter,
  onSafetyChange,
  hasActiveFilters,
  onClearAll,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1, position: 'sticky' }}
      exit={{ y: -80, opacity: 0, position: 'absolute', width: '100%', pointerEvents: 'none' }}
      transition={{ type: 'tween', duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`hp-filterbar ${className}`.trim()}
      role="search"
      aria-label="Herb filters"
    >
      <div className="hp-filterbar-inner">
        <div className="hp-filterbar-search">
          <SearchBar
            value={localSearch}
            onChange={onSearchChange}
            onSubmit={onSearchChange}
            placeholder="Search herbs, symptoms, properties..."
            defaultWidth="w-full"
            focusedWidth="w-full"
            className="w-full"
          />
        </div>

        <div className="hp-filterbar-divider" aria-hidden="true" />

        <div className="hp-filterbar-gender">
          <IconToggleButton
            preset="gender-male-outline"
            toggled={activeGender === 'male'}
            onClick={() => onGenderToggle(activeGender === 'male' ? null : 'male')}
            ariaLabel="Filter by male"
            size="md"
          />
          <IconToggleButton
            preset="gender-female-outline"
            toggled={activeGender === 'female'}
            onClick={() => onGenderToggle(activeGender === 'female' ? null : 'female')}
            ariaLabel="Filter by female"
            size="md"
          />
        </div>

        <div className="hp-filterbar-divider" aria-hidden="true" />

        <div className="hp-filterbar-safety">
          <DiscreteSlider
            label="Safety"
            value={safetyFilter}
            onChange={onSafetyChange}
            options={[
              { value: 'all', label: 'All Safety', shortLabel: 'All' },
              { value: 'safe', label: 'Safe', shortLabel: 'Safe' },
              { value: 'caution', label: 'Caution', shortLabel: 'Caution' },
              { value: 'avoid', label: 'Avoid', shortLabel: 'Avoid' },
              { value: 'unknown', label: 'Unknown', shortLabel: 'Unknown' },
            ]}
            valueColorMap={{
              all: 'var(--text-tertiary)',
              safe: 'var(--color-intent-success-strong)',
              caution: 'var(--color-intent-warning-strong)',
              avoid: 'var(--color-intent-danger-strong)',
              unknown: 'var(--text-secondary)',
            }}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={onClearAll}
            disabled={!hasActiveFilters}
            aria-label="Clear all filters"
            className="hp-clear-all-button"
          >
            Clear all
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default FilterBar;
