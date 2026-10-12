import React, { useState } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Info,
  Check,
  Zap,
  Play,
} from 'lucide-react';
import { AnalysisRunRecord } from '../types';
import { useRuns } from '../store/runs';
import { RiskCard } from '../components/ui/RiskCard';
import { DecisionCard } from '../components/ui/DecisionCard';
import { UserDecisionsView } from '../components/ui/UserDecisionsView';
import { StatusBadge } from '../components/ui/StatusBadge';

interface RunContext {
  run: AnalysisRunRecord;
  onOpenEvidence: () => void;
}

export const ReviewPage: React.FC = () => {
  const { run, onOpenEvidence } = useOutletContext<RunContext>();
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
  const decisions = contract.decisions;

  const criticalCount = concerns.filter((c) => c.confidence >= 0.9).length;
  const highCount = concerns.filter((c) => c.confidence >= 0.8 && c.confidence < 0.9).length;
  const mediumCount = concerns.filter((c) => c.confidence >= 0.65 && c.confidence < 0.8).length;
  const lowCount = concerns.filter((c) => c.confidence < 0.65).length;

  const allQuestions = concerns.flatMap((c) => c.unresolvedQuestions || []);
  const uniqueQuestions = Array.from(new Set(allQuestions));
  const hasUnansweredQuestions = uniqueQuestions.some((q) => !run.userAnswers?.[q]);

  // Overall readiness status
  const readiness = hasUnansweredQuestions
    ? 'NEEDS_INPUT'
    : criticalCount > 0
    ? 'HIGH_RISK'
    : 'READY_TO_BUILD';

  return (
    <div className="review-page-layout">
      {/* Human Decision Summary Hero */}
      <section className="review-hero">
        <div className="review-hero-top">
          <span className="review-tag font-mono">Architecture Review</span>
          <div className="readiness-pill-wrapper">
            {readiness === 'READY_TO_BUILD' && (
              <span className="readiness-pill ready font-mono">
                <CheckCircle2 size={13} className="text-success" />
                <span>Ready to build</span>
              </span>
            )}
            {readiness === 'NEEDS_INPUT' && (
              <span className="readiness-pill input font-mono">
                <HelpCircle size={13} className="text-warning" />
                <span>Needs your input</span>
              </span>
            )}
            {readiness === 'HIGH_RISK' && (
              <span className="readiness-pill risk font-mono">
                <ShieldAlert size={13} className="text-danger" />
                <span>High engineering risk</span>
              </span>
            )}
          </div>
        </div>

        <h1 className="review-title">
          {concerns.length} engineering {concerns.length === 1 ? 'risk' : 'risks'} identified
        </h1>

        <p className="review-executive-summary">
          ArchitectAI analyzed your requirement across universal engineering dimensions (concurrency, bounded resources, failure of dependencies, and side effects).
          {criticalCount > 0
            ? ` Found ${criticalCount} critical failure mode(s) that require bounded mitigation before implementation.`
            : ` The engineering architecture is verified and ready for bounded coding agent implementation.`}
        </p>

        <div className="severity-summary-strip font-mono">
          {criticalCount > 0 && <span className="severity-chip critical">{criticalCount} Critical</span>}
          {highCount > 0 && <span className="severity-chip high">{highCount} High</span>}
          {mediumCount > 0 && <span className="severity-chip medium">{mediumCount} Medium</span>}
          {lowCount > 0 && <span className="severity-chip low">{lowCount} Low</span>}
        </div>

        <div className="user-requirement-callout">
          <span className="req-label font-mono">YOUR REQUIREMENT</span>
          <p className="req-text">"{contract.requirement.rawIntent}"</p>
        </div>
      </section>

      {/* Decisions Needed from User (Interactive) */}
      {uniqueQuestions.length > 0 && (
        <UserDecisionsView
          runId={run.id}
          questions={uniqueQuestions}
          userAnswers={run.userAnswers || {}}
        />
      )}

      {/* Discovered Engineering Risks */}
      <section className="findings-section" aria-labelledby="risks-heading">
        <div className="findings-section-header">
          <div className="header-text-group">
            <h2 id="risks-heading" className="section-heading">Discovered Systems Risks</h2>
            <p className="text-secondary">
              Universal failure modes inferred from your intent that were not mentioned in the prompt.
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost font-mono evidence-global-btn"
            onClick={onOpenEvidence}
          >
            <Sparkles size={13} className="icon-brand" />
            <span>Technical Evidence Graph</span>
          </button>
        </div>

        <div className="findings-stack">
          {concerns.map((concern) => (
            <RiskCard
              key={concern.id}
              concern={concern}
              onOpenEvidence={onOpenEvidence}
            />
          ))}
        </div>
      </section>

      {/* Recommended Decisions Summary */}
      {decisions.length > 0 && (
        <section className="review-decisions-section" aria-labelledby="decisions-summary-heading">
          <div className="section-header-row">
            <div>
              <h2 id="decisions-summary-heading" className="section-heading">
                Recommended Architecture Approach ({decisions.length})
              </h2>
              <p className="text-secondary">
                Structural decisions formulated to eliminate the discovered failure modes.
              </p>
            </div>
          </div>

          <div className="decisions-cards-grid">
            {decisions.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
              />
            ))}
          </div>
        </section>
      )}

      {/* Ready-to-Build Gate */}
      <section className="ready-to-build-banner">
        <div className="gate-text-group">
          <div className="gate-title-row">
            <CheckCircle2 size={18} className="text-success" />
            <h3 className="gate-title">Ready for Bounded Implementation</h3>
          </div>
          <p className="gate-desc">
            ArchitectAI will execute the coding agent inside an isolated Git worktree. Your working branch is protected.
            Independent verification will prove whether the implementation holds up before any code touches your repository.
          </p>
        </div>

        <div className="gate-action-buttons">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(`/runs/${run.id}/architecture`)}
          >
            <span>Continue to Architecture</span>
            <ArrowRight size={15} />
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate(`/runs/${run.id}/implementation`)}
          >
            <Play size={14} />
            <span>Prepare Implementation</span>
          </button>
        </div>
      </section>

      {/* Bottom Sequential Workflow Bar */}
      <div className="review-footer-bar">
        <div className="footer-bar-summary">
          <span>Step 1 of 5 completed</span>
          <span className="font-mono text-muted">• Review risks and proceed to architecture or implementation</span>
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
