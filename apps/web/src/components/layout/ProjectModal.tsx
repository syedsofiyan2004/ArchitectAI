import React, { useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { useRuns } from '../../store/runs';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../ui/Modal';
import { FormField, Label, Input, FormHint, FormError } from '../ui/FormField';
import { Button } from '../ui/Button';

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
  const [isRetryingRepo, setIsRetryingRepo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdProject, setCreatedProject] = useState<{ id: string; name: string } | null>(null);
  const [repoWarning, setRepoWarning] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetAndClose = (projectId?: string) => {
    setName('');
    setDescription('');
    setRepoPath('');
    setError(null);
    setRepoWarning(null);
    setCreatedProject(null);
    onClose();
    if (projectId && onProjectCreated) {
      onProjectCreated(projectId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setRepoWarning(null);

    try {
      const project = await createProject(name.trim(), description.trim() || undefined);
      if (repoPath.trim()) {
        try {
          await registerRepository(project.id, repoPath.trim());
        } catch (repoErr) {
          setCreatedProject({ id: project.id, name: project.name });
          setRepoWarning(
            repoErr instanceof Error ? repoErr.message : 'Repository registration failed.'
          );
          setIsSubmitting(false);
          return;
        }
      }
      resetAndClose(project.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setIsSubmitting(false);
    }
  };

  const handleRetryRepo = async () => {
    if (!createdProject || !repoPath.trim()) return;
    setIsRetryingRepo(true);
    setRepoWarning(null);
    try {
      await registerRepository(createdProject.id, repoPath.trim());
      resetAndClose(createdProject.id);
    } catch (err: unknown) {
      setRepoWarning(
        err instanceof Error ? err.message : 'Repository registration failed.'
      );
    } finally {
      setIsRetryingRepo(false);
    }
  };

  const handleContinueWithoutRepo = () => {
    if (createdProject) {
      resetAndClose(createdProject.id);
    } else {
      resetAndClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => resetAndClose(createdProject?.id)}
      size="md"
      maxWidth="560px"
      ariaLabelledBy="new-project-title"
      backdropClassName="project-modal-backdrop"
      className="project-modal-box"
    >
      <form onSubmit={handleSubmit} className="project-form-container">
        <ModalHeader
          title="Create New Project"
          titleId="new-project-title"
          icon={<FolderPlus size={18} className="text-brand" />}
          onClose={() => resetAndClose(createdProject?.id)}
        />

        <ModalBody>
          {error && <FormError>{error}</FormError>}

          {repoWarning && (
            <div
              className="warning-alert-banner partial-success-warning"
              role="alert"
              style={{
                marginBottom: '16px',
                padding: '12px 14px',
                background: 'rgba(210, 153, 34, 0.15)',
                border: '1px solid #d29922',
                borderRadius: '6px',
                color: '#e3b341',
                fontSize: '13px',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                Project was created, but repository was not connected
              </div>
              <div style={{ opacity: 0.9 }}>{repoWarning}</div>
            </div>
          )}

          <FormField>
            <Label htmlFor="project-name-input" required>
              Project Name
            </Label>
            <Input
              id="project-name-input"
              type="text"
              required
              autoFocus
              disabled={Boolean(createdProject)}
              placeholder="e.g. Payments Gateway, Auth Service"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

          <FormField>
            <Label htmlFor="project-desc-input">
              Description (Optional)
            </Label>
            <Input
              id="project-desc-input"
              type="text"
              disabled={Boolean(createdProject)}
              placeholder="Brief description of the service or system"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <FormHint>
              Help ArchitectAI evaluate domain and operational constraints.
            </FormHint>
          </FormField>

          <FormField>
            <Label htmlFor="project-repo-input">
              Local Git Repository Path (Optional)
            </Label>
            <Input
              id="project-repo-input"
              type="text"
              className="font-mono"
              placeholder="e.g. D:\projects\payments-api or ./repos/auth"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
            />
            <FormHint>
              {createdProject
                ? 'Check the local path and retry, or continue without connecting a repository.'
                : 'Connect a Git repository now or later when ready to execute changes.'}
            </FormHint>
          </FormField>
        </ModalBody>

        <ModalFooter>
          {createdProject ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={handleContinueWithoutRepo}
                disabled={isRetryingRepo}
              >
                Continue without repository
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleRetryRepo}
                disabled={!repoPath.trim() || isRetryingRepo}
                isLoading={isRetryingRepo}
              >
                {isRetryingRepo ? 'Connecting...' : 'Retry repository connection'}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => resetAndClose()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!name.trim() || isSubmitting}
                isLoading={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </Button>
            </>
          )}
        </ModalFooter>
      </form>
    </Modal>
  );
};
