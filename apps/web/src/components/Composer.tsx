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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="composer-container card">
      <div className="card-header">
        <div className="section-label">
          <span className="dot-indicator"></span>
          <span>Requirement Input</span>
        </div>
        <span className="helper-text">
          Describe product intent in plain language. ArchitectAI will discover the systems concerns.
        </span>
      </div>

      <div className="presets-bar">
        <span className="presets-label">Preset Scenarios:</span>
        <div className="presets-scroll">
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              className="preset-btn"
              onClick={() => handleSelectScenario(s)}
              title={s.prompt}
            >
              <span className="preset-tag font-mono">{s.tag}</span>
              <span className="preset-title">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="composer-form">
        <div className="textarea-wrapper">
          <label htmlFor="intent-input" className="input-label">
            What are you building or changing?
          </label>
          <textarea
            id="intent-input"
            rows={3}
            className="composer-textarea"
            placeholder="e.g. Limit each authenticated user to 100 API requests per minute..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="advanced-toggle-bar">
          <button
            type="button"
            className="text-toggle-btn"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span className="toggle-icon">{showAdvanced ? '▾' : '▸'}</span>
            <span>Optional Architecture Context & Constraints</span>
            {(language || framework || database || cloud || scale || constraints) && (
              <span className="active-pill">Customized</span>
            )}
          </button>
        </div>

        {showAdvanced && (
          <div className="advanced-grid">
            <div className="field-group">
              <label className="field-label">Language / Runtime</label>
              <input
                type="text"
                className="field-input"
                placeholder="e.g. TypeScript, Go, Java"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="field-group">
              <label className="field-label">Framework</label>
              <input
                type="text"
                className="field-input"
                placeholder="e.g. Node.js, Spring Boot, React"
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="field-group">
              <label className="field-label">Database / Cache</label>
              <input
                type="text"
                className="field-input"
                placeholder="e.g. Redis, PostgreSQL, Kafka"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="field-group">
              <label className="field-label">Cloud / Infra</label>
              <input
                type="text"
                className="field-input"
                placeholder="e.g. AWS, Kubernetes, Serverless"
                value={cloud}
                onChange={(e) => setCloud(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="field-group full-width">
              <label className="field-label">Expected Scale / Traffic</label>
              <input
                type="text"
                className="field-input"
                placeholder="e.g. 10,000 active users, 500 images/minute"
                value={scale}
                onChange={(e) => setScale(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="field-group full-width">
              <label className="field-label">Additional Constraints</label>
              <input
                type="text"
                className="field-input"
                placeholder="e.g. Must strictly avoid duplicate charges"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setPrompt('');
              setLanguage('');
              setFramework('');
              setDatabase('');
              setCloud('');
              setScale('');
              setConstraints('');
            }}
            disabled={isLoading || !prompt}
          >
            Clear
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                <span>Discovering Unknowns...</span>
              </>
            ) : (
              <>
                <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                </svg>
                <span>Analyze Architecture</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
