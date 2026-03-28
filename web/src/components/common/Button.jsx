import React from 'react';
import PropTypes from 'prop-types';

const VARIANT_CLASSES = {
  primary:   'btn btn--primary',
  secondary: 'btn btn--secondary',
  danger:    'btn btn--danger',
  success:   'btn btn--success',
  outline:   'btn btn--outline',
  ghost:     'btn btn--ghost',
  neutral:   'btn btn--neutral',
};

const SIZE_CLASSES = {
  sm: 'btn--sm',
  md: '',
  lg: 'btn--lg',
  xl: 'btn--xl',
};

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
  ...props
}) => {
  const base = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary;
  const sz   = SIZE_CLASSES[size] ?? '';

  return (
    <button
      type={type}
      className={`${base} ${sz} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'success', 'outline', 'ghost', 'neutral']),
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  className: PropTypes.string,
};

export default Button;
