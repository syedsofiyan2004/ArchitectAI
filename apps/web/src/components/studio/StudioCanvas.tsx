// ArchitectAI Architecture Studio Prototype — Central Interactive Canvas
import React, { useRef, useState } from 'react';
import {
  Server,
  Database,
  Globe,
  Cpu,
  Layers,
  Activity,
  Shield,
} from 'lucide-react';
import { StudioNode, StudioEdge, TrustBoundary, SimulationState } from './types';
import { SimulatedPacket } from './useSimulation';

export const CANVAS_WIDTH = 1100;
export const CANVAS_HEIGHT = 650;

interface StudioCanvasProps {
  nodes: StudioNode[];
  edges: StudioEdge[];
  boundaries: TrustBoundary[];
  selectedId: string | null;
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onClearSelection: () => void;
  zoomLevel: number;
  pan: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
  packets: SimulatedPacket[];
  simulation: SimulationState;
}

interface EdgeRouting {
  pathData: string;
  badgeX: number;
  badgeY: number;
}

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  nodes,
  edges,
  boundaries,
  selectedId,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
  zoomLevel,
  pan,
  onPanChange,
  packets,
  simulation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only pan on background click, not on nodes or edge hitboxes
    if (
      (e.target as HTMLElement).closest('.canvas-node') ||
      (e.target as HTMLElement).closest('.canvas-edge-hit') ||
      (e.target as HTMLElement).closest('.canvas-edge-badge-group')
    ) {
      return;
    }
    setIsPanning(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    onPanChange({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const getNodeIcon = (category: string) => {
    switch (category) {
      case 'client':
        return <Globe size={18} />;
      case 'gateway':
        return <Layers size={18} />;
      case 'compute':
        return <Cpu size={18} />;
      case 'cache':
        return <Activity size={18} />;
      case 'datastore':
        return <Database size={18} />;
      default:
        return <Server size={18} />;
    }
  };

  // Pre-calculated collision-free edge routing
  const getEdgeRouting = (edgeId: string): EdgeRouting => {
    switch (edgeId) {
      case 'edge-client-gw':
        return {
          pathData: 'M 230 320 L 285 320',
          badgeX: 257.5,
          badgeY: 260,
        };
      case 'edge-gw-compute':
        return {
          pathData: 'M 485 305 C 510 305, 520 235, 545 235',
          badgeX: 515,
          badgeY: 270,
        };
      case 'edge-gw-redis':
        return {
          pathData: 'M 485 290 C 560 290, 680 120, 835 185',
          badgeX: 650,
          badgeY: 120,
        };
      case 'edge-compute-db':
        return {
          pathData: 'M 745 245 C 790 245, 790 450, 835 450',
          badgeX: 790,
          badgeY: 345,
        };
      default:
        return {
          pathData: 'M 0 0 L 100 100',
          badgeX: 50,
          badgeY: 50,
        };
    }
  };

  return (
    <div
      ref={containerRef}
      className={`studio-canvas-container ${isPanning ? 'is-panning' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={(e) => {
        if (
          e.target === containerRef.current ||
          (e.target as HTMLElement).classList.contains('canvas-viewport') ||
          (e.target as HTMLElement).classList.contains('canvas-boundaries-layer')
        ) {
          onClearSelection();
        }
      }}
      role="region"
      aria-label="Interactive Architecture Graph Canvas"
    >
      <div
        className="canvas-viewport"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
          transformOrigin: '0 0',
        }}
      >
        {/* 1. Trust Boundaries Layer (Background Regions) */}
        <div className="canvas-boundaries-layer">
          {boundaries.map((tb) => (
            <div
              key={tb.id}
              className={`trust-boundary-box boundary-${tb.tier}`}
              style={{
                left: `${tb.rect.x}px`,
                top: `${tb.rect.y}px`,
                width: `${tb.rect.width}px`,
                height: `${tb.rect.height}px`,
              }}
            >
              <div className="boundary-header">
                <Shield size={12} className="boundary-icon" />
                <span className="boundary-title">{tb.label}</span>
              </div>
              <p className="boundary-desc">{tb.description}</p>
            </div>
          ))}
        </div>

        {/* 2. SVG Edge Connections & Request Particles Layer */}
        <svg
          className="canvas-svg-layer"
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L8,3 z" fill="#38bdf8" />
            </marker>
            <marker
              id="arrowhead-selected"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L8,3 z" fill="#0ea5e9" />
            </marker>
          </defs>

          {/* Connection Lines */}
          {edges.map((edge) => {
            const isSelected = selectedId === edge.id;
            const routing = getEdgeRouting(edge.id);

            return (
              <g key={edge.id} className="canvas-edge-group">
                {/* Invisible wide hit area for easy clicking */}
                <path
                  d={routing.pathData}
                  className="canvas-edge-hit"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEdge(edge.id);
                  }}
                />

                {/* Visible base path */}
                <path
                  d={routing.pathData}
                  className={`canvas-edge-line ${isSelected ? 'selected' : ''}`}
                  markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
                />

                {/* Animated edge flow pulse when simulation is running */}
                {simulation.isRunning && (
                  <path
                    d={routing.pathData}
                    className={`canvas-edge-pulse ${simulation.burstDetected ? 'pulse-burst' : ''}`}
                  />
                )}

                {/* Protocol Badge (Clean, un-occluded position) */}
                <g
                  transform={`translate(${routing.badgeX}, ${routing.badgeY})`}
                  className="canvas-edge-badge-group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEdge(edge.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x="-60"
                    y="-11"
                    width="120"
                    height="22"
                    rx="4"
                    className={`edge-badge-bg ${isSelected ? 'selected' : ''}`}
                  />
                  <text x="0" y="3" textAnchor="middle" className="edge-badge-text font-mono">
                    {edge.protocol}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 3. Simulated Request Packets */}
          {simulation.isRunning &&
            packets.map((pkt) => {
              const currentX = pkt.sourceX + (pkt.targetX - pkt.sourceX) * pkt.progress;
              const currentY = pkt.sourceY + (pkt.targetY - pkt.sourceY) * pkt.progress;

              return (
                <circle
                  key={pkt.id}
                  cx={currentX}
                  cy={currentY}
                  r={pkt.status === 'throttled' ? 4 : 3}
                  className={`sim-packet-circle ${
                    pkt.status === 'throttled' ? 'packet-throttled' : 'packet-allowed'
                  }`}
                />
              );
            })}
        </svg>

        {/* 4. Interactive Node Cards Layer (200px width, zero overlap) */}
        <div className="canvas-nodes-layer">
          {nodes.map((node) => {
            const isSelected = selectedId === node.id;
            const isOverloaded =
              simulation.downstreamLoadPct > 100 &&
              (node.id === 'node-compute' || node.id === 'node-gateway');

            return (
              <div
                key={node.id}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${node.label}: ${node.sublabel}. Click to inspect systems details.`}
                className={`canvas-node node-${node.category} ${isSelected ? 'selected' : ''} ${
                  isOverloaded ? 'overloaded' : ''
                }`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectNode(node.id);
                  }
                }}
              >
                {/* Node Card Header */}
                <div className="node-card-top">
                  <div className="node-icon-frame">{getNodeIcon(node.category)}</div>
                  <div className="node-title-group">
                    <span className="node-tier-pill font-mono">{node.tierBadge}</span>
                    <strong className="node-title">{node.label}</strong>
                  </div>
                  <span
                    className={`node-status-indicator status-${isOverloaded ? 'overloaded' : node.status}`}
                    title={isOverloaded ? 'Overloaded' : node.status}
                  />
                </div>

                <p className="node-subtitle">{node.sublabel}</p>

                {/* Key Metrics Strip */}
                <div className="node-metrics-strip">
                  <div className="node-metric-cell">
                    <span className="metric-k">{node.metrics.label1}</span>
                    <span className="metric-v font-mono">{node.metrics.value1}</span>
                  </div>
                  <div className="node-metric-cell">
                    <span className="metric-k">{node.metrics.label2}</span>
                    <span
                      className={`metric-v font-mono ${
                        isOverloaded && node.metrics.label2.includes('Latency') ? 'text-danger' : ''
                      }`}
                    >
                      {isOverloaded && node.metrics.label2.includes('Latency')
                        ? '148 ms (High)'
                        : node.metrics.value2}
                    </span>
                  </div>
                </div>

                {/* Overloaded Alert Pill if boundary burst leaks */}
                {isOverloaded && (
                  <div className="node-overload-banner font-mono">
                    ⚠️ Concurrency Overload
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Canvas Overlay Legend */}
      <div className="canvas-bottom-legend" aria-label="Architecture Legend">
        <div className="legend-item">
          <span className="legend-swatch swatch-boundary" />
          <span>Trust Boundaries</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch swatch-flow" />
          <span>Synchronous RPC / RESP3</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot dot-allowed" />
          <span>Permitted Flow (200)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot dot-throttled" />
          <span>429 Rate Limited</span>
        </div>
        <div className="legend-hint">Click any component to inspect trade-offs & invariants</div>
      </div>
    </div>
  );
};
