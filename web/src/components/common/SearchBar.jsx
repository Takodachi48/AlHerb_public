import React, { useState, useRef, useEffect, useMemo } from 'react';

const SearchIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const SearchBar = ({
  value = '',
  onChange,
  onSubmit,
  autocompleteOptions = [],
  onSelectOption,
  placeholder = 'Search...',
  className = '',
  inputClassName = '',
  showIcon = true,
  disabled = false,
  autoFocus = false,
  variant = 'default',
}) => {
  const [focused, setFocused]         = useState(false);
  const [dropOpen, setDropOpen]       = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef(null);
  const wrapRef  = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const filtered = useMemo(() => {
    if (!autocompleteOptions.length) return [];
    const term = value?.trim().toLowerCase();
    if (!term) return autocompleteOptions.slice(0, 8);
    return autocompleteOptions
      .filter(o => {
        const l = o.label?.toLowerCase() ?? '';
        const s = o.sublabel?.toLowerCase() ?? '';
        const t = o.searchText?.toLowerCase() ?? '';
        return l.includes(term) || s.includes(term) || t.includes(term);
      })
      .slice(0, 8);
  }, [autocompleteOptions, value]);

  useEffect(() => { setHighlighted(-1); }, [value, dropOpen]);

  const pick = (opt) => {
    onSelectOption ? onSelectOption(opt) : onChange?.(opt.label ?? '');
    setDropOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (!dropOpen || !filtered.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(p => Math.min(p + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(p => Math.max(p - 1, -1)); }
    else if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); pick(filtered[highlighted]); }
    else if (e.key === 'Escape') setDropOpen(false);
  };

  return (
    <div className={`search-wrap search-bar--${variant} ${className}`} ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange?.(e.target.value);
          if (autocompleteOptions.length) setDropOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          if (autocompleteOptions.length) setDropOpen(true);
        }}
        onBlur={() => {
          setFocused(false);
          setTimeout(() => setDropOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`search-input focus:outline-none focus:ring-0 ${inputClassName}`}
      />
      {showIcon && (
        <button
          type="button"
          onClick={() => onSubmit?.(value)}
          disabled={disabled}
          className="search-btn"
          aria-label="Search"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </button>
      )}

      {dropOpen && filtered.length > 0 && (
        <div className="autocomplete-menu">
          {filtered.map((opt, i) => (
            <button
              key={opt.value ?? opt.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(opt)}
              className={`autocomplete-item w-full ${i === highlighted ? 'autocomplete-item--highlighted' : ''}`}
            >
              <div className="text-left">
                <div className="font-medium">{opt.label}</div>
                {opt.sublabel && <div className="text-xs font-sans opacity-60">{opt.sublabel}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
