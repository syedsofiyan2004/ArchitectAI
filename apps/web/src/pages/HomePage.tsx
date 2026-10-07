import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Sparkles, ArrowRight, Clock, ShieldAlert, ChevronRight, FolderGit2, RefreshCw, GitBranch } from 'lucide-react';
import { useRuns } from '../store/runs';

interface HomePageProps {
  onOpenExamples: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onOpenExamples }) => {
  const {
    runs,
    projects,
    activeProject,
    activeRepository,
    createProject,
    selectProject,
    registerRepository,
    refreshRepository,
  } = useRuns();
  const navigate = useNavigate();

  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [repoPathInput, setRepoPathInput] = useState('');
  const [showConnectRepo, setShowConnectRepo] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      await createProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewProject(false);
    } catch (err: unknown) {
      console.error('Failed to create project', err);
    }
  };

  const handleRegisterRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoPathInput.trim()) return;
    setRepoError(null);
    try {
      await registerRepository(repoPathInput.trim());
      setRepoPathInput('');
      setShowConnectRepo(false);
    } catch (err: unknown) {
      setRepoError(err instanceof Error ? err.message : 'Failed to register repository');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshRepository();
    } finally {
      setIsRefreshing(false);
    }
  };

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

      {/* Project & Repository Workspace Header */}
      <section className="project-workspace-banner" style={{
        background: 'var(--card-bg, #161b22)',
        border: '1px solid var(--border-color, #30363d)',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '28px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <FolderGit2 size={18} className="icon-brand" style={{ color: 'var(--brand-blue, #58a6ff)' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #8b949e)', textTransform: 'uppercase', letterSpacing: '0.05em' }} className="font-mono">
                Active Project:
              </span>
              {projects.length > 1 ? (
                <select
                  value={activeProject?.id || ''}
                  onChange={(e) => selectProject(e.target.value)}
                  style={{
                    background: 'var(--bg-dark, #0d1117)',
                    color: 'var(--text-primary, #c9d1d9)',
                    border: '1px solid var(--border-color, #30363d)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '13px',
                  }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <strong style={{ fontSize: '14px', color: 'var(--text-primary, #f0f6fc)' }}>
                  {activeProject?.name || 'Default Workspace'}
                </strong>
              )}
              <button
                type="button"
                onClick={() => setShowNewProject(!showNewProject)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand-blue, #58a6ff)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginLeft: '4px',
                }}
              >
                + New Project
              </button>
            </div>

            {/* Registered Repo Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '13px', color: 'var(--text-muted, #8b949e)' }}>
              {activeRepository ? (
                <>
                  <span style={{ color: 'var(--text-primary, #c9d1d9)' }}>{activeRepository.repositoryName}</span>
                  <span className="font-mono" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <GitBranch size={12} />
                    {activeRepository.defaultBranch}
                  </span>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted, #8b949e)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                    }}
                    title="Refresh repository context"
                  >
                    <RefreshCw size={12} className={isRefreshing ? 'spin' : ''} />
                    <span>Refresh</span>
                  </button>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted, #8b949e)' }}>
                  No repository linked.{' '}
                  <button
                    type="button"
                    onClick={() => setShowConnectRepo(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand-blue, #58a6ff)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontSize: '13px',
                    }}
                  >
                    Connect local Git repo
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal/Form to Connect Repository */}
        {showConnectRepo && (
          <form onSubmit={handleRegisterRepo} style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', marginTop: '8px' }}>
            <input
              type="text"
              placeholder="e.g. D:/architectai or /path/to/repo"
              value={repoPathInput}
              onChange={(e) => setRepoPathInput(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                background: 'var(--bg-dark, #0d1117)',
                border: '1px solid var(--border-color, #30363d)',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '13px',
              }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
              Connect
            </button>
            <button
              type="button"
              onClick={() => { setShowConnectRepo(false); setRepoError(null); }}
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: '13px' }}
            >
              Cancel
            </button>
          </form>
        )}

        {showNewProject && (
          <form onSubmit={handleCreateProject} style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', marginTop: '8px' }}>
            <input
              type="text"
              placeholder="New Project Name (e.g. Payments API)"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                background: 'var(--bg-dark, #0d1117)',
                border: '1px solid var(--border-color, #30363d)',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '13px',
              }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowNewProject(false)}
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: '13px' }}
            >
              Cancel
            </button>
          </form>
        )}

        {repoError && (
          <div style={{ color: 'var(--danger-red, #f85149)', fontSize: '12px', width: '100%', marginTop: '4px' }}>
            {repoError}
          </div>
        )}
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
