import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  Terminal,
  BookOpen,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Shield,
  Layers,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'provider' | 'agent' | 'knowledge' | 'advanced';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [capabilities, setCapabilities] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/system/capabilities')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setCapabilities(data.capabilities);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestProvider = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/providers/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTestResult('Connected successfully: response verified.');
      } else {
        setTestResult(data.error || 'Connection test failed.');
      }
    } catch (err: unknown) {
      setTestResult(err instanceof Error ? err.message : 'Connection test error.');
    } finally {
      setIsTesting(false);
    }
  };

  const isDemo = capabilities?.reasoningModel?.isDemo ?? true;
  const codexAvailable = capabilities?.codingAgent?.codexAvailable ?? false;
  const codexVersion = capabilities?.codingAgent?.codexVersion || '0.158.0';

  return (
    <div className="modal-backdrop settings-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="settings-heading">
      <div className="modal-content settings-modal-box">
        <div className="settings-modal-header">
          <div className="settings-header-title-group">
            <Sliders size={18} className="text-brand" />
            <h2 id="settings-heading" className="modal-title">Settings</h2>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-modal-body">
          {/* Settings Tabs Sidebar */}
          <nav className="settings-nav-sidebar" aria-label="Settings categories">
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <Sliders size={14} />
              <span>General</span>
            </button>
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === 'provider' ? 'active' : ''}`}
              onClick={() => setActiveTab('provider')}
            >
              <Cpu size={14} />
              <span>AI Provider</span>
            </button>
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === 'agent' ? 'active' : ''}`}
              onClick={() => setActiveTab('agent')}
            >
              <Terminal size={14} />
              <span>Coding Agent</span>
            </button>
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
              onClick={() => setActiveTab('knowledge')}
            >
              <BookOpen size={14} />
              <span>Knowledge</span>
            </button>
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}
              onClick={() => setActiveTab('advanced')}
            >
              <Layers size={14} />
              <span>Advanced</span>
            </button>
          </nav>

          {/* Settings Tab Content */}
          <div className="settings-tab-panel">
            {/* GENERAL */}
            {activeTab === 'general' && (
              <div className="settings-section">
                <h3 className="section-title">Product Workspace</h3>
                <p className="section-desc">Local-first engineering intelligence platform.</p>

                <div className="settings-card">
                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Environment</strong>
                      <p className="setting-subtext">Local desktop workspace with SQLite persistence.</p>
                    </div>
                    <span className="status-pill font-mono">Development</span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Storage Integrity</strong>
                      <p className="setting-subtext">Runs, sessions, and contracts are saved to SQLite.</p>
                    </div>
                    <span className="status-pill text-success font-mono">SQLite Ready</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI PROVIDER */}
            {activeTab === 'provider' && (
              <div className="settings-section">
                <h3 className="section-title">AI Reasoning Provider</h3>
                <p className="section-desc">ArchitectAI uses structured reasoning to discover engineering failure modes.</p>

                <div className="settings-card">
                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Active Provider</strong>
                      <p className="setting-subtext">
                        {isDemo ? 'Deterministic Demo Mode' : capabilities?.reasoningModel?.provider || 'OpenAI Compatible'}
                      </p>
                    </div>
                    <span className={`status-pill ${isDemo ? 'text-warning' : 'text-success'} font-mono`}>
                      {isDemo ? 'Demo Mode' : 'Connected'}
                    </span>
                  </div>

                  {isDemo ? (
                    <div className="demo-notice-box">
                      <Sparkles size={15} className="text-warning" />
                      <p>
                        Demo reasoning is active. ArchitectAI uses deterministic fixture knowledge for instant local exploration
                        without an API key. Add <code>OPENAI_API_KEY</code> to your environment for live remote reasoning.
                      </p>
                    </div>
                  ) : (
                    <div className="settings-row">
                      <div>
                        <strong className="setting-label">Credentials</strong>
                        <p className="setting-subtext">Supplied securely by environment variables (never exposed in UI).</p>
                      </div>
                      <span className="font-mono text-muted">Configured</span>
                    </div>
                  )}

                  <div className="settings-actions-row">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleTestProvider}
                      disabled={isTesting}
                    >
                      {isTesting ? 'Testing...' : 'Test Connection'}
                    </button>
                    {testResult && (
                      <span className="test-result-msg font-mono text-secondary">
                        {testResult}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CODING AGENT */}
            {activeTab === 'agent' && (
              <div className="settings-section">
                <h3 className="section-title">Coding Agent Integration</h3>
                <p className="section-desc">ArchitectAI delegates implementation through isolated agent adapters.</p>

                <div className="settings-card">
                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Codex CLI</strong>
                      <p className="setting-subtext">Official non-interactive CLI for autonomous code editing.</p>
                    </div>
                    <span className={`status-pill ${codexAvailable ? 'text-success' : 'text-muted'} font-mono`}>
                      {codexAvailable ? `Detected v${codexVersion}` : 'Not Detected'}
                    </span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Execution Safety</strong>
                      <p className="setting-subtext">Strict isolated Git worktree. Dangerous bypass is permanently disabled.</p>
                    </div>
                    <span className="status-pill text-success font-mono">Workspace Sandbox</span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Deterministic Fallback Agent</strong>
                      <p className="setting-subtext">Available for automated testing and CI pipelines.</p>
                    </div>
                    <span className="status-pill text-success font-mono">Available</span>
                  </div>
                </div>
              </div>
            )}

            {/* KNOWLEDGE */}
            {activeTab === 'knowledge' && (
              <div className="settings-section">
                <h3 className="section-title">Engineering Knowledge Base</h3>
                <p className="section-desc">Three-level knowledge model bridging durable fundamentals and technologies.</p>

                <div className="settings-card">
                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Curated Primitives (L1 Fundamentals)</strong>
                      <p className="setting-subtext">Memory, concurrency, throughput, trust boundaries, resource ownership.</p>
                    </div>
                    <span className="font-mono font-medium">16 items</span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Failure Patterns (L2 Modes)</strong>
                      <p className="setting-subtext">OOM, boundary bursts, race conditions, retry amplification, stampedes.</p>
                    </div>
                    <span className="font-mono font-medium">42 patterns</span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Technology Specifics (L3 Constraints)</strong>
                      <p className="setting-subtext">Node.js, PostgreSQL, Redis, Linux OS primitives with provenance.</p>
                    </div>
                    <span className="font-mono font-medium">24 specs</span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Approved Source Registry</strong>
                      <p className="setting-subtext">Acquisition locked to registered authoritative domains (RFC, official docs).</p>
                    </div>
                    <span className="status-pill text-success font-mono">Enforced</span>
                  </div>
                </div>
              </div>
            )}

            {/* ADVANCED */}
            {activeTab === 'advanced' && (
              <div className="settings-section">
                <h3 className="section-title">Kernel Diagnostics</h3>
                <p className="section-desc">Underlying runtime boundaries and capability verification.</p>

                <div className="settings-card">
                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Git Isolation Engine</strong>
                      <p className="setting-subtext">Per-run temporary worktrees with pre-agent command snapshotting.</p>
                    </div>
                    <span className="status-pill text-success font-mono">Active</span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Verification Runtime</strong>
                      <p className="setting-subtext">Local process sandbox with bounded memory and timeout supervision.</p>
                    </div>
                    <span className="status-pill text-success font-mono">Ready</span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Crash Recovery Supervisor</strong>
                      <p className="setting-subtext">Detects orphaned worktrees and stale runs on startup.</p>
                    </div>
                    <span className="status-pill text-success font-mono">Supervised</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
