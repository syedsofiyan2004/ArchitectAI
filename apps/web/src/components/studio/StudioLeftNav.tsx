// ArchitectAI Architecture Studio Prototype — Left Navigation & Scope Panel
import React from 'react';
import {
  Server,
  Database,
  Globe,
  Cpu,
  Layers,
  Activity,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Sliders,
  Network,
  ShieldCheck,
  Info,
  Workflow,
  Radio,
} from 'lucide-react';
import type { EngineeringContract } from '@architectai/domain';
import { StudioNode, StudioEdge, SimulationState, SimulationAlgorithm, TrafficScenario } from './types';

interface StudioLeftNavProps {
  nodes: StudioNode[];
  edges: StudioEdge[];
  selectedId: string | null;
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  simulation: SimulationState;
  onSetAlgorithm: (alg: SimulationAlgorithm) => void;
  onSetScenario: (scen: TrafficScenario) => void;
  onSetSpeed: (speed: number) => void;
  onTogglePlay: () => void;
  onResetSimulation: () => void;
  activeContract?: EngineeringContract;
  simulationAvailable?: boolean;
}

export const StudioLeftNav: React.FC<StudioLeftNavProps> = ({
  nodes,
  edges,
  selectedId,
  onSelectNode,
  onSelectEdge,
  simulation,
  onSetAlgorithm,
  onSetScenario,
  onSetSpeed,
  onTogglePlay,
  onResetSimulation,
  activeContract,
  simulationAvailable = false,
}) => {
  const getNodeIcon = (category: string) => {
    switch (category) {
      case 'client':
        return <Globe size={13} />;
      case 'gateway':
        return <Layers size={13} />;
      case 'compute':
      case 'service':
        return <Cpu size={13} />;
      case 'cache':
        return <Activity size={13} />;
      case 'datastore':
        return <Database size={13} />;
      case 'queue':
        return <Workflow size={13} />;
      case 'worker':
        return <Radio size={13} />;
      default:
        return <Server size={13} />;
    }
  };

  const reqTitle = activeContract?.requirement.context?.title || activeContract?.id || 'Multi-Tenant Rate Limiting';
  const reqIntent = activeContract?.requirement.rawIntent || 'Rate limit each authenticated tenant to 100 API requests per minute.';
  const constraints: string[] = activeContract?.requirement.explicitConstraints || ['100 req/60s', 'Sliding Window', 'HTTP 429'];

  return (
    <aside className="studio-left-nav" aria-label="Project Scope and Simulation Controller">
      {/* 1. Project Requirement Card */}
      <div className="studio-scope-card">
        <div className="scope-header">
          <span className="scope-kicker font-mono">SPECIFIED REQUIREMENT</span>
        </div>
        <h2 className="scope-title">{reqTitle}</h2>
        <p className="scope-intent">
          "{reqIntent}"
        </p>
        <div className="scope-meta-tags font-mono">
          {constraints.map((c: string, idx: number) => (
            <span key={idx} className="scope-tag">
              {c.length > 28 ? `${c.slice(0, 26)}...` : c}
            </span>
          ))}
        </div>
      </div>

      {/* 2. Interactive Simulation Controller (When Available) */}
      {simulationAvailable ? (
        <section className="studio-nav-section" aria-labelledby="sim-controller-heading">
          <div className="section-label-row">
            <Sliders size={13} className="text-brand" />
            <h3 id="sim-controller-heading" className="section-label">
              Interactive Simulation
            </h3>
          </div>

          <div className="sim-disclaimer-box" role="note">
            <Info size={12} className="disclaimer-icon" />
            <span className="disclaimer-text">
              <strong>EDUCATIONAL SIMULATION</strong> — Models distributed window hazard suppression. Not measured production telemetry.
            </span>
          </div>

          {/* Algorithm Selection */}
          <div className="sim-control-group">
            <label className="sim-label font-mono">Rate Limiting Algorithm</label>
            <div className="sim-pill-selector">
              <button
                type="button"
                className={`sim-pill-btn ${simulation.algorithm === 'ROLLING_WINDOW' ? 'active' : ''}`}
                onClick={() => onSetAlgorithm('ROLLING_WINDOW')}
              >
                <span className="pill-dot text-brand">●</span>
                <span>Sliding Window</span>
                <span className="pill-badge-rec font-mono">REC</span>
              </button>
              <button
                type="button"
                className={`sim-pill-btn ${simulation.algorithm === 'FIXED_WINDOW' ? 'active vulnerable' : ''}`}
                onClick={() => onSetAlgorithm('FIXED_WINDOW')}
              >
                <span className="pill-dot text-warning">●</span>
                <span>Fixed Window</span>
                <span className="pill-badge-vuln font-mono">DEFECT</span>
              </button>
            </div>
          </div>

          {/* Traffic Scenario */}
          <div className="sim-control-group">
            <label className="sim-label font-mono">Traffic Pattern</label>
            <div className="scenario-select-grid">
              <button
                type="button"
                className={`scenario-btn ${simulation.scenario === 'BOUNDARY_SPIKE' ? 'active' : ''}`}
                onClick={() => onSetScenario('BOUNDARY_SPIKE')}
              >
                <strong className="scenario-name">Boundary Spike</strong>
                <span className="scenario-desc font-mono">80 at 59s, 80 at 61s</span>
              </button>
              <button
                type="button"
                className={`scenario-btn ${simulation.scenario === 'BURST_ATTACK' ? 'active' : ''}`}
                onClick={() => onSetScenario('BURST_ATTACK')}
              >
                <strong className="scenario-name">Burst Attack</strong>
                <span className="scenario-desc font-mono">150 req concurrent</span>
              </button>
              <button
                type="button"
                className={`scenario-btn ${simulation.scenario === 'STEADY' ? 'active' : ''}`}
                onClick={() => onSetScenario('STEADY')}
              >
                <strong className="scenario-name">Steady Load</strong>
                <span className="scenario-desc font-mono">1.2 rps compliant</span>
              </button>
            </div>
          </div>

          {/* Playback Controls & Speed */}
          <div className="sim-control-group">
            <div className="sim-playback-row">
              <button
                type="button"
                className={`sim-primary-play-btn ${simulation.isRunning ? 'running' : ''}`}
                onClick={onTogglePlay}
                aria-label={simulation.isRunning ? 'Pause Simulation' : 'Run Simulation'}
              >
                {simulation.isRunning ? <Pause size={14} /> : <Play size={14} />}
                <span>{simulation.isRunning ? 'Pause' : 'Start Simulation'}</span>
              </button>

              <button
                type="button"
                className="sim-reset-btn"
                onClick={onResetSimulation}
                title="Reset simulation time and metrics"
                aria-label="Reset simulation"
              >
                <RotateCcw size={14} />
              </button>

              <div className="speed-pills font-mono" role="group" aria-label="Playback Speed">
                {[1, 2, 5].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    className={`speed-pill speed-btn ${simulation.speed === spd ? 'active' : ''}`}
                    onClick={() => onSetSpeed(spd)}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Virtual Clock & Admitted / Throttled Counters */}
          <div className="sim-telemetry-box font-mono">
            <div className="telemetry-row">
              <span className="tel-label">Virtual Window Clock:</span>
              <span className="tel-val text-brand">{simulation.timeInWindowSec.toFixed(1)}s / 60.0s</span>
            </div>
            <div className="telemetry-row">
              <span className="tel-label">Total Ingress Requests:</span>
              <span className="tel-val">{simulation.totalRequests}</span>
            </div>
            <div className="telemetry-row">
              <span className="tel-label">Admitted to Compute:</span>
              <span className="tel-val text-success">{simulation.allowedRequests} (200 OK)</span>
            </div>
            <div className="telemetry-row">
              <span className="tel-label">Throttled at Gateway:</span>
              <span className="tel-val text-warning">{simulation.throttledRequests} (429)</span>
            </div>

            {/* Downstream Service Load Indicator */}
            <div className="load-meter-header">
              <span className="tel-label">Modeled Downstream Load:</span>
              <span
                className={`load-pct ${
                  simulation.downstreamLoadPct > 100
                    ? 'text-danger'
                    : simulation.downstreamLoadPct > 80
                    ? 'text-warning'
                    : 'text-success'
                }`}
              >
                {simulation.downstreamLoadPct}%
              </span>
            </div>
            <div className="load-bar-track">
              <div
                className={`load-bar-fill ${
                  simulation.downstreamLoadPct > 100
                    ? 'bar-overloaded'
                    : simulation.downstreamLoadPct > 80
                    ? 'bar-warning'
                    : 'bar-normal'
                }`}
                style={{ width: `${Math.min(100, (simulation.downstreamLoadPct / 160) * 100)}%` }}
              />
            </div>
            {simulation.downstreamLoadPct > 100 && (
              <div className="overload-warning-pill font-mono">
                <AlertTriangle size={11} /> Overloaded: Boundary Burst Leak
              </div>
            )}
          </div>

          {/* Simulation Educational Explanation */}
          <p className="sim-live-explanation">{simulation.explanation}</p>
        </section>
      ) : (
        <section className="studio-nav-section" aria-labelledby="sim-controller-heading">
          <div className="section-label-row">
            <Sliders size={13} className="text-secondary" />
            <h3 id="sim-controller-heading" className="section-label">
              Simulation Status
            </h3>
          </div>
          <div className="sim-disclaimer-box" role="note" style={{ background: '#090d16', borderColor: 'rgba(255,255,255,0.08)' }}>
            <Info size={12} className="disclaimer-icon text-muted" />
            <span className="disclaimer-text text-muted" style={{ color: '#94a3b8' }}>
              Discrete educational simulation is not modeled for this scenario. Architectural invariants are verified through executable contracts.
            </span>
          </div>
        </section>
      )}

      {/* 3. System Components Hierarchy */}
      <section className="studio-nav-section" aria-labelledby="components-heading">
        <div className="section-label-row">
          <Server size={13} className="text-secondary" />
          <h3 id="components-heading" className="section-label">
            Architecture Nodes ({nodes.length})
          </h3>
        </div>

        <ul className="studio-entity-list" role="list">
          {nodes.map((node) => {
            const isSelected = selectedId === node.id;
            return (
              <li key={node.id}>
                <button
                  type="button"
                  className={`studio-entity-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectNode(node.id)}
                  aria-pressed={isSelected}
                >
                  <span className="entity-icon-badge">{getNodeIcon(node.category)}</span>
                  <div className="entity-text-group">
                    <strong className="entity-label">{node.label}</strong>
                    <span className="entity-sublabel">{node.tierBadge || node.tier?.toUpperCase()}</span>
                  </div>
                  <span className={`status-dot dot-${node.status || 'healthy'}`} title={`Status: ${node.status || 'healthy'}`} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 4. Service Connections */}
      <section className="studio-nav-section" aria-labelledby="connections-heading">
        <div className="section-label-row">
          <Network size={13} className="text-secondary" />
          <h3 id="connections-heading" className="section-label">
            Protocols & Flows ({edges.length})
          </h3>
        </div>

        <ul className="studio-entity-list" role="list">
          {edges.map((edge) => {
            const isSelected = selectedId === edge.id;
            return (
              <li key={edge.id}>
                <button
                  type="button"
                  className={`studio-entity-item edge-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectEdge(edge.id)}
                  aria-pressed={isSelected}
                >
                  <span className="edge-bullet">→</span>
                  <div className="entity-text-group">
                    <strong className="entity-label">{edge.label || edge.id}</strong>
                    <span className="entity-sublabel font-mono">{edge.protocol}</span>
                  </div>
                  <span className="entity-sla font-mono">{edge.latencySla || (edge.direction === 'bidirectional' ? '↔' : '→')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 5. Invariants Checklist */}
      {activeContract?.invariants && activeContract.invariants.length > 0 && (
        <section className="studio-nav-section" aria-labelledby="invariants-heading">
          <div className="section-label-row">
            <ShieldCheck size={13} className="text-secondary" />
            <h3 id="invariants-heading" className="section-label">
              Planned Invariant Checks ({activeContract.invariants.length} planned)
            </h3>
          </div>

          <div className="invariants-mini-checklist">
            {activeContract.id === 'contract-rate-limiter' ? (
              <>
                <div className="invariant-check-row">
                  <span className="font-mono text-xs text-brand">○</span>
                  <span>Sliding window burst suppression (Planned check)</span>
                </div>
                <div className="invariant-check-row">
                  <span className="font-mono text-xs text-brand">○</span>
                  <span>Ingress gateway isolation shield (Planned check)</span>
                </div>
                <div className="invariant-check-row">
                  <span className="font-mono text-xs text-brand">○</span>
                  <span>Zero SQL queries in hot-path (Planned check)</span>
                </div>
              </>
            ) : (
              activeContract.invariants.map((inv) => (
                <div key={inv.id} className="invariant-check-row">
                  <span className="font-mono text-xs text-brand">○</span>
                  <span>{inv.property}</span>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </aside>
  );
};
