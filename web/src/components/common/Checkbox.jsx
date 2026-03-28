import React from 'react';
import PropTypes from 'prop-types';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

const SIZE = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5', xl: 'w-6 h-6' };
const ICON = { sm: 'w-2.5 h-2.5', md: 'w-3 h-3', lg: 'w-3.5 h-3.5', xl: 'w-4 h-4' };

const CheckIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 10 8" fill="none">
    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Checkbox = ({
  id,
  checked,
  onChange,
  disabled = false,
  label,
  labelPosition = 'right',
  size = 'md',
  className = '',
  admin, // Destructure admin to prevent passing to DOM
  ...props
}) => {
  const root = (
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className={`checkbox-root ${SIZE[size]} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
        <Check className={ICON[size]} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) return root;

  return (
    <div className={`flex items-center gap-2 ${labelPosition === 'left' ? 'flex-row-reverse justify-end' : ''}`}>
      {root}
      <label
        htmlFor={id}
        className="label cursor-pointer"
        style={{ '--label-line': 'none' }}
      >
        {label}
      </label>
    </div>
  );
};

Checkbox.propTypes = {
  id: PropTypes.string.isRequired,
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string,
  labelPosition: PropTypes.oneOf(['left', 'right']),
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  className: PropTypes.string,
  admin: PropTypes.bool, // Add admin prop type
};

export default Checkbox;
