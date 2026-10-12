import React, { useState } from 'react';
import { X, FolderGit2, Sparkles, FolderPlus } from 'lucide-react';
import { useRuns } from '../../store/runs';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: (projectId: string) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const { createProject, registerRepository } = useRuns();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const project = await createProject(name.trim(), description.trim() || undefined);
      if (repoPath.trim()) {
        try {
          await registerRepository(repoPath.trim());
        } catch (repoErr) {
          console.warn('Repository registration failed during project creation', repoErr);
        }
      }
      setName('');
      setDescription('');
      setRepoPath('');
      onClose();
      if (onProjectCreated) {
        onProjectCreated(project.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
      <div className="modal-content project-modal-box">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <FolderPlus size={18} className="text-brand" />
            <h3 id="new-project-title" className="modal-title">Create New Project</h3>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="project-form">
          {error && <div className="form-error-banner">{error}</div>}

          <div className="form-group">
            <label htmlFor="project-name-input" className="form-label">Project Name *</label>
            <input
              id="project-name-input"
              type="text"
              required
              autoFocus
              className="input text-input"
              placeholder="e.g. Payments Gateway, Auth Service"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="project-desc-input" className="form-label">Description (Optional)</label>
            <input
              id="project-desc-input"
              type="text"
              className="input text-input"
              placeholder="Brief description of the service or system"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="project-repo-input" className="form-label">
              Local Git Repository Path (Optional)
            </label>
            <input
              id="project-repo-input"
              type="text"
              className="input text-input font-mono"
              placeholder="e.g. D:\projects\payments-api or ./repos/auth"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
            />
            <span className="form-hint">
              You can connect a Git repository now or later when ready to execute changes.
            </span>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!name.trim() || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
