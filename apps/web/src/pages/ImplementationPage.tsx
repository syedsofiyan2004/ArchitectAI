import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  Lock,
  Play,
  CheckCircle2,
  XCircle,
  FileCode,
  ArrowRight,
  ArrowLeft,
  GitBranch,
  Terminal,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import {
  AnalysisRunRecord,
  AgentInfo,
  PlanExecutionOutput,
} from '../types';
import { ImplementationPlan } from '@architectai/domain';
import { useRuns } from '../store/runs';
import { BuildPlanView } from '../components/ui/BuildPlanView';
import { BuildTimeline } from '../components/ui/BuildTimeline';
import { ConnectRepoModal } from '../components/layout/ConnectRepoModal';
import { Button } from '../components/ui/Button';

interface RunContext {
  run: AnalysisRunRecord;
  onOpenEvidence: () => void;
}

export const ImplementationPage: React.FC = () => {
  const { run } = useOutletContext<RunContext>();
  const { updateRun, csrfToken, activeRepository, refreshRun, cancelRun } = useRuns();
  const navigate = useNavigate();

  const contract = run.result!.contract;

  // Repository & Modals
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('codex-cli');

  // Plan and Execution
  const [plan, setPlan] = useState<ImplementationPlan | null>(run.plan || null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(run.state === 'IMPLEMENTING');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Real operation progress from /api/runs/:runId/operation
  const [operationStage, setOperationStage] = useState<string>(
    run.state === 'CANCELLED' ? 'CANCELLED' : run.state === 'IMPLEMENTING' ? 'PREPARING_WORKTREE' : ''
  );
  const [currentTaskName, setCurrentTaskName] = useState<string | undefined>();
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [operationMessage, setOperationMessage] = useState<string | undefined>();
  const [operationStartTime, setOperationStartTime] = useState<number>(Date.now());

  // Polling ref
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Load available coding agents
  useEffect(() => {
    fetch('/api/agents')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.agents) {
          setAgents(data.agents);
          const available = data.agents.find((a: AgentInfo) => a.available);
          if (available) {
            setSelectedAgentId(available.id);
          }
        }
      })
      .catch((err) => console.error('Failed to load agents:', err));
  }, []);

  // Poll operation status if running
  useEffect(() => {
    if (isExecuting) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/runs/${run.id}/operation`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.operation) {
              const op = data.operation;
              setOperationStage(op.stage);
              setCurrentTaskName(op.currentTask);
              setCompletedTaskIds(op.completedTasks || []);
              setOperationMessage(op.message);

              if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(op.stage)) {
                setIsExecuting(false);
                if (pollingRef.current) clearInterval(pollingRef.current);
                await refreshRun(run.id);
              }
            }
          }
        } catch {
          // Ignore polling errors
        }
      }, 500);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isExecuting, run.id, refreshRun]);

  const handleCompilePlan = async () => {
    if (!activeRepository) {
      setError('Please connect a repository to your project before compiling an implementation plan.');
      return;
    }

    setIsCompiling(true);
    setError(null);

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

  const handleStartBuild = async () => {
    if (!plan) return;
    if (!activeRepository) {
      setError('No repository connected.');
      return;
    }

    setIsExecuting(true);
    setIsCancelling(false);
    setError(null);
    setOperationStage('PREPARING_WORKTREE');
    setOperationStartTime(Date.now());

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

      updateRun(run.id, {
        execution: data.execution,
      });
      await refreshRun(run.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Execution failed.');
      setOperationStage('FAILED');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancelBuild = async () => {
    setIsCancelling(true);
    try {
      await cancelRun(run.id);
      setOperationStage('CANCELLED');
      setOperationMessage('Build cancelled. Original branch untouched.');
      setIsExecuting(false);
      await refreshRun(run.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel build.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="implementation-page-layout">
      <section className="implementation-hero">
        <div className="section-step-indicator font-mono">Step 4 of 5 • Implementation Workspace</div>
        <h1 className="implementation-title">Implementation Workspace</h1>
        <p className="implementation-subtitle">
          ArchitectAI executes implementation tasks inside an isolated Git worktree using your configured coding agent.
          Original repository branches remain untouched.
        </p>
      </section>

      {error && (
        <div className="error-alert-banner" role="alert" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={18} className="icon-danger" />
          <span>{error}</span>
        </div>
      )}

      {/* Item 4: Read-Only Repository Status Strip */}
      <section className="setup-section-card" style={{ marginBottom: '20px' }}>
        <div className="setup-section-header">
          <FolderGit2 size={18} className="icon-brand" />
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '15px', color: '#fff', margin: 0 }}>Target Repository</h3>
            <p className="text-secondary" style={{ fontSize: '13px', margin: '2px 0 0' }}>
              Execution strictly occurs from the registered repository.
            </p>
          </div>

          {!activeRepository && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsConnectModalOpen(true)}
            >
              Connect Repository
            </Button>
          )}
        </div>

        {activeRepository ? (
          <div className="workspace-signals-strip" style={{ marginTop: '12px' }}>
            <div className="signal-pill">
              <span className="signal-label font-mono">Repository:</span>
              <strong className="font-mono">{activeRepository.repositoryName}</strong>
            </div>
            <div className="signal-pill">
              <span className="signal-label font-mono">Branch:</span>
              <strong className="font-mono">{activeRepository.defaultBranch}</strong>
            </div>
            <div className="signal-pill">
              <span className="signal-label font-mono">HEAD Commit:</span>
              <span className="font-mono">{activeRepository.lastInspectedHead?.slice(0, 8) || 'HEAD'}</span>
            </div>
            <div className="signal-pill">
              <span className="signal-label font-mono">Status:</span>
              <span className="font-mono text-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} /> Connected
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: '12px',
              padding: '12px 16px',
              background: 'rgba(210, 153, 34, 0.1)',
              border: '1px solid rgba(210, 153, 34, 0.3)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} className="text-warning" />
              <span style={{ fontSize: '13px', color: '#e3b341' }}>
                No repository connected to this project
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsConnectModalOpen(true)}
            >
              Connect Repository
            </Button>
          </div>
        )}
      </section>

      {/* Plan Preparation CTA if plan not yet compiled */}
      {!plan && (
        <div
          style={{
            padding: '24px',
            background: 'var(--card-bg, #161b22)',
            border: '1px solid var(--border-color, #30363d)',
            borderRadius: '8px',
            textAlign: 'center',
            marginBottom: '20px',
          }}
        >
          <FileCode size={32} className="text-brand" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '6px' }}>Ready to Prepare Implementation Tasks</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #8b949e)', maxWidth: '540px', margin: '0 auto 16px' }}>
            ArchitectAI will translate the approved architecture decisions into bounded, testable tasks for your coding agent.
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={handleCompilePlan}
            isLoading={isCompiling}
            disabled={isCompiling || !activeRepository}
          >
            {isCompiling ? 'Compiling Tasks...' : 'Prepare Implementation Plan'}
          </Button>
        </div>
      )}

      {/* Item 7: Active Build Progress Timeline */}
      {(isExecuting || operationStage === 'CANCELLED' || (run.state === 'IMPLEMENTING' && !plan)) && (
        <section style={{ marginBottom: '24px' }}>
          <BuildTimeline
            operationStage={operationStage}
            currentTask={currentTaskName}
            completedTasks={completedTaskIds}
            message={operationMessage}
            startTime={operationStartTime}
            onCancel={handleCancelBuild}
            isCancelling={isCancelling}
          />
        </section>
      )}

      {/* Item 5: Canonical Build Plan View */}
      {plan && !isExecuting && operationStage !== 'PREPARING_WORKTREE' && operationStage !== 'RUNNING_AGENT' && (
        <section className="canonical-build-plan-section">
          <BuildPlanView
            plan={plan}
            repoName={activeRepository?.repositoryName || ''}
            repoPath={activeRepository?.canonicalLocalPath || '.'}
            branchName={activeRepository?.defaultBranch || 'main'}
            agents={agents}
            selectedAgentId={selectedAgentId}
            onSelectAgent={setSelectedAgentId}
            onStartBuild={handleStartBuild}
            isStartingBuild={isExecuting}
          />
        </section>
      )}

      {/* Post-execution result notifications */}
      {run.state === 'VERIFIED' && (
        <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(63, 185, 80, 0.1)', border: '1px solid #3fb950', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={20} className="text-success" />
            <div>
              <strong style={{ fontSize: '14px', color: '#fff' }}>Build completed and verified!</strong>
              <p style={{ fontSize: '12px', color: 'var(--text-muted, #8b949e)', margin: '2px 0 0' }}>
                All architecture invariants were independently proven.
              </p>
            </div>
          </div>
          <Button type="button" variant="primary" onClick={() => navigate(`/runs/${run.id}/changes`)}>
            View Changes <ArrowRight size={14} />
          </Button>
        </div>
      )}

      {run.state === 'VERIFICATION_FAILED' && (
        <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(210, 153, 34, 0.1)', border: '1px solid #d29922', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} className="text-warning" />
            <div>
              <strong style={{ fontSize: '14px', color: '#fff' }}>Verification check failed</strong>
              <p style={{ fontSize: '12px', color: 'var(--text-muted, #8b949e)', margin: '2px 0 0' }}>
                One or more architecture invariants disproved the implementation.
              </p>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => navigate(`/runs/${run.id}/verification`)}>
            Go to Verification & Fix <ArrowRight size={14} />
          </Button>
        </div>
      )}

      {/* Sequential Footer Action */}
      <div className="review-footer-bar">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(`/runs/${run.id}/verification`)}
        >
          <ArrowLeft size={16} />
          <span>Back to Verification</span>
        </button>

        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(`/runs/${run.id}/changes`)}
        >
          <span>View Changes & Diff</span>
          <ArrowRight size={16} />
        </button>
      </div>

      <ConnectRepoModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
    </div>
  );
};
