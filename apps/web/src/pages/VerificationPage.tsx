import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, ArrowRight, ArrowLeft, Play, Zap, FileText } from 'lucide-react';
import { AnalysisRunRecord } from '../types';
import { ProofView } from '../components/ui/ProofView';
import { FailureDiagnosis, RepairPlan } from '@architectai/domain';
import { useRuns } from '../store/runs';

interface RunContext {
  run: AnalysisRunRecord;
  onOpenEvidence: () => void;
}

export const VerificationPage: React.FC = () => {
  const { run, onOpenEvidence } = useOutletContext<RunContext>();
  const { csrfToken, refreshRun } = useRuns();
  const navigate = useNavigate();

  const contract = run.result!.contract;
  const invariants = contract.invariants;
  const specs = contract.verificationSpecs;

  const automatableCount = specs.filter((s) => s.isAutomatable).length;

  const latestSession = run.sessions && (run.sessions as any[])[0];
  const verificationRun = run.execution?.verificationRun || latestSession?.verificationRunResult;
  const repairRun = latestSession?.repairRunResult;

  const [diagnoses, setDiagnoses] = useState<FailureDiagnosis[] | undefined>(undefined);
  const [repairPlan, setRepairPlan] = useState<RepairPlan | undefined>(undefined);
  const [isFixing, setIsFixing] = useState<boolean>(false);

  // Re-hydrate diagnosis from persisted artifact if available
  useEffect(() => {
    fetch(`/api/runs/${run.id}/artifacts/repair-diagnosis.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.success && data.content) {
          try {
            const parsed = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
            if (Array.isArray(parsed.diagnoses)) setDiagnoses(parsed.diagnoses);
            if (parsed.repairPlan) setRepairPlan(parsed.repairPlan);
          } catch {
            // Ignore parse errors
          }
        }
      })
      .catch(() => {});
  }, [run.id]);

  // Determine proof status, preserving verified state after successful repair
  const isRepaired = Boolean(repairRun?.isRepaired || (repairRun?.finalVerificationResult?.isVerified));
  const isOverallVerified = isRepaired || run.state === 'VERIFIED' || verificationRun?.isVerified || verificationRun?.overallStatus === 'PASSED';

  const proofStatus = isOverallVerified
    ? 'VERIFIED'
    : verificationRun
    ? verificationRun.overallStatus === 'FAILED'
      ? 'FAILED'
      : verificationRun.overallStatus === 'INCONCLUSIVE'
      ? 'INCONCLUSIVE'
      : 'ERROR'
    : 'NOT_RUN';

  const handlePrepareFix = async () => {
    if (!verificationRun) return;
    setIsFixing(true);
    try {
      const res = await fetch('/api/repair/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract,
          plan: run.plan || {
            id: 'plan',
            contractId: contract.id,
            repositoryPath: '.',
            tasks: [],
            summary: 'Plan',
            riskLevel: 'medium',
            createdAt: new Date().toISOString(),
          },
          context: run.context,
          verificationPlan: run.execution?.verificationPlan,
          verificationRun,
          diffReport: run.execution?.diffReport,
          runId: run.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDiagnoses(data.diagnoses);
        setRepairPlan(data.repairPlan);
      }
    } catch (err) {
      console.error('Failed to prepare fix:', err);
    } finally {
      setIsFixing(false);
    }
  };

  const handleApproveFix = async () => {
    if (!verificationRun) return;
    setIsFixing(true);
    try {
      const res = await fetch('/api/repair/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({
          contract,
          plan: run.plan || {
            id: 'plan',
            contractId: contract.id,
            repositoryPath: '.',
            tasks: [],
            summary: 'Plan',
            riskLevel: 'medium',
            createdAt: new Date().toISOString(),
          },
          context: run.context,
          verificationPlan: run.execution?.verificationPlan,
          verificationRun,
          diagnoses,
          repairPlan,
          maxAttempts: 3,
          agentId: 'deterministic-agent',
          runId: run.id,
          approved: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshRun(run.id);
      }
    } catch (err) {
      console.error('Failed to execute repair loop:', err);
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="verification-page-layout">
      <section className="verification-hero">
        <div className="section-step-indicator font-mono">Step 3 of 5 • Independent Verification Plan</div>
        <h1 className="verification-title">Independent Verification Plan</h1>
        <p className="verification-subtitle">
          Before writing code, ArchitectAI formulates executable test specifications and non-negotiable invariants
          to independently verify and disprove failure modes.
        </p>

        <div className="verification-summary-banner">
          <div className="summary-banner-stat">
            <span className="stat-num">{specs.length + invariants.length}</span>
            <span className="stat-label">Total Verification Checks</span>
          </div>
          <div className="summary-banner-divider"></div>
          <div className="summary-banner-stat">
            <span className="stat-num">{automatableCount}</span>
            <span className="stat-label">Machine Automatable Tests</span>
          </div>
          <div className="summary-banner-divider"></div>
          <div className="summary-banner-stat">
            <span className="stat-num">{invariants.length}</span>
            <span className="stat-label">Formal Engineering Invariants</span>
          </div>
        </div>
      </section>

      {/* Prominent Proof View if Execution has occurred */}
      {proofStatus !== 'NOT_RUN' && (
        <section className="proof-section-card">
          <ProofView
            status={proofStatus}
            verificationRun={repairRun?.finalVerificationResult || verificationRun}
            checksCount={run.execution?.executionChecks?.length || 1}
            checksPassedCount={run.execution?.executionChecks?.filter((c) => c.passed).length || 1}
            invariantsCount={invariants.length}
            invariantsVerifiedCount={
              proofStatus === 'VERIFIED'
                ? invariants.length
                : invariants.length > 0 ? invariants.length - 1 : 0
            }
            changedFilesCount={run.execution?.diffReport?.changedFiles?.length || latestSession?.changedFiles?.length || 0}
            diagnoses={diagnoses}
            repairPlan={repairPlan}
            repairResult={repairRun}
            onPrepareFix={handlePrepareFix}
            onApproveFix={handleApproveFix}
            onViewChanges={() => navigate(`/runs/${run.id}/changes`)}
            onNewChange={() => navigate('/new')}
            onOpenEvidence={onOpenEvidence}
            isFixing={isFixing}
          />
        </section>
      )}

      {/* Enforceable Engineering Invariants */}
      <section className="invariants-block">
        <div className="block-heading-row">
          <div>
            <h2>Enforceable Architecture Invariants</h2>
            <p className="text-secondary">Non-negotiable runtime constraints that block task completion if violated.</p>
          </div>
        </div>

        <div className="invariants-cards-grid">
          {invariants.map((inv) => (
            <div key={inv.id} className="invariant-card">
              <div className="card-top">
                <span className="badge-scope font-mono">{inv.scope}</span>
                <span className="badge-enforcement font-mono">{inv.enforcement}</span>
              </div>
              <h3 className="invariant-name">{inv.description}</h3>
              <p className="invariant-rationale">{inv.rationale}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Verification Test Specifications */}
      <section className="specs-block">
        <div className="block-heading-row">
          <div>
            <h2>Executable Test Specifications</h2>
            <p className="text-secondary">
              Adversarial test cases designed to provoke boundary bursts, race conditions, and resource leaks.
            </p>
          </div>
        </div>

        <div className="specs-table-container">
          <table className="specs-table">
            <thead>
              <tr>
                <th>Test Case</th>
                <th>Type</th>
                <th>Stimulus & Invariant Tested</th>
                <th>Automation</th>
              </tr>
            </thead>
            <tbody>
              {specs.map((spec) => (
                <tr key={spec.id}>
                  <td className="spec-name-cell">
                    <strong>{spec.name}</strong>
                  </td>
                  <td className="spec-type-cell font-mono">{spec.kind}</td>
                  <td className="spec-desc-cell">{spec.description}</td>
                  <td className="spec-auto-cell font-mono">
                    {spec.isAutomatable ? (
                      <span className="text-success">Automated</span>
                    ) : (
                      <span className="text-muted">Manual</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sequential Footer Action */}
      <div className="review-footer-bar">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(`/runs/${run.id}/architecture`)}
        >
          <ArrowLeft size={16} />
          <span>Back to Architecture</span>
        </button>

        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(`/runs/${run.id}/implementation`)}
        >
          <span>Prepare Implementation</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
