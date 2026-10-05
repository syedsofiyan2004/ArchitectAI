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
  GitBranch,
  Terminal,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { AnalysisRunRecord, AgentInfo, PlanExecutionOutput } from '../types';
import { ImplementationPlan, RepositoryWorkspace, ImplementationTask } from '@architectai/domain';
import { useRuns } from '../store/runs';

interface RunContext {
  run: AnalysisRunRecord;
  onOpenEvidence: () => void;
}

export const ImplementationPage: React.FC = () => {
  const { run } = useOutletContext<RunContext>();
  const { updateRun } = useRuns();
  const navigate = useNavigate();

  const contract = run.result!.contract;

  // Local state initialized from run if present
  const [repoPath, setRepoPath] = useState<string>('.');
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('codex-cli');
  const [workspace, setWorkspace] = useState<RepositoryWorkspace | null>(run.workspace || null);
  const [plan, setPlan] = useState<ImplementationPlan | null>(run.plan || null);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number>(0);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [userApproved, setUserApproved] = useState<boolean>(false);
  const [executionOutput, setExecutionOutput] = useState<PlanExecutionOutput | null>(run.execution || null);
  const [error, setError] = useState<string | null>(null);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract, repoPath }),
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          agentId: selectedAgentId,
          approved: true,
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
