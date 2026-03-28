import React, { useRef, useEffect } from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';

const VARIANT_CLASS = {
  panel: {
    list: 'tabnav tabnav--panel',
    tab: 'tabnav__tab tabnav__tab--panel',
    active: 'is-active',
    badge: 'tabnav__badge',
  },
  line: {
    list: 'tabnav tabnav--line',
    tab: 'tabnav__tab tabnav__tab--line',
    active: 'is-active',
    badge: 'tabnav__badge',
  },
  chip: {
    list: 'tabnav tabnav--chip',
    tab: 'tabnav__tab tabnav__tab--chip',
    active: 'is-active',
    badge: 'tabnav__badge',
  },
};

const TabNavigation = ({
  items = [],
  value,
  onChange,
  variant = 'line',
  className = '',
  ariaLabel = 'Tabs',
  renderPanel,
}) => {
  const v = VARIANT_CLASS[variant] || VARIANT_CLASS.line;
  const activeId = value ?? items[0]?.id;
  const activeItem = items.find((item) => item.id === activeId);
  const tabnavRef = useRef();

  useEffect(() => {
    const handleWheel = (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // if already horizontal scroll, let it be
      e.preventDefault();
      tabnavRef.current.scrollLeft += e.deltaY * 0.5; // adjust multiplier for sensitivity
    };

    const element = tabnavRef.current;
    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div className={`tabnav-wrap ${className}`.trim()}>
      <div ref={tabnavRef} className={v.list} role="tablist" aria-label={ariaLabel}>
        {items.map((item) => {
          const isActive = item.id === activeId;
          const disabled = Boolean(item.disabled);
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={renderPanel ? `tab-panel-${item.id}` : undefined}
              id={`tab-${item.id}`}
              className={`${v.tab} ${isActive ? v.active : ''} ${item.tone === 'danger' ? 'is-danger' : ''}`.trim()}
              disabled={disabled}
              onClick={() => {
                if (disabled || !onChange) return;
                onChange(item.id);
              }}
            >
              <span className="tabnav__label">{item.label}</span>
              {item.badge === '!' && (
                <AlertTriangle style={{ color: 'var(--color-intent-danger-strong)' }} size={12} />
              )}
              {item.badge === '~' && (
                <AlertCircle style={{ color: 'var(--color-intent-warning-strong)' }} size={12} />
              )}
            </button>
          );
        })}
      </div>
      {renderPanel && activeItem && (
        <div
          id={`tab-panel-${activeItem.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeItem.id}`}
          className="tabnav__panel"
        >
          {renderPanel(activeItem)}
        </div>
      )}
    </div>
  );
};

export default TabNavigation;
