import React, { useState, useEffect } from 'react';
import {
  EngineeringContract,
  ImplementationPlan,
  RepositoryWorkspace,
} from '@architectai/domain';
import { AgentInfo, PlanExecutionOutput } from '../types';

interface ImplementationViewProps {
  contract: EngineeringContract;
}

export const ImplementationView: React.FC<ImplementationViewProps> = ({ contract }) => {
  const [repoPath, setRepoPath] = useState<string>('.');
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('codex-cli');
  const [workspace, setWorkspace] = useState<RepositoryWorkspace | null>(null);
  const [plan, setPlan] = useState<ImplementationPlan | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [userApproved, setUserApproved] = useState<boolean>(false);
  const [executionOutput, setExecutionOutput] = useState<PlanExecutionOutput | null>(null);
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
      .catch((err) => console.error('Failed to load coding agents:', err));
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Compilation failed.');
    } finally {
      setIsCompiling(false);
    }
  };

  const handleExecutePlan = async () => {
    if (!plan) return;
    if (!userApproved) {
      setError('Explicit user approval is required before modifying any files.');
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
        throw new Error(data.error || 'Execution failed.');
      }

      setExecutionOutput(data.execution);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Execution failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="implementation-container">
      <div className="section-intro">
        <div>
          <h2 className="section-heading">Engineering Execution Cockpit</h2>
          <p className="section-subtext">
            Compiles this Engineering Contract into bounded, traceable implementation tasks, runs them
            through an isolated Git worktree via your chosen coding agent, and captures native diffs
            without touching your working branch.
          </p>
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <span className="error-icon" aria-hidden="true">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      {/* Target Repo & Agent Setup */}
      <div className="surface-card setup-card">
        <h3 className="card-section-title">1. Workspace & Coding Agent Target</h3>
        <div className="setup-fields-grid">
          <div className="field-group">
            <label className="field-label" htmlFor="repo-path">
              Target Git Repository Directory
            </label>
            <input
              id="repo-path"
              type="text"
              className="field-input font-mono"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="e.g. . or /path/to/repo"
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="agent-select">
              Coding Agent Adapter
            </label>
            <select
              id="agent-select"
              className="field-input"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}{' '}
                  {agent.available
                    ? `(${agent.version || 'Available'})`
                    : `[Unavailable: ${agent.reason || 'Not Found'}]`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="setup-actions-bar">
          <button
            type="button"
            className="btn-primary"
            onClick={handleCompilePlan}
            disabled={isCompiling || isExecuting}
          >
            {isCompiling ? (
              <>
                <span className="spinner" aria-hidden="true"></span>
                <span>Compiling Tasks...</span>
              </>
            ) : (
              'Prepare Implementation Plan'
            )}
          </button>
        </div>

        {workspace && (
          <div className="workspace-signals-box">
            <div className="signals-label">Detected Repository Context:</div>
            <div className="signals-grid">
              <div className="signal-item">
                <span className="signal-key">Current Branch:</span>
                <span className="signal-val font-mono">{workspace.currentBranch}</span>
              </div>
              <div className="signal-item">
                <span className="signal-key">HEAD Commit:</span>
                <span className="signal-val font-mono">{workspace.headCommit.slice(0, 8)}</span>
              </div>
              <div className="signal-item">
                <span className="signal-key">Working Tree:</span>
                <span className="signal-val font-mono">
                  {workspace.isClean ? 'Clean Working Tree' : 'Uncommitted Changes Present'}
                </span>
              </div>
              <div className="signal-item">
                <span className="signal-key">Languages:</span>
                <span className="signal-val">
                  {workspace.detectedLanguages.join(', ') || 'General'}
                </span>
              </div>
              <div className="signal-item">
                <span className="signal-key">Frameworks:</span>
                <span className="signal-val">
                  {workspace.detectedFrameworks.join(', ') || 'Standard Library'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Implementation Plan View */}
      {plan && (
        <div className="surface-card plan-card">
          <div className="plan-header">
            <div>
              <div className="sub-section-label">Bounded Implementation Plan</div>
              <h3 className="plan-title">{plan.summary}</h3>
            </div>
            <span className="grounding-count-pill font-mono">
              {plan.tasks.length} Bounded Tasks
            </span>
          </div>

          <div className="tasks-stack">
            {plan.tasks.map((task) => (
              <div key={task.id} className="task-surface">
                <div className="task-header-row">
                  <div className="task-title-group">
                    <span className="task-id font-mono">{task.id}</span>
                    <strong className="task-name">{task.title}</strong>
                  </div>
                  <span className={`task-status-pill font-mono ${task.status}`}>
                    {task.status.toUpperCase()}
                  </span>
                </div>

                <p className="task-objective">{task.objective}</p>

                <div className="task-traceability font-mono">
                  <span>Concerns: [{task.sourceConcernIds.join(', ') || 'None'}]</span>
                  <span> • Decisions: [{task.sourceDecisionIds.join(', ') || 'None'}]</span>
                  <span> • Invariants: [{task.sourceInvariantIds.join(', ') || 'None'}]</span>
                </div>

                <div className="task-boundaries-grid">
                  <div className="boundary-box allowed">
                    <span className="boundary-label">Allowed Files:</span>
                    <ul className="boundary-list font-mono">
                      {task.allowedFiles.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="boundary-box excluded">
                    <span className="boundary-label">Excluded Files:</span>
                    <ul className="boundary-list font-mono">
                      {task.excludedFiles.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="acceptance-box">
                  <span className="acceptance-label">Acceptance Criteria:</span>
                  <ul className="acceptance-list">
                    {task.acceptanceCriteria.map((ac, i) => (
                      <li key={i}>{ac}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* User Approval Gate */}
          <div className="approval-banner">
            <div className="approval-title">🔒 User Approval Gate</div>
            <p className="approval-desc">
              Execution will occur in an isolated Git worktree on dedicated branch:{' '}
              <code className="font-mono">architectai/run-xxx</code>. Your current branch (
              <code className="font-mono">{workspace?.currentBranch || 'main'}</code>) will NOT be
              modified. Automatic merge and push to remote are disabled.
            </p>

            <label className="approval-checkbox-label">
              <input
                type="checkbox"
                checked={userApproved}
                onChange={(e) => setUserApproved(e.target.checked)}
              />
              <span>I approve running the coding agent adapter in the isolated worktree</span>
            </label>

            <button
              type="button"
              className="btn-primary"
              onClick={handleExecutePlan}
              disabled={!userApproved || isExecuting}
              style={{
                background: userApproved ? '#16a34a' : undefined,
                borderColor: userApproved ? '#22c55e' : undefined,
              }}
            >
              {isExecuting ? (
                <>
                  <span className="spinner" aria-hidden="true"></span>
                  <span>Executing Tasks in Isolated Worktree...</span>
                </>
              ) : (
                'Approve & Execute Implementation'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Execution Results & Diff */}
      {executionOutput && (
        <div className="surface-card execution-results-card">
          <div className="results-header">
            <div className="sub-section-label">Execution Results & Verified Git Diff</div>
            <h3 className="results-title">Worktree Run: {executionOutput.runId}</h3>
          </div>

          <div className="execution-meta-grid">
            <div className="meta-item">
              <span className="meta-key">Isolated Branch:</span>
              <span className="meta-val font-mono">{executionOutput.isolatedBranch}</span>
            </div>
            <div className="meta-item">
              <span className="meta-key">Original Branch:</span>
              <span className="meta-val font-mono">
                {executionOutput.originalBranch}{' '}
                {executionOutput.originalBranchUntouched ? '✓ (UNTOUCHED)' : '⚠️ MODIFIED'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-key">Coding Agent:</span>
              <span className="meta-val">{executionOutput.agentName}</span>
            </div>
            <div className="meta-item">
              <span className="meta-key">Completion Status:</span>
              <span
                className={`status-pill ${
                  executionOutput.allTasksCompleted ? 'grounded' : 'critical'
                }`}
              >
                {executionOutput.allTasksCompleted ? 'ALL COMPLETED' : 'PARTIAL / FAILED'}
              </span>
            </div>
          </div>

          {/* Changed Files */}
          <div className="changed-files-box">
            <div className="changed-label">
              Changed Files ({executionOutput.diffReport.changedFiles.length}):
            </div>
            <div className="changed-tags">
              {executionOutput.diffReport.changedFiles.map((f, i) => (
                <span key={i} className="tag tag-knowledge font-mono">
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Native Repository Checks */}
          {executionOutput.executionChecks.length > 0 && (
            <div className="checks-box">
              <div className="checks-label">Native Repository Test & Build Checks:</div>
              <div className="checks-stack">
                {executionOutput.executionChecks.map((check, i) => (
                  <div
                    key={i}
                    className={`check-item ${check.passed ? 'passed' : 'failed'}`}
                  >
                    <div className="check-title-row font-mono">
                      <span>{check.command}</span>
                      <span>
                        {check.passed ? '✓ PASSED' : '× FAILED'} ({check.durationMs}ms)
                      </span>
                    </div>
                    {check.stdout && (
                      <pre className="check-output font-mono">{check.stdout}</pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Git Diff */}
          <div className="diff-section">
            <div className="diff-label">Git Unified Diff:</div>
            <pre className="diff-box font-mono">
              {executionOutput.diffReport.diff || 'No textual diff (files staged / clean)'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
