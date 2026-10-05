import React, { useState } from 'react';
import { ConcernCandidate, EngineeringDimension } from '@architectai/domain';

interface UnknownUnknownsViewProps {
  concerns: ConcernCandidate[];
  dimensionsDetected: EngineeringDimension[];
}

function getSeverity(concern: ConcernCandidate): {
  level: 'critical' | 'high' | 'medium' | 'low';
  label: string;
} {
  if (concern.confidence >= 0.9) return { level: 'critical', label: 'CRITICAL' };
  if (concern.confidence >= 0.8) return { level: 'high', label: 'HIGH' };
  if (concern.confidence >= 0.65) return { level: 'medium', label: 'MEDIUM' };
  return { level: 'low', label: 'LOW' };
}

export const UnknownUnknownsView: React.FC<UnknownUnknownsViewProps> = ({
  concerns,
  dimensionsDetected,
}) => {
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const toggleDetail = (id: string) => {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (concerns.length === 0) {
    return (
      <div className="surface-card empty-state">
        <p>No unknown-unknowns discovered yet. Submit a requirement to run discovery.</p>
      </div>
    );
  }

  return (
    <div className="findings-container">
      <div className="section-intro">
        <div>
          <h2 className="section-heading">Unknown-Unknown Engineering Concerns</h2>
          <p className="section-subtext">
            Hidden failure modes, race conditions, resource bottlenecks, and trust boundary hazards
            discovered through universal systems reasoning.
          </p>
        </div>
        {dimensionsDetected.length > 0 && (
          <div className="detected-dimensions-bar">
            <span className="dim-label">Active Dimensions:</span>
            <div className="dim-tags">
              {dimensionsDetected.map((dim) => (
                <span key={dim} className="tag tag-dim font-mono">
                  {dim}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="concerns-grid">
        {concerns.map((concern, idx) => {
          const severity = getSeverity(concern);
          const isGrounded = concern.groundingStatus !== 'ungrounded_model_discovery';
          const isExpanded = Boolean(expandedDetails[concern.id]);
          const hasDetails =
            (concern.assumptions && concern.assumptions.length > 0) ||
            (concern.unresolvedQuestions && concern.unresolvedQuestions.length > 0) ||
            concern.supportingKnowledgeIds.length > 0;

          return (
            <div key={concern.id} className="finding-card">
              <div className="finding-header">
                <div className="finding-title-group">
                  <div className="finding-badges-row">
                    <span className={`severity-pill ${severity.level}`}>
                      {severity.label}
                    </span>
                    <span className="confidence-pill font-mono">
                      {Math.round(concern.confidence * 100)}% Confidence
                    </span>
                    <span className={`grounding-pill ${isGrounded ? 'grounded' : 'ungrounded'}`}>
                      {isGrounded ? '✓ Grounded (L1-L3)' : '⚠ Model Discovered'}
                    </span>
                    {concern.dimensions.map((d) => (
                      <span key={d} className="tag tag-dim-sub font-mono">
                        {d}
                      </span>
                    ))}
                  </div>
                  <h3 className="finding-title">
                    <span className="finding-num font-mono">#{idx + 1} </span>
                    {concern.title}
                  </h3>
                </div>
              </div>

              <p className="finding-description">{concern.description}</p>

              <div className="impact-callout">
                <div className="impact-label">Why This Applies (Inferred Systems Concern):</div>
                <div className="impact-text">{concern.applicabilityReason}</div>
              </div>

              {hasDetails && (
                <div className="disclosure-section">
                  <button
                    type="button"
                    className="disclosure-trigger"
                    onClick={() => toggleDetail(concern.id)}
                    aria-expanded={isExpanded}
                  >
                    <span>{isExpanded ? '▾ Hide Technical Details' : '▸ View Assumptions & Questions'}</span>
                    {concern.unresolvedQuestions?.length ? (
                      <span className="detail-badge-count">
                        ({concern.unresolvedQuestions.length} open questions)
                      </span>
                    ) : null}
                  </button>

                  {isExpanded && (
                    <div className="disclosure-content">
                      {concern.assumptions && concern.assumptions.length > 0 && (
                        <div className="detail-box">
                          <span className="detail-title">Architectural Assumptions:</span>
                          <ul className="detail-list">
                            {concern.assumptions.map((assump, aIdx) => (
                              <li key={aIdx}>{assump}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {concern.unresolvedQuestions && concern.unresolvedQuestions.length > 0 && (
                        <div className="detail-box">
                          <span className="detail-title">Unresolved Engineering Questions:</span>
                          <ul className="detail-list questions">
                            {concern.unresolvedQuestions.map((q, qIdx) => (
                              <li key={qIdx}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {concern.supportingKnowledgeIds.length > 0 && (
                        <div className="detail-box">
                          <span className="detail-title">Supporting Knowledge IDs:</span>
                          <div className="knowledge-tags">
                            {concern.supportingKnowledgeIds.map((id) => (
                              <span key={id} className="tag tag-knowledge font-mono">
                                {id}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
