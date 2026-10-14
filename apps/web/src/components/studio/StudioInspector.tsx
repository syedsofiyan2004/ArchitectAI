// ArchitectAI Architecture Studio Prototype — Contextual Right Inspector Drawer
import React, { useState } from 'react';
import {
  X,
  Shield,
  Layers,
  AlertTriangle,
  GitBranch,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  Server,
  Database,
  Globe,
  Cpu,
  Activity,
  Network,
  Sparkles,
} from 'lucide-react';
import { StudioNode, StudioEdge } from './types';

interface StudioInspectorProps {
  selectedEntity: StudioNode | StudioEdge | null;
  onClose: () => void;
  isOpen: boolean;
}

type InspectorTab = 'overview' | 'tradeoffs' | 'failures' | 'implementation' | 'verification';

export const StudioInspector: React.FC<StudioInspectorProps> = ({
  selectedEntity,
  onClose,
  isOpen,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('overview');

  if (!isOpen) {
    return null;
  }

  const isNode = selectedEntity && 'category' in selectedEntity;
  const isEdge = selectedEntity && 'protocol' in selectedEntity;

  const getEntityIcon = () => {
    if (!selectedEntity) return <Layers size={18} />;
    if (isNode) {
      const node = selectedEntity as StudioNode;
      switch (node.category) {
        case 'client':
          return <Globe size={18} />;
        case 'gateway':
          return <Layers size={18} />;
        case 'compute':
          return <Cpu size={18} />;
        case 'cache':
          return <Activity size={18} />;
        case 'datastore':
          return <Database size={18} />;
        default:
          return <Server size={18} />;
      }
    }
    return <Network size={18} />;
  };

  return (
    <aside className="studio-inspector-drawer" aria-label="Systems Reasoning Inspector">
      {/* 1. Header Bar */}
      <div className="inspector-header">
        <div className="inspector-title-row">
          <div className="inspector-entity-icon">{getEntityIcon()}</div>
          <div className="inspector-title-text">
            <div className="inspector-category-badge font-mono">
              {isNode
                ? (selectedEntity as StudioNode).tierBadge
                : isEdge
                ? `Connection Flow • ${(selectedEntity as StudioEdge).latencySla}`
                : 'System Architecture Contract'}
            </div>
            <h2 className="inspector-heading">
              {selectedEntity ? selectedEntity.label : 'Enterprise Rate-Limiting Contract'}
            </h2>
          </div>
          <button
            type="button"
            className="inspector-close-btn"
            onClick={onClose}
            aria-label="Close Inspector"
          >
            <X size={16} />
          </button>
        </div>

        {/* 2. Navigation Tabs (when entity is selected) */}
        {selectedEntity && (
          <nav className="inspector-tabs-nav font-mono" aria-label="Inspector Sections">
            <button
              type="button"
              className={`inspector-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              className={`inspector-tab-btn ${activeTab === 'tradeoffs' ? 'active' : ''}`}
              onClick={() => setActiveTab('tradeoffs')}
            >
              Trade-offs
            </button>
            <button
              type="button"
              className={`inspector-tab-btn ${activeTab === 'failures' ? 'active' : ''}`}
              onClick={() => setActiveTab('failures')}
            >
              Failures ({selectedEntity.failureModes.length})
            </button>
            <button
              type="button"
              className={`inspector-tab-btn ${activeTab === 'implementation' ? 'active' : ''}`}
              onClick={() => setActiveTab('implementation')}
            >
              Implementation
            </button>
            <button
              type="button"
              className={`inspector-tab-btn ${activeTab === 'verification' ? 'active' : ''}`}
              onClick={() => setActiveTab('verification')}
            >
              Verification
            </button>
          </nav>
        )}
      </div>

      {/* 3. Drawer Body Content */}
      <div className="inspector-body">
        {!selectedEntity ? (
          /* Default State: Architecture Overview & Contract Summary */
          <div className="inspector-empty-overview">
            <div className="empty-overview-hero">
              <span className="hero-kicker font-mono">ENGINEERING CONTRACT</span>
              <h3 className="hero-title">Sliding-Window Rate Limiting Architecture</h3>
              <p className="hero-desc">
                ArchitectAI synthesized this multi-tiered architecture to fulfill your rate limiting requirement
                while shielding backend compute from boundary burst amplification.
              </p>
            </div>

            <div className="overview-stats-grid font-mono">
              <div className="stat-card">
                <span className="stat-label">System Nodes</span>
                <strong className="stat-number">5 Components</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Edge Flows</span>
                <strong className="stat-number">4 Connections</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Planned Invariants</span>
                <strong className="stat-number text-brand">3 checks planned</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Modeled Baseline Latency</span>
                <strong className="stat-number text-muted">&lt; 0.8 ms (Assumed)</strong>
              </div>
            </div>

            <div className="overview-section">
              <h4 className="section-title">Knowledge Model Grounding</h4>
              <div className="grounding-tier-row">
                <span className="tier-tag l1 font-mono">L1 FUNDAMENTAL</span>
                <p className="tier-text">Concurrency boundaries, mutable state isolation, monotonic clock tracking.</p>
              </div>
              <div className="grounding-tier-row">
                <span className="tier-tag l2 font-mono">L2 FAILURE PATTERN</span>
                <p className="tier-text">Boundary burst amplification, worker thread starvation, OOM key leakage.</p>
              </div>
              <div className="grounding-tier-row">
                <span className="tier-tag l3 font-mono">L3 TECHNOLOGY FACT</span>
                <p className="tier-text">Redis 7+ RESP3 protocol, atomic Lua 5.1 scripts, Envoy rate-limit filter.</p>
              </div>
            </div>

            <div className="inspector-callout-hint font-mono">
              💡 Select any node or connection on the central canvas to inspect its systems rationale, trade-offs, failure modes, and independent verification tests.
            </div>
          </div>
        ) : (
          /* Entity-Specific Detail Views */
          <div className="inspector-entity-content">
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="tab-pane">
                <div className="content-block">
                  <h4 className="block-title">Architectural Role & Purpose</h4>
                  <p className="block-text">{selectedEntity.purpose}</p>
                </div>

                <div className="content-block">
                  <h4 className="block-title">Why ArchitectAI Selected This Approach</h4>
                  <div className="rationale-box">
                    <p className="rationale-text">{selectedEntity.whySelected}</p>
                  </div>
                </div>

                {isNode && (
                  <div className="content-block">
                    <h4 className="block-title">Simulated Component Health</h4>
                    <div className="health-metrics-grid font-mono">
                      <div className="metric-cell">
                        <span className="m-k">{(selectedEntity as StudioNode).metrics.label1}</span>
                        <strong className="m-v">{(selectedEntity as StudioNode).metrics.value1}</strong>
                      </div>
                      <div className="metric-cell">
                        <span className="m-k">{(selectedEntity as StudioNode).metrics.label2}</span>
                        <strong className="m-v">{(selectedEntity as StudioNode).metrics.value2}</strong>
                      </div>
                      <div className="metric-cell">
                        <span className="m-k">{(selectedEntity as StudioNode).metrics.label3}</span>
                        <strong className="m-v">{(selectedEntity as StudioNode).metrics.value3}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {isEdge && (
                  <div className="content-block">
                    <h4 className="block-title">Protocol & Transport Constraints</h4>
                    <div className="edge-spec-list font-mono">
                      <div className="edge-spec-row">
                        <span className="spec-k">Protocol:</span>
                        <span className="spec-v text-brand">{(selectedEntity as StudioEdge).protocol}</span>
                      </div>
                      <div className="edge-spec-row">
                        <span className="spec-k">Target Latency SLA:</span>
                        <span className="spec-v text-success">{(selectedEntity as StudioEdge).latencySla}</span>
                      </div>
                      <div className="edge-spec-row">
                        <span className="spec-k">Directionality:</span>
                        <span className="spec-v">{(selectedEntity as StudioEdge).direction}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TRADE-OFFS & ALTERNATIVES */}
            {activeTab === 'tradeoffs' && (
              <div className="tab-pane">
                <div className="content-block">
                  <h4 className="block-title">Accepted Trade-offs & Compromises</h4>
                  <ul className="tradeoffs-list">
                    {selectedEntity.tradeOffs.map((tradeoff, idx) => (
                      <li key={idx} className="tradeoff-item">
                        <span className="tradeoff-bullet">⚠️</span>
                        <span>{tradeoff}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="content-block">
                  <h4 className="block-title">Evaluated & Rejected Alternatives</h4>
                  <div className="alternatives-list">
                    {selectedEntity.alternativesConsidered.map((alt, idx) => (
                      <div key={idx} className="alternative-card">
                        <div className="alt-header">
                          <strong className="alt-title">{alt.title}</strong>
                          <span className={`alt-verdict font-mono verdict-${alt.verdict.toLowerCase()}`}>
                            {alt.verdict}
                          </span>
                        </div>
                        <p className="alt-reason">{alt.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: FAILURE MODES */}
            {activeTab === 'failures' && (
              <div className="tab-pane">
                <div className="content-block">
                  <h4 className="block-title">Anticipated Distributed Systems Hazards</h4>
                  <p className="block-subtext">
                    ArchitectAI proactively isolates failure modes inferred from concurrency, memory, and timing dimensions.
                  </p>

                  <div className="failure-modes-stack">
                    {selectedEntity.failureModes.map((fm) => (
                      <div key={fm.id} className="failure-mode-card">
                        <div className="failure-header">
                          <div className="failure-title-group">
                            <AlertTriangle size={14} className="text-warning" />
                            <strong className="failure-name">{fm.name}</strong>
                          </div>
                          <span className="tier-tag font-mono">{fm.level}</span>
                        </div>
                        <div className="failure-field">
                          <span className="field-label font-mono">MECHANISM:</span>
                          <p className="field-desc">{fm.description}</p>
                        </div>
                        <div className="failure-field">
                          <span className="field-label font-mono">CONSEQUENCE:</span>
                          <p className="field-desc text-danger">{fm.consequence}</p>
                        </div>
                        <div className="failure-field mitigation-field">
                          <span className="field-label font-mono">ARCHITECTAI MITIGATION:</span>
                          <p className="field-desc text-success">{fm.mitigation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: IMPLEMENTATION */}
            {activeTab === 'implementation' && (
              <div className="tab-pane">
                <div className="content-block">
                  <h4 className="block-title">Implementation Blueprint for Coding Agent</h4>
                  <p className="block-subtext">
                    Constitutes the bounded contract delegated to coding agents (e.g. Codex) inside an isolated worktree.
                  </p>

                  <div className="impl-spec-card font-mono">
                    <div className="impl-row">
                      <span className="impl-label">Technology:</span>
                      <span className="impl-val text-brand">{selectedEntity.implementation.technology}</span>
                    </div>

                    <div className="impl-row">
                      <span className="impl-label">Target Files:</span>
                      <div className="target-files-list">
                        {selectedEntity.implementation.targetFiles.map((f, idx) => (
                          <div key={idx} className="file-pill">
                            <FileCode size={12} />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="impl-row">
                      <span className="impl-label">Configuration:</span>
                      <div className="config-grid">
                        {Object.entries(selectedEntity.implementation.configuration).map(([k, v]) => (
                          <div key={k} className="config-entry">
                            <span className="cfg-k">{k}:</span>
                            <span className="cfg-v">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedEntity.implementation.codeSnippet && (
                    <div className="snippet-container">
                      <div className="snippet-header font-mono">
                        <GitBranch size={12} />
                        <span>Canonical Logic Preview</span>
                      </div>
                      <pre className="snippet-code font-mono">
                        <code>{selectedEntity.implementation.codeSnippet}</code>
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: INDEPENDENT VERIFICATION */}
            {activeTab === 'verification' && (
              <div className="tab-pane">
                <div className="content-block">
                  <h4 className="block-title">Adversarial Invariant Verification</h4>
                  <p className="block-subtext">
                    ArchitectAI never accepts "Agent says done." This executable invariant independently proves behavior.
                  </p>

                  <div className="verification-spec-card">
                    <div className="verif-header">
                      <ShieldCheck size={16} className="text-success" />
                      <div>
                        <strong className="verif-title">{selectedEntity.verification.title}</strong>
                        <div className="verif-id font-mono text-muted">{selectedEntity.verification.invariantId}</div>
                      </div>
                    </div>

                    <div className="verif-property-box font-mono">
                      <span className="prop-k">FORMAL INVARIANT PROPERTY:</span>
                      <p className="prop-text">{selectedEntity.verification.formalProperty}</p>
                    </div>

                    <div className="verif-metrics-row font-mono">
                      <div className="verif-metric">
                        <span className="v-lbl">OPERATOR:</span>
                        <span className="v-val text-brand">{selectedEntity.verification.operator}</span>
                      </div>
                      <div className="verif-metric">
                        <span className="v-lbl">EXPECTED:</span>
                        <span className="v-val text-success">{String(selectedEntity.verification.expected)}</span>
                      </div>
                      <div className="verif-metric">
                        <span className="v-lbl">STRATEGY:</span>
                        <span className="v-val text-warning">{selectedEntity.verification.testStrategy}</span>
                      </div>
                    </div>

                    <div className="verif-desc-box">
                      <span className="v-desc-title font-mono">TEST METHODOLOGY:</span>
                      <p className="v-desc-p">{selectedEntity.verification.verificationDescription}</p>
                    </div>

                    <div className="verif-status-badge font-mono">
                      <span className="text-brand">○</span>
                      <span>Planned Verification Check (Not yet executed)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
