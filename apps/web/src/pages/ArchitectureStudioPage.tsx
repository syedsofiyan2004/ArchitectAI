// ArchitectAI — Architecture Studio Prototype Page
// Grounded Architecture Graph Projection derived from authoritative EngineeringContracts
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArchitectureGraphProjector } from '@architectai/application/services/architecture-graph-projector';
import { StudioHeader } from '../components/studio/StudioHeader';
import { StudioLeftNav } from '../components/studio/StudioLeftNav';
import { StudioCanvas } from '../components/studio/StudioCanvas';
import { StudioInspector } from '../components/studio/StudioInspector';
import {
  ALL_FIXTURE_CONTRACTS,
  RATE_LIMITER_FIXTURE_CONTRACT,
} from '../components/studio/fixture-contracts';
import { useSimulation } from '../components/studio/useSimulation';
import '../components/studio/ArchitectureStudio.css';

export const ArchitectureStudioPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlContract = searchParams.get('contract');
  const [selectedContractId, setSelectedContractId] = useState<string>(
    urlContract && ALL_FIXTURE_CONTRACTS[urlContract] ? urlContract : 'contract-rate-limiter'
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Update URL search param when selected contract changes
  const handleSelectContract = useCallback(
    (contractId: string) => {
      setSelectedContractId(contractId);
      setSearchParams({ contract: contractId });
      setSelectedId(null);
      setIsInspectorOpen(false);
    },
    [setSearchParams]
  );

  // Sync state if URL search param changes externally
  useEffect(() => {
    if (urlContract && ALL_FIXTURE_CONTRACTS[urlContract] && urlContract !== selectedContractId) {
      setSelectedContractId(urlContract);
      setSelectedId(null);
    }
  }, [urlContract, selectedContractId]);

  // Authoritative Engineering Contract & Deterministic Graph Projection
  const activeContract = useMemo(() => {
    return ALL_FIXTURE_CONTRACTS[selectedContractId] || RATE_LIMITER_FIXTURE_CONTRACT;
  }, [selectedContractId]);

  const projector = useMemo(() => new ArchitectureGraphProjector(), []);

  const projection = useMemo(() => {
    return projector.project(activeContract);
  }, [projector, activeContract]);

  const nodes = projection.nodes;
  const edges = projection.edges;
  const boundaries = projection.boundaries;
  const simulationAvailable = Boolean(projection.simulationModule?.available);

  const {
    state: simulation,
    packets,
    setAlgorithm,
    setScenario,
    setSpeed,
    togglePlay,
    reset,
  } = useSimulation();

  // Find currently selected node or edge
  const selectedNode = nodes.find((n) => n.id === selectedId) || null;
  const selectedEdge = edges.find((e) => e.id === selectedId) || null;
  const selectedEntity = selectedNode || selectedEdge;

  // Genuine Fit-to-Content calculation
  const handleFitToContent = useCallback(() => {
    const container = document.querySelector('.studio-canvas-container');
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;
    const isMobile = w < 768;
    const pad = isMobile ? 24 : 48;
    const scale = Math.min((w - pad) / 1100, (h - pad) / 650, 1.05);
    const px = (w - 1100 * scale) / 2;
    const py = (h - 650 * scale) / 2;
    setZoomLevel(+scale.toFixed(2));
    setPan({ x: Math.round(px), y: Math.round(py) });
  }, []);

  // Focus-on-selected-component behavior (readable zoom and centered framing)
  const focusOnNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const container = document.querySelector('.studio-canvas-container');
      const w = container?.clientWidth || 1000;
      const h = container?.clientHeight || 650;
      const isMobile = w < 768;
      const targetZoom = isMobile ? 1.0 : 1.1;
      const targetY = isMobile ? h * 0.28 : h / 2;
      const px = w / 2 - node.x * targetZoom;
      const py = targetY - node.y * targetZoom;
      setZoomLevel(targetZoom);
      setPan({ x: Math.round(px), y: Math.round(py) });
    },
    [nodes]
  );

  // Initial auto-fit and resize listener
  useEffect(() => {
    handleFitToContent();
    const timer = setTimeout(handleFitToContent, 100);
    window.addEventListener('resize', handleFitToContent);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleFitToContent);
    };
  }, [handleFitToContent, selectedContractId]);

  // Re-fit canvas when inspector or mobile drawer toggles without selected entity
  useEffect(() => {
    if (!selectedId) {
      const timer = setTimeout(handleFitToContent, 220);
      return () => clearTimeout(timer);
    }
  }, [isInspectorOpen, isMobileNavOpen, selectedId, handleFitToContent]);

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelectedId(nodeId);
      setIsInspectorOpen(true);
      setIsMobileNavOpen(false);
      focusOnNode(nodeId);
    },
    [focusOnNode]
  );

  const handleSelectEdge = useCallback((edgeId: string) => {
    setSelectedId(edgeId);
    setIsInspectorOpen(true);
    setIsMobileNavOpen(false);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedId(null);
    setIsInspectorOpen(false);
    handleFitToContent();
  }, [handleFitToContent]);

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        if (selectedId) {
          handleClearSelection();
        } else if (isMobileNavOpen) {
          setIsMobileNavOpen(false);
        }
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoomLevel((z) => Math.min(2.0, +(z + 0.1).toFixed(2)));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoomLevel((z) => Math.max(0.3, +(z - 0.1).toFixed(2)));
      } else if (e.key === '0') {
        e.preventDefault();
        handleClearSelection();
      } else if (e.code === 'Space' && simulationAvailable) {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, isMobileNavOpen, togglePlay, handleClearSelection, simulationAvailable]);

  return (
    <div className="architecture-studio-layout">
      {/* 1. Global Studio Header Bar */}
      <StudioHeader
        projectName={activeContract.id}
        requirementTitle={activeContract.requirement.context?.title || activeContract.requirement.id}
        simulation={simulation}
        onTogglePlay={togglePlay}
        onResetSimulation={reset}
        zoomLevel={zoomLevel}
        onZoomIn={() => setZoomLevel((z) => Math.min(2.0, +(z + 0.1).toFixed(2)))}
        onZoomOut={() => setZoomLevel((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))}
        onZoomReset={handleFitToContent}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        activeContractId={selectedContractId}
        onSelectContract={handleSelectContract}
        simulationAvailable={simulationAvailable}
      />

      {/* Mobile Quick Action Buttons Bar */}
      <div className="studio-mobile-bar font-mono">
        <button
          type="button"
          className={`mobile-nav-toggle ${isMobileNavOpen ? 'active' : ''}`}
          onClick={() => {
            setIsMobileNavOpen((prev) => !prev);
            if (!isMobileNavOpen) setIsInspectorOpen(false);
          }}
          aria-expanded={isMobileNavOpen}
        >
          {isMobileNavOpen ? 'Close Menu' : 'Overview & Nodes'}
        </button>

        {selectedId ? (
          <button
            type="button"
            className="mobile-overview-btn font-mono"
            onClick={handleClearSelection}
            title="Back to Overview Map"
            aria-label="Back to Overview Map"
          >
            ← Overview
          </button>
        ) : (
          <span className="mobile-mode-indicator">
            {activeContract.requirement.context?.title || activeContract.requirement.id}
          </span>
        )}

        <button
          type="button"
          className={`mobile-inspector-toggle ${isInspectorOpen ? 'active' : ''}`}
          onClick={() => {
            setIsInspectorOpen((prev) => !prev);
            if (!isInspectorOpen) setIsMobileNavOpen(false);
          }}
          aria-expanded={isInspectorOpen}
        >
          {isInspectorOpen ? 'Close Details' : 'Inspector'}
        </button>
      </div>

      {/* 2. Main Studio Workspace (3-Column Layout) */}
      <div className="studio-workspace">
        {/* Left Navigation & Simulation Controls */}
        <div className={`studio-left-pane ${isMobileNavOpen ? 'mobile-open' : ''}`}>
          <StudioLeftNav
            nodes={nodes}
            edges={edges}
            selectedId={selectedId}
            onSelectNode={handleSelectNode}
            onSelectEdge={handleSelectEdge}
            simulation={simulation}
            onSetAlgorithm={setAlgorithm}
            onSetScenario={setScenario}
            onSetSpeed={setSpeed}
            onTogglePlay={togglePlay}
            onResetSimulation={reset}
            activeContract={activeContract}
            simulationAvailable={simulationAvailable}
          />
        </div>

        {/* Central Architecture Canvas */}
        <main className="studio-canvas-pane">
          <StudioCanvas
            nodes={nodes}
            edges={edges}
            boundaries={boundaries}
            selectedId={selectedId}
            onSelectNode={handleSelectNode}
            onSelectEdge={handleSelectEdge}
            onClearSelection={handleClearSelection}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            pan={pan}
            onPanChange={setPan}
            onFitToOverview={handleFitToContent}
            packets={packets}
            simulation={simulation}
            simulationAvailable={simulationAvailable}
          />
        </main>

        {/* Right Contextual Systems Inspector */}
        <div className={`studio-right-pane ${isInspectorOpen ? 'open' : 'closed'}`}>
          <StudioInspector
            selectedEntity={selectedEntity}
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
            activeContract={activeContract}
            projection={projection}
          />
        </div>
      </div>
    </div>
  );
};
