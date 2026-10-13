import React, { useState, useEffect } from 'react';
import { CheckCircle2, Clock, XCircle, Terminal, ChevronDown, ChevronUp, AlertCircle, StopCircle } from 'lucide-react';

export interface BuildStageItem {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  detail?: string;
}

interface BuildTimelineProps {
  stages?: BuildStageItem[];
  operationStage?: string;
  currentTask?: string;
  completedTasks?: string[];
  message?: string;
  logs?: string[];
  startTime?: number;
  onCancel?: () => void;
  isCancelling?: boolean;
}

const CANONICAL_PHASES = [
  { id: 'PREPARING_WORKTREE', name: 'Preparing isolated Git worktree sandbox' },
  { id: 'RUNNING_AGENT', name: 'Coding agent implementing tasks' },
  { id: 'RUNNING_NATIVE_CHECKS', name: 'Running snapshotted repository test checks' },
  { id: 'RUNNING_VERIFICATION', name: 'Running independent adversarial verification' },
];

export const BuildTimeline: React.FC<BuildTimelineProps> = ({
  stages: customStages,
  operationStage,
  currentTask,
  completedTasks = [],
  message,
  logs = [],
  startTime = Date.now(),
  onCancel,
  isCancelling = false,
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Derive stages from operationStage if customStages not provided
  const stages: BuildStageItem[] = customStages || CANONICAL_PHASES.map((p, idx) => {
    const activeIdx = CANONICAL_PHASES.findIndex((item) => item.id === operationStage);
    const isPast = activeIdx > idx || operationStage === 'COMPLETED';
    const isCurrent = operationStage === p.id;
    const isFailed = operationStage === 'FAILED' && activeIdx === idx;

    let status: BuildStageItem['status'] = 'pending';
    if (isPast) status = 'completed';
    else if (isCurrent) status = 'in_progress';
    else if (isFailed) status = 'failed';

    let detail: string | undefined;
    if (p.id === 'RUNNING_AGENT' && currentTask) {
      detail = `Current task: ${currentTask}`;
    } else if (isCurrent && message) {
      detail = message;
    }

    return {
      id: p.id,
      name: p.name,
      status,
      detail,
    };
  });

  const isCancelled = operationStage === 'CANCELLED';

  return (
    <div className="build-timeline-panel">
      <div className="timeline-top-bar">
        <div className="timeline-title-group">
          <div className={`pulse-indicator ${isCancelled ? 'pulse-cancelled' : ''}`}>
            <span className="pulse-dot"></span>
          </div>
          <div>
            <h3 className="timeline-heading">
              {isCancelled ? 'Build Cancelled' : 'Building in isolated workspace'}
            </h3>
            <span className="timeline-timer font-mono text-muted">
              Elapsed: {formatElapsed(elapsedSec)} {currentTask ? `• Task: ${currentTask}` : ''}
            </span>
          </div>
        </div>

        {onCancel && !isCancelled && operationStage !== 'COMPLETED' && operationStage !== 'FAILED' && (
          <button
            type="button"
            className="btn-danger-outline cancel-build-btn"
            onClick={onCancel}
            disabled={isCancelling}
          >
            <StopCircle size={14} />
            <span>{isCancelling ? 'Cancelling...' : 'Cancel Build'}</span>
          </button>
        )}
      </div>

      {isCancelled && (
        <div
          className="cancelled-banner font-mono"
          style={{
            margin: '12px 0',
            padding: '10px 14px',
            background: 'rgba(218, 54, 51, 0.1)',
            border: '1px solid #da3633',
            borderRadius: '6px',
            color: '#f85149',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <StopCircle size={16} />
          <span>Build cancelled. Original branch untouched.</span>
        </div>
      )}

      <div className="activity-timeline-feed">
        {stages.map((stage, idx) => {
          const isDone = stage.status === 'completed';
          const isCurrent = stage.status === 'in_progress';
          const isFailed = stage.status === 'failed';

          return (
            <div key={stage.id} className={`timeline-step-row step-${stage.status}`}>
              <div className="step-marker-col">
                <div className={`step-dot ${stage.status}`}>
                  {isDone && <CheckCircle2 size={16} className="text-success" />}
                  {isCurrent && <span className="mini-spinner" aria-hidden="true"></span>}
                  {isFailed && <XCircle size={16} className="text-danger" />}
                  {stage.status === 'pending' && <span className="pending-dot"></span>}
                </div>
                {idx < stages.length - 1 && <div className="step-line"></div>}
              </div>

              <div className="step-content-col">
                <div className="step-title-line">
                  <span className={`step-name ${isCurrent ? 'font-medium' : ''}`}>
                    {stage.name}
                  </span>
                  <span className="step-status-tag font-mono">
                    {stage.status === 'completed' && 'Done'}
                    {stage.status === 'in_progress' && 'Running...'}
                    {stage.status === 'pending' && 'Queued'}
                    {stage.status === 'failed' && 'Failed'}
                  </span>
                </div>
                {stage.detail && <p className="step-detail text-muted">{stage.detail}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {logs && logs.length > 0 && (
        <div className="timeline-logs-section">
          <button
            type="button"
            className="btn-ghost logs-toggle-btn font-mono"
            onClick={() => setShowLogs(!showLogs)}
            aria-expanded={showLogs}
          >
            <Terminal size={14} />
            <span>Technical Logs ({logs.length} lines)</span>
            {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showLogs && (
            <div className="logs-terminal font-mono">
              {logs.map((line, i) => (
                <div key={i} className="log-line">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
