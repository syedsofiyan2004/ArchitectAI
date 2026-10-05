import React from 'react';
import { ServerConfig } from '../types';

interface HeaderProps {
  config: ServerConfig | null;
}

export const Header: React.FC<HeaderProps> = ({ config }) => {
  return (
    <header className="top-bar" role="banner">
      <div className="brand-section">
        <div className="brand-logo" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="brand-title-wrap">
          <span className="brand-name">ArchitectAI</span>
          <span className="brand-version font-mono">v0.1.0</span>
        </div>
        <span className="brand-tagline">Engineering Intelligence Cockpit</span>
      </div>

      <div className="top-bar-controls">
        {config ? (
          <div className="header-status-group">
            <div className="status-badge" title={`Provider: ${config.providerName}`}>
              <span className="status-dot live" aria-hidden="true"></span>
              <span className="status-label">
                {config.mode === 'remote-model' ? `Model: ${config.modelName}` : 'Deterministic Kernel'}
              </span>
            </div>
            <div className="status-badge secondary">
              <span className="status-label font-mono">{config.knowledgeItemsCount} Primitives</span>
            </div>
          </div>
        ) : (
          <div className="status-badge loading">
            <span className="status-dot pending" aria-hidden="true"></span>
            <span className="status-label">Connecting to kernel...</span>
          </div>
        )}
      </div>
    </header>
  );
};
