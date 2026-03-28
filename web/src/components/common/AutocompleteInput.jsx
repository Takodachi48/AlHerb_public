import React, { useState, useEffect, useRef } from 'react';

const AutocompleteInput = ({
  value,
  onChange,
  options = [],
  placeholder = '',
  className = '',
  disabled = false,
}) => {
  const [open, setOpen]               = useState(false);
  const [filtered, setFiltered]       = useState([]);
  const [highlighted, setHighlighted] = useState(-1);
  const justSelected = useRef(false);
  const inputRef     = useRef(null);
  const wrapRef      = useRef(null);

  useEffect(() => {
    if (!value) { setFiltered([]); return; }
    if (justSelected.current) { justSelected.current = false; setOpen(false); return; }
    setFiltered(options.filter(o => o.toLowerCase().includes(value.toLowerCase())).slice(0, 8));
    setHighlighted(-1);
  }, [value, options]);

  useEffect(() => {
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (opt) => {
    justSelected.current = true;
    onChange(opt);
    setOpen(false);
    setTimeout(() => inputRef.current?.blur(), 0);
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(p => Math.min(p + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(p => Math.max(p - 1, -1)); }
    else if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); pick(filtered[highlighted]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); if (!justSelected.current) setOpen(true); }}
        onFocus={() => { if (value && !justSelected.current) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`input ${className}`}
      />

      {open && filtered.length > 0 && (
        <div
          className="autocomplete-menu scrollbar-thin"
        >
          {filtered.map((opt, i) => (
            <div
              key={opt}
              className={`autocomplete-item ${i === highlighted ? 'autocomplete-item--highlighted' : ''}`}
              onClick={() => pick(opt)}
            >
              <span className="dd-dot" />
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutocompleteInput;
