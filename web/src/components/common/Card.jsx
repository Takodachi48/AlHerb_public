import React from 'react';
import PropTypes from 'prop-types';

const PADDING = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6', xl: 'p-8' };

const Card = ({
  children,
  className = '',
  padding = 'md',
  hover = false,
  border = true,
  ...props
}) => (
  <div
    className={[
      'card',
      PADDING[padding] ?? PADDING.md,
      hover ? 'card--hover cursor-pointer' : '',
      !border ? 'border-transparent border-l-transparent' : '',
      className,
    ].join(' ').trim()}
    {...props}
  >
    {children}
  </div>
);

Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  padding: PropTypes.oneOf(['none', 'sm', 'md', 'lg', 'xl']),
  hover: PropTypes.bool,
  border: PropTypes.bool,
};

export default Card;
