import React from 'react';
import { SettingsModal } from './SettingsModal';

export interface SystemStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Consolidated into SettingsModal (Advanced Tab) per Requirement 13.
 */
export const SystemStatusModal: React.FC<SystemStatusModalProps> = ({ isOpen, onClose }) => {
  return <SettingsModal isOpen={isOpen} onClose={onClose} initialTab="advanced" />;
};
