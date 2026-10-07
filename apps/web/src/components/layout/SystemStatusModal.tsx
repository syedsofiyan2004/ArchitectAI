import React, { useState, useEffect } from 'react';
import { X, Cpu, Database, CheckCircle2, Server, Terminal, Shield, FolderGit2 } from 'lucide-react';
import { ServerConfig, AgentInfo } from '../../types';

interface SystemStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemStatusModal: React.FC<SystemStatusModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'status' | 'providers' | 'agents' | 'knowledge' | 'workspace'>('status');
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [knowledgeStatus, setKnowledgeStatus] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/config')
        .then((res) => res.json())
        .then((data) => setConfig(data))
        .catch((err) => console.error('Failed to load status', err));

      fetch('/api/system/capabilities')
        .then((res) => res.json())
        .then((data) => { if (data.success) setCapabilities(data.capabilities); })
        .catch(() => {});

      fetch('/api/providers')
        .then((res) => res.json())
        .then((data) => { if (data.success) setProviders(data.providers); })
        .catch(() => {});

      fetch('/api/agents')
        .then((res) => res.json())
        .then((data) => { if (data.success) setAgents(data.agents); })
        .catch(() => {});

      fetch('/api/knowledge/status')
        .then((res) => res.json())
        .then((data) => { if (data.success) setKnowledgeStatus(data.status); })
        .catch(() => {});

      fetch('/api/settings')
        .then((res) => res.json())
        .then((data) => { if (data.success) setSettings(data.settings); })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleTestProvider = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/providers/test', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
    } catch (err: unknown) {
      setTestResult({ success: false, error: String(err) });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Server className="icon-muted" size={18} />
            <h3>System Status & Workspace Settings</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color, #30363d)', padding: '0 20px', gap: '8px' }}>
          {[
            { id: 'status', label: 'Capabilities' },
            { id: 'providers', label: 'Providers' },
            { id: 'agents', label: 'Coding Agents' },
            { id: 'knowledge', label: 'Knowledge' },
            { id: 'workspace', label: 'Workspace' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--brand-blue, #58a6ff)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--text-primary, #f0f6fc)' : 'var(--text-muted, #8b949e)',
                padding: '10px 12px',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ minHeight: '260px' }}>
          {activeTab === 'status' && (
            <div className="status-grid">
              <div className="status-item">
                <div className="status-item-label">
                  <CheckCircle2 className="icon-success" size={15} />
                  <span>Analysis Provider</span>
                </div>
                <div className="status-item-value font-mono">
                  {capabilities?.analysisProvider || (config?.mode === 'remote-model' ? 'READY' : 'DETERMINISTIC_READY')}
                </div>
              </div>

              <div className="status-item">
                <div className="status-item-label">
                  <Database className="icon-muted" size={15} />
                  <span>Knowledge Registry</span>
                </div>
                <div className="status-item-value font-mono">
                  {capabilities?.knowledgeRegistry || 'READY'} ({config?.knowledgeItemsCount || 0} items)
                </div>
              </div>

              <div className="status-item">
                <div className="status-item-label">
                  <Terminal className="icon-muted" size={15} />
                  <span>Coding Agent</span>
                </div>
                <div className="status-item-value font-mono">
                  {capabilities?.codingAgent || 'READY'}
                </div>
              </div>

              <div className="status-item">
                <div className="status-item-label">
                  <FolderGit2 className="icon-muted" size={15} />
                  <span>Git Runtime</span>
                </div>
                <div className="status-item-value font-mono">
                  {capabilities?.git || 'READY'}
                </div>
              </div>

              <div className="status-item">
                <div className="status-item-label">
                  <Shield className="icon-muted" size={15} />
                  <span>Verification Engine</span>
                </div>
                <div className="status-item-value font-mono">
                  {capabilities?.verificationRuntime || 'READY'}
                </div>
              </div>

              <div className="status-item">
                <div className="status-item-label">
                  <Cpu className="icon-muted" size={15} />
                  <span>Repository Access</span>
                </div>
                <div className="status-item-value font-mono">
                  {capabilities?.repositoryAccess || 'READY'}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'providers' && (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted, #8b949e)', marginBottom: '14px' }}>
                Architecture providers translate intent and synthesize verifiable engineering contracts. API keys are strictly referenced from environment variables and never stored in plaintext.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {providers.map((p) => (
                  <div key={p.id} style={{ padding: '12px', border: '1px solid var(--border-color, #30363d)', borderRadius: '6px', background: 'var(--bg-dark, #0d1117)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--text-primary, #f0f6fc)' }}>{p.displayName}</strong>
                      <span className="font-mono" style={{ fontSize: '12px', color: p.enabled ? 'var(--success-green, #3fb950)' : 'var(--text-muted, #8b949e)' }}>
                        {p.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted, #8b949e)', marginTop: '4px' }}>
                      Type: <span className="font-mono">{p.type}</span> • Model: <span className="font-mono">{p.modelName}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted, #8b949e)', marginTop: '2px' }}>
                      Credential Reference: <span className="font-mono">{p.credentialReference || '(Deterministic / None)'}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button type="button" className="btn-secondary" onClick={handleTestProvider} disabled={isTesting}>
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </button>
                {testResult && (
                  <span style={{ fontSize: '13px', color: testResult.healthy ? 'var(--success-green, #3fb950)' : 'var(--danger-red, #f85149)' }}>
                    {testResult.healthy ? '✓ Healthy: ' + (testResult.diagnostic || 'Connected') : '✕ ' + (testResult.error || 'Connection Failed')}
                  </span>
                )}
              </div>
            </div>
          )}

          {activeTab === 'agents' && (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted, #8b949e)', marginBottom: '14px' }}>
                Detected coding agents execute implementation tasks in isolated Git worktrees.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {agents.map((a) => (
                  <div key={a.id} style={{ padding: '12px', border: '1px solid var(--border-color, #30363d)', borderRadius: '6px', background: 'var(--bg-dark, #0d1117)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--text-primary, #f0f6fc)' }}>{a.name}</strong>
                      <span className="font-mono" style={{ fontSize: '12px', color: a.available ? 'var(--success-green, #3fb950)' : 'var(--danger-red, #f85149)' }}>
                        {a.available ? 'AVAILABLE' : 'UNAVAILABLE'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted, #8b949e)', marginTop: '4px' }}>
                      Adapter ID: <span className="font-mono">{a.id}</span> {a.version ? `• Version: ${a.version}` : ''}
                    </div>
                    {a.reason && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted, #8b949e)', marginTop: '2px' }}>
                        Notice: {a.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'knowledge' && (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted, #8b949e)', marginBottom: '14px' }}>
                Engineering intelligence combines curated prototype knowledge fixtures and accepted authoritative acquired items.
              </p>
              <div className="status-grid">
                <div className="status-item">
                  <div className="status-item-label"><span>Curated Prototype Fixtures</span></div>
                  <div className="status-item-value font-mono">{knowledgeStatus?.curatedCount || 16}</div>
                </div>
                <div className="status-item">
                  <div className="status-item-label"><span>Accepted Acquired Items</span></div>
                  <div className="status-item-value font-mono">{knowledgeStatus?.acceptedAcquiredCount || 0}</div>
                </div>
                <div className="status-item">
                  <div className="status-item-label"><span>Pending Review Required</span></div>
                  <div className="status-item-value font-mono">{knowledgeStatus?.reviewRequiredCount || 0}</div>
                </div>
                <div className="status-item">
                  <div className="status-item-label"><span>Multi-Source Conflicts</span></div>
                  <div className="status-item-value font-mono">{knowledgeStatus?.conflictsCount || 0}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workspace' && (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted, #8b949e)', marginBottom: '14px' }}>
                Local workspace settings and repository restrictions.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ padding: '12px', border: '1px solid var(--border-color, #30363d)', borderRadius: '6px', background: 'var(--bg-dark, #0d1117)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary, #f0f6fc)', fontWeight: 600 }}>Allowed Repository Roots</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #8b949e)', marginTop: '4px' }}>
                    {settings?.allowedRepositoryRoots?.length > 0
                      ? settings.allowedRepositoryRoots.join(', ')
                      : 'Unrestricted (Local Developer Mode permits user-selected Git repos)'}
                  </div>
                </div>
                <div style={{ padding: '12px', border: '1px solid var(--border-color, #30363d)', borderRadius: '6px', background: 'var(--bg-dark, #0d1117)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary, #f0f6fc)', fontWeight: 600 }}>Artifact Size Bound</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #8b949e)', marginTop: '4px' }}>
                    Max per artifact: <span className="font-mono">{(settings?.maxArtifactSizeBytes || 5242880) / 1024 / 1024} MB</span> (Bounded storage at data/artifacts/)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
