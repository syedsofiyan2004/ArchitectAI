import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { FileCode, ArrowLeft, GitBranch, ShieldCheck, RefreshCw } from 'lucide-react';
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

  const [persistedDiff, setPersistedDiff] = useState<string>(run.execution?.diffReport?.diff || '');
  const [loadingDiff, setLoadingDiff] = useState<boolean>(false);

  // Load real diff artifact from backend (Item 10)
  useEffect(() => {
    let isMounted = true;
    setLoadingDiff(true);

    fetch(`/api/runs/${run.id}/artifacts`)
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        if (!isMounted || !data || !data.success || !Array.isArray(data.artifacts)) {
          setLoadingDiff(false);
          return;
        }

        // Prioritize repair.diff if available, else changes.diff
        const repairArt = data.artifacts.find((a: any) => a.relativePath === 'repair.diff' || a.id?.includes('repair'));
        const changesArt = data.artifacts.find((a: any) => a.relativePath === 'changes.diff' || a.type === 'DIFF_PATCH');
        const targetFilename = repairArt ? 'repair.diff' : changesArt ? 'changes.diff' : null;

        if (targetFilename) {
          try {
            const contentRes = await fetch(`/api/runs/${run.id}/artifacts/${targetFilename}`);
            if (contentRes.ok) {
              const contentData = await contentRes.json();
              if (contentData.success && contentData.content && isMounted) {
                setPersistedDiff(contentData.content);
              }
            }
          } catch {
            // Ignore error
          }
        }
        if (isMounted) setLoadingDiff(false);
      })
      .catch(() => {
        if (isMounted) setLoadingDiff(false);
      });

    return () => {
      isMounted = false;
    };
  }, [run.id]);

  const rawDiff = persistedDiff || run.execution?.diffReport?.diff || '';

  // Extract changed files from raw diff or fallback to recorded session files
  const extractChangedFiles = (diffText: string): string[] => {
    if (!diffText) return diffReport?.changedFiles || [];
    const files: string[] = [];
    const regex = /diff --git a\/(.+?) b\/(.+?)/g;
    let match;
    while ((match = regex.exec(diffText)) !== null) {
      if (match[2] && !files.includes(match[2])) {
        files.push(match[2]);
      }
    }
    return files.length > 0 ? files : (diffReport?.changedFiles || []);
  };

  const changedFiles = extractChangedFiles(rawDiff);

  const hasChanges = Boolean(rawDiff && rawDiff.trim().length > 0) || (changedFiles.length > 0);

  return (
    <div className="changes-page-layout">
      <section className="changes-hero">
        <div className="section-step-indicator font-mono">Step 5 of 5 • Code Changes</div>
        <h1 className="changes-title">Unified Code Changes</h1>
        <p className="changes-subtitle">
          Inspect the exact unified diff produced by the coding agent inside the isolated Git worktree.
          Original repository branches remain strictly untouched.
        </p>

        {(run.execution || latestSession) && (
          <div className="changes-meta-strip font-mono">
            <span className="meta-item">
              <GitBranch size={13} />
              <span>
                Isolated Branch: <strong>{run.execution?.isolatedBranch || latestSession?.isolatedBranch || `architectai/${run.id}`}</strong>
              </span>
            </span>
            <span className="meta-item text-success">
              <ShieldCheck size={13} />
              <span>
                Target Branch: <strong>{run.execution?.originalBranch || latestSession?.originalBranch || 'main'} (untouched)</strong>
              </span>
            </span>
          </div>
        )}
      </section>

      {hasChanges ? (
        <section className="diff-content-section">
          {loadingDiff && !rawDiff ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted, #8b949e)', fontFamily: 'monospace' }}>
              <RefreshCw size={18} className="spin" style={{ marginBottom: '8px' }} />
              <div>Loading persisted diff artifact...</div>
            </div>
          ) : (
            <DiffViewer diff={rawDiff} changedFiles={changedFiles} />
          )}
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
