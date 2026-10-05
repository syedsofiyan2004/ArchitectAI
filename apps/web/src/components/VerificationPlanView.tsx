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
  return (
    <div className="verification-view">
      <div className="section-intro">
        <div>
          <h2 className="section-heading">Independent Verification Plan</h2>
          <p className="section-subtext">
            Formal engineering invariants and executable verification specifications designed to test and disprove failures.
          </p>
        </div>
        <div className="automatable-pill font-mono">
          {verificationSpecs.filter((v) => v.isAutomatable).length} / {verificationSpecs.length} Automatable Specs
        </div>
      </div>

      <div className="invariants-section">
        <h3 className="sub-heading">Engineering Invariants</h3>
        <div className="invariants-grid">
          {invariants.map((inv) => (
            <div key={inv.id} className="invariant-card card">
              <div className="invariant-header">
                <span className="inv-id font-mono">{inv.id}</span>
                <span className={`severity-badge ${inv.severity}`}>{inv.severity}</span>
                {inv.blocksCompletion && (
                  <span className="blocking-badge font-mono">Blocks Completion</span>
                )}
              </div>
              <p className="inv-property">{inv.property}</p>
              <div className="inv-rationale">
                <span className="label">Rationale:</span>
                <span className="text">{inv.rationale}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="specs-section">
        <h3 className="sub-heading">Executable Verification Specifications</h3>
        <div className="specs-list">
          {verificationSpecs.map((spec) => (
            <div key={spec.id} className="spec-card card">
              <div className="spec-header">
                <div>
                  <span className="spec-id font-mono">{spec.id}</span>
                  <span className="spec-target font-mono">Target: {spec.target}</span>
                </div>
                {spec.isAutomatable && (
                  <span className="badge-automatable font-mono">✓ Machine Automatable</span>
                )}
              </div>

              <h4 className="spec-desc">{spec.description}</h4>

              <div className="spec-flow-grid">
                <div className="flow-step">
                  <span className="step-tag font-mono">1. SETUP</span>
                  <p className="step-text">{spec.setup}</p>
                </div>
                <div className="flow-step highlight">
                  <span className="step-tag font-mono">2. ACTION / STIMULUS</span>
                  <p className="step-text">{spec.action}</p>
                </div>
                <div className="flow-step">
                  <span className="step-tag font-mono">3. EXPECTED PROPERTY</span>
                  <p className="step-text">{spec.expectedProperty}</p>
                </div>
              </div>

              <div className="evidence-box">
                <span className="evidence-title">Required Evidence Artifacts:</span>
                <ul className="evidence-list font-mono">
                  {spec.evidenceToCollect.map((ev, eIdx) => (
                    <li key={eIdx}>• {ev}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
