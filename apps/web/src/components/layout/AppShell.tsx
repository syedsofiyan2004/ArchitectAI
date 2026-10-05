import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Server, Sparkles, Terminal } from 'lucide-react';
import { CommandPalette } from './CommandPalette';
import { SystemStatusModal } from './SystemStatusModal';
import { ExamplesModal } from './ExamplesModal';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isExamplesOpen, setIsExamplesOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Global keyboard shortcuts (Cmd+K for palette, N for new analysis when not in input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsPaletteOpen(false);
        setIsStatusOpen(false);
        setIsExamplesOpen(false);
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

  const isHome = location.pathname === '/';

  return (
    <div className="product-shell">
      <header className="product-header" role="banner">
        <div className="header-left">
          <Link to="/" className="brand-link" title="ArchitectAI Home">
            <div className="brand-symbol">
              <Terminal size={16} />
            </div>
            <span className="brand-text">ArchitectAI</span>
          </Link>
        </div>

        <div className="header-center">
          <button
            type="button"
            className="search-trigger-btn font-mono"
            onClick={() => setIsPaletteOpen(true)}
            title="Search and commands (Cmd+K)"
          >
            <Search size={14} className="icon-muted" />
            <span>Search or jump to...</span>
            <kbd className="kbd-shortcut font-mono">⌘K</kbd>
          </button>
        </div>

        <div className="header-right">
          <button
            type="button"
            className="header-action-btn"
            onClick={() => setIsExamplesOpen(true)}
            title="Browse curated architecture examples"
          >
            <Sparkles size={14} className="icon-brand" />
            <span>Examples</span>
          </button>

          <Link to="/new" className="btn-primary-header">
            <Plus size={15} />
            <span>New Analysis</span>
          </Link>

          <button
            type="button"
            className="status-trigger-dot"
            onClick={() => setIsStatusOpen(true)}
            title="Engine Kernel Status & Telemetry"
            aria-label="System status"
          >
            <span className="dot-live"></span>
          </button>
        </div>
      </header>

      <main className="product-main">
        {children}
      </main>

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

      {/* Global Modals */}
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

      <SystemStatusModal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
      />

      <ExamplesModal
        isOpen={isExamplesOpen}
        onClose={() => setIsExamplesOpen(false)}
      />
    </div>
  );
};
