import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';

const ChevronDown = () => (
  <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckMark = () => (
  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CustomDropdown = ({ value, onChange, options = [], size = 'md', customClasses = {} }) => {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef(null);
  const menuRef = useRef(null);

  const selected = options.find(o => o.value === value) ?? options[0];

  useEffect(() => {
    const close = (e) => {
      const clickedTrigger = wrapRef.current?.contains(e.target);
      const clickedMenu = menuRef.current?.contains(e.target);
      if (!clickedTrigger && !clickedMenu) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const pick = (opt) => {
    onChange(opt.value);
    setOpen(false);
  };

  const sizeClass = size === 'sm' ? 'py-2 text-sm font-sans' : size === 'lg' ? 'py-3 text-base font-sans' : 'py-2.5 text-sm font-sans';

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className={`dd-trigger ${sizeClass} ${customClasses.input ?? ''}`}
        data-open={open}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected?.icon && <span className="flex-shrink-0">{selected.icon}</span>}
        <span className="flex-1 truncate">{selected?.label ?? ''}</span>
        <span className="dd-caret">
          <ChevronDown />
        </span>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className={`dd-menu scrollbar-thin ${customClasses.dropdown ?? ''}`}
          role="listbox"
          style={{
            position: 'fixed',
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            width: `${menuPosition.width}px`,
            right: 'auto',
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={active}
                data-selected={active}
                className={`dd-item ${customClasses.option ?? ''}`}
                onClick={() => pick(opt)}
              >
                <span className="dd-dot" />
                {opt.icon && <span className="text-base flex-shrink-0">{opt.icon}</span>}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{opt.label}</div>
                  {opt.description && (
                    <div className="text-sm opacity-60 truncate">{opt.description}</div>
                  )}
                </div>
                {active && (
                  <span className="flex-shrink-0 text-brand ml-auto">
                    <CheckMark />
                  </span>
                )}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

CustomDropdown.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.node,
    description: PropTypes.string,
  })).isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  customClasses: PropTypes.object,
};

export default CustomDropdown;
