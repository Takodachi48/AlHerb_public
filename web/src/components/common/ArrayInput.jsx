import React, { useState } from 'react';
import PropTypes from 'prop-types';

const ArrayInput = ({
  items = [],
  onChange,
  placeholder = 'Add item…',
  label = '',
  className = '',
}) => {
  const [inputValue, setInputValue] = useState('');

  const add = (e) => {
    e.preventDefault();
    const val = inputValue.trim();
    if (!val) return;
    onChange([...items, val]);
    setInputValue('');
  };

  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  const onKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); add(e); }
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {label && <span className="label">{label}</span>}

      {/* Tag display */}
      {items.length > 0 && (
        <div className="tag-box">
          {items.map((item, i) => (
            <span key={i} className="tag">
              {item}
              <button type="button" className="tag-remove" onClick={() => remove(i)} aria-label={`Remove ${item}`}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-0">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="input flex-1"
          style={{ borderRight: 'none' }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!inputValue.trim()}
          className="btn btn--secondary"
          style={{ borderLeft: '1.5px solid var(--border-brand)' }}
        >
          Add
        </button>
      </div>
    </div>
  );
};

ArrayInput.propTypes = {
  items: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  label: PropTypes.string,
  className: PropTypes.string,
};

export default ArrayInput;
