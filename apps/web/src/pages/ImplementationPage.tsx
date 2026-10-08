import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  Lock,
  Play,
  CheckCircle2,
  XCircle,
  FileCode,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  GitBranch,
  Terminal,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Code,
  Wrench,
} from 'lucide-react';
import {
  AnalysisRunRecord,
  AgentInfo,
  PlanExecutionOutput,
  FailureDiagnosis,
  RepairPlan,
  RepairRunResult,
} from '../types';
import { ImplementationPlan, RepositoryWorkspace, ImplementationTask } from '@architectai/domain';
import { useRuns } from '../store/runs';

interface RunContext {
  run: AnalysisRunRecord;
  onOpenEvidence: () => void;
}

export const ImplementationPage: React.FC = () => {
  const { run } = useOutletContext<RunContext>();
  const { updateRun, csrfToken, activeRepository } = useRuns();
  const navigate = useNavigate();

  const contract = run.result!.contract;

  // Local state initialized from run if present
  const [repoPath, setRepoPath] = useState<string>(activeRepository?.canonicalLocalPath || run.workspace?.repositoryPath || '.');
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('codex-cli');
  const [workspace, setWorkspace] = useState<RepositoryWorkspace | null>(run.workspace || null);
  const [plan, setPlan] = useState<ImplementationPlan | null>(run.plan || null);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number>(0);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [userApproved, setUserApproved] = useState<boolean>(false);
  const [executionOutput, setExecutionOutput] = useState<PlanExecutionOutput | null>(run.execution || null);
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Milestone 4 Repair Loop states
  const [isDiagnosing, setIsDiagnosing] = useState<boolean>(false);
  const [diagnoses, setDiagnoses] = useState<FailureDiagnosis[] | null>(null);
  const [repairPlan, setRepairPlan] = useState<RepairPlan | null>(null);
  const [repairApproved, setRepairApproved] = useState<boolean>(false);
  const [isRepairing, setIsRepairing] = useState<boolean>(false);
  const [repairResult, setRepairResult] = useState<RepairRunResult | null>(null);
  const [repairStatusMsg, setRepairStatusMsg] = useState<string>('');

  // Hydrate persisted session, verification, and repair history from SQLite
  useEffect(() => {
    if (run.sessions && (run.sessions as any[]).length > 0) {
      const latest = (run.sessions as any[])[0];
      if (latest.repairRunResult && !repairResult) {
        setRepairResult(latest.repairRunResult);
      }
      if (latest.verificationRunResult && !executionOutput) {
        setExecutionOutput({
          runId: run.id,
          plan: plan || {
            id: latest.implementationPlanId || 'plan',
            contractId: contract.id,
            repositoryPath: repoPath,
            tasks: [],
            summary: 'Persisted Implementation Plan',
            riskLevel: 'medium',
            createdAt: latest.createdAt,
          },
          tasksExecuted: latest.changedFiles?.length || 1,
          taskResults: [],
          diffReport: {
            diff: '',
            changedFiles: latest.changedFiles || [],
            insertions: 0,
            deletions: 0,
            filesCount: latest.changedFiles?.length || 0,
          },
          isVerified: latest.repairRunResult?.isRepaired ?? (latest.verificationRunResult?.isVerified || latest.verificationRunResult?.overallStatus === 'PASSED'),
          verificationRun: latest.verificationRunResult,
        });
      }
    }
  }, [run.sessions, repairResult, executionOutput, plan, contract.id, repoPath, run.id]);

  // Load available coding agents
  useEffect(() => {
    fetch('/api/agents')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.agents) {
          setAgents(data.agents);
          const defaultAgent = data.agents.find((a: AgentInfo) => a.available) || data.agents[0];
          if (defaultAgent) {
            setSelectedAgentId(defaultAgent.id);
          }
        }
      })
      .catch((err) => console.error('Failed to load agents:', err));
  }, []);

  const handleCompilePlan = async () => {
    setIsCompiling(true);
    setError(null);
    setExecutionOutput(null);

    try {
      const res = await fetch('/api/plan/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({ contract, runId: run.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to compile implementation plan.');
      }

      setPlan(data.plan);
      setWorkspace(data.workspace);
      setSelectedTaskIndex(0);
      updateRun(run.id, {
        plan: data.plan,
        workspace: data.workspace,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Plan compilation failed.');
    } finally {
      setIsCompiling(false);
    }
  };

  const handleExecutePlan = async () => {
    if (!plan) return;
    if (!userApproved) {
      setError('Explicit user approval is required before running the coding agent.');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const res = await fetch('/api/plan/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({
          plan,
          agentId: selectedAgentId,
          approved: true,
          contract,
          context: run.context,
          runId: run.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Agent execution failed.');
      }

      setExecutionOutput(data.execution);
      updateRun(run.id, {
        execution: data.execution,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Execution failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDiagnose = async () => {
    if (!executionOutput?.verificationRun || !executionOutput.verificationPlan || !plan) return;
    setIsDiagnosing(true);
    setError(null);
    try {
      const res = await fetch('/api/repair/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract,
          plan,
          context: run.context,
          verificationPlan: executionOutput.verificationPlan,
          verificationRun: executionOutput.verificationRun,
          diffReport: executionOutput.diffReport,
          runId: executionOutput.runId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to diagnose verification failure.');
      }
      setDiagnoses(data.diagnoses);
      setRepairPlan(data.repairPlan);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Diagnosis failed.');
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleExecuteRepair = async () => {
    if (!repairPlan || !executionOutput?.verificationRun || !executionOutput.verificationPlan || !plan) return;
    setIsRepairing(true);
    setError(null);
    setRepairStatusMsg('Repair attempt 1 of 3: Coding agent modifying implementation in worktree...');

    try {
      const res = await fetch('/api/repair/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({
          contract,
          plan,
          context: run.context,
          verificationPlan: executionOutput.verificationPlan,
          verificationRun: executionOutput.verificationRun,
          diagnoses,
          repairPlan,
          maxAttempts: 3,
          agentId: selectedAgentId,
          runId: run.id,
          approved: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Repair execution failed.');
      }

      setRepairResult(data.repairResult);
      if (data.repairResult.finalVerificationResult) {
        setExecutionOutput((prev) =>
          prev
            ? {
                ...prev,
                verificationRun: data.repairResult.finalVerificationResult,
                isVerified: data.repairResult.isRepaired,
              }
            : null
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Repair loop failed.');
    } finally {
      setIsRepairing(false);
      setRepairStatusMsg('');
    }
  };

  const activeTask: ImplementationTask | undefined = plan?.tasks[selectedTaskIndex];

  return (
    <div className="implementation-page-layout">
      <section className="implementation-hero">
        <div className="section-step-indicator font-mono">Step 4 of 4 • Implementation Workspace</div>
        <h1 className="implementation-title">Implementation Workspace</h1>
        <p className="implementation-subtitle">
          Connect your target Git repository. ArchitectAI translates the contract into bounded tasks,
          safely runs your coding agent in an isolated Git worktree, and captures unified diffs.
        </p>
      </section>

      {error && (
        <div className="error-alert-banner" role="alert">
          <AlertTriangle size={18} className="icon-danger" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Repository & Agent Setup */}
      <section className="setup-section-card">
        <div className="setup-section-header">
          <FolderGit2 size={18} className="icon-brand" />
          <div>
            <h3>1. Target Repository & Coding Agent Adapter</h3>
            <p className="text-secondary">Select your repository path and provider-neutral coding agent adapter.</p>
          </div>
        </div>

        <div className="setup-form-row">
          <div className="setup-input-col">
            <label htmlFor="repo-input">Git Repository Directory</label>
            <input
              id="repo-input"
              type="text"
              className="font-mono"
              placeholder="e.g. . or /path/to/repo"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
            />
          </div>

          <div className="setup-input-col">
            <label htmlFor="agent-input">Coding Agent Adapter</label>
            <select
              id="agent-input"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.available ? `(${a.version || 'Ready'})` : `[Unavailable: ${a.reason || 'Missing'}]`}
                </option>
              ))}
            </select>
          </div>

          <div className="setup-submit-col">
            <button
              type="button"
              className="btn-primary"
              onClick={handleCompilePlan}
              disabled={isCompiling || isExecuting}
            >
              {isCompiling ? 'Compiling Tasks...' : 'Prepare Implementation Plan'}
            </button>
          </div>
        </div>

        {workspace && (
          <div className="workspace-signals-strip">
            <div className="signal-pill">
              <span className="signal-label font-mono">Branch:</span>
              <strong className="font-mono">{workspace.currentBranch}</strong>
            </div>
            <div className="signal-pill">
              <span className="signal-label font-mono">HEAD:</span>
              <span className="font-mono">{workspace.headCommit.slice(0, 8)}</span>
            </div>
            <div className="signal-pill">
              <span className="signal-label font-mono">Working Tree:</span>
              <span className="font-mono">{workspace.isClean ? 'Clean ✓' : 'Dirty Tree'}</span>
            </div>
            <div className="signal-pill">
              <span className="signal-label font-mono">Stack:</span>
              <span>{workspace.detectedLanguages.concat(workspace.detectedFrameworks).join(', ') || 'General'}</span>
            </div>
          </div>
        )}
      </section>

      {/* Step 2: Implementation Tasks Breakdown (Split Review Layout) */}
      {plan && (
        <section className="plan-review-section">
          <div className="plan-review-header">
            <div>
              <h2>2. Bounded Implementation Tasks ({plan.tasks.length})</h2>
              <p className="text-secondary">{plan.summary}</p>
            </div>
          </div>

          <div className="code-review-split-layout">
            {/* Left: Tasks List */}
            <div className="tasks-nav-column">
              <div className="column-label font-mono">TASKS LIST</div>
              <div className="tasks-nav-list">
                {plan.tasks.map((task, idx) => (
                  <button
                    key={task.id}
                    type="button"
                    className={`task-row-btn ${selectedTaskIndex === idx ? 'active' : ''}`}
                    onClick={() => setSelectedTaskIndex(idx)}
                  >
                    <div className="task-row-top">
                      <span className="task-id-badge font-mono">{task.id}</span>
                      <span className={`task-status-tag font-mono ${task.status}`}>
                        {task.status.toUpperCase()}
                      </span>
                    </div>
                    <span className="task-row-title">{task.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Selected Task Inspector */}
            <div className="task-detail-column">
              {activeTask ? (
                <div className="task-inspector-card">
                  <div className="inspector-title-row">
                    <div>
                      <span className="font-mono text-muted">{activeTask.id}</span>
                      <h3>{activeTask.title}</h3>
                    </div>
                  </div>

                  <div className="inspector-objective-box">
                    <span className="box-label font-mono">OBJECTIVE</span>
                    <p>{activeTask.objective}</p>
                  </div>

                  <div className="inspector-files-grid">
                    <div className="files-box allowed">
                      <span className="files-label font-mono">ALLOWED FILES (MUTABLE)</span>
                      <ul className="font-mono">
                        {activeTask.allowedFiles.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="files-box excluded">
                      <span className="files-label font-mono">EXCLUDED FILES (PROTECTED)</span>
                      <ul className="font-mono">
                        {activeTask.excludedFiles.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="inspector-criteria-box">
                    <span className="box-label font-mono">ACCEPTANCE CRITERIA</span>
                    <ul>
                      {activeTask.acceptanceCriteria.map((ac, i) => (
                        <li key={i}>{ac}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="inspector-traceability-bar font-mono">
                    <span>Traceability: Concerns [{activeTask.sourceConcernIds.join(', ') || 'None'}]</span>
                    <span> • Decisions [{activeTask.sourceDecisionIds.join(', ') || 'None'}]</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* User Approval Gate */}
          <div className="approval-gate-card">
            <div className="approval-gate-header">
              <Lock size={18} className="icon-warning" />
              <div>
                <h3>User Approval Gate (Isolated Worktree Execution)</h3>
                <p>
                  ArchitectAI executes coding agents inside an isolated Git worktree on dedicated branch{' '}
                  <code className="font-mono">architectai/run-xxx</code>. Your current working branch (
                  <code className="font-mono">{workspace?.currentBranch || 'main'}</code>) is never modified.
                  Automatic merge to main is disabled.
                </p>
              </div>
            </div>

            <label className="approval-checkbox-control">
              <input
                type="checkbox"
                checked={userApproved}
                onChange={(e) => setUserApproved(e.target.checked)}
              />
              <strong>I approve running the coding agent adapter in the isolated worktree</strong>
            </label>

            <button
              type="button"
              className="btn-execute"
              onClick={handleExecutePlan}
              disabled={!userApproved || isExecuting}
            >
              {isExecuting ? (
                <>
                  <span className="spinner-white" aria-hidden="true"></span>
                  <span>Executing Tasks in Isolated Worktree...</span>
                </>
              ) : (
                <>
                  <Play size={16} />
                  <span>Approve & Execute Implementation</span>
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* Step 3: Execution Output & Git Diff Review */}
      {executionOutput && (
        <section className="execution-output-section">
          <div className="output-section-header">
            <CheckCircle2 size={20} className="icon-success" />
            <div>
              <h2>3. Execution Results & Unified Git Diff</h2>
              <p className="text-secondary">Review changes and native test checks produced by the coding agent.</p>
            </div>
          </div>

          <div className="execution-meta-strip">
            <div className="meta-block">
              <span className="font-mono text-muted">ISOLATED BRANCH</span>
              <strong className="font-mono">{executionOutput.isolatedBranch}</strong>
            </div>
            <div className="meta-block">
              <span className="font-mono text-muted">ORIGINAL BRANCH</span>
              <span className="font-mono text-success">
                {executionOutput.originalBranch} {executionOutput.originalBranchUntouched ? '(UNTOUCHED ✓)' : ''}
              </span>
            </div>
            <div className="meta-block">
              <span className="font-mono text-muted">AGENT</span>
              <span>{executionOutput.agentName}</span>
            </div>
            <div className="meta-block">
              <span className="font-mono text-muted">STATUS</span>
              <span className="badge-done font-mono">
                {executionOutput.allTasksCompleted ? 'ALL COMPLETED' : 'PARTIAL / FAILED'}
              </span>
            </div>
          </div>

          {/* Changed Files */}
          <div className="changed-files-strip">
            <span className="font-mono text-muted">Changed Files ({executionOutput.diffReport.changedFiles.length}):</span>
            <div className="changed-files-pills">
              {executionOutput.diffReport.changedFiles.map((f, i) => (
                <span key={i} className="file-pill font-mono">
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Native Build & Test Checks */}
          {executionOutput.executionChecks.length > 0 && (
            <div className="checks-block">
              <span className="font-mono text-muted">Repository Native Checks:</span>
              <div className="checks-list">
                {executionOutput.executionChecks.map((check, idx) => (
                  <div key={idx} className={`check-card ${check.passed ? 'passed' : 'failed'}`}>
                    <div className="check-card-title-row font-mono">
                      <span>{check.command}</span>
                      <span>{check.passed ? '✓ PASSED' : '× FAILED'} ({check.durationMs}ms)</span>
                    </div>
                    {check.stdout && (
                      <pre className="check-code font-mono">{check.stdout}</pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ArchitectAI Independent Adversarial Verification */}
          {executionOutput.verificationRun && (
            <div className="verification-results-block">
              <div className="verification-header-row">
                <div>
                  <h3 className="verification-block-title">
                    ArchitectAI Independent Adversarial Verification
                  </h3>
                  <p className="text-secondary">
                    Independent post-implementation verification evaluates discovered engineering invariants against the modified worktree under a Trusted Local Execution model.
                  </p>
                </div>
                <div className={`overall-verdict-badge ${executionOutput.verificationRun.overallStatus.toLowerCase()}`}>
                  {executionOutput.verificationRun.overallStatus === 'VERIFIED' && <ShieldCheck size={16} />}
                  {executionOutput.verificationRun.overallStatus === 'FAILED' && <ShieldAlert size={16} />}
                  {executionOutput.verificationRun.overallStatus === 'INCONCLUSIVE' && <HelpCircle size={16} />}
                  {executionOutput.verificationRun.overallStatus === 'ERROR' && <ShieldX size={16} />}
                  <span className="font-mono font-bold">
                    {executionOutput.verificationRun.overallStatus === 'VERIFIED' && 'ARCHITECTAI VERIFIED'}
                    {executionOutput.verificationRun.overallStatus === 'FAILED' && 'VERIFICATION FAILED'}
                    {executionOutput.verificationRun.overallStatus === 'INCONCLUSIVE' && 'VERIFICATION INCONCLUSIVE'}
                    {executionOutput.verificationRun.overallStatus === 'ERROR' && 'VERIFICATION ERROR'}
                  </span>
                </div>
              </div>

              <div className="verification-summary-banner font-mono">
                {executionOutput.verificationRun.summary}
              </div>

              <div className="verification-cases-list">
                {executionOutput.verificationRun.caseResults.map((caseRes) => (
                  <div key={caseRes.caseId} className={`vcase-card ${caseRes.verdict.toLowerCase()}`}>
                    <div className="vcase-header">
                      <div className="vcase-meta">
                        <span className={`verdict-tag font-mono ${caseRes.verdict.toLowerCase()}`}>
                          {caseRes.verdict}
                        </span>
                        <span className="invariant-id-tag font-mono">{caseRes.targetInvariantId}</span>
                        <strong className="vcase-title">{caseRes.caseId}</strong>
                      </div>
                      <span className="vcase-duration font-mono text-muted">{caseRes.durationMs}ms</span>
                    </div>

                    <p className="vcase-summary text-secondary">{caseRes.summary}</p>

                    {caseRes.assertions.length > 0 && (
                      <div className="vcase-assertions-table">
                        <div className="assertion-row-header font-mono">
                          <span>ASSERTION</span>
                          <span>EXPECTED</span>
                          <span>OBSERVED</span>
                          <span>OUTCOME</span>
                        </div>
                        {caseRes.assertions.map((a, i) => (
                          <div key={i} className={`assertion-row font-mono ${a.passed ? 'pass' : 'fail'}`}>
                            <span className="assertion-name">{a.name}</span>
                            <span className="assertion-val">{String(a.expected)}</span>
                            <span className={`assertion-val ${a.passed ? 'text-success' : 'text-danger font-bold'}`}>
                              {String(a.observed)}
                            </span>
                            <span className={`assertion-outcome ${a.passed ? 'badge-pass' : 'badge-fail'}`}>
                              {a.passed ? '✓ PASS' : '✗ FAIL'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {caseRes.artifactContent && (
                      <div className="vcase-inspector-toggle">
                        <button
                          type="button"
                          className="btn-toggle-harness font-mono"
                          onClick={() =>
                            setExpandedCaseId(
                              expandedCaseId === caseRes.caseId ? null : caseRes.caseId
                            )
                          }
                        >
                          <Code size={13} />
                          <span>
                            {expandedCaseId === caseRes.caseId
                              ? 'Hide Verification Harness Artifact'
                              : 'Inspect Generated Test Artifact & Output'}
                          </span>
                          <ChevronDown
                            size={14}
                            className={expandedCaseId === caseRes.caseId ? 'rotate-180' : ''}
                          />
                        </button>
                        {expandedCaseId === caseRes.caseId && (
                          <div className="vcase-inspector-content">
                            <span className="font-mono text-muted text-xs">Generated Verification Harness:</span>
                            <pre className="harness-pre font-mono">{caseRes.artifactContent}</pre>
                            {caseRes.stderr && (
                              <>
                                <span className="font-mono text-muted text-xs text-danger">Process Stderr:</span>
                                <pre className="stderr-pre font-mono text-danger">{caseRes.stderr}</pre>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Milestone 4: Evidence-Driven Autonomous Diagnosis & Repair Section */}
              {executionOutput.verificationRun &&
                executionOutput.verificationRun.overallStatus === 'FAILED' && (
                  <div className="repair-lifecycle-container">
                    <div className="repair-card-header">
                      <Wrench size={18} className="icon-warning" />
                      <div>
                        <h4>Evidence-Driven Autonomous Diagnosis & Repair</h4>
                        <p className="text-secondary text-sm">
                          Independent verification failed on measured software evidence. ArchitectAI can diagnose the root-cause failure mechanism and execute a bounded repair loop without modifying tests or CI.
                        </p>
                      </div>
                    </div>

                    {/* Action: Diagnose & Prepare Repair */}
                    {!diagnoses && !repairResult && (
                      <div className="repair-action-bar">
                        <button
                          type="button"
                          className="btn-diagnose font-mono"
                          onClick={handleDiagnose}
                          disabled={isDiagnosing}
                        >
                          {isDiagnosing ? (
                            <>
                              <span className="spinner-white" aria-hidden="true"></span>
                              <span>Grounding Measured Evidence & Diagnosing...</span>
                            </>
                          ) : (
                            <>
                              <Wrench size={15} />
                              <span>Diagnose & Prepare Repair</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Display Failure Diagnosis & Proposed Bounded Repair */}
                    {diagnoses && diagnoses.length > 0 && !repairResult && (
                      <div className="diagnosis-results-box">
                        <div className="diagnosis-classification-pill font-mono">
                          <span>CLASSIFICATION: {diagnoses[0]?.classification}</span>
                          {diagnoses[0]?.isRepairable ? (
                            <span className="badge-pass">REPAIR ELIGIBLE</span>
                          ) : (
                            <span className="badge-fail">HUMAN REVIEW REQUIRED</span>
                          )}
                        </div>

                        <p className="diagnosis-mechanism">
                          <strong>Root Cause Mechanism:</strong> {diagnoses[0]?.likelyFailureMechanism}
                        </p>

                        {diagnoses[0]?.expectedMetricValue !== undefined && (
                          <div className="diagnosis-evidence-metrics font-mono">
                            <span>Expected: {String(diagnoses[0]?.expectedMetricValue)}</span>
                            <span className="text-danger font-bold">
                              Observed: {String(diagnoses[0]?.observedMetricValue)}
                            </span>
                          </div>
                        )}

                        {repairPlan && repairPlan.tasks.length > 0 && (
                          <div className="repair-proposal-box">
                            <span className="box-label font-mono">PROPOSED BOUNDED REPAIR</span>
                            <p className="repair-objective">{repairPlan.tasks[0]?.objective}</p>
                            <div className="repair-files font-mono">
                              <span>Allowed Files: {repairPlan.tasks[0]?.allowedFiles.join(', ')}</span>
                            </div>

                            {/* User Approval Gate for Repair */}
                            <div className="repair-approval-row">
                              <label className="approval-checkbox-control">
                                <input
                                  type="checkbox"
                                  checked={repairApproved}
                                  onChange={(e) => setRepairApproved(e.target.checked)}
                                />
                                <span>I approve running autonomous repair loop (up to 3 bounded attempts in isolated worktree)</span>
                              </label>

                              <button
                                type="button"
                                className="btn-approve-repair font-mono"
                                onClick={handleExecuteRepair}
                                disabled={!repairApproved || isRepairing}
                              >
                                {isRepairing ? (
                                  <>
                                    <span className="spinner-white" aria-hidden="true"></span>
                                    <span>{repairStatusMsg || 'Executing Repair in Isolated Worktree...'}</span>
                                  </>
                                ) : (
                                  <>
                                    <Play size={14} />
                                    <span>Approve & Execute Repair</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Display Repair Outcome & Attempt History */}
                    {repairResult && (
                      <div className="repair-outcome-container">
                        <div className={`repair-outcome-banner ${repairResult.outcome.toLowerCase()}`}>
                          {repairResult.isRepaired ? (
                            <>
                              <CheckCircle2 size={18} className="icon-success" />
                              <div>
                                <strong>ARCHITECTAI VERIFIED</strong>
                                <p className="text-sm">
                                  Successfully repaired and re-verified in {repairResult.totalAttempts} attempt(s).
                                </p>
                              </div>
                            </>
                          ) : repairResult.outcome === 'ARCHITECTURE_REVIEW_REQUIRED' ? (
                            <>
                              <AlertTriangle size={18} className="icon-warning" />
                              <div>
                                <strong>ARCHITECTURE REVIEW REQUIRED</strong>
                                <p className="text-sm">
                                  {repairResult.escalationReason ||
                                    'Verification failure indicates an architectural decision must be revised.'}
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <XCircle size={18} className="icon-danger" />
                              <div>
                                <strong>NEEDS HUMAN REVIEW</strong>
                                <p className="text-sm">
                                  {repairResult.escalationReason ||
                                    'Maximum repair attempts reached without satisfying all invariants.'}
                                </p>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Repair Attempt History */}
                        <div className="repair-attempts-timeline">
                          <span className="font-mono text-muted text-xs">
                            Repair Attempt History ({repairResult.attempts.length}):
                          </span>
                          {repairResult.attempts.map((att) => (
                            <div key={att.attemptNumber} className={`attempt-item-card ${att.progress.toLowerCase()}`}>
                              <div className="attempt-header-row font-mono">
                                <span>Attempt #{att.attemptNumber}</span>
                                <span className={`progress-badge ${att.progress.toLowerCase()}`}>{att.progress}</span>
                                <span>{att.durationMs}ms</span>
                              </div>
                              <div className="attempt-diff-summary font-mono text-xs">
                                {att.diffSummary}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}

          {/* Diff Box */}
          <div className="diff-viewer-block">
            <div className="diff-viewer-header font-mono">
              <FileCode size={15} />
              <span>Git Unified Diff</span>
            </div>
            <pre className="diff-pre font-mono">
              <code>{executionOutput.diffReport.diff || 'No textual changes (workspace staged / clean)'}</code>
            </pre>
          </div>
        </section>
      )}

      {/* Footer Navigation */}
      <div className="review-footer-bar">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(`/runs/${run.id}/verification`)}
        >
          <ArrowLeft size={16} />
          <span>Back to Verification</span>
        </button>
      </div>
    </div>
  );
};
