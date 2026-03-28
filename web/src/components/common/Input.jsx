import React from 'react';

const STATE_CLASS = {
  ok:    'input--ok',
  warn:  'input--warn',
  error: 'input--error',
};

/**
 * Input — industrial minimal
 * Props:
 *   type, placeholder, error, className, multiline,
 *   label, helper, state ('ok' | 'warn' | 'error'), variant ('secondary')
 */
const Input = ({
  type = 'text',
  placeholder,
  error,
  className = '',
  multiline,
  label,
  helper,
  state,
  variant,
  ...props
}) => {
  const stateClass = error ? 'input--error' : (STATE_CLASS[state] ?? '');
  const variantClass = variant === 'secondary' ? 'input--secondary' : '';
  const Component  = multiline ? 'textarea' : 'input';

  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="label">{label}</span>}
      <Component
        type={!multiline ? type : undefined}
        className={`input ${stateClass} ${variantClass} ${className}`.trim()}
        placeholder={placeholder}
        {...props}
      />
      {(helper || error) && (
        <span className={`helper ${error ? 'helper--err' : state === 'ok' ? 'helper--ok' : state === 'warn' ? 'helper--warn' : ''}`.trim()}>
          {error || helper}
        </span>
      )}
    </div>
  );
};

export default Input;
