import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, ArrowLeft, Layers, AlertTriangle, RefreshCcw } from 'lucide-react';
import { AnalysisRunRecord } from '../types';

interface RunContext {
  run: AnalysisRunRecord;
  onOpenEvidence: () => void;
}

export const ArchitecturePage: React.FC = () => {
  const { run, onOpenEvidence } = useOutletContext<RunContext>();
  const navigate = useNavigate();

  const contract = run.result!.contract;
  const decisions = contract.decisions;

  return (
    <div className="architecture-page-layout">
      <section className="architecture-hero">
        <div className="section-step-indicator font-mono">Step 2 of 4 • Architecture Decisions</div>
        <h1 className="architecture-title">Recommended Architecture</h1>
        <p className="architecture-subtitle">
          Concrete structural decisions designed to resolve discovered engineering risks.
          Each choice carries explicit evaluated trade-offs and reconsideration triggers.
        </p>
      </section>

      <div className="decisions-feed">
        {decisions.map((dec, idx) => {
          const selectedOption = dec.consideredOptions.find((o) => o.id === dec.selectedOptionId);
          const alternativeOptions = dec.consideredOptions.filter((o) => o.id !== dec.selectedOptionId);

          return (
            <div key={dec.id} className="architecture-card">
              <div className="architecture-card-top">
                <span className="decision-counter font-mono">Decision {idx + 1} of {decisions.length}</span>
                <h2 className="architecture-card-title">{dec.problemContext}</h2>
              </div>

              {/* Highlighted Recommended Choice */}
              <div className="recommended-choice-banner">
                <div className="recommended-label-bar">
                  <CheckCircle2 size={16} className="icon-success" />
                  <strong>Recommended Direction</strong>
                </div>
                <h3 className="recommended-choice-name">
                  {selectedOption ? selectedOption.name : dec.selectedOptionName || 'Selected Direction'}
                </h3>
                <p className="recommended-choice-desc">
                  {selectedOption?.description || dec.rationale}
                </p>
              </div>

              {/* Why */}
              <div className="decision-explanation-block">
                <h4 className="block-label">Why ArchitectAI Recommends This</h4>
                <p className="block-text">{dec.rationale}</p>
              </div>

              {/* Alternatives Considered */}
              {alternativeOptions.length > 0 && (
                <div className="decision-alternatives-block">
                  <h4 className="block-label">Alternatives Evaluated</h4>
                  <div className="alternatives-grid">
                    {alternativeOptions.map((alt) => (
                      <div key={alt.id} className="alternative-item">
                        <strong className="alt-name">{alt.name}</strong>
                        <p className="alt-desc">{alt.description}</p>
                        {alt.tradeoffs && (
                          <div className="alt-tradeoff">
                            <span className="tradeoff-tag font-mono">Trade-off:</span>
                            <span>{alt.tradeoffs}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Residual Risks & Trade-offs */}
              {dec.risksAndTradeoffs && dec.risksAndTradeoffs.length > 0 && (
                <div className="decision-risks-block">
                  <h4 className="block-label">Residual Trade-offs</h4>
                  <ul className="bullet-list">
                    {dec.risksAndTradeoffs.map((r, rIdx) => (
                      <li key={rIdx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Reconsideration Triggers */}
              {dec.reconsiderationTriggers && dec.reconsiderationTriggers.length > 0 && (
                <div className="reconsideration-block">
                  <div className="reconsideration-header">
                    <RefreshCcw size={14} className="icon-warning" />
                    <h4 className="block-label">Reconsider This Decision When</h4>
                  </div>
                  <ul className="bullet-list warning-bullets">
                    {dec.reconsiderationTriggers.map((t, tIdx) => (
                      <li key={tIdx}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sequential Footer Action */}
      <div className="review-footer-bar">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(`/runs/${run.id}`)}
        >
          <ArrowLeft size={16} />
          <span>Back to Review</span>
        </button>

        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(`/runs/${run.id}/verification`)}
        >
          <span>Continue to Verification</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
