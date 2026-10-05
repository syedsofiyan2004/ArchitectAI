import React, { useState } from 'react';
import { ScenarioPreset } from '../types';

interface ComposerProps {
  scenarios: ScenarioPreset[];
  onSubmit: (data: {
    rawIntent: string;
    explicitConstraints: string[];
    declaredTechStack: string[];
    context: Record<string, string>;
  }) => void;
  isLoading: boolean;
}

export const Composer: React.FC<ComposerProps> = ({
  scenarios,
  onSubmit,
  isLoading,
}) => {
  const [prompt, setPrompt] = useState<string>(
    'Limit each authenticated user to 100 API requests per minute.'
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>('');
  const [framework, setFramework] = useState<string>('Node.js');
  const [database, setDatabase] = useState<string>('Redis');
  const [cloud, setCloud] = useState<string>('');
  const [scale, setScale] = useState<string>('10,000 active users');
  const [constraints, setConstraints] = useState<string>('');

  const handleSelectScenario = (scenario: ScenarioPreset) => {
    setPrompt(scenario.prompt);
    setLanguage(scenario.context.language || '');
    setFramework(scenario.context.framework || '');
    setDatabase(scenario.context.database || '');
    setCloud(scenario.context.cloud || '');
    setScale(scenario.context.scale || '');
    setConstraints(scenario.context.additionalConstraints || '');
  };

  const handleClear = () => {
    setPrompt('');
    setLanguage('');
    setFramework('');
    setDatabase('');
    setCloud('');
    setScale('');
    setConstraints('');
  };

  const triggerSubmit = () => {
    if (!prompt.trim() || isLoading) return;

    const declaredTechStack: string[] = [];
    if (language.trim()) declaredTechStack.push(language.trim());
    if (framework.trim()) declaredTechStack.push(framework.trim());
    if (database.trim()) declaredTechStack.push(database.trim());
    if (cloud.trim()) declaredTechStack.push(cloud.trim());

    const contextRecord: Record<string, string> = {};
    if (language.trim()) contextRecord['language'] = language.trim();
    if (framework.trim()) contextRecord['framework'] = framework.trim();
    if (database.trim()) contextRecord['database'] = database.trim();
    if (cloud.trim()) contextRecord['cloud'] = cloud.trim();
    if (scale.trim()) contextRecord['scale'] = scale.trim();
    if (constraints.trim()) contextRecord['additionalConstraints'] = constraints.trim();

    const explicitConstraints = constraints
      .split('\n')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    onSubmit({
      rawIntent: prompt.trim(),
      explicitConstraints,
      declaredTechStack,
      context: contextRecord,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      triggerSubmit();
    }
  };

  const hasCustomContext = Boolean(
    language || framework || database || cloud || scale || constraints
  );

  return (
    <div className="surface-card composer-container">
      <div className="composer-header">
        <h1>What are you building or changing?</h1>
        <p className="composer-subtext">
          Describe product intent in plain language. ArchitectAI discovers the distributed-systems,
          reliability, concurrency, and security unknowns you did not know to ask about.
        </p>
      </div>

      {scenarios.length > 0 && (
        <div className="template-picker" role="region" aria-label="Preset Scenarios">
          <span className="template-label">Quick Scenarios:</span>
          <div className="template-chips-scroll">
            {scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                className="template-chip"
                onClick={() => handleSelectScenario(s)}
                title={s.prompt}
              >
                <span className="chip-tag font-mono">{s.tag}</span>
                <span className="chip-title">{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="composer-form">
        <div className="composer-input-wrapper">
          <label htmlFor="intent-input" className="sr-only">
            What are you building or changing?
          </label>
          <textarea
            id="intent-input"
            rows={3}
            className="composer-textarea"
            placeholder="e.g. Limit each authenticated user to 100 API requests per minute..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />

          <div className="composer-bottom-bar">
            <button
              type="button"
              className="context-toggle-inline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
            >
              <span className="toggle-symbol">{showAdvanced ? '▾' : '▸'}</span>
              <span>Architecture Context & Constraints</span>
              {hasCustomContext && <span className="custom-indicator">Customized</span>}
            </button>

            <div className="composer-actions">
              <span className="keyboard-hint font-mono">
                Ctrl + Enter to run
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleClear}
                disabled={isLoading || !prompt}
              >
                Clear
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading || !prompt.trim()}
              >
                {isLoading ? (
                  <>
                    <span className="spinner" aria-hidden="true"></span>
                    <span>Discovering Unknowns...</span>
                  </>
                ) : (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Analyze Architecture</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {showAdvanced && (
          <div className="context-disclosure">
            <div className="context-fields-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="field-lang">
                  Language / Runtime
                </label>
                <input
                  id="field-lang"
                  type="text"
                  className="field-input"
                  placeholder="e.g. TypeScript, Go, Java"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="field-framework">
                  Framework
                </label>
                <input
                  id="field-framework"
                  type="text"
                  className="field-input"
                  placeholder="e.g. Node.js, Spring Boot, React"
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="field-db">
                  Database / Storage
                </label>
                <input
                  id="field-db"
                  type="text"
                  className="field-input"
                  placeholder="e.g. Redis, PostgreSQL, Kafka"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="field-cloud">
                  Cloud / Infra
                </label>
                <input
                  id="field-cloud"
                  type="text"
                  className="field-input"
                  placeholder="e.g. AWS, Kubernetes, Serverless"
                  value={cloud}
                  onChange={(e) => setCloud(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="field-scale">
                  Expected Scale / Concurrency
                </label>
                <input
                  id="field-scale"
                  type="text"
                  className="field-input"
                  placeholder="e.g. 10,000 active users, 500 images/minute"
                  value={scale}
                  onChange={(e) => setScale(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="field-constraints">
                  Explicit Non-Negotiable Constraints
                </label>
                <input
                  id="field-constraints"
                  type="text"
                  className="field-input"
                  placeholder="e.g. Must strictly avoid duplicate charges"
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
