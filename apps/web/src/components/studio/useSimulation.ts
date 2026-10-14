// ArchitectAI Architecture Studio Prototype — Simulation Engine
// Educational simulation comparing Fixed-Window vs Rolling-Window rate limiting

import { useState, useEffect, useRef, useCallback } from 'react';
import { SimulationAlgorithm, TrafficScenario, SimulationState } from './types';

export interface SimulatedPacket {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  progress: number; // 0.0 to 1.0
  status: 'allowed' | 'throttled' | 'in_flight';
  timestamp: number;
}

export function useSimulation() {
  const [algorithm, setAlgorithm] = useState<SimulationAlgorithm>('ROLLING_WINDOW');
  const [scenario, setScenario] = useState<TrafficScenario>('BOUNDARY_SPIKE');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1); // 1x, 2x, 5x
  
  // Real-time metrics
  const [timeInWindowSec, setTimeInWindowSec] = useState<number>(55.0); // start near boundary for instant demonstration
  const [totalRequests, setTotalRequests] = useState<number>(0);
  const [allowedRequests, setAllowedRequests] = useState<number>(0);
  const [throttledRequests, setThrottledRequests] = useState<number>(0);
  const [currentRps, setCurrentRps] = useState<number>(0);
  const [downstreamLoadPct, setDownstreamLoadPct] = useState<number>(30);
  const [burstDetected, setBurstDetected] = useState<boolean>(false);
  const [explanation, setExplanation] = useState<string>('');
  const [packets, setPackets] = useState<SimulatedPacket[]>([]);

  // Rolling window history buffer (timestamps of allowed requests in ms)
  const requestHistoryRef = useRef<number[]>([]);
  // Fixed window counter and window start
  const fixedWindowCountRef = useRef<number>(0);
  const fixedWindowStartSecRef = useRef<number>(0);

  const reset = useCallback(() => {
    setTimeInWindowSec(scenario === 'BOUNDARY_SPIKE' ? 56.0 : 0.0);
    setTotalRequests(0);
    setAllowedRequests(0);
    setThrottledRequests(0);
    setCurrentRps(0);
    setDownstreamLoadPct(25);
    setBurstDetected(false);
    setPackets([]);
    requestHistoryRef.current = [];
    fixedWindowCountRef.current = 0;
    fixedWindowStartSecRef.current = 0;
    setExplanation('Simulation initialized. Observe how traffic flows across window boundaries.');
  }, [scenario]);

  // Main simulation tick
  useEffect(() => {
    if (!isRunning) return;

    const intervalMs = 100;
    const timer = setInterval(() => {
      setTimeInWindowSec((prevSec) => {
        const deltaSec = (intervalMs / 1000) * speed;
        let nextSec = prevSec + deltaSec;

        // Determine if boundary was crossed
        const didCrossBoundary = prevSec < 60.0 && nextSec >= 60.0;
        if (nextSec >= 60.0) {
          nextSec = nextSec % 60.0;
        }

        // Determine request arrival intensity based on scenario and time
        let incomingBurst = 0;
        if (scenario === 'BOUNDARY_SPIKE') {
          // Spike 1: seconds 57 to 59.9
          if (prevSec >= 57.0 && prevSec < 60.0) {
            incomingBurst = Math.floor(Math.random() * 4) + 3; // ~30-40 req/s
          }
          // Spike 2: seconds 0.0 to 3.0 (just after boundary)
          else if (nextSec >= 0.0 && nextSec < 3.0) {
            incomingBurst = Math.floor(Math.random() * 4) + 3; // ~30-40 req/s
          } else {
            incomingBurst = Math.random() < 0.3 ? 1 : 0;
          }
        } else if (scenario === 'BURST_ATTACK') {
          incomingBurst = Math.floor(Math.random() * 5) + 4; // heavy continuous flood
        } else {
          // STEADY scenario: smooth 1-2 req per tick (~15 req/sec)
          incomingBurst = Math.random() < 0.6 ? 1 : 0;
        }

        if (incomingBurst > 0) {
          const nowMs = Date.now();
          const LIMIT = 100; // max 100 requests per 60s
          const WINDOW_MS = 60000;

          let allowedBatch = 0;
          let throttledBatch = 0;

          for (let i = 0; i < incomingBurst; i++) {
            if (algorithm === 'FIXED_WINDOW') {
              if (didCrossBoundary) {
                fixedWindowCountRef.current = 0;
              }
              if (fixedWindowCountRef.current < LIMIT) {
                fixedWindowCountRef.current++;
                allowedBatch++;
              } else {
                throttledBatch++;
              }
            } else {
              // ROLLING_WINDOW / Token Bucket
              // Filter out timestamps older than 60s
              const cutoff = nowMs - WINDOW_MS;
              requestHistoryRef.current = requestHistoryRef.current.filter((t) => t > cutoff);
              if (requestHistoryRef.current.length < LIMIT) {
                requestHistoryRef.current.push(nowMs);
                allowedBatch++;
              } else {
                throttledBatch++;
              }
            }
          }

          setTotalRequests((t) => t + incomingBurst);
          setAllowedRequests((a) => a + allowedBatch);
          setThrottledRequests((th) => th + throttledBatch);
          setCurrentRps(incomingBurst * 10 * speed);

          // Update Downstream Compute Load
          if (algorithm === 'FIXED_WINDOW') {
            if ((prevSec >= 57.0 && prevSec < 60.0) || (nextSec >= 0.0 && nextSec < 4.0)) {
              setDownstreamLoadPct((prev) => Math.min(160, Math.max(85, prev + allowedBatch * 4)));
              setBurstDetected(true);
              setExplanation(
                'CRITICAL DEFECT (Boundary Amplification): Fixed window counter reset at t=60s. Both pre-boundary and post-boundary bursts were permitted, causing 160% overload on API instances!'
              );
            } else {
              setDownstreamLoadPct((prev) => Math.max(25, prev - 2));
              setBurstDetected(false);
            }
          } else {
            // ROLLING WINDOW
            if (throttledBatch > 0) {
              setDownstreamLoadPct(95); // strictly capped under 100%
              setBurstDetected(true);
              setExplanation(
                `SLIDING WINDOW ENFORCED: ${throttledBatch} excess requests rejected with HTTP 429 at Ingress Gateway. Downstream compute instances remain protected at 100 req/60s ceiling.`
              );
            } else {
              setDownstreamLoadPct((prev) => Math.min(85, Math.max(20, prev + (allowedBatch > 0 ? 3 : -2))));
              setBurstDetected(false);
              setExplanation(
                'Normal operation: Ingress Gateway verifies sliding window timestamps in Redis (<0.8ms). All requests within quota are routed to API instances.'
              );
            }
          }

          // Generate animated visual packets on canvas
          const newPackets: SimulatedPacket[] = [];
          for (let k = 0; k < Math.min(incomingBurst, 4); k++) {
            const isThrottled = k >= allowedBatch;
            newPackets.push({
              id: `${nowMs}-${Math.random()}`,
              sourceX: 12 + Math.random() * 4,
              sourceY: 48 + (Math.random() - 0.5) * 8,
              targetX: isThrottled ? 37 : 62,
              targetY: isThrottled ? 50 : 32 + (Math.random() - 0.5) * 6,
              progress: 0.0,
              status: isThrottled ? 'throttled' : 'allowed',
              timestamp: nowMs,
            });
          }

          setPackets((prev) => [...prev.slice(-12), ...newPackets]);
        }

        return nextSec;
      });

      // Update packet progress
      setPackets((prev) =>
        prev
          .map((p) => ({ ...p, progress: p.progress + 0.15 * speed }))
          .filter((p) => p.progress <= 1.0)
      );
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isRunning, speed, algorithm, scenario]);

  const state: SimulationState = {
    algorithm,
    scenario,
    isRunning,
    speed,
    timeInWindowSec,
    totalRequests,
    allowedRequests,
    throttledRequests,
    currentRps,
    downstreamLoadPct,
    burstDetected,
    explanation,
  };

  return {
    state,
    packets,
    setAlgorithm,
    setScenario,
    setSpeed,
    setIsRunning,
    togglePlay: () => setIsRunning((r) => !r),
    reset,
  };
}
