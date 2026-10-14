import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Terminal,
  BookOpen,
  Sliders,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  FolderGit2,
  ShieldCheck,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import { Modal, ModalHeader, ModalBody } from '../ui/Modal';
import { Tabs, TabList, TabTrigger, TabContent } from '../ui/Tabs';
import { Button } from '../ui/Button';
import { useRuns } from '../../store/runs';

export type SettingsTab = 'general' | 'provider' | 'agent' | 'knowledge' | 'advanced';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'general',
}) => {
  const { csrfToken } = useRuns();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Real backend states
  const [capabilities, setCapabilities] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [knowledgeStatus, setKnowledgeStatus] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  // UI / Action states
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ healthy: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [preferredAgent, setPreferredAgent] = useState<string>('');
  const [isSavingAgent, setIsSavingAgent] = useState(false);
  const [agentSaveSuccess, setAgentSaveSuccess] = useState(false);

  // Settings editing state
  const [allowedRootsInput, setAllowedRootsInput] = useState<string>('');
  const [maxArtifactMB, setMaxArtifactMB] = useState<number>(5);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      loadAllData();
    }
  }, [isOpen, initialTab]);

  const loadAllData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [capRes, provRes, agentRes, knowRes, setRes] = await Promise.allSettled([
        fetch('/api/system/capabilities').then((r) => r.json()),
        fetch('/api/providers').then((r) => r.json()),
        fetch('/api/agents').then((r) => r.json()),
        fetch('/api/knowledge/status').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
      ]);

      if (capRes.status === 'fulfilled' && capRes.value.success) {
        setCapabilities(capRes.value.capabilities);
      }
      if (provRes.status === 'fulfilled' && provRes.value.success) {
        setProviders(provRes.value.providers || []);
      }
      if (agentRes.status === 'fulfilled' && agentRes.value.success) {
        const agList = agentRes.value.agents || [];
        setAgents(agList);
        const preferred = agList.find((a: any) => a.preferred);
        if (preferred) {
          setPreferredAgent(preferred.id);
        } else if (agList.length > 0) {
          setPreferredAgent(agList[0].id);
        }
      }
      if (knowRes.status === 'fulfilled' && knowRes.value.success) {
        setKnowledgeStatus(knowRes.value.status);
      }
      if (setRes.status === 'fulfilled' && setRes.value.success) {
        const s = setRes.value.settings;
        setSettings(s);
        setAllowedRootsInput((s.allowedRepositoryRoots || []).join(', '));
        setMaxArtifactMB(Math.round((s.maxArtifactSizeBytes || 5242880) / (1024 * 1024)));
        if (s.preferredAgentId) {
          setPreferredAgent(s.preferredAgentId);
        }
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load backend settings');
    } finally {
      setLoading(false);
    }
  };

  const handleTestProvider = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/providers/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
      });
      const data = await res.json();
      if (res.ok && data.healthy === true) {
        setTestResult({
          healthy: true,
          message: data.diagnostic || 'Provider connection verified successfully.',
        });
      } else {
        setTestResult({
          healthy: false,
          message: data.error || data.diagnostic || 'Connection test failed.',
        });
      }
    } catch (err: unknown) {
      setTestResult({
        healthy: false,
        message: err instanceof Error ? err.message : 'Connection test request failed.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSelectPreferredAgent = async (agentId: string) => {
    setPreferredAgent(agentId);
    setIsSavingAgent(true);
    setAgentSaveSuccess(false);
    try {
      const res = await fetch('/api/agents/preferred', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({ adapterId: agentId }),
      });
      const data = await res.json();
      if (data.success) {
        setAgentSaveSuccess(true);
        setTimeout(() => setAgentSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Failed to set preferred agent:', err);
    } finally {
      setIsSavingAgent(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSaveSuccess(false);
    try {
      const roots = allowedRootsInput
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const sizeBytes = Math.max(1, maxArtifactMB) * 1024 * 1024;

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({
          allowedRepositoryRoots: roots,
          maxArtifactSizeBytes: sizeBytes,
          preferredAgentId: preferredAgent || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setSettingsSaveSuccess(true);
        setTimeout(() => setSettingsSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (!isOpen) return null;

  const isDemo = capabilities?.details?.provider?.id === 'deterministic-demo' ||
    capabilities?.analysisProvider === 'READY' && (!providers.length || providers[0]?.type === 'DETERMINISTIC_DEMO');
  const activeProvider = providers.find((p) => p.enabled) || providers[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      maxWidth="820px"
      ariaLabelledBy="settings-heading"
      backdropClassName="settings-modal-backdrop"
      className="settings-modal-box"
    >
      <ModalHeader
        title="Settings & Workspace Configuration"
        titleId="settings-heading"
        icon={<Sliders size={18} className="text-brand" />}
        onClose={onClose}
      />

      <ModalBody noPadding className="settings-modal-body-layout">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as SettingsTab)}
          orientation="vertical"
          className="settings-tabs-container"
        >
          {/* Settings Tabs Sidebar Navigation (approx 190px) */}
          <TabList aria-label="Settings categories" className="settings-nav-sidebar">
            <TabTrigger value="general" icon={<Sliders size={15} />}>
              General
            </TabTrigger>
            <TabTrigger value="provider" icon={<Cpu size={15} />}>
              AI Provider
            </TabTrigger>
            <TabTrigger value="agent" icon={<Terminal size={15} />}>
              Coding Agent
            </TabTrigger>
            <TabTrigger value="knowledge" icon={<BookOpen size={15} />}>
              Knowledge
            </TabTrigger>
            <TabTrigger value="advanced" icon={<Layers size={15} />}>
              Advanced
            </TabTrigger>
          </TabList>

          {/* Settings Tab Content Area */}
          <div className="settings-content-area">
            {loadError && (
              <div className="settings-error-banner" role="alert" style={{ margin: '16px', padding: '10px 14px', background: '#381a1a', border: '1px solid #da3633', borderRadius: '6px', color: '#f85149', fontSize: '13px' }}>
                <AlertCircle size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                <span>{loadError}</span>
              </div>
            )}

            {/* 1. GENERAL / WORKSPACE */}
            <TabContent value="general" className="settings-tab-panel">
              <div className="settings-section">
                <h3 className="section-title">Product Workspace</h3>
                <p className="section-desc">Local-first engineering intelligence workspace settings.</p>

                <div className="settings-card">
                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Persistence Engine</strong>
                      <p className="setting-subtext">All projects, runs, sessions, and contracts persist in SQLite.</p>
                    </div>
                    <span className="status-pill text-success font-mono">SQLite Connected</span>
                  </div>

                  <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
                    <div>
                      <label htmlFor="settings-roots" className="setting-label" style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
                        Allowed Repository Roots (comma separated)
                      </label>
                      <input
                        id="settings-roots"
                        type="text"
                        className="font-mono text-input"
                        placeholder="Leave empty to permit any local repository"
                        value={allowedRootsInput}
                        onChange={(e) => setAllowedRootsInput(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-dark, #0d1117)', border: '1px solid var(--border-color, #30363d)', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                      />
                      <p className="setting-subtext" style={{ marginTop: '4px' }}>
                        Optional security boundary limiting which directory paths may be registered.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="settings-artifact-size" className="setting-label" style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
                        Max Artifact Size (MB)
                      </label>
                      <input
                        id="settings-artifact-size"
                        type="number"
                        min="1"
                        max="50"
                        className="font-mono text-input"
                        value={maxArtifactMB}
                        onChange={(e) => setMaxArtifactMB(Number(e.target.value))}
                        style={{ width: '120px', padding: '8px 12px', background: 'var(--bg-dark, #0d1117)', border: '1px solid var(--border-color, #30363d)', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                      />
                      <p className="setting-subtext" style={{ marginTop: '4px' }}>
                        Bounded storage prevents oversized diff patches or logs from exhausting local storage.
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                      <Button type="submit" variant="primary" isLoading={isSavingSettings} disabled={isSavingSettings}>
                        {isSavingSettings ? 'Saving...' : 'Save Settings'}
                      </Button>
                      {settingsSaveSuccess && (
                        <span className="font-mono text-success" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={14} /> Saved successfully
                        </span>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </TabContent>

            {/* 2. AI PROVIDER */}
            <TabContent value="provider" className="settings-tab-panel">
              <div className="settings-section">
                <h3 className="section-title">AI Reasoning Provider</h3>
                <p className="section-desc">ArchitectAI uses structured reasoning to discover engineering failure modes.</p>

                <div className="settings-card">
                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Active Provider</strong>
                      <p className="setting-subtext">
                        {activeProvider ? activeProvider.displayName : (capabilities?.details?.provider?.name || 'Deterministic Demo Kernel')}
                      </p>
                    </div>
                    <span className={`status-pill ${capabilities?.analysisProvider === 'READY' ? (isDemo ? 'text-warning' : 'text-success') : 'text-danger'} font-mono`}>
                      {capabilities?.analysisProvider === 'READY' ? (isDemo ? 'Demo Mode' : 'Connected') : (capabilities?.analysisProvider || 'Unavailable')}
                    </span>
                  </div>

                  {activeProvider && (
                    <div className="settings-row">
                      <div>
                        <strong className="setting-label">Model Name</strong>
                        <p className="setting-subtext font-mono">{activeProvider.modelName || 'Deterministic Kernel'}</p>
                      </div>
                      <span className="font-mono text-muted">{activeProvider.type}</span>
                    </div>
                  )}

                  {isDemo ? (
                    <div className="demo-notice-box" style={{ margin: '12px 0' }}>
                      <Sparkles size={15} className="text-warning" />
                      <p>
                        Demo reasoning is active. ArchitectAI uses deterministic fixture knowledge for instant local exploration
                        without an API key. Set <code>ARCHITECTAI_API_KEY</code> in your environment for remote models.
                      </p>
                    </div>
                  ) : (
                    <div className="settings-row">
                      <div>
                        <strong className="setting-label">Credentials Reference</strong>
                        <p className="setting-subtext font-mono">
                          {activeProvider?.credentialReference || 'ARCHITECTAI_API_KEY'}
                        </p>
                      </div>
                      <span className="font-mono text-muted">Configured in env</span>
                    </div>
                  )}

                  <div className="settings-actions-row" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleTestProvider}
                      disabled={isTesting}
                      isLoading={isTesting}
                    >
                      {isTesting ? 'Testing...' : 'Test Connection'}
                    </Button>
                    {testResult && (
                      <span
                        className={`test-result-msg font-mono ${testResult.healthy ? 'text-success' : 'text-danger'}`}
                        style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {testResult.healthy ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        {testResult.message}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </TabContent>

            {/* 3. CODING AGENT */}
            <TabContent value="agent" className="settings-tab-panel">
              <div className="settings-section">
                <h3 className="section-title">Coding Agent Integration</h3>
                <p className="section-desc">ArchitectAI delegates implementation through isolated agent adapters.</p>

                <div className="settings-card">
                  {loading && agents.length === 0 ? (
                    <p className="text-muted font-mono" style={{ padding: '12px' }}>Detecting agents...</p>
                  ) : agents.length === 0 ? (
                    <div className="settings-row">
                      <span className="text-danger font-mono">No coding agent adapters detected.</span>
                    </div>
                  ) : (
                    agents.map((ag) => (
                      <div key={ag.id} className="settings-row" style={{ alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong className="setting-label">{ag.name}</strong>
                            {ag.id === preferredAgent && (
                              <span className="status-pill text-brand font-mono" style={{ fontSize: '11px' }}>Preferred</span>
                            )}
                          </div>
                          <p className="setting-subtext">
                            Adapter ID: <span className="font-mono">{ag.id}</span>
                            {ag.version ? ` • Detected v${ag.version}` : ''}
                          </p>
                          {ag.reason && (
                            <p className="setting-subtext text-warning" style={{ marginTop: '2px' }}>
                              Notice: {ag.reason}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className={`status-pill ${ag.available ? 'text-success' : 'text-muted'} font-mono`}>
                            {ag.available ? 'Available' : 'Unavailable'}
                          </span>
                          {ag.available && (
                            <Button
                              type="button"
                              variant={ag.id === preferredAgent ? 'ghost' : 'secondary'}
                              size="sm"
                              onClick={() => handleSelectPreferredAgent(ag.id)}
                              disabled={ag.id === preferredAgent || isSavingAgent}
                            >
                              {ag.id === preferredAgent ? 'Active' : 'Set Preferred'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {agentSaveSuccess && (
                    <div style={{ padding: '8px 12px', marginTop: '6px', background: 'rgba(63, 185, 80, 0.1)', border: '1px solid #3fb950', borderRadius: '4px', color: '#3fb950', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={14} /> Preferred coding agent updated and saved.
                    </div>
                  )}

                  <div className="settings-row" style={{ marginTop: '12px', borderTop: '1px solid var(--border-color, #30363d)', paddingTop: '12px' }}>
                    <div>
                      <strong className="setting-label">Execution Safety Boundary</strong>
                      <p className="setting-subtext">Strict isolated Git worktree. Dangerous bypass is permanently disabled.</p>
                    </div>
                    <span className="status-pill text-success font-mono">Worktree Sandbox</span>
                  </div>
                </div>
              </div>
            </TabContent>

            {/* 4. KNOWLEDGE */}
            <TabContent value="knowledge" className="settings-tab-panel">
              <div className="settings-section">
                <h3 className="section-title">Engineering Knowledge Base</h3>
                <p className="section-desc">Three-level knowledge model bridging durable fundamentals and technologies.</p>

                <div className="settings-card">
                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Curated Primitives (L1 Fundamentals)</strong>
                      <p className="setting-subtext">Memory, concurrency, throughput, trust boundaries, resource ownership.</p>
                    </div>
                    <span className="font-mono font-medium">
                      {knowledgeStatus?.l1Count ?? knowledgeStatus?.byLevel?.L1 ?? '—'} items
                    </span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Failure Patterns (L2 Modes)</strong>
                      <p className="setting-subtext">OOM, boundary bursts, race conditions, retry amplification, stampedes.</p>
                    </div>
                    <span className="font-mono font-medium">
                      {knowledgeStatus?.l2Count ?? knowledgeStatus?.byLevel?.L2 ?? '—'} patterns
                    </span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Technology Specifics (L3 Constraints)</strong>
                      <p className="setting-subtext">Node.js, PostgreSQL, Redis, Linux OS primitives with provenance.</p>
                    </div>
                    <span className="font-mono font-medium">
                      {knowledgeStatus?.l3Count ?? knowledgeStatus?.byLevel?.L3 ?? '—'} specs
                    </span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Total Loaded Knowledge</strong>
                      <p className="setting-subtext">Authoritative items indexed and available for reasoning.</p>
                    </div>
                    <span className="status-pill text-success font-mono">
                      {knowledgeStatus?.totalLoaded ?? '—'} items indexed
                    </span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Acquisition Registry Status</strong>
                      <p className="setting-subtext">Acquisition locked to registered authoritative domains (RFC, official docs).</p>
                    </div>
                    <span className="status-pill text-success font-mono">
                      {knowledgeStatus?.status === 'HEALTHY' ? 'Enforced' : (knowledgeStatus?.status || 'Active')}
                    </span>
                  </div>
                </div>
              </div>
            </TabContent>

            {/* 5. ADVANCED */}
            <TabContent value="advanced" className="settings-tab-panel">
              <div className="settings-section">
                <h3 className="section-title">Kernel Diagnostics & Subsystem Status</h3>
                <p className="section-desc">Real-time status of runtime boundaries and capability verification.</p>

                <div className="settings-card">
                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Git Isolation Engine</strong>
                      <p className="setting-subtext">
                        Runtime: <span className="font-mono">{capabilities?.details?.gitVersion || 'Git CLI'}</span>
                      </p>
                    </div>
                    <span className={`status-pill ${capabilities?.git === 'READY' ? 'text-success' : 'text-danger'} font-mono`}>
                      {capabilities?.git || 'READY'}
                    </span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Verification Runtime</strong>
                      <p className="setting-subtext">Local process sandbox with bounded memory and timeout supervision.</p>
                    </div>
                    <span className={`status-pill ${capabilities?.verificationRuntime === 'READY' ? 'text-success' : 'text-danger'} font-mono`}>
                      {capabilities?.verificationRuntime || 'READY'}
                    </span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Crash Recovery Supervisor</strong>
                      <p className="setting-subtext">Monitors and recovers orphaned worktrees and interrupted runs on startup.</p>
                    </div>
                    <span className="status-pill text-success font-mono">Supervised</span>
                  </div>

                  <div className="settings-row">
                    <div>
                      <strong className="setting-label">Repository Access</strong>
                      <p className="setting-subtext">Permission and path validation for registered project repository.</p>
                    </div>
                    <span className={`status-pill ${capabilities?.repositoryAccess === 'READY' ? 'text-success' : 'text-warning'} font-mono`}>
                      {capabilities?.repositoryAccess || 'READY'}
                    </span>
                  </div>
                </div>
              </div>
            </TabContent>
          </div>
        </Tabs>
      </ModalBody>
    </Modal>
  );
};
