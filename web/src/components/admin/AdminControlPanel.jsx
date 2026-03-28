import React from 'react';
import PropTypes from 'prop-types';
import Button from '../common/Button';
import './AdminControlPanel.css';

const AdminControlPanelSection = ({
  title,
  children = null,
  actions = [],
  className = '',
}) => {
  const visibleActions = Array.isArray(actions) ? actions.filter(Boolean) : [];

  return (
    <section className={`adm-ctrl-section ${className}`.trim()}>
      <div className="eyebrow">
        <div className="eyebrow-bar" />
        <span className="eyebrow-text">{title}</span>
      </div>

      {children ? <div className="adm-ctrl-section-body">{children}</div> : null}

      {visibleActions.length > 0 ? (
        <div className="bl-sb-actions">
          {visibleActions.map((action) => (
            <Button
              key={action.key || action.label}
              variant={action.variant || 'outline'}
              size={action.size || 'sm'}
              className={`w-full justify-start text-left ${action.className || ''}`.trim()}
              onClick={action.onClick}
              disabled={Boolean(action.disabled)}
              type={action.type || 'button'}
            >
              {action.icon ? <span className="mr-2 inline-flex">{action.icon}</span> : null}
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
};

const AdminControlPanel = ({ children, className = '' }) => (
  <aside className={`adm-ctrl-panel ${className}`.trim()}>
    {children}
  </aside>
);

AdminControlPanel.Section = AdminControlPanelSection;

AdminControlPanel.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

AdminControlPanelSection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  actions: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    variant: PropTypes.string,
    size: PropTypes.string,
    disabled: PropTypes.bool,
    icon: PropTypes.node,
    className: PropTypes.string,
    type: PropTypes.string,
  })),
  className: PropTypes.string,
};

export default AdminControlPanel;
