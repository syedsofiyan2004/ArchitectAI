import React, { useState, useEffect } from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScenarioPreset } from '../../types';

interface ExamplesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExample?: (scenario: ScenarioPreset) => void;
}

export const ExamplesModal: React.FC<ExamplesModalProps> = ({
  isOpen,
  onClose,
  onSelectExample,
}) => {
  const [scenarios, setScenarios] = useState<ScenarioPreset[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && scenarios.length === 0) {
      fetch('/api/scenarios')
        .then((res) => res.json())
        .then((data) => setScenarios(data))
        .catch((err) => console.error('Failed to load scenarios', err));
    }
  }, [isOpen, scenarios.length]);

  if (!isOpen) return null;

  const handleChoose = (scenario: ScenarioPreset) => {
    onClose();
    if (onSelectExample) {
      onSelectExample(scenario);
    } else {
      navigate('/new', { state: { example: scenario } });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Sparkles className="icon-brand" size={18} />
            <h3>Curated Architecture Examples</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-subtext">
            Explore how ArchitectAI automatically uncovers hidden concurrency races, memory saturation,
            connection exhaustion, and trust boundary hazards across common software requirements.
          </p>

          <div className="examples-list">
            {scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                className="example-row-card"
                onClick={() => handleChoose(s)}
              >
                <div className="example-row-content">
                  <div className="example-row-title-bar">
                    <span className="example-tag font-mono">{s.tag}</span>
                    <strong className="example-title">{s.title}</strong>
                  </div>
                  <p className="example-prompt">"{s.prompt}"</p>
                  <div className="example-meta-bar font-mono">
                    {s.context?.database && <span>DB: {s.context.database}</span>}
                    {s.context?.framework && <span>Framework: {s.context.framework}</span>}
                    {s.context?.scale && <span>Scale: {s.context.scale}</span>}
                  </div>
                </div>
                <div className="example-row-action">
                  <ArrowRight size={16} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
