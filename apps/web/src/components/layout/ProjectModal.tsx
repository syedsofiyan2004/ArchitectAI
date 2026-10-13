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
          await registerRepository(project.id, repoPath.trim());
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
          onClose={onClose}
        />

        <ModalBody>
          {error && <FormError>{error}</FormError>}

          <FormField>
            <Label htmlFor="project-name-input" required>
              Project Name
            </Label>
            <Input
              id="project-name-input"
              type="text"
              required
              autoFocus
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
              Connect a Git repository now or later when ready to execute changes.
            </FormHint>
          </FormField>
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
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
        </ModalFooter>
      </form>
    </Modal>
  );
};
