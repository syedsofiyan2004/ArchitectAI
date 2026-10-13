import React from 'react';
import { getRunPresentationState } from '../../utils/run-presentation';

export type DisplayStatus = string;

interface StatusBadgeProps {
  status: DisplayStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className = '' }) => {
  const { label, variant } = getRunPresentationState(status);

  return (
    <span className={`status-badge status-${variant} size-${size} ${className}`} role="status">
      <span className="status-badge-dot" aria-hidden="true"></span>
      <span className="status-badge-label">{label}</span>
    </span>
  );
};
