import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Layers,
  Plus,
  Sliders,
  Terminal,
  FolderGit2,
  Folder,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useRuns } from '../../store/runs';

interface SidebarProps {
  onOpenSettings: () => void;
  onOpenNewProject: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenSettings,
  onOpenNewProject,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { projects, activeProject, selectProject } = useRuns();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSelectProject = async (projectId: string) => {
    await selectProject(projectId);
    if (onCloseMobile) onCloseMobile();
    // Navigate home to see active project workspace
    navigate('/');
  };

  return (
    <aside className={`workspace-sidebar ${isMobileOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
      {/* Brand Wordmark */}
      <div className="sidebar-brand-block">
        <Link to="/" className="brand-link" onClick={onCloseMobile}>
          <div className="brand-logo-icon">
            <Terminal size={15} />
          </div>
          <span className="brand-wordmark">ArchitectAI</span>
        </Link>
      </div>

      {/* Projects List */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span className="sidebar-section-label">Projects</span>
          <button
            type="button"
            className="btn-icon-xs add-project-btn"
            onClick={onOpenNewProject}
            title="Create new project"
            aria-label="Create new project"
          >
            <Plus size={13} />
          </button>
        </div>

        <nav className="projects-nav-list" aria-label="Projects">
          {projects.length === 0 ? (
            <button
              type="button"
              className="sidebar-empty-project-btn"
              onClick={onOpenNewProject}
            >
              <Plus size={13} />
              <span>Create first project</span>
            </button>
          ) : (
            projects.map((proj) => {
              const isActive = activeProject?.id === proj.id;
              return (
                <button
                  key={proj.id}
                  type="button"
                  className={`project-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectProject(proj.id)}
                >
                  <Folder size={14} className="icon-project" />
                  <span className="project-nav-name">{proj.name}</span>
                </button>
              );
            })
          )}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        {/* System Readiness Trigger */}
        <button
          type="button"
          className="system-readiness-btn"
          onClick={onOpenSettings}
          title="System configuration and readiness"
        >
          <span className="status-dot-pulse"></span>
          <span className="readiness-text font-mono">System ready</span>
        </button>

        {/* Settings Button */}
        <button
          type="button"
          className="sidebar-settings-btn"
          onClick={onOpenSettings}
          title="Open settings"
        >
          <Sliders size={14} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};
