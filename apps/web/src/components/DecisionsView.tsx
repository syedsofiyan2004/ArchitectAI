import React from 'react';
import { ArchitectureDecision } from '@architectai/domain';

interface DecisionsViewProps {
  decisions: ArchitectureDecision[];
}

export const DecisionsView: React.FC<DecisionsViewProps> = ({ decisions }) => {
  if (decisions.length === 0) {
    return (
      <div className="surface-card empty-state">
        <p>No architecture decisions formed yet. Submit a requirement to evaluate choices.</p>
      </div>
    );
  }

  return (
    <div className="decisions-container">
      <div className="section-intro">
        <div>
          <h2 className="section-heading">Architecture Decision Records (ADRs)</h2>
          <p className="section-subtext">
            Explicit trade-offs and structural decisions formulated to prevent the discovered systems failure modes.
          </p>
        </div>
        <div className="grounding-count-pill font-mono">
          {decisions.length} Enforceable ADRs
        </div>
      </div>

      <div className="decisions-list">
        {decisions.map((dec, idx) => (
          <div key={dec.id} className="surface-card decision-card">
            <div className="decision-header">
              <div className="decision-badge font-mono">ADR-{idx + 1}</div>
              <h3 className="decision-title">{dec.problemContext}</h3>
            </div>

            <div className="decision-body">
              {/* Evaluated Options */}
              <div className="evaluated-options-section">
                <div className="sub-section-label">Evaluated Architecture Options:</div>
                <div className="options-grid">
                  {dec.consideredOptions.map((opt) => {
                    const isSelected = opt.id === dec.selectedOptionId;
                    return (
                      <div
                        key={opt.id}
                        className={`option-box ${isSelected ? 'selected' : 'unselected'}`}
                      >
                        <div className="option-box-header">
                          <strong className="option-name">{opt.name}</strong>
                          {isSelected && (
                            <span className="selected-tag font-mono">✓ Selected Option</span>
                          )}
                        </div>
                        <p className="option-desc">{opt.description}</p>
                        {opt.tradeoffs && (
                          <div className="option-tradeoffs-line">
                            <span className="label">Trade-off: </span>
                            <span className="text">{opt.tradeoffs}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rationale */}
              <div className="rationale-callout">
                <div className="callout-label">Architectural Rationale:</div>
                <p className="callout-text">{dec.rationale}</p>
              </div>

              {/* Meta Grid: Risks & Reconsideration Triggers */}
              <div className="decision-details-grid">
                {dec.risksAndTradeoffs && dec.risksAndTradeoffs.length > 0 && (
                  <div className="detail-column">
                    <div className="sub-section-label">Residual Risks & Trade-offs:</div>
                    <ul className="meta-list">
                      {dec.risksAndTradeoffs.map((risk, rIdx) => (
                        <li key={rIdx}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {dec.reconsiderationTriggers && dec.reconsiderationTriggers.length > 0 && (
                  <div className="detail-column">
                    <div className="sub-section-label">Reconsideration Triggers:</div>
                    <ul className="meta-list triggers">
                      {dec.reconsiderationTriggers.map((trig, tIdx) => (
                        <li key={tIdx}>{trig}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
