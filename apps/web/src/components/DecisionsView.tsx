import React from 'react';
import { ArchitectureDecision } from '@architectai/domain';

interface DecisionsViewProps {
  decisions: ArchitectureDecision[];
}

export const DecisionsView: React.FC<DecisionsViewProps> = ({ decisions }) => {
  if (decisions.length === 0) {
    return (
      <div className="empty-state card">
        <p>No architecture decisions formed yet. Submit a requirement to evaluate choices.</p>
      </div>
    );
  }

  return (
    <div className="decisions-view">
      <div className="section-intro">
        <div>
          <h2 className="section-heading">Architecture Decisions & Invariants</h2>
          <p className="section-subtext">
            Explicit trade-offs and architectural choices formulated to address discovered failure patterns.
          </p>
        </div>
      </div>

      <div className="decisions-list">
        {decisions.map((dec, idx) => (
          <div key={dec.id} className="decision-card card">
            <div className="decision-header">
              <span className="decision-num font-mono">ADR #{idx + 1}</span>
              <h3 className="decision-context">{dec.problemContext}</h3>
            </div>

            <div className="decision-body">
              <div className="options-comparison">
                <span className="section-subtitle">Evaluated Options:</span>
                <div className="options-grid">
                  {dec.consideredOptions.map((opt) => {
                    const isSelected = opt.id === dec.selectedOptionId;
                    return (
                      <div
                        key={opt.id}
                        className={`option-card ${isSelected ? 'selected' : 'unselected'}`}
                      >
                        <div className="option-title-row">
                          <h4 className="option-name">{opt.name}</h4>
                          {isSelected && (
                            <span className="selected-badge font-mono">✓ Selected Option</span>
                          )}
                        </div>
                        <p className="option-desc">{opt.description}</p>
                        {opt.tradeoffs && (
                          <div className="option-tradeoffs">
                            <span className="tradeoff-label">Trade-offs:</span>
                            <span className="tradeoff-text">{opt.tradeoffs}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rationale-box">
                <span className="rationale-label">Decision Rationale:</span>
                <p className="rationale-text">{dec.rationale}</p>
              </div>

              <div className="decision-meta-grid">
                {dec.risksAndTradeoffs && dec.risksAndTradeoffs.length > 0 && (
                  <div className="meta-box">
                    <span className="meta-label">Risks & Trade-offs:</span>
                    <ul className="meta-list">
                      {dec.risksAndTradeoffs.map((risk, rIdx) => (
                        <li key={rIdx}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {dec.reconsiderationTriggers && dec.reconsiderationTriggers.length > 0 && (
                  <div className="meta-box">
                    <span className="meta-label">Reconsideration Triggers:</span>
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
