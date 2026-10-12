import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { FileCode, ArrowLeft, GitBranch, ShieldCheck } from 'lucide-react';
import { AnalysisRunRecord } from '../types';
import { DiffViewer } from '../components/ui/DiffViewer';

interface RunContext {
  run: AnalysisRunRecord;
  onOpenEvidence: () => void;
}

export const ChangesPage: React.FC = () => {
  const { run } = useOutletContext<RunContext>();
  const navigate = useNavigate();

  const latestSession = run.sessions && (run.sessions as any[])[0];
  const diffReport = run.execution?.diffReport || (latestSession ? {
    diff: '',
    changedFiles: latestSession.changedFiles || [],
    insertions: 0,
    deletions: 0,
    filesCount: latestSession.changedFiles?.length || 0,
  } : undefined);

  const rawDiff = run.execution?.diffReport?.diff || '';
  const changedFiles = diffReport?.changedFiles || [];

  return (
    <div className="changes-page-layout">
      <section className="changes-hero">
        <div className="section-step-indicator font-mono">Step 5 of 5 • Code Changes</div>
        <h1 className="changes-title">Unified Code Changes</h1>
        <p className="changes-subtitle">
          Inspect the exact unified diff produced by the coding agent inside the isolated Git worktree.
          Original repository branches remain strictly untouched.
        </p>

        {run.execution && (
          <div className="changes-meta-strip font-mono">
            <span className="meta-item">
              <GitBranch size={13} />
              <span>Isolated Branch: <strong>{run.execution.isolatedBranch}</strong></span>
            </span>
            <span className="meta-item text-success">
              <ShieldCheck size={13} />
              <span>Target Branch: <strong>{run.execution.originalBranch} (untouched)</strong></span>
            </span>
          </div>
        )}
      </section>

      {diffReport ? (
        <section className="diff-content-section">
          <DiffViewer diff={rawDiff} changedFiles={changedFiles} />
        </section>
      ) : (
        <div className="empty-changes-card">
          <FileCode size={32} className="text-muted" />
          <h3>No code changes generated yet</h3>
          <p>
            Approve and execute the implementation tasks to generate code modifications in an isolated worktree.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate(`/runs/${run.id}/implementation`)}
          >
            Go to Implementation Workspace
          </button>
        </div>
      )}

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
