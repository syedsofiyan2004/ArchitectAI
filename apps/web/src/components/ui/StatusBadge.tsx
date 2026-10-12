import React from 'react';

export type DisplayStatus =
  | 'DRAFT'
  | 'ANALYZING'
  | 'ANALYSIS_COMPLETE'
  | 'READY_FOR_IMPLEMENTATION'
  | 'IMPLEMENTING'
  | 'VERIFICATION_FAILED'
  | 'REPAIR_PENDING'
  | 'REPAIRING'
  | 'VERIFIED'
  | 'ESCALATED'
  | 'FAILED'
  | 'CANCELLED'
  | 'INCONCLUSIVE'
  | string;

interface StatusBadgeProps {
  status: DisplayStatus;
  size?: 'sm' | 'md';
  className?: string;
}

interface StatusMeta {
  label: string;
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'inconclusive';
}

function getStatusMeta(status: DisplayStatus): StatusMeta {
  const norm = (status || '').toUpperCase();
  switch (norm) {
    case 'VERIFIED':
    case 'COMPLETED':
      return { label: 'Verified', variant: 'success' };
    case 'READY_FOR_IMPLEMENTATION':
    case 'READY_TO_BUILD':
      return { label: 'Ready to build', variant: 'info' };
    case 'ANALYSIS_COMPLETE':
    case 'REVIEW_READY':
      return { label: 'Review ready', variant: 'info' };
    case 'ANALYZING':
      return { label: 'Analyzing', variant: 'info' };
    case 'IMPLEMENTING':
    case 'BUILDING':
      return { label: 'Building', variant: 'info' };
    case 'VERIFICATION_FAILED':
    case 'NEEDS_FIX':
      return { label: 'Needs fix', variant: 'warning' };
    case 'REPAIR_PENDING':
    case 'FIX_READY':
      return { label: 'Fix ready', variant: 'warning' };
    case 'REPAIRING':
    case 'FIXING':
      return { label: 'Fixing', variant: 'warning' };
    case 'INCONCLUSIVE':
      return { label: 'Inconclusive', variant: 'inconclusive' };
    case 'ESCALATED':
    case 'NEEDS_INPUT':
      return { label: 'Needs decision', variant: 'warning' };
    case 'HIGH_RISK':
      return { label: 'High risk', variant: 'warning' };
    case 'FAILED':
      return { label: 'Failed', variant: 'danger' };
    case 'CANCELLED':
      return { label: 'Cancelled', variant: 'default' };
    case 'DRAFT':
    default:
      return { label: status || 'Draft', variant: 'default' };
  }
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className = '' }) => {
  const { label, variant } = getStatusMeta(status);

  return (
    <span className={`status-badge status-${variant} size-${size} ${className}`} role="status">
      <span className="status-badge-dot" aria-hidden="true"></span>
      <span className="status-badge-label">{label}</span>
    </span>
  );
};
