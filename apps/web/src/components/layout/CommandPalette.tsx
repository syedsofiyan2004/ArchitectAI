import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, PlusCircle, Home, Sparkles, Server, Clock, X } from 'lucide-react';
import { useRuns } from '../../store/runs';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenExamples: () => void;
  onOpenStatus: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenExamples,
  onOpenStatus,
}) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { runs } = useRuns();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredRuns = runs.filter((r) =>
    r.title.toLowerCase().includes(query.toLowerCase()) ||
    r.rawIntent.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="palette-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-bar">
          <Search size={18} className="icon-muted" />
          <input
            type="text"
            className="palette-input"
            placeholder="Type a command or search recent analyses..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="palette-results">
          <div className="palette-section-title">Navigation & Actions</div>
          <button
            type="button"
            className="palette-item"
            onClick={() => handleSelect(() => navigate('/new'))}
          >
            <PlusCircle size={16} className="icon-brand" />
            <span>New Architecture Analysis</span>
            <span className="palette-shortcut font-mono">N</span>
          </button>

          <button
            type="button"
            className="palette-item"
            onClick={() => handleSelect(() => navigate('/'))}
          >
            <Home size={16} className="icon-muted" />
            <span>Dashboard / Projects</span>
          </button>

          <button
            type="button"
            className="palette-item"
            onClick={() => handleSelect(onOpenExamples)}
          >
            <Sparkles size={16} className="icon-muted" />
            <span>Browse Example Scenarios</span>
          </button>

          <button
            type="button"
            className="palette-item"
            onClick={() => handleSelect(onOpenStatus)}
          >
            <Server size={16} className="icon-muted" />
            <span>System Status & Kernel Diagnostics</span>
          </button>

          {runs.length > 0 && (
            <>
              <div className="palette-section-title">Recent Analyses</div>
              {filteredRuns.slice(0, 5).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="palette-item"
                  onClick={() => handleSelect(() => navigate(`/runs/${r.id}`))}
                >
                  <Clock size={16} className="icon-muted" />
                  <span className="palette-item-text">{r.title}</span>
                  <span className="palette-item-sub font-mono">
                    {r.result?.contract.discoveredConcerns.length ?? 0} risks
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
