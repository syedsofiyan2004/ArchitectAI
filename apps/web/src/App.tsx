import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Composer } from './components/Composer';
import { StageProgress } from './components/StageProgress';
import { UnknownUnknownsView } from './components/UnknownUnknownsView';
import { KnowledgeMapView } from './components/KnowledgeMapView';
import { DecisionsView } from './components/DecisionsView';
import { VerificationPlanView } from './components/VerificationPlanView';
import { ImplementationView } from './components/ImplementationView';
import { ContractInspector } from './components/ContractInspector';
import {
  ServerConfig,
  ScenarioPreset,
  AnalyzeArchitectureOutput,
} from './types';
import './App.css';

export function App() {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioPreset[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeArchitectureOutput | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'unknowns' | 'knowledge' | 'decisions' | 'verification' | 'implementation' | 'contract'
  >('overview');

  useEffect(() => {
    // Load config
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error('Failed to load server config', err));

    // Load scenarios
    fetch('/api/scenarios')
      .then((res) => res.json())
      .then((data) => {
        setScenarios(data);
        // Pre-run analysis on initial scenario if no result yet
        if (data.length > 0) {
          const first = data[0];
          handleAnalyze({
            rawIntent: first.prompt,
            explicitConstraints: [],
            declaredTechStack: [first.context?.database || 'Redis', first.context?.framework || 'Node.js'],
            context: first.context,
          });
        }
      })
      .catch((err) => console.error('Failed to load scenarios', err));
  }, []);

  const handleAnalyze = async (data: {
    rawIntent: string;
    explicitConstraints: string[];
    declaredTechStack: string[];
    context: Record<string, string>;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const responseData = await res.json();
      if (!res.ok || !responseData.success) {
        throw new Error(responseData.error || 'Failed to analyze requirement.');
      }

      setResult({
        contract: responseData.contract,
        stages: responseData.stages,
        dimensionsDetected: responseData.dimensionsDetected,
        mode: responseData.mode,
        decomposition: responseData.decomposition,
      });
    } catch (err: unknown) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Unknown pipeline error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Header config={config} />

      <div className="workspace-layout">
        {/* Left Workflow Rail */}
        <aside className="workflow-rail" aria-label="Workflow Navigation">
          <div className="rail-section-label">Engineering Workflow</div>
          <nav className="rail-nav">
            <button
              type="button"
              className={`rail-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <div className="rail-btn-content">
                <span className="rail-icon" aria-hidden="true">📋</span>
                <span>Overview</span>
              </div>
            </button>

            <button
              type="button"
              className={`rail-btn ${activeTab === 'unknowns' ? 'active' : ''}`}
              onClick={() => setActiveTab('unknowns')}
            >
              <div className="rail-btn-content">
                <span className="rail-icon" aria-hidden="true">🔍</span>
                <span>Unknown-Unknowns</span>
              </div>
              {result && (
                <span className="rail-badge font-mono">
                  {result.contract.discoveredConcerns.length}
                </span>
              )}
            </button>

            <button
              type="button"
              className={`rail-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
              onClick={() => setActiveTab('knowledge')}
            >
              <div className="rail-btn-content">
                <span className="rail-icon" aria-hidden="true">🧠</span>
                <span>3-Level Knowledge</span>
              </div>
              <span className="rail-badge font-mono">L1-L3</span>
            </button>

            <button
              type="button"
              className={`rail-btn ${activeTab === 'decisions' ? 'active' : ''}`}
              onClick={() => setActiveTab('decisions')}
            >
              <div className="rail-btn-content">
                <span className="rail-icon" aria-hidden="true">⚖️</span>
                <span>Decisions & ADRs</span>
              </div>
              {result && (
                <span className="rail-badge font-mono">
                  {result.contract.decisions.length}
                </span>
              )}
            </button>

            <button
              type="button"
              className={`rail-btn ${activeTab === 'verification' ? 'active' : ''}`}
              onClick={() => setActiveTab('verification')}
            >
              <div className="rail-btn-content">
                <span className="rail-icon" aria-hidden="true">🧪</span>
                <span>Verification Plan</span>
              </div>
              {result && (
                <span className="rail-badge font-mono">
                  {result.contract.verificationSpecs.length}
                </span>
              )}
            </button>

            <button
              type="button"
              className={`rail-btn ${activeTab === 'implementation' ? 'active' : ''}`}
              onClick={() => setActiveTab('implementation')}
            >
              <div className="rail-btn-content">
                <span className="rail-icon" aria-hidden="true">⚡</span>
                <span>Implementation</span>
              </div>
              <span className="rail-badge font-mono">EXEC</span>
            </button>

            <button
              type="button"
              className={`rail-btn ${activeTab === 'contract' ? 'active' : ''}`}
              onClick={() => setActiveTab('contract')}
            >
              <div className="rail-btn-content">
                <span className="rail-icon" aria-hidden="true">{'{ }'}</span>
                <span>Contract JSON</span>
              </div>
            </button>
          </nav>
        </aside>

        {/* Main Canvas */}
        <main className="main-canvas" role="main">
          <Composer
            scenarios={scenarios}
            onSubmit={handleAnalyze}
            isLoading={isLoading}
          />

          {error && (
            <div className="error-banner" role="alert">
              <span className="error-icon" aria-hidden="true">⚠️</span>
              <span className="error-message">{error}</span>
            </div>
          )}

          {(result || isLoading) && (
            <StageProgress
              stages={result ? result.stages : []}
              isLoading={isLoading}
            />
          )}

          {result && (
            <div className="canvas-view-container">
              {activeTab === 'overview' && (
                <div className="overview-stack">
                  <div className="surface-card contract-summary-card">
                    <div className="card-top-tags">
                      <span className="grounding-pill grounded font-mono">✓ CONTRACT ACCEPTED</span>
                      <span className="contract-id font-mono">ID: {result.contract.id}</span>
                    </div>

                    <h2 className="summary-intent">{result.contract.requirement.rawIntent}</h2>

                    <div className="summary-meta-grid">
                      <div className="meta-item">
                        <span className="meta-key">Discovered Unknowns:</span>
                        <span className="meta-val font-mono">
                          {result.contract.discoveredConcerns.length} Concerns
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-key">Decisions / ADRs:</span>
                        <span className="meta-val font-mono">
                          {result.contract.decisions.length} Decisions
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-key">Verification Specs:</span>
                        <span className="meta-val font-mono">
                          {result.contract.verificationSpecs.length} Executable Tests
                        </span>
                      </div>
                      {result.decomposition && (
                        <div className="meta-item full-span">
                          <span className="meta-key">Semantic Decomposition:</span>
                          <span className="meta-val">{result.decomposition.summary}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <UnknownUnknownsView
                    concerns={result.contract.discoveredConcerns}
                    dimensionsDetected={result.dimensionsDetected}
                  />

                  <DecisionsView decisions={result.contract.decisions} />
                </div>
              )}

              {activeTab === 'unknowns' && (
                <UnknownUnknownsView
                  concerns={result.contract.discoveredConcerns}
                  dimensionsDetected={result.dimensionsDetected}
                />
              )}

              {activeTab === 'knowledge' && (
                <KnowledgeMapView contract={result.contract} />
              )}

              {activeTab === 'decisions' && (
                <DecisionsView decisions={result.contract.decisions} />
              )}

              {activeTab === 'verification' && (
                <VerificationPlanView
                  invariants={result.contract.invariants}
                  verificationSpecs={result.contract.verificationSpecs}
                />
              )}

              {activeTab === 'implementation' && (
                <ImplementationView contract={result.contract} />
              )}

              {activeTab === 'contract' && (
                <ContractInspector contract={result.contract} />
              )}
            </div>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <div className="footer-content">
          <span>ArchitectAI • Engineering-Intelligence Platform</span>
          <span className="footer-links font-mono">
            Provider Neutral • Three-Level Knowledge • Independent Verification
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
