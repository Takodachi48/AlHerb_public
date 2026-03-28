import React from 'react';
import PropTypes from 'prop-types';
import * as SwitchPrimitive from '@radix-ui/react-switch';

const TRACK_SIZE = {
  sm: { track: 'w-10 h-5', thumb: 'w-3 h-3', translateOn: 'translate-x-[24px]', translateOff: 'translate-x-[4px]' },
  md: { track: 'w-12 h-6', thumb: 'w-3.5 h-3.5', translateOn: 'translate-x-[30px]', translateOff: 'translate-x-[5px]' },
  lg: { track: 'w-14 h-7', thumb: 'w-4 h-4', translateOn: 'translate-x-[36px]', translateOff: 'translate-x-[6px]' },
};

const Toggle = ({
  checked = false,
  onChange,
  disabled = false,
  size = 'md',
  admin, // Destructure admin to prevent passing to DOM
}) => {
  const sz = TRACK_SIZE[size] ?? TRACK_SIZE.md;

  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className={[
        'toggle-track',
        sz.track,
        disabled ? 'opacity-40 cursor-not-allowed' : '',
      ].join(' ')}
      data-checked={checked}
      data-disabled={disabled}
    >
      <SwitchPrimitive.Thumb
        className={`toggle-thumb ${sz.thumb} ${checked ? sz.translateOn : sz.translateOff}`}
      />
    </SwitchPrimitive.Root>
  );
};

Toggle.propTypes = {
  checked: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  admin: PropTypes.bool, // Add admin prop type
};

export default Toggle;
