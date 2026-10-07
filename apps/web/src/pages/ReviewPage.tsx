import React from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Info,
} from 'lucide-react';
import { AnalysisRunRecord } from '../types';
import { ConcernCandidate } from '@architectai/domain';
import { useRuns } from '../store/runs';

interface RunContext {
  run: AnalysisRunRecord;
  onOpenEvidence: () => void;
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

function getRecommendation(concern: ConcernCandidate): string {
  const t = concern.title.toLowerCase();
  if (t.includes('rate') || t.includes('burst') || t.includes('window')) {
    return 'Implement an atomic sliding window counter with a shared memory store and local token-bucket buffering.';
  }
  if (t.includes('refresh') || t.includes('token') || t.includes('race')) {
    return 'Use a single in-flight refresh promise with synchronized queued replay for all pending requests.';
  }
  if (t.includes('memory') || t.includes('buffer') || t.includes('exhaustion') || t.includes('stream')) {
    return 'Enforce stream-level backpressure (highWaterMark) and cap concurrent worker tasks with a bounded buffer.';
  }
  if (t.includes('pool') || t.includes('connection')) {
    return 'Configure connection pool acquisition timeouts, query cancellation, and circuit breaking for tail queries.';
  }
  if (t.includes('idempot') || t.includes('payment') || t.includes('duplicate')) {
    return 'Generate unique idempotency keys per operation and enforce transactional deduplication before charging.';
  }
  return 'Establish an explicit bounded queue, transactional isolation, and independent verification tests.';
}

export const ReviewPage: React.FC = () => {
  const { run, onOpenEvidence } = useOutletContext<RunContext>();
  const { recordQuestionAnswer } = useRuns();
  const navigate = useNavigate();
  if (!run.result || !run.result.contract) {
    return (
      <div className="review-page-layout">
        <section className="review-hero">
          <div className="review-hero-top">
            <span className="review-tag font-mono">Architecture Review</span>
          </div>
          <h1 className="review-title">Loading architecture findings...</h1>
        </section>
      </div>
    );
  }

  const contract = run.result.contract;
  const concerns = contract.discoveredConcerns;

  const criticalCount = concerns.filter((c) => c.confidence >= 0.9).length;
  const highCount = concerns.filter((c) => c.confidence >= 0.8 && c.confidence < 0.9).length;
  const mediumCount = concerns.filter((c) => c.confidence >= 0.65 && c.confidence < 0.8).length;
  const lowCount = concerns.filter((c) => c.confidence < 0.65).length;

  const allQuestions = concerns.flatMap((c) => c.unresolvedQuestions || []);
  const uniqueQuestions = Array.from(new Set(allQuestions));

  return (
    <div className="review-page-layout">
      {/* Human Decision Summary Hero */}
      <section className="review-hero">
        <div className="review-hero-top">
          <span className="review-tag font-mono">Architecture Review</span>
        </div>
        <h1 className="review-title">
          {concerns.length} engineering {concerns.length === 1 ? 'risk' : 'risks'} identified
        </h1>

        <div className="severity-summary-strip font-mono">
          {criticalCount > 0 && <span className="severity-chip critical">{criticalCount} Critical</span>}
          {highCount > 0 && <span className="severity-chip high">{highCount} High</span>}
          {mediumCount > 0 && <span className="severity-chip medium">{mediumCount} Medium</span>}
          {lowCount > 0 && <span className="severity-chip low">{lowCount} Low</span>}
        </div>

        <div className="user-requirement-callout">
          <span className="req-label">Your requirement</span>
          <p className="req-text">"{contract.requirement.rawIntent}"</p>
        </div>
      </section>

      {/* Unresolved Questions Section if available */}
      {uniqueQuestions.length > 0 && (
        <section className="interactive-questions-section">
          <div className="questions-header">
            <HelpCircle size={18} className="icon-warning" />
            <div>
              <h3>ArchitectAI needs {uniqueQuestions.length} {uniqueQuestions.length === 1 ? 'detail' : 'details'} to refine choices</h3>
              <p className="text-secondary">Your answers eliminate assumptions and adjust verification requirements.</p>
            </div>
          </div>

          <div className="questions-grid">
            {uniqueQuestions.map((q, idx) => {
              const currentAnswer = run.userAnswers?.[q];
              return (
                <div key={idx} className="question-item-card">
                  <p className="question-text">{q}</p>
                  <div className="question-options-row">
                    {['Yes', 'No', "I'm not sure"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`btn-choice ${currentAnswer === option ? 'selected' : ''}`}
                        onClick={() => recordQuestionAnswer(run.id, q, option)}
                      >
                        {currentAnswer === option && <CheckCircle2 size={13} className="icon-success" />}
                        <span>{option}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Findings Ranked by Importance */}
      <section className="findings-section">
        <div className="findings-section-header">
          <h2>Discovered Systems Risks</h2>
          <p>
            Universal engineering concerns inferred from your requirements that were not explicitly mentioned.
          </p>
        </div>

        <div className="findings-stack">
          {concerns.map((concern, idx) => {
            const severity = getSeverity(concern);
            const recommendation = getRecommendation(concern);
            const isGrounded = concern.groundingStatus !== 'ungrounded_model_discovery';

            return (
              <div key={concern.id} className="finding-row-card">
                <div className="finding-row-header">
                  <div className="finding-badge-group">
                    <span className={`severity-tag ${severity.level}`}>
                      {severity.label}
                    </span>
                    <span className="confidence-tag font-mono">
                      {Math.round(concern.confidence * 100)}% Confidence
                    </span>
                    <span className={`grounded-tag ${isGrounded ? 'grounded' : 'ungrounded'}`}>
                      {isGrounded ? '✓ Grounded' : 'Model Discovered'}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn-link-evidence font-mono"
                    onClick={onOpenEvidence}
                    title="Open technical causal trail"
                  >
                    <span>[Why ArchitectAI found this]</span>
                    <ExternalLink size={12} />
                  </button>
                </div>

                <h3 className="finding-title">{concern.title}</h3>
                <p className="finding-explanation">{concern.description}</p>

                {/* Plain-Language Consequence / Impact */}
                <div className="finding-impact-callout">
                  <span className="callout-label">Impact</span>
                  <p className="callout-body">{concern.applicabilityReason}</p>
                </div>

                {/* Recommended Direction */}
                <div className="finding-recommendation-callout">
                  <span className="callout-label">Recommended direction</span>
                  <p className="callout-body">{recommendation}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom Sequential Workflow Action */}
      <div className="review-footer-bar">
        <div className="footer-bar-summary">
          <span>Step 1 of 4 completed</span>
          <span className="font-mono text-muted">• Proceed to review concrete architecture choices</span>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(`/runs/${run.id}/architecture`)}
        >
          <span>Continue to Architecture</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
