import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Sparkles,
  FolderGit2,
  GitBranch,
  RefreshCw,
  Menu,
} from 'lucide-react';
import { useRuns } from '../../store/runs';

interface TopBarProps {
  onOpenPalette: () => void;
  onOpenExamples: () => void;
  onOpenConnectRepo: () => void;
  onToggleMobileSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenPalette,
  onOpenExamples,
  onOpenConnectRepo,
  onToggleMobileSidebar,
}) => {
  const { activeProject, activeRepository, refreshRepository } = useRuns();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshRepository();
    } finally {
      setIsRefreshing(false);
    }
  };

  const shortHead = activeRepository?.lastInspectedHead
    ? activeRepository.lastInspectedHead.slice(0, 7)
    : null;

  return (
    <header className="workspace-topbar" role="banner">
      <div className="topbar-left">
        {/* Mobile menu trigger */}
        <button
          type="button"
          className="mobile-sidebar-toggle btn-icon-xs"
          onClick={onToggleMobileSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>

        {/* Project Name */}
        <div className="topbar-project-title-group">
          <span className="topbar-project-name">
            {activeProject ? activeProject.name : 'Default Workspace'}
          </span>
        </div>

        {/* Repository Context Chip */}
        {activeRepository ? (
          <div className="topbar-repo-chip font-mono">
            <FolderGit2 size={13} className="text-muted" />
            <span className="repo-name-text">
              {activeRepository.repositoryName || 'repository'}
            </span>
            <span className="repo-divider">•</span>
            <GitBranch size={12} className="text-muted" />
            <span>{activeRepository.defaultBranch || 'main'}</span>
            {shortHead && (
              <>
                <span className="repo-divider">•</span>
                <span className="text-muted">{shortHead}</span>
              </>
            )}
            <button
              type="button"
              className={`repo-refresh-btn ${isRefreshing ? 'spinning' : ''}`}
              onClick={handleRefresh}
              title="Refresh repository context"
              aria-label="Refresh repository context"
            >
              <RefreshCw size={11} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="topbar-connect-repo-btn font-mono"
            onClick={onOpenConnectRepo}
          >
            <FolderGit2 size={13} />
            <span>Connect repository</span>
          </button>
        )}
      </div>

      <div className="topbar-center">
        {/* Global Command Palette Trigger */}
        <button
          type="button"
          className="topbar-search-btn font-mono"
          onClick={onOpenPalette}
          title="Search or jump to... (Cmd+K)"
        >
          <Search size={13} className="text-muted" />
          <span>Search or jump to...</span>
          <kbd className="topbar-kbd">⌘K</kbd>
        </button>
      </div>

      <div className="topbar-right">
        {/* Examples Button */}
        <button
          type="button"
          className="btn-ghost topbar-examples-btn"
          onClick={onOpenExamples}
        >
          <Sparkles size={13} className="icon-brand" />
          <span>Examples</span>
        </button>

        {/* Primary CTA: New Change */}
        <Link to="/new" className="btn-primary topbar-new-btn">
          <Plus size={14} />
          <span>New Change</span>
          <kbd className="topbar-cta-kbd font-mono">N</kbd>
        </Link>
      </div>
    </header>
  );
};
