import React, { useState } from 'react';
import { X, FolderGit2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useRuns } from '../../store/runs';

interface ConnectRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
}

export const ConnectRepoModal: React.FC<ConnectRepoModalProps> = ({
  isOpen,
  onClose,
  currentPath = '',
}) => {
  const { registerRepository, activeProject } = useRuns();
  const [repoPath, setRepoPath] = useState(currentPath);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoPath.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (!activeProject) throw new Error('No active project selected.');
      await registerRepository(activeProject.id, repoPath.trim());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect repository');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="connect-repo-title">
      <div className="modal-content connect-repo-modal-box">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <FolderGit2 size={18} className="text-brand" />
            <h3 id="connect-repo-title" className="modal-title">Connect Git Repository</h3>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="project-form">
          {error && <div className="form-error-banner">{error}</div>}

          <div className="form-group">
            <label htmlFor="repo-path-input" className="form-label">
              Local Repository Path *
            </label>
            <input
              id="repo-path-input"
              type="text"
              required
              autoFocus
              className="input text-input font-mono"
              placeholder="e.g. /home/user/code/my-repo or C:\projects\api"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
            />
            <span className="form-hint">
              Absolute or workspace-relative path to a valid Git repository root.
            </span>
          </div>

          <div className="repo-trust-box">
            <ShieldCheck size={16} className="text-brand" />
            <p>
              ArchitectAI reads a bounded subset of the repository and strictly excludes credentials, environment
              files, binaries, and build artifacts.
            </p>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!repoPath.trim() || isSubmitting}
            >
              {isSubmitting ? 'Inspecting...' : 'Connect Repository'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
