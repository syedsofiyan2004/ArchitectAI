import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, ArrowRight, ArrowLeft, Play, Zap, FileText } from 'lucide-react';
import { AnalysisRunRecord } from '../types';

interface RunContext {
  run: AnalysisRunRecord;
  onOpenEvidence: () => void;
}

export const VerificationPage: React.FC = () => {
  const { run } = useOutletContext<RunContext>();
  const navigate = useNavigate();

  const contract = run.result!.contract;
  const invariants = contract.invariants;
  const specs = contract.verificationSpecs;

  const automatableCount = specs.filter((s) => s.isAutomatable).length;

  return (
    <div className="verification-page-layout">
      <section className="verification-hero">
        <div className="section-step-indicator font-mono">Step 3 of 4 • Independent Verification Plan</div>
        <h1 className="verification-title">Independent Verification Plan</h1>
        <p className="verification-subtitle">
          Before writing code, ArchitectAI formulates executable test specifications and non-negotiable invariants
          to independently verify and disprove failure modes.
        </p>

        <div className="verification-summary-banner">
          <div className="summary-banner-stat">
            <span className="stat-num">{specs.length + invariants.length}</span>
            <span className="stat-label">Total Verification Checks</span>
          </div>
          <div className="summary-banner-divider"></div>
          <div className="summary-banner-stat">
            <span className="stat-num">{automatableCount}</span>
            <span className="stat-label">Machine Automatable Tests</span>
          </div>
          <div className="summary-banner-divider"></div>
          <div className="summary-banner-stat">
            <span className="stat-num">{invariants.length}</span>
            <span className="stat-label">Formal Engineering Invariants</span>
          </div>
        </div>
      </section>

      {/* Enforceable Engineering Invariants */}
      <section className="invariants-block">
        <div className="block-heading-row">
          <div>
            <h2>Enforceable Architecture Invariants</h2>
            <p className="text-secondary">Non-negotiable runtime constraints that block task completion if violated.</p>
          </div>
        </div>

        <div className="invariants-cards-grid">
          {invariants.map((inv) => (
            <div key={inv.id} className="invariant-item-card">
              <div className="invariant-item-header">
                <span className={`severity-tag ${inv.severity}`}>{inv.severity.toUpperCase()}</span>
                {inv.blocksCompletion && (
                  <span className="blocking-tag font-mono">Blocks Completion</span>
                )}
              </div>
              <p className="invariant-property">{inv.property}</p>
              {inv.rationale && (
                <div className="invariant-rationale">
                  <span className="rationale-label">Rationale:</span>
                  <span>{inv.rationale}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Executable Test Plan */}
      <section className="specs-block">
        <div className="block-heading-row">
          <div>
            <h2>Executable Test Specifications</h2>
            <p className="text-secondary">Concrete stimuli, setups, and expected assertions for testing this implementation.</p>
          </div>
        </div>

        <div className="specs-feed">
          {specs.map((spec, sIdx) => (
            <div key={spec.id} className="spec-item-card">
              <div className="spec-item-top">
                <div className="spec-title-group">
                  <span className="spec-num font-mono">Test #{sIdx + 1}</span>
                  <h3 className="spec-name">{spec.description}</h3>
                </div>
                <div className="spec-badges">
                  <span className="target-pill font-mono">Target: {spec.target}</span>
                  {spec.isAutomatable ? (
                    <span className="automatable-pill font-mono">✓ Automatable</span>
                  ) : (
                    <span className="manual-pill font-mono">Manual Check</span>
                  )}
                </div>
              </div>

              <div className="spec-steps-sequence">
                <div className="step-column">
                  <span className="step-label font-mono">1. SETUP / PRECONDITION</span>
                  <p className="step-content">{spec.setup}</p>
                </div>
                <div className="step-column action-col">
                  <span className="step-label font-mono">2. ACTION / STIMULUS</span>
                  <p className="step-content">{spec.action}</p>
                </div>
                <div className="step-column">
                  <span className="step-label font-mono">3. EXPECTED INVARIANT</span>
                  <p className="step-content">{spec.expectedProperty}</p>
                </div>
              </div>

              {spec.evidenceToCollect && spec.evidenceToCollect.length > 0 && (
                <div className="spec-evidence-bar">
                  <span className="evidence-label font-mono">Evidence to record:</span>
                  <div className="evidence-pills-list">
                    {spec.evidenceToCollect.map((ev, eIdx) => (
                      <span key={eIdx} className="evidence-chip font-mono">
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Sequential Footer Action */}
      <div className="review-footer-bar">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(`/runs/${run.id}/architecture`)}
        >
          <ArrowLeft size={16} />
          <span>Back to Architecture</span>
        </button>

        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(`/runs/${run.id}/implementation`)}
        >
          <span>Prepare Implementation</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
