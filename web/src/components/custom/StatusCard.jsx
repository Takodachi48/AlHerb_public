import React from 'react';
import Card from '../common/Card';
import '../../styles/components/StatusCard.css';

/**
 * StatusCard — wraps the Card component using its `status` variant.
 *
 * Props:
 *   isOn       {boolean} — mirrors the toggle state to drive on/off styling
 *   className  {string}  — optional extra classes
 */
const StatusCard = ({ isOn = false, className = '', ...props }) => {
  return (
    <Card className={`status-card ${isOn ? 'on' : ''} ${className}`.trim()} {...props}>
      <div className="dot" />
      <span className="status-text">
        {isOn ? 'Protection Enabled' : 'Protection Disabled'}
      </span>
    </Card>
  );
};

export default StatusCard;
