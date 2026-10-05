import React from 'react';
import { ConcernCandidate, EngineeringDimension } from '@architectai/domain';

interface UnknownUnknownsViewProps {
  concerns: ConcernCandidate[];
  dimensionsDetected: EngineeringDimension[];
}

export const UnknownUnknownsView: React.FC<UnknownUnknownsViewProps> = ({
  concerns,
  dimensionsDetected,
}) => {
  if (concerns.length === 0) {
    return (
      <div className="empty-state card">
        <p>No unknown-unknowns discovered yet. Submit a requirement to run discovery.</p>
      </div>
    );
  }

  return (
    <div className="unknowns-view">
      <div className="section-intro">
        <div>
          <h2 className="section-heading">Unknown-Unknown Engineering Concerns</h2>
          <p className="section-subtext">
            Concerns inferred from systems principles that were not explicitly mentioned in the input prompt.
          </p>
        </div>
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
      </div>

      <div className="concerns-grid">
        {concerns.map((concern, idx) => (
          <div key={concern.id} className="concern-card card">
            <div className="concern-header">
              <div className="concern-index font-mono">#{idx + 1}</div>
              <div className="concern-main-info">
                <h3 className="concern-title">{concern.title}</h3>
                <div className="concern-meta">
                  <span className="confidence-pill font-mono">
                    {Math.round(concern.confidence * 100)}% Confidence
                  </span>
                  <div className="tag-group">
                    {concern.dimensions.map((d) => (
                      <span key={d} className="tag tag-dim-sub font-mono">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="concern-desc">{concern.description}</p>

            <div className="concern-callout">
              <span className="callout-label">Why This Applies (Inferred Concern):</span>
              <p className="callout-text">{concern.applicabilityReason}</p>
            </div>

            <div className="concern-details-grid">
              {concern.assumptions && concern.assumptions.length > 0 && (
                <div className="detail-box">
                  <span className="detail-title">Inherent Assumptions:</span>
                  <ul className="detail-list">
                    {concern.assumptions.map((assump, aIdx) => (
                      <li key={aIdx}>{assump}</li>
                    ))}
                  </ul>
                </div>
              )}

              {concern.unresolvedQuestions && concern.unresolvedQuestions.length > 0 && (
                <div className="detail-box">
                  <span className="detail-title">Unresolved Systems Questions:</span>
                  <ul className="detail-list questions">
                    {concern.unresolvedQuestions.map((q, qIdx) => (
                      <li key={qIdx}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {concern.groundingStatus === 'ungrounded_model_discovery' ? (
              <div className="supporting-knowledge ungrounded">
                <span className="badge-ungrounded font-mono">
                  ⚠ Model-discovered — authoritative grounding not yet available
                </span>
              </div>
            ) : concern.supportingKnowledgeIds.length > 0 ? (
              <div className="supporting-knowledge">
                <span className="knowledge-label">Grounded In Knowledge IDs:</span>
                <div className="knowledge-tags">
                  {concern.supportingKnowledgeIds.map((id) => (
                    <span key={id} className="tag tag-knowledge font-mono">
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};
