import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { SettingsModal } from './SettingsModal';
import { ProjectModal } from './ProjectModal';
import { ConnectRepoModal } from './ConnectRepoModal';
import { ExamplesModal } from './ExamplesModal';
import { SystemStatusModal } from './SystemStatusModal';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isConnectRepoOpen, setIsConnectRepoOpen] = useState(false);
  const [isExamplesOpen, setIsExamplesOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const navigate = useNavigate();

  // Global keyboard shortcuts (Cmd+K for palette, N for new analysis when not in input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsPaletteOpen(false);
        setIsSettingsOpen(false);
        setIsProjectModalOpen(false);
        setIsConnectRepoOpen(false);
        setIsExamplesOpen(false);
        setIsStatusOpen(false);
        setIsMobileSidebarOpen(false);
      } else if (e.key === 'n' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          navigate('/new');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="product-shell">
      {/* Mobile backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Workspace Sidebar */}
      <Sidebar
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNewProject={() => setIsProjectModalOpen(true)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Workspace Main Area */}
      <div className="workspace-main-column">
        {/* Workspace Top Bar */}
        <TopBar
          onOpenPalette={() => setIsPaletteOpen(true)}
          onOpenExamples={() => setIsExamplesOpen(true)}
          onOpenConnectRepo={() => setIsConnectRepoOpen(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        />

        {/* Workspace Route Content */}
        <main className="product-main">
          {children}
        </main>

        {/* Minimal Subtle Workspace Footer */}
        <footer className="product-footer">
          <div className="footer-container">
            <span className="footer-copy">
              ArchitectAI • Engineering intelligence for AI-built software
            </span>
            <div className="footer-links font-mono">
              <span>Provider Neutral</span>
              <span>•</span>
              <span>Three-Level Grounding</span>
              <span>•</span>
              <span>Independent Verification</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Global Application Modals */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onOpenExamples={() => {
          setIsPaletteOpen(false);
          setIsExamplesOpen(true);
        }}
        onOpenStatus={() => {
          setIsPaletteOpen(false);
          setIsStatusOpen(true);
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />

      <ConnectRepoModal
        isOpen={isConnectRepoOpen}
        onClose={() => setIsConnectRepoOpen(false)}
      />

      <ExamplesModal
        isOpen={isExamplesOpen}
        onClose={() => setIsExamplesOpen(false)}
      />

      <SystemStatusModal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
      />
    </div>
  );
};
