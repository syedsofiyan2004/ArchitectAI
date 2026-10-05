import React, { useState, useEffect } from 'react';
import { X, Cpu, Database, CheckCircle2, Server } from 'lucide-react';
import { ServerConfig } from '../../types';

interface SystemStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemStatusModal: React.FC<SystemStatusModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<ServerConfig | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/config')
        .then((res) => res.json())
        .then((data) => setConfig(data))
        .catch((err) => console.error('Failed to load status', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Server className="icon-muted" size={18} />
            <h3>System Status & Engine Diagnostics</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="status-grid">
            <div className="status-item">
              <div className="status-item-label">
                <CheckCircle2 className="icon-success" size={15} />
                <span>Engine Kernel Status</span>
              </div>
              <div className="status-item-value">Connected & Operational</div>
            </div>

            <div className="status-item">
              <div className="status-item-label">
                <Cpu className="icon-muted" size={15} />
                <span>Execution Mode</span>
              </div>
              <div className="status-item-value font-mono">
                {config ? (config.mode === 'remote-model' ? 'Remote Model Reasoning' : 'Deterministic Demonstrator') : 'Loading...'}
              </div>
            </div>

            <div className="status-item">
              <div className="status-item-label">
                <Server className="icon-muted" size={15} />
                <span>Active Model / Adapter</span>
              </div>
              <div className="status-item-value font-mono">
                {config?.modelName || 'Deterministic Engine'}
              </div>
            </div>

            <div className="status-item">
              <div className="status-item-label">
                <Database className="icon-muted" size={15} />
                <span>Grounding Repository</span>
              </div>
              <div className="status-item-value font-mono">
                {config ? `${config.knowledgeItemsCount} Grounded Systems Primitives` : 'Loading...'}
              </div>
            </div>
          </div>

          <div className="status-note">
            ArchitectAI operates with a provider-neutral engineering kernel decoupled from specific LLM providers.
            System telemetry and repository primitives remain isolated behind explicit ports.
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
