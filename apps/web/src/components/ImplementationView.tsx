import React, { useState, useEffect } from 'react';
import {
  EngineeringContract,
  ImplementationPlan,
  RepositoryWorkspace,
} from '@architectai/domain';
import { AgentInfo, PlanExecutionOutput } from '../types.js';

interface ImplementationViewProps {
  contract: EngineeringContract;
}

export function ImplementationView({ contract }: ImplementationViewProps) {
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
    <div className="implementation-view">
      <div className="section-header card">
        <div className="section-label">
          <span className="dot-indicator green"></span>
          <span>Milestone 2 • Engineering Execution</span>
        </div>
        <h2>Automated Task Compilation & Isolated Agent Execution</h2>
        <p className="section-description">
          Compiles this EngineeringContract into bounded, traceable implementation tasks, runs them through an isolated Git worktree with your chosen coding agent, and captures real diffs and native test checks without modifying your active branch.
        </p>
      </div>

      {error && (
        <div className="error-banner card">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      {/* Target Repo & Preparation Setup */}
      <div className="composer-card card">
        <h3 className="composer-heading">1. Target Workspace & Agent Configuration</h3>
        <div className="form-grid">
          <div className="form-group">
            <label className="input-label">Target Git Repository Path:</label>
            <input
              type="text"
              className="text-input font-mono"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="e.g. . or /path/to/repo"
            />
          </div>

          <div className="form-group">
            <label className="input-label">Coding Agent Adapter:</label>
            <select
              className="text-input"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} {agent.available ? `(${agent.version || 'Available'})` : `[Unavailable: ${agent.reason || 'Not Found'}]`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="action-row">
          <button
            type="button"
            className="btn-primary"
            onClick={handleCompilePlan}
            disabled={isCompiling || isExecuting}
          >
            {isCompiling ? 'Compiling Tasks...' : 'Prepare Implementation Plan'}
          </button>
        </div>

        {workspace && (
          <div className="workspace-signals-card" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Detected Workspace Signals:</h4>
            <div className="summary-meta-grid">
              <div className="meta-item">
                <span className="meta-key">Branch:</span>
                <span className="meta-val font-mono">{workspace.currentBranch}</span>
              </div>
              <div className="meta-item">
                <span className="meta-key">HEAD Commit:</span>
                <span className="meta-val font-mono">{workspace.headCommit.slice(0, 8)}</span>
              </div>
              <div className="meta-item">
                <span className="meta-key">Status:</span>
                <span className="meta-val font-mono">{workspace.isClean ? 'Clean Working Tree' : 'Dirty Working Tree'}</span>
              </div>
              <div className="meta-item">
                <span className="meta-key">Languages:</span>
                <span className="meta-val">{workspace.detectedLanguages.join(', ') || 'General'}</span>
              </div>
              <div className="meta-item">
                <span className="meta-key">Frameworks:</span>
                <span className="meta-val">{workspace.detectedFrameworks.join(', ') || 'Standard Library'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Implementation Plan View */}
      {plan && (
        <div className="plan-section card">
          <div className="section-label">
            <span className="dot-indicator green"></span>
            <span>2. Bounded Implementation Plan ({plan.tasks.length} Tasks)</span>
          </div>
          <h3 style={{ margin: '0.5rem 0 1rem 0' }}>{plan.summary}</h3>

          <div className="tasks-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {plan.tasks.map((task, index) => (
              <div key={task.id} className="task-card" style={{ padding: '1rem', background: 'var(--bg-card-secondary, #1a202c)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge font-mono" style={{ background: '#2563eb', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
                      {task.id}
                    </span>
                    <strong style={{ fontSize: '1rem' }}>{task.title}</strong>
                  </div>
                  <span className={`badge-status font-mono ${task.status}`}>
                    {task.status.toUpperCase()}
                  </span>
                </div>

                <p style={{ margin: '0.5rem 0', color: 'var(--text-secondary)' }}>
                  {task.objective}
                </p>

                <div className="trace-row" style={{ fontSize: '0.8rem', color: '#93c5fd', margin: '0.5rem 0' }}>
                  <strong>Traceability: </strong>
                  Concerns: [{task.sourceConcernIds.join(', ') || 'None'}] •
                  Decisions: [{task.sourceDecisionIds.join(', ') || 'None'}] •
                  Invariants: [{task.sourceInvariantIds.join(', ') || 'None'}]
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>Allowed Files:</span>
                    <ul style={{ margin: '0.2rem 0', paddingLeft: '1.2rem' }}>
                      {task.allowedFiles.map((f, i) => (
                        <li key={i} className="font-mono">{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>Excluded Files:</span>
                    <ul style={{ margin: '0.2rem 0', paddingLeft: '1.2rem' }}>
                      {task.excludedFiles.map((f, i) => (
                        <li key={i} className="font-mono">{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  <strong>Acceptance Criteria:</strong>
                  <ul style={{ margin: '0.2rem 0', paddingLeft: '1.2rem' }}>
                    {task.acceptanceCriteria.map((ac, i) => (
                      <li key={i}>{ac}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* User Approval Gate */}
          <div className="approval-gate card" style={{ marginTop: '1.5rem', background: '#0f172a', border: '1px solid #3b82f6', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#60a5fa' }}>🔒 User Approval Gate</h4>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#cbd5e1' }}>
              Execution will occur in an isolated Git worktree on dedicated branch: <code className="font-mono">architectai/run-xxx</code>. Your current branch (<code className="font-mono">{workspace?.currentBranch || 'main'}</code>) will NOT be modified. Automatic merge and push to remote are disabled.
            </p>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
              <input
                type="checkbox"
                checked={userApproved}
                onChange={(e) => setUserApproved(e.target.checked)}
              />
              <span style={{ fontWeight: 500 }}>I approve running the coding agent adapter on the isolated worktree</span>
            </label>

            <button
              type="button"
              className="btn-primary"
              onClick={handleExecutePlan}
              disabled={!userApproved || isExecuting}
              style={{ background: userApproved ? '#16a34a' : undefined }}
            >
              {isExecuting ? 'Executing Tasks in Isolated Worktree...' : 'Approve & Execute Implementation'}
            </button>
          </div>
        </div>
      )}

      {/* Execution Results View */}
      {executionOutput && (
        <div className="execution-output-section card" style={{ marginTop: '1.5rem' }}>
          <div className="section-label">
            <span className="dot-indicator green"></span>
            <span>3. Execution Results & Git Diff</span>
          </div>

          <div className="summary-meta-grid" style={{ margin: '1rem 0' }}>
            <div className="meta-item">
              <span className="meta-key">Isolated Branch:</span>
              <span className="meta-val font-mono">{executionOutput.isolatedBranch}</span>
            </div>
            <div className="meta-item">
              <span className="meta-key">Original Branch:</span>
              <span className="meta-val font-mono">
                {executionOutput.originalBranch} {executionOutput.originalBranchUntouched ? '✓ (UNTOUCHED)' : '⚠️ MODIFIED'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-key">Agent Used:</span>
              <span className="meta-val">{executionOutput.agentName}</span>
            </div>
            <div className="meta-item">
              <span className="meta-key">Task Status:</span>
              <span className="meta-val badge-status">
                {executionOutput.allTasksCompleted ? 'ALL COMPLETED' : 'PARTIAL / FAILED'}
              </span>
            </div>
          </div>

          {/* Changed Files */}
          <div style={{ margin: '1rem 0' }}>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>Changed Files ({executionOutput.diffReport.changedFiles.length}):</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {executionOutput.diffReport.changedFiles.map((f, i) => (
                <span key={i} className="font-mono badge" style={{ background: '#334155', color: '#f8fafc', padding: '4px 8px', borderRadius: '4px' }}>
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Execution Checks (Build / Test) */}
          {executionOutput.executionChecks.length > 0 && (
            <div style={{ margin: '1rem 0' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Native Repository Checks:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {executionOutput.executionChecks.map((check, i) => (
                  <div key={i} style={{ padding: '0.75rem', background: check.passed ? '#064e3b' : '#7f1d1d', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="font-mono" style={{ fontWeight: 600 }}>{check.command}</span>
                      <span>{check.passed ? '✓ PASSED' : '× FAILED'} ({check.durationMs}ms)</span>
                    </div>
                    {check.stdout && (
                      <pre className="font-mono" style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
                        {check.stdout}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw Git Diff */}
          <div style={{ margin: '1.5rem 0 0 0' }}>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>Git Diff:</h4>
            <pre
              className="font-mono"
              style={{
                background: '#020617',
                color: '#e2e8f0',
                padding: '1rem',
                borderRadius: '6px',
                overflowX: 'auto',
                fontSize: '0.85rem',
                maxHeight: '400px',
              }}
            >
              {executionOutput.diffReport.diff || 'No textual diff (files staged / clean)'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
