import React from 'react';
import { EngineeringInvariant, VerificationSpec } from '@architectai/domain';

interface VerificationPlanViewProps {
  invariants: EngineeringInvariant[];
  verificationSpecs: VerificationSpec[];
}

export const VerificationPlanView: React.FC<VerificationPlanViewProps> = ({
  invariants,
  verificationSpecs,
}) => {
  const automatableCount = verificationSpecs.filter((v) => v.isAutomatable).length;

  return (
    <div className="verification-container">
      <div className="section-intro">
        <div>
          <h2 className="section-heading">Independent Verification Plan</h2>
          <p className="section-subtext">
            Formal architectural invariants and executable test specifications designed to test and disprove failure modes.
          </p>
        </div>
        <div className="grounding-count-pill font-mono">
          {automatableCount} / {verificationSpecs.length} Automatable Specs
        </div>
      </div>

      {/* Invariants Section */}
      <div className="invariants-section">
        <h3 className="group-heading">Enforceable Engineering Invariants</h3>
        <div className="invariants-grid">
          {invariants.map((inv) => (
            <div key={inv.id} className="surface-card invariant-card">
              <div className="invariant-header">
                <span className="inv-id font-mono">{inv.id}</span>
                <span className={`severity-pill ${inv.severity}`}>{inv.severity}</span>
                {inv.blocksCompletion && (
                  <span className="blocking-pill font-mono">Blocks Completion</span>
                )}
              </div>
              <p className="inv-property">{inv.property}</p>
              {inv.rationale && (
                <div className="inv-rationale-box">
                  <span className="label">Rationale:</span>
                  <span className="text">{inv.rationale}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Verification Specs Section */}
      <div className="specs-section">
        <h3 className="group-heading">Executable Test Specifications</h3>
        <div className="specs-list">
          {verificationSpecs.map((spec) => (
            <div key={spec.id} className="surface-card spec-card">
              <div className="spec-header">
                <div className="spec-meta">
                  <span className="spec-id font-mono">{spec.id}</span>
                  <span className="spec-target font-mono">Target: {spec.target}</span>
                </div>
                {spec.isAutomatable && (
                  <span className="automatable-badge font-mono">✓ Automatable Test</span>
                )}
              </div>

              <h4 className="spec-description">{spec.description}</h4>

              <div className="spec-flow-grid">
                <div className="flow-step">
                  <span className="step-tag font-mono">1. SETUP / PRECONDITION</span>
                  <p className="step-text">{spec.setup}</p>
                </div>
                <div className="flow-step action-highlight">
                  <span className="step-tag font-mono">2. ACTION / STIMULUS</span>
                  <p className="step-text">{spec.action}</p>
                </div>
                <div className="flow-step">
                  <span className="step-tag font-mono">3. EXPECTED INVARIANT</span>
                  <p className="step-text">{spec.expectedProperty}</p>
                </div>
              </div>

              {spec.evidenceToCollect.length > 0 && (
                <div className="evidence-box">
                  <span className="evidence-title">Required Evidence Artifacts:</span>
                  <div className="evidence-tags">
                    {spec.evidenceToCollect.map((ev, eIdx) => (
                      <span key={eIdx} className="evidence-pill font-mono">
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
