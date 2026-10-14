// ArchitectAI Architecture Studio — Pure TypeScript Simulation Engine
// Deterministic Rate Limiting Simulation: Fixed Window vs Exact Rolling Window

export type SimulationAlgorithm = 'FIXED_WINDOW' | 'ROLLING_WINDOW';
export type TrafficScenario = 'BOUNDARY_SPIKE' | 'STEADY' | 'BURST_ATTACK';

export interface RequestEvent {
  id: string;
  virtualTimeMs: number;
}

export interface ProcessedRequest {
  id: string;
  virtualTimeMs: number;
  status: 'ADMITTED' | 'REJECTED';
  algorithm: SimulationAlgorithm;
  windowIndex?: number;
}

export interface SimulationMetrics {
  virtualTimeMs: number;
  timeInWindowSec: number;
  totalRequests: number;
  allowedRequests: number;
  throttledRequests: number;
  acceptedInLast60s: number;
  downstreamLoadPct: number;
  isOverloaded: boolean;
  explanation: string;
}

export interface SimulationEngineConfig {
  windowMs?: number; // default: 60,000 ms (60 seconds)
  quotaLimit?: number; // default: 100 requests
  modeledCapacityPerWindow?: number; // default: 100 requests per 60s
}

export class SimulationEngine {
  readonly windowMs: number;
  readonly quotaLimit: number;
  readonly modeledCapacity: number;

  private algorithm: SimulationAlgorithm;
  private scenario: TrafficScenario;
  private virtualTimeMs: number;
  private scheduledEvents: RequestEvent[];
  private processedRequests: ProcessedRequest[];

  // Algorithm state
  private fixedWindowCurrentIndex: number;
  private fixedWindowCount: number;
  private rollingWindowAdmittedTimestamps: number[];

  constructor(
    algorithm: SimulationAlgorithm = 'ROLLING_WINDOW',
    scenario: TrafficScenario = 'BOUNDARY_SPIKE',
    config?: SimulationEngineConfig
  ) {
    this.windowMs = config?.windowMs ?? 60_000;
    this.quotaLimit = config?.quotaLimit ?? 100;
    this.modeledCapacity = config?.modeledCapacityPerWindow ?? 100;

    this.algorithm = algorithm;
    this.scenario = scenario;
    this.virtualTimeMs = 0;
    this.scheduledEvents = [];
    this.processedRequests = [];

    this.fixedWindowCurrentIndex = 0;
    this.fixedWindowCount = 0;
    this.rollingWindowAdmittedTimestamps = [];

    this.initScenario(scenario);
  }

  getAlgorithm(): SimulationAlgorithm {
    return this.algorithm;
  }

  setAlgorithm(alg: SimulationAlgorithm): void {
    if (this.algorithm === alg) return;
    this.algorithm = alg;
    this.reset();
  }

  getScenario(): TrafficScenario {
    return this.scenario;
  }

  setScenario(scen: TrafficScenario): void {
    if (this.scenario === scen) return;
    this.scenario = scen;
    this.reset();
  }

  getVirtualTimeMs(): number {
    return this.virtualTimeMs;
  }

  getProcessedRequests(): ProcessedRequest[] {
    return [...this.processedRequests];
  }

  /**
   * Initializes the deterministic request event sequence for a scenario.
   */
  private initScenario(scenario: TrafficScenario): void {
    this.scheduledEvents = [];
    this.processedRequests = [];
    this.fixedWindowCurrentIndex = 0;
    this.fixedWindowCount = 0;
    this.rollingWindowAdmittedTimestamps = [];

    if (scenario === 'BOUNDARY_SPIKE') {
      // Start clock at t = 50.0s (50,000ms) to inspect boundary transition quickly
      this.virtualTimeMs = 50_000;
      this.fixedWindowCurrentIndex = 0;

      // Exactly 80 requests at t = 59.0s (59,000 ms)
      for (let i = 0; i < 80; i++) {
        this.scheduledEvents.push({
          id: `req-pre-boundary-${i + 1}`,
          virtualTimeMs: 59_000,
        });
      }

      // Exactly 80 requests at t = 61.0s (61,000 ms)
      for (let i = 0; i < 80; i++) {
        this.scheduledEvents.push({
          id: `req-post-boundary-${i + 1}`,
          virtualTimeMs: 61_000,
        });
      }
    } else if (scenario === 'BURST_ATTACK') {
      this.virtualTimeMs = 0;
      // 150 requests arriving at t = 10.0s
      for (let i = 0; i < 150; i++) {
        this.scheduledEvents.push({
          id: `req-burst-${i + 1}`,
          virtualTimeMs: 10_000,
        });
      }
    } else {
      // STEADY scenario: 60 requests evenly spaced between t = 5.0s and t = 55.0s
      this.virtualTimeMs = 0;
      for (let i = 0; i < 60; i++) {
        this.scheduledEvents.push({
          id: `req-steady-${i + 1}`,
          virtualTimeMs: 5_000 + i * 850,
        });
      }
    }

    // Sort scheduled events monotonically by virtual time
    this.scheduledEvents.sort((a, b) => a.virtualTimeMs - b.virtualTimeMs);
  }

  reset(): void {
    this.initScenario(this.scenario);
  }

  /**
   * Advance virtual clock by deltaMs and process all scheduled requests.
   */
  advanceBy(deltaMs: number): ProcessedRequest[] {
    const targetTimeMs = this.virtualTimeMs + deltaMs;
    const newlyProcessed: ProcessedRequest[] = [];

    // Find and process all events up to targetTimeMs
    while (
      this.scheduledEvents.length > 0 &&
      this.scheduledEvents[0]!.virtualTimeMs <= targetTimeMs
    ) {
      const event = this.scheduledEvents.shift()!;
      this.virtualTimeMs = event.virtualTimeMs;
      const res = this.processSingleRequest(event);
      newlyProcessed.push(res);
      this.processedRequests.push(res);
    }

    this.virtualTimeMs = targetTimeMs;
    return newlyProcessed;
  }

  /**
   * Fast-forward to a specific virtual time.
   */
  advanceTo(targetTimeMs: number): ProcessedRequest[] {
    if (targetTimeMs <= this.virtualTimeMs) return [];
    return this.advanceBy(targetTimeMs - this.virtualTimeMs);
  }

  private processSingleRequest(event: RequestEvent): ProcessedRequest {
    if (this.algorithm === 'FIXED_WINDOW') {
      const windowIndex = Math.floor(event.virtualTimeMs / this.windowMs);
      if (windowIndex > this.fixedWindowCurrentIndex) {
        // Crosses fixed window boundary: reset counter
        this.fixedWindowCurrentIndex = windowIndex;
        this.fixedWindowCount = 0;
      }

      if (this.fixedWindowCount < this.quotaLimit) {
        this.fixedWindowCount++;
        return {
          id: event.id,
          virtualTimeMs: event.virtualTimeMs,
          status: 'ADMITTED',
          algorithm: 'FIXED_WINDOW',
          windowIndex,
        };
      } else {
        return {
          id: event.id,
          virtualTimeMs: event.virtualTimeMs,
          status: 'REJECTED',
          algorithm: 'FIXED_WINDOW',
          windowIndex,
        };
      }
    } else {
      // Exact Rolling-Window Log
      const cutoff = event.virtualTimeMs - this.windowMs;
      this.rollingWindowAdmittedTimestamps = this.rollingWindowAdmittedTimestamps.filter(
        (t) => t > cutoff
      );

      if (this.rollingWindowAdmittedTimestamps.length < this.quotaLimit) {
        this.rollingWindowAdmittedTimestamps.push(event.virtualTimeMs);
        return {
          id: event.id,
          virtualTimeMs: event.virtualTimeMs,
          status: 'ADMITTED',
          algorithm: 'ROLLING_WINDOW',
        };
      } else {
        return {
          id: event.id,
          virtualTimeMs: event.virtualTimeMs,
          status: 'REJECTED',
          algorithm: 'ROLLING_WINDOW',
        };
      }
    }
  }

  /**
   * Compute current metrics and derived downstream service load.
   */
  getMetrics(): SimulationMetrics {
    const totalRequests = this.processedRequests.length;
    const allowedRequests = this.processedRequests.filter((r) => r.status === 'ADMITTED').length;
    const throttledRequests = this.processedRequests.filter((r) => r.status === 'REJECTED').length;

    // Rolling 60s accepted request count
    const rollingCutoff = this.virtualTimeMs - this.windowMs;
    const admittedInRollingWindow = this.processedRequests.filter(
      (r) => r.status === 'ADMITTED' && r.virtualTimeMs > rollingCutoff && r.virtualTimeMs <= this.virtualTimeMs
    ).length;

    // Derive downstream load strictly from accepted requests vs modeled capacity
    const downstreamLoadPct = Math.round((admittedInRollingWindow / this.modeledCapacity) * 100);
    const isOverloaded = downstreamLoadPct > 100;

    const timeInWindowSec = ((this.virtualTimeMs % this.windowMs) / 1000);

    let explanation = '';
    if (this.algorithm === 'FIXED_WINDOW') {
      if (isOverloaded) {
        explanation = `CRITICAL BOUNDARY DEFECT: Fixed window counter reset at t=60s. Admitted ${admittedInRollingWindow} requests in rolling 60s span (${downstreamLoadPct}% of modeled capacity). API instances overloaded!`;
      } else if (allowedRequests > 0) {
        explanation = `Fixed window active. Admitted ${allowedRequests} requests in current fixed bucket. Watching boundary at t=60s.`;
      } else {
        explanation = 'Fixed window simulation ready. Approaching window boundary at t=60s.';
      }
    } else {
      if (throttledRequests > 0) {
        explanation = `SLIDING WINDOW ENFORCED: ${throttledRequests} requests rejected with HTTP 429. Rolling 60s admissions strictly capped at ${admittedInRollingWindow}/${this.quotaLimit} (${downstreamLoadPct}% load). Downstream compute protected.`;
      } else if (allowedRequests > 0) {
        explanation = `Sliding window active. Admitted ${allowedRequests} requests. Continuous time-slice quota enforced at Gateway.`;
      } else {
        explanation = 'Sliding window simulation ready. Evaluating trailing 60s window on every request.';
      }
    }

    return {
      virtualTimeMs: this.virtualTimeMs,
      timeInWindowSec,
      totalRequests,
      allowedRequests,
      throttledRequests,
      acceptedInLast60s: admittedInRollingWindow,
      downstreamLoadPct,
      isOverloaded,
      explanation,
    };
  }
}
