// ArchitectAI Architecture Studio Prototype — Left Navigation & Simulation Panel
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
  CheckCircle2,
  Sliders,
  Network,
  ShieldCheck,
  Info,
} from 'lucide-react';
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
}) => {
  const getNodeIcon = (category: string) => {
    switch (category) {
      case 'client':
        return <Globe size={13} />;
      case 'gateway':
        return <Layers size={13} />;
      case 'compute':
        return <Cpu size={13} />;
      case 'cache':
        return <Activity size={13} />;
      case 'datastore':
        return <Database size={13} />;
      default:
        return <Server size={13} />;
    }
  };

  return (
    <aside className="studio-left-nav" aria-label="Project Scope and Simulation Controller">
      {/* 1. Project Requirement Card */}
      <div className="studio-scope-card">
        <div className="scope-header">
          <span className="scope-kicker font-mono">SPECIFIED REQUIREMENT</span>
        </div>
        <h2 className="scope-title">Multi-Tenant Rate Limiting</h2>
        <p className="scope-intent">
          "Rate limit each authenticated tenant to 100 API requests per minute with burst tolerance up to 20 requests over limit."
        </p>
        <div className="scope-meta-tags font-mono">
          <span className="scope-tag">100 req/60s</span>
          <span className="scope-tag">Token Bucket</span>
          <span className="scope-tag">HTTP 429</span>
        </div>
      </div>

      {/* 2. Interactive Simulation Controller */}
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
              title="80 requests at t=59s followed by 80 requests at t=61s"
            >
              <strong className="scenario-title">Boundary Spike</strong>
              <span className="scenario-desc">t=59s & t=61s burst</span>
            </button>
            <button
              type="button"
              className={`scenario-btn ${simulation.scenario === 'STEADY' ? 'active' : ''}`}
              onClick={() => onSetScenario('STEADY')}
              title="Normal smooth traffic under limit"
            >
              <strong className="scenario-title">Steady Traffic</strong>
              <span className="scenario-desc">Smooth 15 req/s</span>
            </button>
            <button
              type="button"
              className={`scenario-btn ${simulation.scenario === 'BURST_ATTACK' ? 'active' : ''}`}
              onClick={() => onSetScenario('BURST_ATTACK')}
              title="Sudden continuous abusive flood"
            >
              <strong className="scenario-title">Abusive Flood</strong>
              <span className="scenario-desc">150 req burst</span>
            </button>
          </div>
        </div>

        {/* Playback Controls & Speed */}
        <div className="sim-playback-row">
          <button
            type="button"
            className="sim-play-btn"
            onClick={onTogglePlay}
            aria-label={simulation.isRunning ? 'Pause Simulation' : 'Run Simulation'}
          >
            {simulation.isRunning ? <Pause size={13} /> : <Play size={13} />}
            <span>{simulation.isRunning ? 'Pause' : 'Run'}</span>
          </button>
          <button
            type="button"
            className="sim-reset-btn"
            onClick={onResetSimulation}
            title="Reset Simulation State"
            aria-label="Reset Simulation State"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
          <div className="sim-speed-toggles font-mono">
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                type="button"
                className={`speed-btn ${simulation.speed === s ? 'active' : ''}`}
                onClick={() => onSetSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Live Simulation Telemetry Gauges */}
        <div className="sim-gauges-card font-mono">
          <div className="gauge-row">
            <span className="gauge-label">Window Time:</span>
            <span className="gauge-val font-semibold">{simulation.timeInWindowSec.toFixed(1)} / 60.0s</span>
          </div>
          <div className="window-progress-bar">
            <div
              className="window-progress-fill"
              style={{ width: `${(simulation.timeInWindowSec / 60) * 100}%` }}
            />
          </div>

          <div className="gauge-metrics-grid">
            <div className="metric-box">
              <span className="metric-num text-brand">{simulation.totalRequests}</span>
              <span className="metric-lbl">Total Req</span>
            </div>
            <div className="metric-box">
              <span className="metric-num text-success">{simulation.allowedRequests}</span>
              <span className="metric-lbl">Allowed (200)</span>
            </div>
            <div className="metric-box">
              <span className={`metric-num ${simulation.throttledRequests > 0 ? 'text-danger' : 'text-muted'}`}>
                {simulation.throttledRequests}
              </span>
              <span className="metric-lbl">Dropped (429)</span>
            </div>
          </div>

          {/* Downstream Compute Load Gauge */}
          <div className="downstream-load-group">
            <div className="load-label-row">
              <span className="load-label">Compute Fleet Load:</span>
              <span
                className={`load-val ${
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
        </div>
      </section>

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
                    <span className="entity-sublabel">{node.tierBadge}</span>
                  </div>
                  <span className={`status-dot dot-${node.status}`} title={`Status: ${node.status}`} />
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
                    <strong className="entity-label">{edge.label}</strong>
                    <span className="entity-sublabel font-mono">{edge.protocol}</span>
                  </div>
                  <span className="entity-sla font-mono">{edge.latencySla}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 5. Invariants Checklist */}
      <section className="studio-nav-section" aria-labelledby="invariants-heading">
        <div className="section-label-row">
          <ShieldCheck size={13} className="text-success" />
          <h3 id="invariants-heading" className="section-label">
            Contract Invariants (3/3)
          </h3>
        </div>

        <div className="invariants-mini-checklist">
          <div className="invariant-check-row">
            <CheckCircle2 size={13} className="text-success" />
            <span>Sliding window burst suppression</span>
          </div>
          <div className="invariant-check-row">
            <CheckCircle2 size={13} className="text-success" />
            <span>Ingress gateway isolation shield</span>
          </div>
          <div className="invariant-check-row">
            <CheckCircle2 size={13} className="text-success" />
            <span>Zero SQL queries in hot-path</span>
          </div>
        </div>
      </section>
    </aside>
  );
};
