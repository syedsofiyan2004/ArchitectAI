// ArchitectAI Architecture Studio — Simulation Hook
// Connects the pure deterministic SimulationEngine to the React UI

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SimulationEngine,
  SimulationAlgorithm,
  TrafficScenario,
  SimulationMetrics,
  ProcessedRequest,
} from './simulation-engine';

export interface SimulatedPacket {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  progress: number;
  status: 'allowed' | 'throttled';
  timestamp: number;
}

export function useSimulation() {
  const [algorithm, setAlgorithmState] = useState<SimulationAlgorithm>('ROLLING_WINDOW');
  const [scenario, setScenarioState] = useState<TrafficScenario>('BOUNDARY_SPIKE');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1); // 1x, 2x, 5x
  const [packets, setPackets] = useState<SimulatedPacket[]>([]);

  // Pure deterministic engine in a ref
  const engineRef = useRef<SimulationEngine>(
    new SimulationEngine('ROLLING_WINDOW', 'BOUNDARY_SPIKE')
  );

  const [metrics, setMetrics] = useState<SimulationMetrics>(() =>
    engineRef.current.getMetrics()
  );

  const reset = useCallback(() => {
    engineRef.current.reset();
    setMetrics(engineRef.current.getMetrics());
    setPackets([]);
  }, []);

  const setAlgorithm = useCallback((alg: SimulationAlgorithm) => {
    setAlgorithmState(alg);
    engineRef.current.setAlgorithm(alg);
    setMetrics(engineRef.current.getMetrics());
    setPackets([]);
  }, []);

  const setScenario = useCallback((scen: TrafficScenario) => {
    setScenarioState(scen);
    engineRef.current.setScenario(scen);
    setMetrics(engineRef.current.getMetrics());
    setPackets([]);
  }, []);

  // Virtual clock progression loop
  useEffect(() => {
    if (!isRunning) return;

    // Real-time interval: 100ms
    const intervalRealMs = 100;
    // Virtual time advancement: 100ms * speed
    const virtualStepMs = intervalRealMs * speed;

    const timer = setInterval(() => {
      const newlyProcessed: ProcessedRequest[] = engineRef.current.advanceBy(virtualStepMs);
      const updatedMetrics = engineRef.current.getMetrics();
      setMetrics(updatedMetrics);

      // Loop back if boundary test reaches 70 seconds to allow continuous educational observation
      if (engineRef.current.getVirtualTimeMs() > 70_000 && scenario === 'BOUNDARY_SPIKE') {
        engineRef.current.reset();
      }

      // Generate animated packets for newly processed requests
      if (newlyProcessed.length > 0) {
        const newPackets: SimulatedPacket[] = newlyProcessed.slice(0, 4).map((req, i) => {
          const isThrottled = req.status === 'REJECTED';
          return {
            id: `${req.id}-${Date.now()}-${i}`,
            sourceX: 230,
            sourceY: 320 + (Math.random() - 0.5) * 24,
            targetX: isThrottled ? 385 : 645,
            targetY: isThrottled ? 320 : 220 + (Math.random() - 0.5) * 24,
            progress: 0.0,
            status: isThrottled ? 'throttled' : 'allowed',
            timestamp: Date.now(),
          };
        });

        setPackets((prev) => [...prev.slice(-10), ...newPackets]);
      }

      // Animate packet progress along paths
      setPackets((prev) =>
        prev
          .map((p) => ({ ...p, progress: p.progress + 0.18 * speed }))
          .filter((p) => p.progress <= 1.0)
      );
    }, intervalRealMs);

    return () => clearInterval(timer);
  }, [isRunning, speed, scenario]);

  // Construct full SimulationState object
  const simulationState: SimulationState = {
    algorithm,
    scenario,
    isRunning,
    speed,
    timeInWindowSec: metrics.timeInWindowSec,
    totalRequests: metrics.totalRequests,
    allowedRequests: metrics.allowedRequests,
    throttledRequests: metrics.throttledRequests,
    currentRps: metrics.currentRps,
    downstreamLoadPct: metrics.downstreamLoadPct,
    burstDetected: metrics.burstDetected,
    explanation: metrics.explanation,
  };

  return {
    simulation: simulationState,
    state: simulationState,
    metrics,
    algorithm,
    scenario,
    isRunning,
    speed,
    packets,
    setAlgorithm,
    setScenario,
    setSpeed,
    setIsRunning,
    togglePlay: () => setIsRunning((r) => !r),
    reset,
  };
}

