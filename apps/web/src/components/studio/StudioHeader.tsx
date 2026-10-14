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
  ShieldAlert,
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
              <span className="studio-demo-pill font-mono" title="Fictional prototype scenario">
                DEMO
              </span>
            </div>
            <div className="studio-project-title" title={`${projectName} • ${requirementTitle}`}>
              <span className="text-secondary font-mono">{projectName}</span>
              <span className="text-muted"> / </span>
              <span className="studio-req-title-text">{requirementTitle}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="studio-header-center">
        {/* Simulation Mini Bar */}
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
            <span className="stat-val text-success">0.8ms</span>
          </div>
        </div>
      </div>

      <div className="studio-header-right">
        {/* Canvas Zoom Controls */}
        <div className="studio-zoom-group">
          <button
            type="button"
            className="studio-btn-icon"
            onClick={onZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="studio-zoom-readout font-mono">{Math.round(zoomLevel * 100)}%</span>
          <button
            type="button"
            className="studio-btn-icon"
            onClick={onZoomIn}
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            className="studio-btn-icon"
            onClick={onZoomReset}
            title="Reset Zoom to Fit"
            aria-label="Reset Zoom to Fit"
          >
            <Maximize2 size={13} />
          </button>
        </div>

        <button
          type="button"
          className={`studio-inspector-toggle-btn font-mono ${isInspectorOpen ? 'active' : ''}`}
          onClick={onToggleInspector}
          aria-expanded={isInspectorOpen}
          aria-label="Toggle Systems Inspector Drawer"
        >
          <ShieldAlert size={14} />
          <span>Inspector</span>
        </button>
      </div>
    </header>
  );
};
