// ArchitectAI Architecture Studio Prototype — Contextual Right Inspector Drawer
// Fully grounded in authoritative EngineeringContract provenance and ArchitectureGraphProjection
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
  Workflow,
  Radio,
  HelpCircle,
  Link as LinkIcon,
  Compass,
} from 'lucide-react';
import type { EngineeringContract, ArchitectureGraphProjection } from '@architectai/domain';
import { StudioNode, StudioEdge } from './types';

interface StudioInspectorProps {
  selectedEntity: StudioNode | StudioEdge | null;
  onClose: () => void;
  isOpen: boolean;
  activeContract?: EngineeringContract;
  projection?: ArchitectureGraphProjection;
}

type InspectorTab = 'overview' | 'traceability' | 'tradeoffs' | 'failures' | 'verification';

export const StudioInspector: React.FC<StudioInspectorProps> = ({
  selectedEntity,
  onClose,
  isOpen,
  activeContract,
  projection,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('overview');

  if (!isOpen) {
    return null;
  }

  const isNode = selectedEntity && ('category' in selectedEntity || 'tier' in selectedEntity);
  const isEdge = selectedEntity && ('protocol' in selectedEntity || 'source' in selectedEntity);

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
        case 'service':
          return <Cpu size={18} />;
        case 'cache':
          return <Activity size={18} />;
        case 'datastore':
          return <Database size={18} />;
        case 'queue':
          return <Workflow size={18} />;
        case 'worker':
          return <Radio size={18} />;
        default:
          return <Server size={18} />;
      }
    }
    return <Network size={18} />;
  };

  // Resolve Provenance References from Authoritative Engineering Contract
  const linkedDecisions = activeContract && selectedEntity?.sourceDecisionIds
    ? activeContract.decisions.filter((d) => selectedEntity.sourceDecisionIds?.includes(d.id))
    : [];

  const linkedConcerns = activeContract && selectedEntity?.sourceConcernIds
    ? activeContract.discoveredConcerns.filter((c) => selectedEntity.sourceConcernIds?.includes(c.id))
    : [];

  const linkedInvariants = activeContract && selectedEntity?.sourceInvariantIds
    ? activeContract.invariants.filter((i) => selectedEntity.sourceInvariantIds?.includes(i.id))
    : [];

  const linkedSpecs = activeContract && selectedEntity?.sourceSpecIds
    ? activeContract.verificationSpecs.filter((s) => selectedEntity.sourceSpecIds?.includes(s.id))
    : [];

  const originLabel = selectedEntity?.origin
    ? selectedEntity.origin.replace('_', ' ').toUpperCase()
    : 'CONTRACT DECISION';

  const confidenceLabel = selectedEntity?.confidence
    ? selectedEntity.confidence.replace('_', ' ').toUpperCase()
    : 'ARCHITECTURAL DECISION';

  return (
    <aside className="studio-inspector-drawer" aria-label="Systems Reasoning Inspector">
      {/* 1. Header Bar */}
      <div className="inspector-header">
        <div className="inspector-title-row">
          <div className="inspector-entity-icon">{getEntityIcon()}</div>
          <div className="inspector-title-text">
            <div className="inspector-category-badge font-mono">
              {isNode
                ? `${(selectedEntity as StudioNode).tierBadge || ((selectedEntity as StudioNode).tier || 'DMZ').toUpperCase()} • ${originLabel}`
                : isEdge
                ? `FLOW • ${(selectedEntity as StudioEdge).protocol || 'HTTPS'}`
                : 'ENGINEERING CONTRACT'}
            </div>
            <h2 className="inspector-heading">
              {selectedEntity ? selectedEntity.label : activeContract?.requirement.context?.title || activeContract?.id || 'System Architecture Contract'}
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
              className={`inspector-tab-btn ${activeTab === 'traceability' ? 'active' : ''}`}
              onClick={() => setActiveTab('traceability')}
            >
              Traceability ({linkedDecisions.length + linkedConcerns.length + linkedInvariants.length})
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
              Failures ({selectedEntity.failureModes?.length || linkedConcerns.length})
            </button>
            <button
              type="button"
              className={`inspector-tab-btn ${activeTab === 'verification' ? 'active' : ''}`}
              onClick={() => setActiveTab('verification')}
            >
              Verification ({linkedSpecs.length || (selectedEntity.verification ? 1 : 0)})
            </button>
          </nav>
        )}
      </div>

      {/* 3. Drawer Body Content */}
      <div className="inspector-body">
        {!selectedEntity ? (
          /* Default State: Authoritative Contract Overview */
          <div className="inspector-empty-overview">
            <div className="empty-overview-hero">
              <span className="hero-kicker font-mono">AUTHORITATIVE CONTRACT</span>
              <h3 className="hero-title">
                {activeContract?.requirement.context?.title || activeContract?.id || 'Enterprise Architecture Contract'}
              </h3>
              <p className="hero-desc">
                {activeContract?.requirement.context?.businessGoal ||
                  activeContract?.requirement.rawIntent ||
                  'ArchitectAI synthesized this architecture to fulfill stated intent while defeating distributed failure modes.'}
              </p>
            </div>

            {/* Projection Status Banner */}
            {projection && (
              <div
                className={`projection-status-card font-mono status-${projection.status}`}
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  background: projection.status === 'valid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.15)',
                  border: `1px solid ${projection.status === 'valid' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.4)'}`,
                  fontSize: '11px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: projection.status === 'valid' ? '#10b981' : '#f59e0b' }}>
                    PROJECTION STATUS: {projection.status.toUpperCase()}
                  </span>
                  <span style={{ color: '#94a3b8' }}>Revision {projection.contractRevision}</span>
                </div>
                {projection.missingSources && projection.missingSources.length > 0 && (
                  <div style={{ color: '#fbbf24', marginTop: '6px' }}>
                    Missing Sources: {projection.missingSources.join(', ')}
                  </div>
                )}
              </div>
            )}

            <div className="overview-stats-grid font-mono">
              <div className="stat-card">
                <span className="stat-label">Topology Nodes</span>
                <strong className="stat-number">{projection?.nodes.length ?? 0} Components</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Edge Flows</span>
                <strong className="stat-number">{projection?.edges.length ?? 0} Connections</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Decisions Grounded</span>
                <strong className="stat-number text-brand">
                  {activeContract?.decisions.length ?? 0} Decisions
                </strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Enforceable Invariants</span>
                <strong className="stat-number text-success">
                  {activeContract?.invariants.length ?? 0} Invariants
                </strong>
              </div>
            </div>

            {/* Raw Intent & Invariants Summary */}
            <div className="overview-section">
              <h4 className="section-title">Contract Requirement Intent</h4>
              <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: '1.6', margin: '4px 0 12px 0' }}>
                "{activeContract?.requirement.rawIntent}"
              </p>
            </div>

            {/* Assumptions & Unresolved Questions */}
            {activeContract?.assumptions && activeContract.assumptions.length > 0 && (
              <div className="overview-section">
                <h4 className="section-title">Explicit Architecture Assumptions</h4>
                <ul className="tradeoffs-list font-mono" style={{ fontSize: '11.5px' }}>
                  {activeContract.assumptions.map((asm, idx) => (
                    <li key={idx} className="tradeoff-item">
                      <span className="tradeoff-bullet">ℹ️</span>
                      <span>{asm}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Simulation Module Disclaimer */}
            <div className="overview-section">
              <h4 className="section-title">Verification & Simulation Status</h4>
              <div className="grounding-tier-row font-mono" style={{ fontSize: '11.5px' }}>
                {projection?.simulationModule?.available ? (
                  <p className="tier-text text-brand">
                    ✓ Dedicated educational simulation available for this contract.
                  </p>
                ) : (
                  <p className="tier-text text-muted">
                    Static architecture contract projection. Discrete educational simulation is not modeled for this scenario; invariants are verified via executable test suites.
                  </p>
                )}
              </div>
            </div>

            <div className="inspector-callout-hint font-mono">
              💡 Select any node or connection on the central canvas to inspect its grounded contract decisions, discovered concerns, enforceable invariants, and verification specs.
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

                {selectedEntity.whySelected && (
                  <div className="content-block">
                    <h4 className="block-title">Why Selected by ArchitectAI</h4>
                    <div className="rationale-box">
                      <p className="rationale-text">{selectedEntity.whySelected}</p>
                    </div>
                  </div>
                )}

                {/* Grounding & Confidence Badges */}
                <div className="content-block">
                  <h4 className="block-title">Grounding & Provenance Metadata</h4>
                  <div className="edge-spec-list font-mono">
                    <div className="edge-spec-row">
                      <span className="spec-k">Origin:</span>
                      <span className="spec-v text-brand">{originLabel}</span>
                    </div>
                    <div className="edge-spec-row">
                      <span className="spec-k">Confidence:</span>
                      <span className="spec-v text-success">{confidenceLabel}</span>
                    </div>
                    {isNode && (selectedEntity as StudioNode).technology && (
                      <div className="edge-spec-row">
                        <span className="spec-k">Technology:</span>
                        <span className="spec-v">{(selectedEntity as StudioNode).technology}</span>
                      </div>
                    )}
                    {isNode && (selectedEntity as StudioNode).modeledCapacity && (
                      <div className="edge-spec-row">
                        <span className="spec-k">Modeled Capacity:</span>
                        <span className="spec-v text-brand">{(selectedEntity as StudioNode).modeledCapacity}</span>
                      </div>
                    )}
                    {isNode && (selectedEntity as StudioNode).assumedLatencySla && (
                      <div className="edge-spec-row">
                        <span className="spec-k">Latency SLA:</span>
                        <span className="spec-v text-muted">{(selectedEntity as StudioNode).assumedLatencySla}</span>
                      </div>
                    )}
                    {isEdge && (
                      <>
                        <div className="edge-spec-row">
                          <span className="spec-k">Protocol:</span>
                          <span className="spec-v text-brand">{(selectedEntity as StudioEdge).protocol}</span>
                        </div>
                        <div className="edge-spec-row">
                          <span className="spec-k">Direction:</span>
                          <span className="spec-v">{(selectedEntity as StudioEdge).direction || 'unidirectional'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Assumptions */}
                {selectedEntity.assumptions && selectedEntity.assumptions.length > 0 && (
                  <div className="content-block">
                    <h4 className="block-title">Entity Assumptions</h4>
                    <ul className="tradeoffs-list font-mono" style={{ fontSize: '12px' }}>
                      {selectedEntity.assumptions.map((asm, idx) => (
                        <li key={idx} className="tradeoff-item">
                          <span className="tradeoff-bullet">ℹ️</span>
                          <span>{asm}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Unresolved Questions */}
                {isNode && (selectedEntity as StudioNode).unresolvedQuestions && (selectedEntity as StudioNode).unresolvedQuestions!.length > 0 && (
                  <div className="content-block">
                    <h4 className="block-title">Unresolved Questions</h4>
                    <ul className="tradeoffs-list font-mono" style={{ fontSize: '12px' }}>
                      {(selectedEntity as StudioNode).unresolvedQuestions!.map((q: string, idx: number) => (
                        <li key={idx} className="tradeoff-item">
                          <span className="tradeoff-bullet text-warning">❓</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CONTRACT TRACEABILITY (Node -> Decision -> Concern/Invariant -> Spec) */}
            {activeTab === 'traceability' && (
              <div className="tab-pane">
                {/* 1. Linked Architectural Decisions */}
                <div className="content-block">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <Compass size={14} className="text-brand" />
                    <h4 className="block-title" style={{ margin: 0 }}>
                      Linked Contract Decisions ({linkedDecisions.length})
                    </h4>
                  </div>

                  {linkedDecisions.length === 0 ? (
                    <p className="block-subtext">No explicit decision IDs linked directly to this entity.</p>
                  ) : (
                    <div className="failure-modes-stack">
                      {linkedDecisions.map((dec) => (
                        <div key={dec.id} className="failure-mode-card" style={{ borderColor: 'rgba(56, 189, 248, 0.25)' }}>
                          <div className="failure-header">
                            <span className="font-mono text-brand" style={{ fontSize: '11px', fontWeight: 700 }}>
                              {dec.id}
                            </span>
                            <span className="tier-tag font-mono text-success">
                              {dec.selectedOptionName || 'Accepted'}
                            </span>
                          </div>
                          <div className="failure-field">
                            <span className="field-label font-mono">CONTEXT:</span>
                            <p className="field-desc" style={{ fontWeight: 600, color: '#f8fafc' }}>
                              {dec.problemContext}
                            </p>
                          </div>
                          <div className="failure-field">
                            <span className="field-label font-mono">RATIONALE:</span>
                            <p className="field-desc">{dec.rationale}</p>
                          </div>
                          {dec.risksAndTradeoffs && dec.risksAndTradeoffs.length > 0 && (
                            <div className="failure-field">
                              <span className="field-label font-mono">RISKS:</span>
                              <p className="field-desc text-danger">{dec.risksAndTradeoffs.join('; ')}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Discovered Concerns */}
                <div className="content-block">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <AlertTriangle size={14} className="text-warning" />
                    <h4 className="block-title" style={{ margin: 0 }}>
                      Discovered Engineering Concerns ({linkedConcerns.length})
                    </h4>
                  </div>

                  {linkedConcerns.length === 0 ? (
                    <p className="block-subtext">No specific concern candidates mapped directly to this component.</p>
                  ) : (
                    <div className="failure-modes-stack">
                      {linkedConcerns.map((c) => (
                        <div key={c.id} className="failure-mode-card">
                          <div className="failure-header">
                            <strong className="failure-name">{c.title}</strong>
                            <span className="tier-tag font-mono">{(c.confidence * 100).toFixed(0)}% CONF</span>
                          </div>
                          <div className="failure-field">
                            <span className="field-label font-mono">APPLICABILITY:</span>
                            <p className="field-desc">{c.applicabilityReason}</p>
                          </div>
                          <div className="failure-field">
                            <span className="field-label font-mono">DIMENSIONS:</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                              {c.dimensions.map((dim) => (
                                <span key={dim} className="font-mono" style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', color: '#94a3b8' }}>
                                  {dim}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Invariants */}
                <div className="content-block">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <ShieldCheck size={14} className="text-success" />
                    <h4 className="block-title" style={{ margin: 0 }}>
                      Enforceable Invariants ({linkedInvariants.length})
                    </h4>
                  </div>

                  {linkedInvariants.length === 0 ? (
                    <p className="block-subtext">No invariants explicitly anchored to this component.</p>
                  ) : (
                    <div className="failure-modes-stack">
                      {linkedInvariants.map((inv) => (
                        <div key={inv.id} className="failure-mode-card" style={{ borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                          <div className="failure-header">
                            <span className="font-mono text-brand" style={{ fontSize: '11px' }}>{inv.id}</span>
                            <span className={`tier-tag font-mono ${inv.severity === 'critical' ? 'text-danger' : 'text-warning'}`}>
                              {inv.severity.toUpperCase()}
                            </span>
                          </div>
                          <p className="field-desc" style={{ color: '#f8fafc', fontWeight: 600 }}>{inv.property}</p>
                          {inv.rationale && (
                            <p className="field-desc text-muted" style={{ fontSize: '11.5px', marginTop: '4px' }}>
                              {inv.rationale}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: TRADE-OFFS & ALTERNATIVES */}
            {activeTab === 'tradeoffs' && (
              <div className="tab-pane">
                <div className="content-block">
                  <h4 className="block-title">Accepted Trade-offs & Compromises</h4>
                  {selectedEntity.tradeOffs && selectedEntity.tradeOffs.length > 0 ? (
                    <ul className="tradeoffs-list">
                      {selectedEntity.tradeOffs.map((tradeoff, idx) => (
                        <li key={idx} className="tradeoff-item">
                          <span className="tradeoff-bullet">⚠️</span>
                          <span>{tradeoff}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="block-subtext">No compromises flagged for this component.</p>
                  )}
                </div>

                {/* Alternatives Considered from linked decisions */}
                <div className="content-block">
                  <h4 className="block-title">Evaluated Alternatives</h4>
                  {linkedDecisions.some((d) => d.consideredOptions && d.consideredOptions.length > 0) ? (
                    <div className="alternatives-list">
                      {linkedDecisions.flatMap((d) =>
                        d.consideredOptions.map((opt) => (
                          <div key={opt.id} className="alternative-card">
                            <div className="alt-header">
                              <strong className="alt-title">{opt.name}</strong>
                              <span
                                className={`alt-verdict font-mono verdict-${
                                  opt.id === d.selectedOptionId ? 'accepted' : 'rejected'
                                }`}
                              >
                                {opt.id === d.selectedOptionId ? 'SELECTED' : 'REJECTED'}
                              </span>
                            </div>
                            <p className="alt-reason">{opt.description}</p>
                            {opt.tradeoffs && (
                              <p className="alt-reason text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                Trade-off: {opt.tradeoffs}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  ) : selectedEntity.alternativesConsidered && selectedEntity.alternativesConsidered.length > 0 ? (
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
                  ) : (
                    <p className="block-subtext">No alternatives documented for this component.</p>
                  )}
                </div>
              </div>
            )}

            {/* TAB: FAILURES */}
            {activeTab === 'failures' && (
              <div className="tab-pane">
                <div className="content-block">
                  <h4 className="block-title">Anticipated Distributed Systems Hazards</h4>
                  <p className="block-subtext">
                    ArchitectAI proactively isolates failure modes inferred from concurrency, memory, and timing dimensions.
                  </p>

                  <div className="failure-modes-stack">
                    {selectedEntity.failureModes && selectedEntity.failureModes.length > 0 ? (
                      selectedEntity.failureModes.map((fm) => (
                        <div key={fm.id} className="failure-mode-card">
                          <div className="failure-header">
                            <div className="failure-title-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                      ))
                    ) : linkedConcerns.length > 0 ? (
                      linkedConcerns.map((c) => (
                        <div key={c.id} className="failure-mode-card">
                          <div className="failure-header">
                            <div className="failure-title-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <AlertTriangle size={14} className="text-warning" />
                              <strong className="failure-name">{c.title}</strong>
                            </div>
                            <span className="tier-tag font-mono">{(c.confidence * 100).toFixed(0)}% CONF</span>
                          </div>
                          <div className="failure-field">
                            <span className="field-label font-mono">MECHANISM:</span>
                            <p className="field-desc">{c.description || c.applicabilityReason}</p>
                          </div>
                          <div className="failure-field">
                            <span className="field-label font-mono">DIMENSIONS:</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                              {c.dimensions.map((dim) => (
                                <span key={dim} className="font-mono" style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', color: '#94a3b8' }}>
                                  {dim}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="block-subtext">No explicit failure modes attached to this component.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: INDEPENDENT VERIFICATION */}
            {activeTab === 'verification' && (
              <div className="tab-pane">
                <div className="content-block">
                  <h4 className="block-title">Contract Verification Specifications</h4>
                  <div className="verif-status-badge font-mono" style={{ background: '#090d16', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '6px 10px', borderRadius: '4px', marginBottom: '12px', fontSize: '11px', color: '#38bdf8' }}>
                    <ShieldCheck size={12} style={{ display: 'inline', marginRight: '6px' }} />
                    Planned Verification Check (Not yet executed)
                  </div>
                  <p className="block-subtext">
                    Executable specifications ensuring this component adheres to contract invariants.
                  </p>

                  {linkedSpecs.length > 0 ? (
                    <div className="failure-modes-stack">
                      {linkedSpecs.map((spec) => (
                        <div key={spec.id} className="failure-mode-card" style={{ borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                          <div className="failure-header">
                            <span className="font-mono text-brand" style={{ fontSize: '11px' }}>{spec.id}</span>
                            <span className="tier-tag font-mono text-brand">
                              {spec.isAutomatable ? 'AUTOMATED' : 'MANUAL'}
                            </span>
                          </div>
                          <div className="failure-field">
                            <span className="field-label font-mono">TARGET:</span>
                            <p className="field-desc font-mono text-success">{spec.target}</p>
                          </div>
                          <div className="failure-field">
                            <span className="field-label font-mono">EXPECTED PROPERTY:</span>
                            <p className="field-desc">{spec.expectedProperty}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : selectedEntity.verification ? (
                    <div className="spec-detail-box font-mono">
                      <div className="spec-row">
                        <span className="spec-k">Invariant ID:</span>
                        <span className="spec-v text-brand">{selectedEntity.verification.invariantId}</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-k">Property:</span>
                        <span className="spec-v">{selectedEntity.verification.formalProperty}</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-k">Strategy:</span>
                        <span className="spec-v text-success">{selectedEntity.verification.testStrategy}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="block-subtext">No discrete verification specs attached to this component.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
