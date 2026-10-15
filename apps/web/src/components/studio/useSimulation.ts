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
import { SimulationState } from './types';

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
  const [instantaneousRps, setInstantaneousRps] = useState<number>(0);

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
    setInstantaneousRps(0);
  }, []);

  const setAlgorithm = useCallback((alg: SimulationAlgorithm) => {
    setAlgorithmState(alg);
    engineRef.current.setAlgorithm(alg);
    setMetrics(engineRef.current.getMetrics());
    setPackets([]);
    setInstantaneousRps(0);
  }, []);

  const setScenario = useCallback((scen: TrafficScenario) => {
    setScenarioState(scen);
    engineRef.current.setScenario(scen);
    setMetrics(engineRef.current.getMetrics());
    setPackets([]);
    setInstantaneousRps(0);
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

      // Truthfully derive presentation signals from valid simulation step data
      const stepSeconds = virtualStepMs / 1000;
      const rps = stepSeconds > 0 ? Math.round(newlyProcessed.length / stepSeconds) : 0;
      setInstantaneousRps(rps);

      // Loop back if boundary test reaches 70 seconds to allow continuous educational observation
      if (engineRef.current.getVirtualTimeMs() > 70_000 && scenario === 'BOUNDARY_SPIKE') {
        engineRef.current.reset();
      }

      // Generate truthful, bounded animated packets representing BOTH admitted and rejected outcomes
      let newPackets: SimulatedPacket[] = [];
      if (newlyProcessed.length > 0) {
        const admitted = newlyProcessed.filter((r) => r.status === 'ADMITTED');
        const rejected = newlyProcessed.filter((r) => r.status === 'REJECTED');

        const samples: ProcessedRequest[] = [];
        // If there are admitted requests, take representative samples
        if (admitted.length > 0) {
          const count = Math.min(3, admitted.length);
          const step = Math.max(1, Math.floor(admitted.length / count));
          for (let i = 0; i < count; i++) {
            samples.push(admitted[i * step] || admitted[0]);
          }
        }
        // If there are rejected requests, take representative samples
        if (rejected.length > 0) {
          const count = Math.min(3, rejected.length);
          const step = Math.max(1, Math.floor(rejected.length / count));
          for (let i = 0; i < count; i++) {
            samples.push(rejected[i * step] || rejected[0]);
          }
        }

        newPackets = samples.map((req, i) => {
          const isThrottled = req.status === 'REJECTED';
          return {
            id: `${req.id}-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            sourceX: 230,
            sourceY: 320 + (Math.random() - 0.5) * 20,
            targetX: isThrottled ? 385 : 645,
            targetY: isThrottled ? 320 : 220 + (Math.random() - 0.5) * 20,
            progress: 0.0,
            status: isThrottled ? 'throttled' : 'allowed',
            timestamp: Date.now(),
          };
        });
      }

      // Animate packet progress along paths (smooth, visible travel duration of ~1.2s)
      setPackets((prev) => {
        const advanced = prev
          .map((p) => ({ ...p, progress: p.progress + 0.08 }))
          .filter((p) => p.progress <= 1.0);

        if (newPackets.length > 0) {
          return [...advanced.slice(-12), ...newPackets];
        }
        return advanced;
      });
    }, intervalRealMs);

    return () => clearInterval(timer);
  }, [isRunning, speed, scenario]);

  // Truthfully derive presentation signals from valid simulation metrics
  const burstDetected =
    metrics.isOverloaded ||
    metrics.downstreamLoadPct > 100 ||
    instantaneousRps > 25 ||
    (metrics.totalRequests > 0 &&
      metrics.virtualTimeMs >= 58_500 &&
      metrics.virtualTimeMs <= 62_500 &&
      scenario === 'BOUNDARY_SPIKE');

  const simulationState: SimulationState = {
    algorithm,
    scenario,
    isRunning,
    speed,
    timeInWindowSec: metrics.timeInWindowSec,
    totalRequests: metrics.totalRequests,
    allowedRequests: metrics.allowedRequests,
    throttledRequests: metrics.throttledRequests,
    currentRps: instantaneousRps,
    downstreamLoadPct: metrics.downstreamLoadPct,
    burstDetected,
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
