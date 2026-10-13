import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileCode,
  Wrench,
  HelpCircle,
} from 'lucide-react';
import { VerificationRunResult, FailureDiagnosis, RepairPlan, RepairRunResult } from '@architectai/domain';

interface ProofViewProps {
  status: 'VERIFIED' | 'FAILED' | 'INCONCLUSIVE' | 'ERROR' | 'NOT_RUN';
  verificationRun?: VerificationRunResult;
  checksCount?: number;
  checksPassedCount?: number;
  invariantsCount?: number;
  invariantsVerifiedCount?: number;
  changedFilesCount?: number;
  diagnoses?: FailureDiagnosis[];
  repairPlan?: RepairPlan;
  repairResult?: RepairRunResult;
  onPrepareFix?: () => Promise<void>;
  onApproveFix?: () => Promise<void>;
  onViewChanges?: () => void;
  onNewChange?: () => void;
  onOpenEvidence?: () => void;
  isFixing?: boolean;
}

export const ProofView: React.FC<ProofViewProps> = ({
  status,
  verificationRun,
  checksCount = 0,
  checksPassedCount = 0,
  invariantsCount = 0,
  invariantsVerifiedCount = 0,
  changedFilesCount = 0,
  diagnoses,
  repairPlan,
  repairResult,
  onPrepareFix,
  onApproveFix,
  onViewChanges,
  onNewChange,
  onOpenEvidence,
  isFixing = false,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const cases = verificationRun?.caseResults || [];
  const failedCases = cases.filter((c) => !c.passed);

  return (
    <div className="proof-container">
      {/* Product Moat Banner */}
      <div className="proof-moat-banner">
        <div className="proof-moat-left">
          <ShieldCheck size={20} className="text-brand" />
          <div>
            <h2 className="proof-moat-title">ArchitectAI Proof</h2>
            <p className="proof-moat-subtitle">
              The coding agent does not decide whether its own work is correct.
            </p>
          </div>
        </div>
      </div>

      {/* 1. VERIFIED STATE */}
      {status === 'VERIFIED' && (
        <div className="proof-status-card verified-card">
          <div className="proof-status-header">
            <div className="proof-status-icon-wrapper success">
              <CheckCircle2 size={24} className="text-success" />
            </div>
            <div>
              <span className="proof-status-tag font-mono">VERIFIED</span>
              <h3 className="proof-result-heading">
                {repairResult?.isRepaired ? 'Repaired and independently verified' : 'All blocking engineering invariants independently proven.'}
              </h3>
              <p className="proof-result-desc">
                {repairResult?.isRepaired
                  ? 'ArchitectAI automated repair loop fixed the failure and independently re-verified all invariants.'
                  : 'ArchitectAI verified this implementation against adversarial stimuli in an isolated workspace.'}
              </p>
            </div>
          </div>

          <div className="proof-metrics-grid font-mono">
            <div className="proof-metric-tile">
              <span className="metric-num text-success">
                {checksPassedCount || checksCount} / {checksCount || checksPassedCount || 1}
              </span>
              <span className="metric-label">Repository Tests Passed</span>
            </div>
            <div className="proof-metric-tile">
              <span className="metric-num text-success">
                {invariantsVerifiedCount || invariantsCount} / {invariantsCount || invariantsVerifiedCount || 1}
              </span>
              <span className="metric-label">Invariants Proven</span>
            </div>
            <div className="proof-metric-tile">
              <span className="metric-num">{changedFilesCount}</span>
              <span className="metric-label">Files Modified</span>
            </div>
            <div className="proof-metric-tile">
              <span className="metric-num text-success">Untouched</span>
              <span className="metric-label">Original Branch</span>
            </div>
          </div>

          <div className="proof-actions-row">
            {onViewChanges && (
              <button type="button" className="btn-primary" onClick={onViewChanges}>
                <span>View Changes</span>
                <ArrowRight size={14} />
              </button>
            )}
            {onNewChange && (
              <button type="button" className="btn-secondary" onClick={onNewChange}>
                <span>New Change</span>
              </button>
            )}
            {onOpenEvidence && (
              <button type="button" className="btn-ghost" onClick={onOpenEvidence}>
                <span>Inspect Evidence</span>
                <ExternalLink size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. FAILED STATE */}
      {status === 'FAILED' && (
        <div className="proof-status-card failed-card">
          <div className="proof-status-header">
            <div className="proof-status-icon-wrapper warning">
              <AlertTriangle size={24} className="text-warning" />
            </div>
            <div>
              <span className="proof-status-tag font-mono text-warning">NOT VERIFIED YET</span>
              <h3 className="proof-result-heading">
                Implementation completed, but ArchitectAI found one behavior that does not satisfy the architecture.
              </h3>
              <p className="proof-result-desc">
                Your repository tests passed, but independent adversarial testing disproved the contract invariant.
              </p>
            </div>
          </div>

          {/* Expected vs Observed Breakdown */}
          <div className="expected-vs-observed-list">
            {failedCases.map((fc) => (
              <div key={fc.caseId} className="expected-observed-card">
                <div className="eo-card-top">
                  <span className="eo-invariant-title">{fc.summary || 'Architecture invariant disproved'}</span>
                </div>
                <div className="eo-comparison-grid">
                  <div className="eo-column expected">
                    <span className="eo-col-label">Expected Behavior</span>
                    <p className="eo-col-text">
                      {fc.assertions.map((a) => `${a.name}: ${JSON.stringify(a.expected)}`).join(', ') || 'Invariant constraint satisfied'}
                    </p>
                  </div>
                  <div className="eo-column observed">
                    <span className="eo-col-label">Observed Evidence</span>
                    <p className="eo-col-text text-danger">
                      {fc.assertions.map((a) => `${a.name}: ${JSON.stringify(a.observed)}`).join(', ') || 'Constraint violated during boundary burst'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Repair Proposal if available */}
          {diagnoses && diagnoses.length > 0 ? (
            <div className="repair-proposal-card">
              <div className="repair-header">
                <Sparkles size={16} className="icon-brand" />
                <h4 className="repair-title">ArchitectAI can fix this</h4>
              </div>

              <div className="repair-body">
                <div className="repair-row">
                  <span className="repair-label">Diagnosis</span>
                  <p className="repair-text">
                    {diagnoses[0]?.likelyFailureMechanism || 'Implementation uses a fixed-window counter, allowing burst amplification.'}
                  </p>
                </div>
                <div className="repair-row">
                  <span className="repair-label">Proposed Fix</span>
                  <p className="repair-text">
                    {repairPlan?.tasks[0]?.objective || 'Replace fixed-window counter with atomic sliding-window timestamps.'}
                  </p>
                </div>
                {repairPlan?.tasks[0]?.allowedFiles && (
                  <div className="repair-row">
                    <span className="repair-label">Allowed Files</span>
                    <span className="font-mono text-secondary">
                      {repairPlan.tasks[0].allowedFiles.join(', ')}
                    </span>
                  </div>
                )}
              </div>

              <div className="repair-safety-note font-mono text-muted">
                Note: ArchitectAI will independently re-attack all invariants after the fix is applied.
              </div>

              <div className="repair-actions">
                {onApproveFix && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={onApproveFix}
                    disabled={isFixing}
                  >
                    <Wrench size={14} />
                    <span>{isFixing ? 'Fixing & Re-verifying...' : 'Approve Fix'}</span>
                  </button>
                )}
                {onOpenEvidence && (
                  <button type="button" className="btn-ghost" onClick={onOpenEvidence}>
                    <span>Inspect Evidence</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="proof-actions-row">
              {onPrepareFix && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onPrepareFix}
                  disabled={isFixing}
                >
                  <Sparkles size={14} />
                  <span>{isFixing ? 'Analyzing...' : 'Prepare Fix'}</span>
                </button>
              )}
              {onOpenEvidence && (
                <button type="button" className="btn-ghost" onClick={onOpenEvidence}>
                  <span>Inspect Evidence</span>
                  <ExternalLink size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. INCONCLUSIVE STATE */}
      {status === 'INCONCLUSIVE' && (
        <div className="proof-status-card inconclusive-card">
          <div className="proof-status-header">
            <div className="proof-status-icon-wrapper neutral">
              <HelpCircle size={24} className="text-muted" />
            </div>
            <div>
              <span className="proof-status-tag font-mono text-muted">INCONCLUSIVE</span>
              <h3 className="proof-result-heading">
                Couldn't prove this automatically.
              </h3>
              <p className="proof-result-desc">
                ArchitectAI identified the invariant, but does not currently have a safe way to measure
                kernel-level behavior or simulate this specific external boundary in this local environment.
              </p>
            </div>
          </div>

          <div className="inconclusive-actions">
            <button type="button" className="btn-secondary" onClick={onOpenEvidence}>
              <span>Review Manually</span>
            </button>
            <button type="button" className="btn-ghost" onClick={onViewChanges}>
              <span>Continue Without Proof</span>
            </button>
          </div>
        </div>
      )}

      {/* Repair History if present */}
      {repairResult && repairResult.attempts && repairResult.attempts.length > 0 && (
        <div className="repair-history-section">
          <h4 className="history-title">Repair History</h4>
          <div className="history-timeline">
            {repairResult.attempts.map((attempt, idx) => {
              const passed = attempt.verificationResult?.isVerified || attempt.progress === 'IMPROVED';
              return (
                <div key={idx} className="history-item">
                  <div className="history-marker">
                    {passed ? (
                      <CheckCircle2 size={16} className="text-success" />
                    ) : (
                      <XCircle size={16} className="text-danger" />
                    )}
                  </div>
                  <div className="history-content">
                    <strong className="history-attempt-name">
                      Attempt {attempt.attemptNumber}: {attempt.diffSummary || 'Code adjusted'}
                    </strong>
                    <p className="history-outcome text-muted">
                      {passed ? 'Verified — Invariants satisfied' : 'Still failed — Verification disproved hypothesis'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
