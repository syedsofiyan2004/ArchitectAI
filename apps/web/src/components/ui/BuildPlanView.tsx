import React, { useState } from 'react';
import {
  FileCode,
  ShieldCheck,
  CheckCircle2,
  FolderGit2,
  Lock,
  Play,
  Terminal,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ImplementationPlan, ImplementationTask } from '@architectai/domain';
import { AgentInfo } from '../../types';

interface BuildPlanViewProps {
  plan: ImplementationPlan;
  repoName: string;
  repoPath: string;
  branchName: string;
  agents: AgentInfo[];
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  onStartBuild: () => Promise<void>;
  isStartingBuild?: boolean;
}

export const BuildPlanView: React.FC<BuildPlanViewProps> = ({
  plan,
  repoName,
  repoPath,
  branchName,
  agents,
  selectedAgentId,
  onSelectAgent,
  onStartBuild,
  isStartingBuild = false,
}) => {
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [acknowledgedSafety, setAcknowledgedSafety] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const codexAgent = agents.find((a) => a.id === 'codex-cli');
  const isCodexUnavailable = codexAgent ? !codexAgent.available : false;

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || {
    id: selectedAgentId,
    name: selectedAgentId === 'codex-cli' ? 'Codex CLI' : 'Deterministic Agent',
    version: '0.158.0',
    available: true,
  };

  const tasks = plan.tasks || [];
  const allAllowedFiles = Array.from(new Set(tasks.flatMap((t) => t.allowedFiles || [])));

  const handleConfirmStart = async () => {
    setShowApprovalModal(false);
    await onStartBuild();
  };

  return (
    <div className="build-plan-container">
      <div className="build-plan-header">
        <div>
          <span className="build-plan-kicker font-mono">Step 4 • Build Plan</span>
          <h2 className="build-plan-title">Implementation Tasks</h2>
          <p className="build-plan-subtitle">
            ArchitectAI prepared {tasks.length} bounded tasks for your coding agent to implement the approved design.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary start-build-cta"
          onClick={() => setShowApprovalModal(true)}
          disabled={isStartingBuild}
        >
          <Play size={15} />
          <span>{isStartingBuild ? 'Starting...' : 'Start Build'}</span>
        </button>
      </div>

      {/* Agent Selection Card per Requirement 6 */}
      <div
        className="plan-agent-select-card"
        style={{
          margin: '16px 0',
          padding: '14px 18px',
          background: 'var(--card-bg, #161b22)',
          border: '1px solid var(--border-color, #30363d)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal size={18} className="text-brand" />
          <div>
            <label htmlFor="plan-agent-select" style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'block' }}>
              Coding Agent Adapter
            </label>
            <p style={{ fontSize: '12px', color: 'var(--text-muted, #8b949e)', margin: '2px 0 0' }}>
              Autonomous coding agent executing changes inside an isolated temporary Git worktree.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <select
            id="plan-agent-select"
            value={selectedAgentId}
            onChange={(e) => onSelectAgent(e.target.value)}
            style={{
              padding: '6px 12px',
              background: 'var(--bg-dark, #0d1117)',
              border: '1px solid var(--border-color, #30363d)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              fontFamily: 'monospace',
            }}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.available}>
                {a.name} {a.available ? (a.version ? `(v${a.version})` : '(Ready)') : `[Unavailable: ${a.reason || 'Missing'}]`}
              </option>
            ))}
          </select>

          {isCodexUnavailable && (
            <span className="text-warning font-mono" style={{ fontSize: '11px' }}>
              Codex CLI not detected in PATH. Using deterministic demo agent.
            </span>
          )}
        </div>
      </div>

      <div className="build-tasks-list">
        {tasks.map((task, idx) => {
          const isExpanded = expandedTaskId === task.id;
          return (
            <div key={task.id} className="build-task-card">
              <div className="task-card-header">
                <div className="task-num-badge font-mono">Task {idx + 1}</div>
                <div className="task-info">
                  <h3 className="task-title">{task.title}</h3>
                  <p className="task-objective">{task.objective}</p>
                </div>
              </div>

              <div className="task-card-files">
                <span className="files-label">Files:</span>
                <div className="files-pills font-mono">
                  {task.allowedFiles?.map((file, fIdx) => (
                    <span key={fIdx} className="file-pill">
                      <FileCode size={12} />
                      {file}
                    </span>
                  ))}
                </div>
              </div>

              <div className="task-card-footer">
                <button
                  type="button"
                  className="btn-ghost task-toggle-details-btn"
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                >
                  <span>Acceptance Criteria</span>
                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {isExpanded && (
                <div className="task-expanded-details">
                  {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
                    <div className="task-details-section">
                      <strong className="details-heading">Acceptance Criteria</strong>
                      <ul className="details-list">
                        {task.acceptanceCriteria.map((c, cIdx) => (
                          <li key={cIdx}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {task.excludedFiles && task.excludedFiles.length > 0 && (
                    <div className="task-details-section">
                      <strong className="details-heading text-danger">Strictly Protected Files</strong>
                      <div className="files-pills font-mono">
                        {task.excludedFiles.map((f, efIdx) => (
                          <span key={efIdx} className="file-pill-excluded">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Execution Approval Modal */}
      {showApprovalModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="approval-title">
          <div className="modal-content approval-modal">
            <div className="modal-header">
              <div className="approval-modal-icon">
                <ShieldCheck size={24} className="text-brand" />
              </div>
              <div>
                <h3 id="approval-title" className="modal-title">
                  ArchitectAI is ready to modify code.
                </h3>
                <p className="modal-subtitle">
                  Review the execution safety parameters before delegating to your coding agent.
                </p>
              </div>
            </div>

            <div className="approval-grid">
              <div className="approval-row">
                <span className="approval-label">Repository</span>
                <span className="approval-value font-mono">{repoName || repoPath}</span>
              </div>
              <div className="approval-row">
                <span className="approval-label">Branch Safety</span>
                <span className="approval-value text-success font-medium">
                  Isolated Git worktree (architectai/*)
                </span>
              </div>
              <div className="approval-row">
                <span className="approval-label">Original Branch</span>
                <span className="approval-value text-success font-medium">
                  {branchName || 'main'} • Will NOT be modified
                </span>
              </div>
              <div className="approval-row">
                <span className="approval-label">Coding Agent</span>
                <span className="approval-value font-mono">
                  {selectedAgent.name} {selectedAgent.version ? `v${selectedAgent.version}` : ''}
                </span>
              </div>
              <div className="approval-row">
                <span className="approval-label">Tasks to Execute</span>
                <span className="approval-value">{tasks.length} bounded tasks</span>
              </div>
              <div className="approval-row">
                <span className="approval-label">Authorized Files</span>
                <span className="approval-value font-mono">{allAllowedFiles.length} file paths</span>
              </div>
              <div className="approval-row">
                <span className="approval-label">Repository Native Checks</span>
                <span className="approval-value font-mono">Pre-snapshotted test & typecheck</span>
              </div>
              <div className="approval-row">
                <span className="approval-label">Independent Proof</span>
                <span className="approval-value text-brand font-medium">
                  Adversarial invariant verification
                </span>
              </div>
            </div>

            <div className="approval-trust-callout">
              <Lock size={15} className="text-muted" />
              <p>
                The coding agent operates strictly inside a temporary Git worktree. Your working tree and Git HEAD
                remain untouched until you review and merge the verified diff.
              </p>
            </div>

            <div className="approval-checkbox-row">
              <label className="approval-checkbox-label">
                <input
                  type="checkbox"
                  checked={acknowledgedSafety}
                  onChange={(e) => setAcknowledgedSafety(e.target.checked)}
                />
                <span>
                  I understand ArchitectAI will invoke my configured coding agent in an isolated worktree.
                </span>
              </label>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowApprovalModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!acknowledgedSafety || isStartingBuild}
                onClick={handleConfirmStart}
              >
                {isStartingBuild ? 'Starting...' : 'Start Build'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
