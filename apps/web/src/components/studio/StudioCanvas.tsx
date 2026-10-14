// ArchitectAI Architecture Studio Prototype — Generic Central Interactive Canvas
// Fully provider-neutral and contract-grounded. No hardcoded edge routing or domain conditionals.
import React, { useRef, useState, useMemo } from 'react';
import {
  Server,
  Database,
  Globe,
  Cpu,
  Layers,
  Activity,
  Shield,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Workflow,
  Radio,
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
  onZoomChange: (zoom: number) => void;
  pan: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
  onFitToOverview: () => void;
  packets?: SimulatedPacket[];
  simulation?: SimulationState;
  simulationAvailable?: boolean;
}

interface EdgeRouting {
  pathData: string;
  badgeX: number;
  badgeY: number;
}

/**
 * Mathematically derives collision-free Bezier edge routing and badge positioning
 * between any two arbitrary nodes in the topology, including self-loops.
 * Never depends on hardcoded edge IDs.
 */
export function computeGenericEdgePath(
  edge: StudioEdge,
  sourceNode?: StudioNode,
  targetNode?: StudioNode
): EdgeRouting {
  if (!sourceNode || !targetNode) {
    return {
      pathData: 'M 0 0 L 0 0',
      badgeX: -9999,
      badgeY: -9999,
    };
  }

  const isSelfLoop = Boolean(edge.isSelfLoop || edge.source === edge.target);
  const sx = sourceNode.x ?? 100;
  const sy = sourceNode.y ?? 100;

  // 1. Self-Loop Routing: Upward arc returning to the same component
  if (isSelfLoop) {
    const startX = sx - 35;
    const startY = sy - 42;
    const endX = sx + 35;
    const endY = sy - 42;
    const cp1x = sx - 65;
    const cp1y = sy - 95;
    const cp2x = sx + 65;
    const cp2y = sy - 95;
    return {
      pathData: `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
      badgeX: sx,
      badgeY: sy - 95,
    };
  }

  const tx = targetNode.x ?? 300;
  const ty = targetNode.y ?? 300;
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.hypot(dx, dy);

  if (dist < 1) {
    return {
      pathData: `M ${sx} ${sy} L ${tx} ${ty}`,
      badgeX: sx,
      badgeY: sy - 15,
    };
  }

  // Node card boundary clipping (width: 200px -> hw: 100px; height: ~84px -> hh: 42px)
  const hw = 100;
  const hh = 42;

  // Intersect ray with source rectangle boundary
  let startX = sx;
  let startY = sy;
  if (Math.abs(dx) * hh > Math.abs(dy) * hw) {
    // Intersects left or right edge
    const sign = dx > 0 ? 1 : -1;
    startX = sx + sign * hw;
    startY = sy + (dy / Math.abs(dx)) * hw;
  } else {
    // Intersects top or bottom edge
    const sign = dy > 0 ? 1 : -1;
    startY = sy + sign * hh;
    startX = sx + (dx / Math.abs(dy)) * hh;
  }

  // Intersect ray with target rectangle boundary (stepping inward towards target)
  let endX = tx;
  let endY = ty;
  if (Math.abs(dx) * hh > Math.abs(dy) * hw) {
    const sign = dx > 0 ? -1 : 1;
    endX = tx + sign * hw;
    endY = ty - (dy / Math.abs(dx)) * hw;
  } else {
    const sign = dy > 0 ? -1 : 1;
    endY = ty + sign * hh;
    endX = tx - (dx / Math.abs(dy)) * hh;
  }

  // Compute smooth cubic Bezier curve
  let cp1x: number;
  let cp1y: number;
  let cp2x: number;
  let cp2y: number;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal dominant: curve horizontally
    const midX = (startX + endX) / 2;
    cp1x = midX;
    cp1y = startY;
    cp2x = midX;
    cp2y = endY;
  } else {
    // Vertical dominant: curve vertically
    const midY = (startY + endY) / 2;
    cp1x = startX;
    cp1y = midY;
    cp2x = endX;
    cp2y = midY;
  }

  const badgeX = (startX + endX) / 2;
  const badgeY = (startY + endY) / 2 - 12;

  return {
    pathData: `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
    badgeX,
    badgeY,
  };
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
  onZoomChange,
  pan,
  onPanChange,
  onFitToOverview,
  packets = [],
  simulation,
  simulationAvailable = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const hasDragged = useRef(false);
  const dragOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Multi-pointer tracking for pinch zoom
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef<number>(1.0);

  // Fast node lookup map
  const nodeMap = useMemo(() => {
    const map = new Map<string, StudioNode>();
    for (const n of nodes) {
      map.set(n.id, n);
    }
    return map;
  }, [nodes]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Only pan on background click, not on nodes, edges, or floating controls
    if (
      (e.target as HTMLElement).closest('.canvas-node') ||
      (e.target as HTMLElement).closest('.canvas-edge-hit') ||
      (e.target as HTMLElement).closest('.canvas-edge-badge-group') ||
      (e.target as HTMLElement).closest('.canvas-floating-controls')
    ) {
      return;
    }

    if (activePointers.current.size === 1) {
      isPanningRef.current = true;
      hasDragged.current = false;
      dragOrigin.current = { x: e.clientX, y: e.clientY };
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      setIsPanning(true);
    } else if (activePointers.current.size === 2) {
      isPanningRef.current = false;
      setIsPanning(false);
      const points = Array.from(activePointers.current.values());
      const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      pinchStartDist.current = dist;
      pinchStartZoom.current = zoomLevel;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Check multi-pointer pinch zoom
    if (activePointers.current.size === 2 && pinchStartDist.current && pinchStartDist.current > 0) {
      const points = Array.from(activePointers.current.values());
      const currentDist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const factor = currentDist / pinchStartDist.current;
      const newZoom = Math.min(2.0, Math.max(0.3, +(pinchStartZoom.current * factor).toFixed(2)));
      onZoomChange(newZoom);
      return;
    }

    if (!isPanningRef.current || activePointers.current.size !== 1) return;
    if (Math.hypot(e.clientX - dragOrigin.current.x, e.clientY - dragOrigin.current.y) > 3) {
      hasDragged.current = true;
    }
    const nextPan = {
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    };
    onPanChange(nextPan);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) {
      pinchStartDist.current = null;
    }
    if (activePointers.current.size === 0) {
      isPanningRef.current = false;
      setIsPanning(false);
      setTimeout(() => {
        hasDragged.current = false;
      }, 100);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest('.canvas-node') ||
      (e.target as HTMLElement).closest('.canvas-edge-hit') ||
      (e.target as HTMLElement).closest('.canvas-edge-badge-group') ||
      (e.target as HTMLElement).closest('.canvas-floating-controls')
    ) {
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      isPanningRef.current = true;
      hasDragged.current = false;
      dragOrigin.current = { x: t.clientX, y: t.clientY };
      dragStartRef.current = { x: t.clientX - pan.x, y: t.clientY - pan.y };
      setIsPanning(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isPanningRef.current || e.touches.length !== 1) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - dragOrigin.current.x, t.clientY - dragOrigin.current.y) > 3) {
      hasDragged.current = true;
    }
    onPanChange({
      x: t.clientX - dragStartRef.current.x,
      y: t.clientY - dragStartRef.current.y,
    });
  };

  const handleTouchEnd = () => {
    isPanningRef.current = false;
    setIsPanning(false);
    setTimeout(() => {
      hasDragged.current = false;
    }, 100);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest('.canvas-node') ||
      (e.target as HTMLElement).closest('.canvas-edge-hit') ||
      (e.target as HTMLElement).closest('.canvas-edge-badge-group') ||
      (e.target as HTMLElement).closest('.canvas-floating-controls')
    ) {
      return;
    }
    if (e.button === 0) {
      isPanningRef.current = true;
      hasDragged.current = false;
      dragOrigin.current = { x: e.clientX, y: e.clientY };
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      setIsPanning(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    if (Math.hypot(e.clientX - dragOrigin.current.x, e.clientY - dragOrigin.current.y) > 3) {
      hasDragged.current = true;
    }
    onPanChange({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    setIsPanning(false);
    setTimeout(() => {
      hasDragged.current = false;
    }, 100);
  };

  const getNodeIcon = (category: string) => {
    switch (category) {
      case 'client':
        return <Globe size={18} />;
      case 'gateway':
        return <Layers size={18} />;
      case 'compute':
      case 'service':
        return <Cpu size={18} />;
      case 'cache':
        return <Activity size={18} />;
      case 'datastore':
        return <Database size={18} />;
      case 'queue':
        return <Workflow size={18} />;
      case 'worker':
        return <Radio size={18} />;
      default:
        return <Server size={18} />;
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={(e) => {
        if (hasDragged.current) return;
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

          {/* Generic Edge Connections */}
          {edges.map((edge) => {
            const isSelected = selectedId === edge.id;
            const sourceNode = nodeMap.get(edge.source);
            const targetNode = nodeMap.get(edge.target);
            const routing = computeGenericEdgePath(edge, sourceNode, targetNode);

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
                {simulationAvailable && simulation?.isRunning && (
                  <path
                    d={routing.pathData}
                    className={`canvas-edge-pulse ${simulation.burstDetected ? 'pulse-burst' : ''}`}
                  />
                )}

                {/* Protocol Badge (Clean, generic midpoint position) */}
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
                    {edge.protocol || edge.label || 'LINK'}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 3. Simulated Request Packets (Only when simulation is active and supported) */}
          {simulationAvailable &&
            simulation?.isRunning &&
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

        {/* 4. Interactive Node Cards Layer */}
        <div className="canvas-nodes-layer">
          {nodes.map((node) => {
            const isSelected = selectedId === node.id;
            const isOverloaded = Boolean(
              simulationAvailable &&
                simulation?.isRunning &&
                simulation.downstreamLoadPct > 100 &&
                (node.category === 'compute' || node.category === 'gateway')
            );

            // Truthful metrics strip derived from grounded contract properties
            const metric1Key = node.metrics?.label1 || (node.modeledCapacity ? 'Capacity' : 'Origin');
            const metric1Val =
              node.metrics?.value1 ||
              node.modeledCapacity ||
              (node.origin ? node.origin.replace('_', ' ') : 'Decision');

            const metric2Key = node.metrics?.label2 || (node.assumedLatencySla ? 'SLA / Tech' : 'Role');
            const metric2Val =
              node.metrics?.value2 ||
              node.assumedLatencySla ||
              node.technology ||
              node.category;

            const tierLabel = node.tierBadge || (node.tier ? node.tier.toUpperCase() : 'DMZ');

            return (
              <div
                key={node.id}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${node.label}: ${node.sublabel || node.purpose}. Click to inspect systems details.`}
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
                    <span className="node-tier-pill font-mono">{tierLabel}</span>
                    <strong className="node-title">{node.label}</strong>
                  </div>
                  <span
                    className={`node-status-indicator status-${isOverloaded ? 'overloaded' : node.status || 'healthy'}`}
                    title={isOverloaded ? 'Overloaded' : node.status || 'Grounded'}
                  />
                </div>

                <p className="node-subtitle">{node.sublabel || node.purpose}</p>

                {/* Key Metrics Strip (truthful properties) */}
                <div className="node-metrics-strip">
                  <div className="node-metric-cell">
                    <span className="metric-k">{metric1Key}</span>
                    <span className="metric-v font-mono">{metric1Val}</span>
                  </div>
                  <div className="node-metric-cell">
                    <span className="metric-k">{metric2Key}</span>
                    <span
                      className={`metric-v font-mono ${
                        isOverloaded && metric2Key.includes('Latency') ? 'text-danger' : ''
                      }`}
                    >
                      {metric2Val}
                    </span>
                  </div>
                </div>

                {/* Overloaded Alert Pill if downstream compute capacity is exceeded */}
                {isOverloaded && (
                  <div className="node-overload-banner font-mono">
                    ⚠️ Concurrency Overload
                  </div>
                )}
              </div>
            );
          })}

          {/* Graceful Fallback for Empty / Incomplete Contracts */}
          {nodes.length === 0 && (
            <div
              className="canvas-empty-state font-mono"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                background: '#0f172a',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '8px',
                padding: '24px 32px',
                maxWidth: '460px',
                pointerEvents: 'auto',
              }}
            >
              <ShieldAlert size={32} style={{ color: '#f59e0b', margin: '0 auto 12px' }} />
              <h4 style={{ color: '#f8fafc', margin: '0 0 8px 0', fontSize: '15px' }}>
                Incomplete Architecture Topology
              </h4>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
                The selected contract is in draft or lacks architectural decisions. Topology cannot be grounded without decisions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Canvas Controls (Accessible on Mobile & Desktop) */}
      <div className="canvas-floating-controls" aria-label="Canvas Zoom & Overview Controls">
        <button
          type="button"
          className="canvas-floating-btn"
          onClick={() => onZoomChange(Math.min(2.0, +(zoomLevel + 0.15).toFixed(2)))}
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          className="canvas-floating-btn"
          onClick={() => onZoomChange(Math.max(0.3, +(zoomLevel - 0.15).toFixed(2)))}
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          className="canvas-floating-btn btn-fit-overview"
          onClick={onFitToOverview}
          title="Fit to Overview"
          aria-label="Fit to Overview"
        >
          <Maximize2 size={13} />
          <span>Fit to Overview</span>
        </button>
      </div>

      {/* Canvas Overlay Legend */}
      <div className="canvas-bottom-legend" aria-label="Architecture Legend">
        <div className="legend-item">
          <span className="legend-swatch swatch-boundary" />
          <span>Trust Boundaries</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch swatch-flow" />
          <span>Validated Topology Edge</span>
        </div>
        {simulationAvailable ? (
          <>
            <div className="legend-item">
              <span className="legend-dot dot-allowed" />
              <span>Admitted Traffic (200)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-throttled" />
              <span>Throttled Traffic (429)</span>
            </div>
          </>
        ) : (
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#38bdf8' }} />
            <span>Static Contract Graph</span>
          </div>
        )}
      </div>
    </div>
  );
};
