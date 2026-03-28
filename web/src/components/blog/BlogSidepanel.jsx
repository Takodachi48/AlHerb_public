import React from 'react';
import Button from '../common/Button';
import SearchBar from '../common/SearchBar';
import Dropdown from '../common/Dropdown';

const BlogSidepanel = ({
  title = 'Actions',
  actions = [],
  sectionRef = undefined,
  dataIoAnimation = 'fade',
  className = '',
  hideDesktop = false,
  mobileControls = null,
}) => {
  const visibleActions = Array.isArray(actions) ? actions.filter(Boolean) : [];

  const hasMobileControls = Boolean(
    mobileControls
    && typeof mobileControls.onSearchChange === 'function'
    && typeof mobileControls.onFilterChange === 'function'
    && Array.isArray(mobileControls.filterOptions)
  );

  const mobileOverlayStyle = mobileControls?.overlay
    ? {
      position: 'fixed',
      top: `${Number.isFinite(mobileControls.overlayTop) ? mobileControls.overlayTop : 64}px`,
      left: 0,
      right: 0,
      zIndex: Number.isFinite(mobileControls.overlayZIndex) ? mobileControls.overlayZIndex : 45,
    }
    : undefined;

  const renderDesktop = !hideDesktop && visibleActions.length > 0;
  if (!hasMobileControls && !renderDesktop) return null;

  return (
    <>
      {hasMobileControls && (
        <div
          className={`bl-mobile-topbar ${mobileControls.className || ''}`.trim()}
          style={mobileOverlayStyle}
        >
          <div className="bl-mobile-topbar-inner">
            <SearchBar
              value={mobileControls.searchValue || ''}
              onChange={mobileControls.onSearchChange}
              placeholder={mobileControls.searchPlaceholder || 'Search posts...'}
              className="w-full"
              iconClassName="text-tertiary"
              defaultWidth="w-full"
              focusedWidth="w-full"
            />
            <Dropdown
              value={mobileControls.filterValue}
              onChange={mobileControls.onFilterChange}
              options={mobileControls.filterOptions}
              size="sm"
            />
          </div>
        </div>
      )}

      {renderDesktop && (
        <div
          className={`bl-sb-section io-reveal ${className}`.trim()}
          data-io-animation={dataIoAnimation}
          ref={sectionRef}
        >
          <div className="eyebrow">
            <div className="eyebrow-bar" />
            <span className="eyebrow-text">{title}</span>
          </div>
          <div className="bl-sb-actions">
            {visibleActions.map((action) => (
              <Button
                key={action.key || action.label}
                variant={action.variant || 'outline'}
                size={action.size || 'sm'}
                className="w-full justify-start text-left"
                onClick={action.onClick}
                disabled={Boolean(action.disabled)}
              >
                {action.icon ? <span className="mr-2 inline-flex">{action.icon}</span> : null}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default BlogSidepanel;
