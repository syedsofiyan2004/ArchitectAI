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
  ArrowRight,
} from 'lucide-react';
import { StudioNode, StudioEdge, TrustBoundary, SimulationState } from './types';
import { SimulatedPacket } from './useSimulation';

interface StudioCanvasProps {
  nodes: StudioNode[];
  edges: StudioEdge[];
  boundaries: TrustBoundary[];
  selectedId: string | null;
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onClearSelection: () => void;
  zoomLevel: number;
  packets: SimulatedPacket[];
  simulation: SimulationState;
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
  packets,
  simulation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan on background click
    if ((e.target as HTMLElement).closest('.canvas-node') || (e.target as HTMLElement).closest('.canvas-edge-hit')) {
      return;
    }
    setIsPanning(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
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

  // Find node coordinates helper
  const getNodeCoord = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    return node ? { x: node.x, y: node.y } : { x: 50, y: 50 };
  };

  return (
    <div
      ref={containerRef}
      className={`studio-canvas-container ${isPanning ? 'is-panning' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={(e) => {
        if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('canvas-viewport')) {
          onClearSelection();
        }
      }}
      role="region"
      aria-label="Interactive Architecture Graph Canvas"
    >
      <div
        className="canvas-viewport"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
          transformOrigin: '50% 50%',
        }}
      >
        {/* 1. Trust Boundaries Layer (Background Regions) */}
        <div className="canvas-boundaries-layer">
          {boundaries.map((tb) => (
            <div
              key={tb.id}
              className={`trust-boundary-box boundary-${tb.tier}`}
              style={{
                left: `${tb.rect.x}%`,
                top: `${tb.rect.y}%`,
                width: `${tb.rect.width}%`,
                height: `${tb.rect.height}%`,
              }}
            >
              <div className="boundary-header">
                <Shield size={12} className="boundary-icon" />
                <span className="boundary-title font-mono">{tb.label}</span>
              </div>
              <p className="boundary-desc">{tb.description}</p>
            </div>
          ))}
        </div>

        {/* 2. SVG Edge Connections & Request Particles Layer */}
        <svg className="canvas-svg-layer" viewBox="0 0 1000 700" preserveAspectRatio="none">
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
            const src = getNodeCoord(edge.source);
            const tgt = getNodeCoord(edge.target);
            const isSelected = selectedId === edge.id;

            // Map 0-100 coordinates to SVG viewBox 1000x700
            const x1 = src.x * 10;
            const y1 = src.y * 7;
            const x2 = tgt.x * 10;
            const y2 = tgt.y * 7;

            // Curved cubic bezier
            const dx = (x2 - x1) * 0.5;
            const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

            // Calculate bezier position for badge to avoid collisions
            const t = edge.id === 'edge-gw-redis' ? 0.74 : edge.id === 'edge-gw-compute' ? 0.38 : 0.5;
            const bx = (1 - t) * (1 - t) * (1 - t) * x1 + 3 * (1 - t) * (1 - t) * t * (x1 + dx) + 3 * (1 - t) * t * t * (x2 - dx) + t * t * t * x2;
            const by = (1 - t) * (1 - t) * (1 - t) * y1 + 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t * y2;

            return (
              <g key={edge.id} className="canvas-edge-group">
                {/* Invisible wide hit area for easy clicking */}
                <path
                  d={pathData}
                  className="canvas-edge-hit"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEdge(edge.id);
                  }}
                />

                {/* Visible base path */}
                <path
                  d={pathData}
                  className={`canvas-edge-line ${isSelected ? 'selected' : ''}`}
                />

                {/* Animated edge flow pulse when simulation is running */}
                {simulation.isRunning && (
                  <path
                    d={pathData}
                    className={`canvas-edge-pulse ${simulation.burstDetected ? 'pulse-burst' : ''}`}
                  />
                )}

                {/* Midpoint Protocol Badge */}
                <g
                  transform={`translate(${bx}, ${by})`}
                  className="canvas-edge-badge-group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEdge(edge.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x="-65"
                    y="-11"
                    width="130"
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
              const currentX = (pkt.sourceX + (pkt.targetX - pkt.sourceX) * pkt.progress) * 10;
              const currentY = (pkt.sourceY + (pkt.targetY - pkt.sourceY) * pkt.progress) * 7;

              return (
                <circle
                  key={pkt.id}
                  cx={currentX}
                  cy={currentY}
                  r={pkt.status === 'throttled' ? 4 : 3}
                  className={`sim-packet-circle ${pkt.status === 'throttled' ? 'packet-throttled' : 'packet-allowed'}`}
                />
              );
            })}
        </svg>

        {/* 4. Interactive Node Cards Layer */}
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
                  left: `${node.x}%`,
                  top: `${node.y}%`,
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
                <div className="node-metrics-strip font-mono">
                  <div className="node-metric-cell">
                    <span className="metric-k">{node.metrics.label1}</span>
                    <span className="metric-v">{node.metrics.value1}</span>
                  </div>
                  <div className="node-metric-cell">
                    <span className="metric-k">{node.metrics.label2}</span>
                    <span
                      className={`metric-v ${
                        isOverloaded && node.metrics.label2.includes('Latency') ? 'text-danger' : ''
                      }`}
                    >
                      {isOverloaded && node.metrics.label2.includes('Latency')
                        ? '148 ms'
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
      <div className="canvas-bottom-legend font-mono" aria-label="Architecture Legend">
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
