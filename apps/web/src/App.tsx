import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Composer } from './components/Composer';
import { StageProgress } from './components/StageProgress';
import { UnknownUnknownsView } from './components/UnknownUnknownsView';
import { KnowledgeMapView } from './components/KnowledgeMapView';
import { DecisionsView } from './components/DecisionsView';
import { VerificationPlanView } from './components/VerificationPlanView';
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
    'overview' | 'unknowns' | 'knowledge' | 'decisions' | 'verification' | 'contract'
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
      });
    } catch (err: unknown) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Unknown pipeline error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Header config={config} />

      <main className="main-content">
        <Composer
          scenarios={scenarios}
          onSubmit={handleAnalyze}
          isLoading={isLoading}
        />

        {error && (
          <div className="error-banner card">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
          </div>
        )}

        {result && (
          <StageProgress stages={result.stages} isLoading={isLoading} />
        )}

        {result && (
          <div className="results-wrapper">
            <nav className="tab-navigation">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <span>Architecture Overview</span>
              </button>

              <button
                type="button"
                className={`tab-btn ${activeTab === 'unknowns' ? 'active' : ''}`}
                onClick={() => setActiveTab('unknowns')}
              >
                <span>Unknown-Unknowns</span>
                <span className="tab-badge font-mono">
                  {result.contract.discoveredConcerns.length}
                </span>
              </button>

              <button
                type="button"
                className={`tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
                onClick={() => setActiveTab('knowledge')}
              >
                <span>3-Level Knowledge</span>
                <span className="tab-badge font-mono">L1-L3</span>
              </button>

              <button
                type="button"
                className={`tab-btn ${activeTab === 'decisions' ? 'active' : ''}`}
                onClick={() => setActiveTab('decisions')}
              >
                <span>Architecture Decisions</span>
                <span className="tab-badge font-mono">
                  {result.contract.decisions.length}
                </span>
              </button>

              <button
                type="button"
                className={`tab-btn ${activeTab === 'verification' ? 'active' : ''}`}
                onClick={() => setActiveTab('verification')}
              >
                <span>Verification Plan</span>
                <span className="tab-badge font-mono">
                  {result.contract.verificationSpecs.length}
                </span>
              </button>

              <button
                type="button"
                className={`tab-btn ${activeTab === 'contract' ? 'active' : ''}`}
                onClick={() => setActiveTab('contract')}
              >
                <span>Engineering Contract (JSON)</span>
              </button>
            </nav>

            <div className="tab-content">
              {activeTab === 'overview' && (
                <div className="overview-grid">
                  <div className="overview-summary card">
                    <div className="section-label">
                      <span className="dot-indicator green"></span>
                      <span>Contract Summary</span>
                    </div>
                    <h3 className="summary-title">{result.contract.requirement.rawIntent}</h3>
                    <div className="summary-meta-grid">
                      <div className="meta-item">
                        <span className="meta-key">Contract ID:</span>
                        <span className="meta-val font-mono">{result.contract.id}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-key">Status:</span>
                        <span className="meta-val badge-status font-mono">ACCEPTED</span>
                      </div>
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

              {activeTab === 'contract' && (
                <ContractInspector contract={result.contract} />
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <span>ArchitectAI • Engineering-Intelligence Platform Prototype</span>
          <span className="footer-links font-mono">
            Provider Neutral • Three-Level Knowledge • Independent Verification
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
