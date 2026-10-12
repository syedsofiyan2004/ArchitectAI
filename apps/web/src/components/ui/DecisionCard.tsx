import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { ArchitectureDecision } from '@architectai/domain';

interface DecisionCardProps {
  decision: ArchitectureDecision;
  index?: number;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({ decision, index = 1 }) => {
  const [showAlternatives, setShowAlternatives] = useState(false);

  const selectedOption = decision.consideredOptions.find((o) => o.id === decision.selectedOptionId);
  const alternatives = decision.consideredOptions.filter((o) => o.id !== decision.selectedOptionId);

  // Extract why bullets from rationale
  const rationaleBullets = decision.rationale
    ? decision.rationale.split(/(?<=[.?!])\s+/).filter((s) => s.trim().length > 0)
    : [];

  return (
    <article className="decision-card">
      <div className="decision-card-header">
        <div className="decision-kicker">
          <CheckCircle2 size={15} className="text-success" />
          <span>Recommended Approach</span>
        </div>
        <h3 className="decision-title">
          {selectedOption ? selectedOption.name : decision.selectedOptionName || decision.problemContext}
        </h3>
        <p className="decision-context">{decision.problemContext}</p>
      </div>

      <div className="decision-card-body">
        {rationaleBullets.length > 0 && (
          <div className="decision-section">
            <span className="decision-section-label">Why</span>
            <ul className="decision-bullets-list">
              {rationaleBullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          </div>
        )}

        {decision.risksAndTradeoffs && decision.risksAndTradeoffs.length > 0 && (
          <div className="decision-section">
            <span className="decision-section-label">Trade-offs</span>
            <ul className="decision-tradeoffs-list">
              {decision.risksAndTradeoffs.map((tradeoff, i) => (
                <li key={i}>{tradeoff}</li>
              ))}
            </ul>
          </div>
        )}

        {alternatives.length > 0 && (
          <div className="decision-alternatives-wrapper">
            <button
              type="button"
              className="btn-ghost alternatives-toggle-btn"
              onClick={() => setShowAlternatives(!showAlternatives)}
              aria-expanded={showAlternatives}
            >
              <span>{alternatives.length} alternatives evaluated</span>
              {showAlternatives ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showAlternatives && (
              <div className="alternatives-list">
                {alternatives.map((alt) => (
                  <div key={alt.id} className="alternative-item">
                    <strong className="alt-title">{alt.name}</strong>
                    <p className="alt-desc">{alt.description}</p>
                    {alt.tradeoffs && (
                      <p className="alt-why-not text-muted">
                        <em>Trade-off:</em> {alt.tradeoffs}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
