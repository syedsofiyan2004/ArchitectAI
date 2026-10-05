import React from 'react';
import { ServerConfig } from '../types';

interface HeaderProps {
  config: ServerConfig | null;
}

export const Header: React.FC<HeaderProps> = ({ config }) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-badge">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <div className="title-row">
            <h1 className="app-title">ArchitectAI</h1>
            <span className="badge-prototype">Kernel v0.1.0</span>
          </div>
          <p className="app-subtitle">
            Engineering intelligence for discovering system, reliability, and concurrency unknowns
          </p>
        </div>
      </div>

      <div className="header-right">
        {config ? (
          <div className="config-indicators">
            <div className="status-pill">
              <span className="status-dot"></span>
              <span className="status-label">Mode:</span>
              <span className="status-value font-mono">
                {config.mode === 'remote-model' ? `Remote (${config.modelName})` : 'Deterministic Demo'}
              </span>
            </div>
            <div className="status-pill secondary">
              <span className="status-label">Knowledge Base:</span>
              <span className="status-value font-mono">{config.knowledgeItemsCount} items</span>
            </div>
          </div>
        ) : (
          <div className="status-pill loading">
            <span className="status-label">Connecting to kernel...</span>
          </div>
        )}
      </div>
    </header>
  );
};
