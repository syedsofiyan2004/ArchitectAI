import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { useRuns } from '../store/runs';
import { ScenarioPreset } from '../types';

interface NewAnalysisPageProps {
  onOpenExamples: () => void;
}

export const NewAnalysisPage: React.FC<NewAnalysisPageProps> = ({ onOpenExamples }) => {
  const [prompt, setPrompt] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>('');
  const [framework, setFramework] = useState<string>('');
  const [database, setDatabase] = useState<string>('');
  const [cloud, setCloud] = useState<string>('');
  const [scale, setScale] = useState<string>('');
  const [constraints, setConstraints] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { createRun, activeRepository } = useRuns();

  useEffect(() => {
    if (activeRepository) {
      if (!language && activeRepository.detectedLanguages?.length) {
        setLanguage(activeRepository.detectedLanguages[0]);
      }
      if (!framework && activeRepository.detectedFrameworks?.length) {
        setFramework(activeRepository.detectedFrameworks[0]);
      }
    }
  }, [activeRepository]);

  // If navigated from an example or state
  useEffect(() => {
    const stateExample = (location.state as any)?.example as ScenarioPreset | undefined;
    if (stateExample) {
      setPrompt(stateExample.prompt);
      setLanguage(stateExample.context?.language || '');
      setFramework(stateExample.context?.framework || '');
      setDatabase(stateExample.context?.database || '');
      setCloud(stateExample.context?.cloud || '');
      setScale(stateExample.context?.scale || '');
      setConstraints(stateExample.context?.additionalConstraints || '');
      if (
        stateExample.context?.language ||
        stateExample.context?.framework ||
        stateExample.context?.database ||
        stateExample.context?.cloud ||
        stateExample.context?.scale ||
        stateExample.context?.additionalConstraints
      ) {
        setShowAdvanced(true);
      }
    }
  }, [location.state]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);

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

    try {
      const runId = await createRun({
        rawIntent: prompt.trim(),
        context: contextRecord,
        explicitConstraints,
        declaredTechStack,
      });
      // Immediate navigation to run screen!
      navigate(`/runs/${runId}`);
    } catch (err) {
      console.error('Failed to initiate analysis:', err);
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasCustomContext = Boolean(language || framework || database || cloud || scale || constraints);

  return (
    <div className="new-analysis-layout">
      <div className="new-analysis-header">
        <Link to="/" className="back-link">
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <div className="composer-hero-container">
        <h1 className="composer-hero-title">What are you building?</h1>
        <p className="composer-hero-desc">
          Describe the feature or system in plain language. ArchitectAI will identify engineering risks,
          architecture decisions, and verification requirements you may not know to ask about.
        </p>

        <form onSubmit={handleSubmit} className="composer-primary-form">
          <div className="composer-hero-input-wrap">
            <textarea
              id="intent-input"
              rows={4}
              className="composer-hero-textarea"
              placeholder="e.g. Limit each authenticated user to 100 API requests per minute..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              autoFocus
            />

            <div className="composer-hero-controls">
              <button
                type="button"
                className="context-toggle-btn"
                onClick={() => setShowAdvanced(!showAdvanced)}
                aria-expanded={showAdvanced}
              >
                {showAdvanced ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <span>Add technical context</span>
                {hasCustomContext && <span className="custom-badge font-mono">Customized</span>}
              </button>

              <div className="composer-hero-submit-group">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onOpenExamples}
                >
                  <Sparkles size={14} className="icon-brand" />
                  <span>Use an example</span>
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!prompt.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <span>Starting Analysis...</span>
                  ) : (
                    <>
                      <Zap size={14} />
                      <span>Analyze Architecture</span>
                      <kbd className="submit-kbd font-mono">⌘↵</kbd>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Progressive Disclosure Context Fields */}
          {showAdvanced && (
            <div className="context-fields-card">
              <div className="context-fields-heading">
                <span>Optional Technical Context & Constraints</span>
                <span className="context-fields-sub">
                  Helps ArchitectAI ground recommendations in your concrete stack.
                </span>
              </div>

              <div className="context-grid">
                <div className="form-field">
                  <label htmlFor="field-lang">Language / Runtime</label>
                  <input
                    id="field-lang"
                    type="text"
                    placeholder="e.g. TypeScript, Go, Java, Python"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="field-framework">Framework</label>
                  <input
                    id="field-framework"
                    type="text"
                    placeholder="e.g. Node.js, Next.js, Spring Boot"
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="field-db">Database / Cache</label>
                  <input
                    id="field-db"
                    type="text"
                    placeholder="e.g. Redis, PostgreSQL, Kafka"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="field-cloud">Cloud / Infrastructure</label>
                  <input
                    id="field-cloud"
                    type="text"
                    placeholder="e.g. AWS, Kubernetes, Cloudflare Workers"
                    value={cloud}
                    onChange={(e) => setCloud(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-field full-col">
                  <label htmlFor="field-scale">Expected Scale / Traffic</label>
                  <input
                    id="field-scale"
                    type="text"
                    placeholder="e.g. 10,000 active users, 500 images/minute"
                    value={scale}
                    onChange={(e) => setScale(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-field full-col">
                  <label htmlFor="field-constraints">Non-Negotiable Constraints</label>
                  <input
                    id="field-constraints"
                    type="text"
                    placeholder="e.g. Must strictly avoid duplicate charges"
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
