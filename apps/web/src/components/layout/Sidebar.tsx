import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Sliders,
  Terminal,
  Folder,
} from 'lucide-react';
import { useRuns } from '../../store/runs';
import { SettingsTab } from './SettingsModal';

interface SidebarProps {
  onOpenSettings: (tab?: SettingsTab) => void;
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
  const { projects, activeProject, activeRepository, selectProject } = useRuns();
  const navigate = useNavigate();
  const [capabilities, setCapabilities] = useState<any>(null);

  useEffect(() => {
    const url = activeProject ? `/api/system/capabilities?projectId=${activeProject.id}` : '/api/system/capabilities';
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCapabilities(data.capabilities);
        }
      })
      .catch(() => {});
  }, [activeProject]);

  const handleSelectProject = async (projectId: string) => {
    await selectProject(projectId);
    if (onCloseMobile) onCloseMobile();
    navigate('/');
  };

  // Compute status per Item 12:
  // - "System ready" when analysisProvider and codingAgent and git are ready.
  // - "Demo mode" when running deterministic demo provider.
  // - "Setup needed" when provider or agent requires configuration.
  // - "Repository needed" when active project has no registered repository.
  // - "Degraded" when one or more subsystems are unavailable.
  const getReadiness = (): { label: string; tab: SettingsTab; statusClass: string } => {
    if (!capabilities) {
      return { label: 'System ready', tab: 'general', statusClass: 'ready' };
    }
    const isDemo = capabilities?.details?.provider?.id === 'deterministic-demo';
    const providerReady = capabilities.analysisProvider === 'READY';
    const agentReady = capabilities.codingAgent === 'READY';
    const gitReady = capabilities.git === 'READY';

    if (capabilities.git === 'UNAVAILABLE' || capabilities.verificationRuntime === 'UNAVAILABLE') {
      return { label: 'Degraded', tab: 'advanced', statusClass: 'degraded' };
    }
    if (capabilities.analysisProvider === 'NOT_CONFIGURED') {
      return { label: 'Setup needed', tab: 'provider', statusClass: 'warning' };
    }
    if (capabilities.codingAgent === 'UNAVAILABLE') {
      return { label: 'Setup needed', tab: 'agent', statusClass: 'warning' };
    }
    if (!activeRepository || capabilities.repositoryAccess === 'UNAVAILABLE') {
      return { label: 'Repository needed', tab: 'general', statusClass: 'warning' };
    }
    if (isDemo) {
      return { label: 'Demo mode', tab: 'provider', statusClass: 'demo' };
    }
    if (providerReady && agentReady && gitReady) {
      return { label: 'System ready', tab: 'general', statusClass: 'ready' };
    }
    return { label: 'Degraded', tab: 'advanced', statusClass: 'degraded' };
  };

  const readiness = getReadiness();

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
          onClick={() => onOpenSettings(readiness.tab)}
          title={`System status: ${readiness.label}. Click to view details.`}
        >
          <span className={`status-dot-pulse ${readiness.statusClass}`}></span>
          <span className="readiness-text font-mono">{readiness.label}</span>
        </button>

        {/* Settings Button */}
        <button
          type="button"
          className="sidebar-settings-btn"
          onClick={() => onOpenSettings('general')}
          title="Open settings"
        >
          <Sliders size={14} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};
