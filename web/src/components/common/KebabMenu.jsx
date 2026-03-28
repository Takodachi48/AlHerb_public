import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const KebabMenu = ({ items = [], buttonLabel = 'Open actions menu', align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPosition = () => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 6,
      left: align === 'left' ? rect.left : rect.right,
    });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedTrigger = rootRef.current?.contains(event.target);
      const clickedMenu = menuRef.current?.contains(event.target);
      if (!clickedTrigger && !clickedMenu) setOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const handleViewportChange = () => updateMenuPosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, align]);

  const hasItems = Array.isArray(items) && items.length > 0;
  if (!hasItems) return null;

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-9 h-9 inline-flex items-center justify-center rounded-md text-tertiary hover:text-primary transition-colors"
        aria-label={buttonLabel}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[1200] min-w-[160px] p-1 rounded-md border border-primary bg-surface-primary shadow-lg"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            transform: align === 'left' ? 'none' : 'translateX(-100%)',
          }}
        >
          {items.map((item, idx) => (
            <button
              key={`${item.label}-${idx}`}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                setOpen(false);
                item.onClick?.();
              }}
              className={`w-full text-left text-xs px-3 py-2 rounded-sm transition-colors ${
                item.disabled
                  ? 'text-weak cursor-not-allowed'
                  : item.intent === 'danger'
                    ? 'text-[var(--color-intent-danger-strong)] hover:bg-[var(--color-intent-danger-weak)]'
                    : 'text-primary hover:bg-surface-secondary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default KebabMenu;
