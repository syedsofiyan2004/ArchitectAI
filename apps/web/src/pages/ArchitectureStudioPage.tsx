// ArchitectAI — Architecture Studio Prototype Page
import React, { useState, useEffect, useCallback } from 'react';
import { StudioHeader } from '../components/studio/StudioHeader';
import { StudioLeftNav } from '../components/studio/StudioLeftNav';
import { StudioCanvas } from '../components/studio/StudioCanvas';
import { StudioInspector } from '../components/studio/StudioInspector';
import {
  STUDIO_NODES,
  STUDIO_EDGES,
  TRUST_BOUNDARIES,
  STUDIO_REQUIREMENT,
} from '../components/studio/fixture-data';
import { useSimulation } from '../components/studio/useSimulation';
import '../components/studio/ArchitectureStudio.css';

export const ArchitectureStudioPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > 900;
    }
    return true;
  });
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

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
  const selectedNode = STUDIO_NODES.find((n) => n.id === selectedId) || null;
  const selectedEdge = STUDIO_EDGES.find((e) => e.id === selectedId) || null;
  const selectedEntity = selectedNode || selectedEdge;

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    setIsInspectorOpen(true);
    setIsMobileNavOpen(false);
  }, []);

  const handleSelectEdge = useCallback((edgeId: string) => {
    setSelectedId(edgeId);
    setIsInspectorOpen(true);
    setIsMobileNavOpen(false);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedId(null);
  }, []);

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        if (selectedId) {
          setSelectedId(null);
        } else if (isMobileNavOpen) {
          setIsMobileNavOpen(false);
        }
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoomLevel((z) => Math.min(1.8, +(z + 0.1).toFixed(1)));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoomLevel((z) => Math.max(0.6, +(z - 0.1).toFixed(1)));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoomLevel(1.0);
      } else if (e.code === 'Space') {
        // Toggle simulation with spacebar
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, isMobileNavOpen, togglePlay]);

  return (
    <div className="architecture-studio-layout">
      {/* 1. Global Studio Header Bar */}
      <StudioHeader
        projectName={STUDIO_REQUIREMENT.project}
        requirementTitle={STUDIO_REQUIREMENT.title}
        simulation={simulation}
        onTogglePlay={togglePlay}
        onResetSimulation={reset}
        zoomLevel={zoomLevel}
        onZoomIn={() => setZoomLevel((z) => Math.min(1.8, +(z + 0.1).toFixed(1)))}
        onZoomOut={() => setZoomLevel((z) => Math.max(0.6, +(z - 0.1).toFixed(1)))}
        onZoomReset={() => setZoomLevel(1.0)}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
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
          {isMobileNavOpen ? 'Close Menu' : 'Sim & Components'}
        </button>

        <span className="mobile-mode-indicator">
          {simulation.algorithm === 'ROLLING_WINDOW' ? 'Sliding Window' : 'Fixed Window'}
        </span>

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
            nodes={STUDIO_NODES}
            edges={STUDIO_EDGES}
            selectedId={selectedId}
            onSelectNode={handleSelectNode}
            onSelectEdge={handleSelectEdge}
            simulation={simulation}
            onSetAlgorithm={setAlgorithm}
            onSetScenario={setScenario}
            onSetSpeed={setSpeed}
            onTogglePlay={togglePlay}
            onResetSimulation={reset}
          />
        </div>

        {/* Central Architecture Canvas */}
        <main className="studio-canvas-pane">
          <StudioCanvas
            nodes={STUDIO_NODES}
            edges={STUDIO_EDGES}
            boundaries={TRUST_BOUNDARIES}
            selectedId={selectedId}
            onSelectNode={handleSelectNode}
            onSelectEdge={handleSelectEdge}
            onClearSelection={handleClearSelection}
            zoomLevel={zoomLevel}
            packets={packets}
            simulation={simulation}
          />
        </main>

        {/* Right Contextual Systems Inspector */}
        <div className={`studio-right-pane ${isInspectorOpen ? 'open' : 'closed'}`}>
          <StudioInspector
            selectedEntity={selectedEntity}
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
          />
        </div>
      </div>
    </div>
  );
};
