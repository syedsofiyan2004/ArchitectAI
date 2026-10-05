import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Sparkles, ArrowRight, Clock, ShieldAlert, CheckCircle2, ChevronRight } from 'lucide-react';
import { useRuns } from '../store/runs';

interface HomePageProps {
  onOpenExamples: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onOpenExamples }) => {
  const { runs } = useRuns();
  const navigate = useNavigate();

  return (
    <div className="home-container">
      {/* Product Hero */}
      <section className="home-hero">
        <div className="hero-badge font-mono">
          <span>Engine v0.2.0 • Autonomous Architecture Review</span>
        </div>
        <h1 className="hero-title">
          Engineering intelligence for AI-built software.
        </h1>
        <p className="hero-subtitle">
          Describe what you want to build in plain product language. ArchitectAI uncovers the distributed-systems,
          concurrency, memory, failure, and security risks you did not know to ask about.
        </p>

        <div className="hero-actions">
          <Link to="/new" className="btn-primary hero-btn">
            <Plus size={16} />
            <span>New Architecture Analysis</span>
            <kbd className="hero-kbd font-mono">N</kbd>
          </Link>
          <button
            type="button"
            className="btn-secondary hero-btn"
            onClick={onOpenExamples}
          >
            <Sparkles size={16} className="icon-brand" />
            <span>Try an Example</span>
          </button>
        </div>
      </section>

      {/* Recent Analyses Section */}
      <section className="recent-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Recent Analyses</h2>
            <p className="section-desc">
              Your software requirements, discovered engineering risks, and verified implementation plans.
            </p>
          </div>
          {runs.length > 0 && (
            <Link to="/new" className="text-link font-mono">
              <span>+ New Analysis</span>
            </Link>
          )}
        </div>

        {runs.length === 0 ? (
          <div className="empty-runs-card">
            <div className="empty-runs-icon">
              <Sparkles size={28} className="icon-muted" />
            </div>
            <h3>No analyses yet</h3>
            <p>
              Start by describing what you want to build or explore curated architecture examples.
            </p>
            <div className="empty-quick-starters">
              <button
                type="button"
                className="starter-chip"
                onClick={() =>
                  navigate('/new', {
                    state: {
                      example: {
                        prompt: 'Limit each authenticated user to 100 API requests per minute.',
                        context: { database: 'Redis', framework: 'Node.js' },
                      },
                    },
                  })
                }
              >
                <span>Rate Limiter</span>
                <ArrowRight size={13} />
              </button>
              <button
                type="button"
                className="starter-chip"
                onClick={() =>
                  navigate('/new', {
                    state: {
                      example: {
                        prompt: 'When my access token expires automatically refresh it and retry the failed request.',
                        context: { framework: 'React / Axios' },
                      },
                    },
                  })
                }
              >
                <span>Token Refresh Race</span>
                <ArrowRight size={13} />
              </button>
              <button
                type="button"
                className="starter-chip"
                onClick={() =>
                  navigate('/new', {
                    state: {
                      example: {
                        prompt: 'Process many large uploaded images in parallel as quickly as possible.',
                        context: { scale: '500 images/minute, up to 25MB each' },
                      },
                    },
                  })
                }
              >
                <span>Image Worker Queue</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ) : (
          <div className="runs-grid">
            {runs.map((run) => {
              const concernsCount = run.result?.contract.discoveredConcerns.length || 0;
              const criticalCount =
                run.result?.contract.discoveredConcerns.filter((c) => c.confidence >= 0.9).length || 0;
              const hasHigh =
                run.result?.contract.discoveredConcerns.some((c) => c.confidence >= 0.8) || false;

              return (
                <div
                  key={run.id}
                  className="run-card"
                  onClick={() => navigate(`/runs/${run.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/runs/${run.id}`);
                  }}
                >
                  <div className="run-card-top">
                    <span className="run-card-time font-mono">
                      <Clock size={12} />
                      <span>{new Date(run.createdAt).toLocaleDateString()}</span>
                    </span>
                    <span
                      className={`run-card-status font-mono ${
                        run.status === 'completed'
                          ? 'status-done'
                          : run.status === 'analyzing'
                          ? 'status-active'
                          : 'status-failed'
                      }`}
                    >
                      {run.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="run-card-title">{run.title}</h3>
                  <p className="run-card-intent">"{run.rawIntent}"</p>

                  <div className="run-card-footer">
                    <div className="run-risk-pills">
                      {concernsCount > 0 ? (
                        <>
                          <span className="risk-pill-count font-mono">
                            <ShieldAlert size={13} />
                            <span>{concernsCount} Risks</span>
                          </span>
                          {criticalCount > 0 ? (
                            <span className="risk-pill critical font-mono">CRITICAL</span>
                          ) : hasHigh ? (
                            <span className="risk-pill high font-mono">HIGH</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="risk-pill pending font-mono">Analyzing...</span>
                      )}
                    </div>
                    <ChevronRight size={16} className="run-card-arrow" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
