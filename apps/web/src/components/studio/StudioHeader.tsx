// ArchitectAI Architecture Studio Prototype — Header Bar
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sliders,
} from 'lucide-react';
import { SimulationState } from './types';

interface StudioHeaderProps {
  requirementTitle: string;
  projectName: string;
  simulation: SimulationState;
  onTogglePlay: () => void;
  onResetSimulation: () => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  activeContractId?: string;
  onSelectContract?: (contractId: string) => void;
  simulationAvailable?: boolean;
  groundingStatus?: 'supported_by_contract' | 'proposed_design' | 'needs_clarification';
  synthesisMode?: 'deterministic_demo' | 'live_provider';
  onRefresh?: () => void;
  isRealRun?: boolean;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  requirementTitle,
  projectName,
  simulation,
  onTogglePlay,
  onResetSimulation,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  isInspectorOpen,
  onToggleInspector,
  activeContractId = 'contract-rate-limiter',
  onSelectContract,
  simulationAvailable = false,
  groundingStatus,
  synthesisMode,
  onRefresh,
  isRealRun = false,
}) => {
  return (
    <header className="studio-header">
      <div className="studio-header-left">
        <Link
          to="/"
          className="studio-back-link"
          title="Return to standard workspace"
          aria-label="Back to standard workspace"
        >
          <ArrowLeft size={15} />
          <span>Exit Studio</span>
        </Link>

        <div className="studio-divider" />

        <div className="studio-branding">
          <div className="studio-logo-icon">
            <Layers size={16} />
          </div>
          <div>
            <div className="studio-brand-row">
              <span className="studio-brand-name">ArchitectAI</span>
              <span className="studio-sub-badge font-mono">STUDIO</span>
              {isRealRun ? (
                <span
                  className="studio-demo-pill font-mono"
                  style={{ background: '#0284c7', color: '#f0fdf4', border: '1px solid #38bdf8' }}
                  title="Live Persisted Architecture Run"
                >
                  LIVE RUN
                </span>
              ) : (
                <span className="studio-demo-pill font-mono" title="Curated demonstration scenario">
                  DEMO
                </span>
              )}
              {groundingStatus && (
                <span
                  className="font-mono"
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    letterSpacing: '0.4px',
                    color:
                      groundingStatus === 'supported_by_contract'
                        ? '#34d399'
                        : groundingStatus === 'proposed_design'
                        ? '#38bdf8'
                        : '#fbbf24',
                    background:
                      groundingStatus === 'supported_by_contract'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : groundingStatus === 'proposed_design'
                        ? 'rgba(56, 189, 248, 0.15)'
                        : 'rgba(245, 158, 11, 0.15)',
                    border: `1px solid ${
                      groundingStatus === 'supported_by_contract'
                        ? 'rgba(16, 185, 129, 0.4)'
                        : groundingStatus === 'proposed_design'
                        ? 'rgba(56, 189, 248, 0.4)'
                        : 'rgba(245, 158, 11, 0.4)'
                    }`,
                  }}
                  title={`Grounding Status: ${groundingStatus}`}
                >
                  {groundingStatus === 'supported_by_contract'
                    ? 'SUPPORTED BY CONTRACT'
                    : groundingStatus === 'proposed_design'
                    ? 'PROPOSED DESIGN'
                    : 'NEEDS CLARIFICATION'}
                </span>
              )}
            </div>
            <div className="studio-project-title" title={`${projectName} • ${requirementTitle}`}>
              <span className="text-secondary font-mono">{projectName}</span>
              <span className="text-muted"> / </span>
              <span className="studio-req-title-text">{requirementTitle}</span>
            </div>
          </div>
        </div>

        {/* Contract Selector Dropdown */}
        <div className="studio-contract-selector-wrap font-mono" style={{ marginLeft: '16px' }}>
          <select
            id="contract-selector"
            className="studio-contract-select"
            value={activeContractId}
            onChange={(e) => onSelectContract?.(e.target.value)}
            aria-label="Select Architecture Contract"
            style={{
              background: '#090d16',
              color: '#f8fafc',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="contract-rate-limiter">Rate Limiter (Multi-Replica)</option>
            <option value="contract-payment-idempotency">Payment Webhook & Outbox</option>
            <option value="contract-image-pipeline">Image Upload & Workers</option>
            <option value="contract-incomplete-sample">Incomplete Contract (Draft)</option>
          </select>
        </div>
      </div>

      <div className="studio-header-center">
        {simulationAvailable ? (
          /* Simulation Mini Bar */
          <div className="studio-sim-quickbar">
            <div className="sim-mode-tag font-mono">
              <span
                className={`sim-indicator-dot ${
                  simulation.burstDetected ? 'dot-burst' : simulation.isRunning ? 'dot-running' : 'dot-paused'
                }`}
              />
              <span>{simulation.algorithm === 'ROLLING_WINDOW' ? 'Sliding Window' : 'Fixed Window'}</span>
            </div>

            <div className="sim-quick-controls">
              <button
                type="button"
                className="studio-btn-icon"
                onClick={onTogglePlay}
                title={simulation.isRunning ? 'Pause Simulation' : 'Resume Simulation'}
                aria-label={simulation.isRunning ? 'Pause Simulation' : 'Resume Simulation'}
              >
                {simulation.isRunning ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                type="button"
                className="studio-btn-icon"
                onClick={onResetSimulation}
                title="Reset Simulation State"
                aria-label="Reset Simulation State"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            <div className="sim-quick-stats font-mono">
              <span className="stat-label">t=</span>
              <span className="stat-val">{simulation.timeInWindowSec.toFixed(1)}s</span>
              <span className="stat-sep">•</span>
              <span className="stat-label">P99:</span>
              <span className="stat-val text-success">~0.8ms (modeled)</span>
            </div>
          </div>
        ) : (
          /* Static Architecture Contract Indicator */
          <div className="studio-sim-quickbar">
            <div className="sim-mode-tag font-mono">
              <span className="sim-indicator-dot dot-paused" style={{ background: '#38bdf8' }} />
              <span>Static Contract Projection</span>
            </div>
            <div className="sim-quick-stats font-mono">
              <span className="stat-label">Source:</span>
              <span className="stat-val text-brand">Authoritative EngineeringContract</span>
            </div>
          </div>
        )}
      </div>

      <div className="studio-header-right">
        {/* Canvas Zoom & View Helpers */}
        <div className="studio-view-tools font-mono">
          <button
            type="button"
            className="studio-btn-icon"
            onClick={onZoomIn}
            title="Zoom In (+)"
            aria-label="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <span className="zoom-indicator-text">{Math.round(zoomLevel * 100)}%</span>
          <button
            type="button"
            className="studio-btn-icon"
            onClick={onZoomOut}
            title="Zoom Out (-)"
            aria-label="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            className="studio-btn-icon"
            onClick={onZoomReset}
            title="Fit to View"
            aria-label="Fit to View"
          >
            <Maximize2 size={13} />
          </button>
        </div>

        {onRefresh && (
          <button
            type="button"
            className="studio-btn-icon font-mono"
            onClick={onRefresh}
            title="Refresh architecture graph from contract"
            aria-label="Refresh Architecture Graph"
            style={{ width: 'auto', padding: '0 8px', gap: '4px', fontSize: '11px', display: 'flex', alignItems: 'center' }}
          >
            <RotateCcw size={12} />
            <span>Refresh</span>
          </button>
        )}

        <div className="studio-divider" />

        {/* Inspector Toggle Button */}
        <button
          type="button"
          className={`studio-toggle-inspector-btn font-mono ${isInspectorOpen ? 'active' : ''}`}
          onClick={onToggleInspector}
          title={isInspectorOpen ? 'Close Systems Inspector' : 'Open Systems Inspector'}
          aria-expanded={isInspectorOpen}
        >
          <Sliders size={13} />
          <span>{isInspectorOpen ? 'Hide Inspector' : 'Show Inspector'}</span>
        </button>
      </div>
    </header>
  );
};
