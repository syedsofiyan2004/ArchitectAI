import React from 'react';
import { EngineeringContract } from '@architectai/domain';

interface KnowledgeMapViewProps {
  contract: EngineeringContract;
}

export const KnowledgeMapView: React.FC<KnowledgeMapViewProps> = ({ contract }) => {
  const supportingIds = new Set(
    contract.discoveredConcerns.flatMap((c) => c.supportingKnowledgeIds)
  );

  return (
    <div className="knowledge-map-view">
      <div className="section-intro">
        <div>
          <h2 className="section-heading">Three-Level Knowledge Grounding</h2>
          <p className="section-subtext">
            ArchitectAI bridges durable primitives (L1), reusable failure modes (L2), and concrete mechanisms (L3) with authentic provenance.
          </p>
        </div>
        <div className="grounding-count-pill font-mono">
          {supportingIds.size} Grounded Knowledge References
        </div>
      </div>

      <div className="knowledge-columns-grid">
        {/* Column 1: L1 Fundamentals */}
        <div className="level-column l1-col">
          <div className="column-header">
            <span className="level-badge l1">L1 Fundamental</span>
            <h3 className="column-title">Durable Systems Primitives</h3>
            <p className="column-desc">Invariant physical laws: capacity, concurrency, time, trust boundaries.</p>
          </div>

          <div className="knowledge-cards-list">
            <div className="k-card card">
              <div className="k-title-row">
                <span className="k-id font-mono">l1-bounded-resources</span>
                <span className="k-dim-pill">bounded_resource</span>
              </div>
              <h4 className="k-name">Bounded Capacity & Resource Saturation</h4>
              <p className="k-desc">
                Physical computational resources (memory, file descriptors, network bandwidth) are finite. Unbounded arrival rates cause OOM or catastrophic tail latency.
              </p>
              <div className="k-provenance">
                <span className="prov-label font-mono">manual_analysis (systems primitive)</span>
              </div>
            </div>

            <div className="k-card card">
              <div className="k-title-row">
                <span className="k-id font-mono">l1-concurrency-state</span>
                <span className="k-dim-pill">concurrency</span>
              </div>
              <h4 className="k-name">Concurrent Mutation of Shared State</h4>
              <p className="k-desc">
                Without serializability or atomic primitives, interleaved operations over shared mutable resources produce race conditions and stale writes.
              </p>
              <div className="k-provenance">
                <span className="prov-label font-mono">manual_analysis (systems primitive)</span>
              </div>
            </div>

            <div className="k-card card">
              <div className="k-title-row">
                <span className="k-id font-mono">l1-trust-boundaries</span>
                <span className="k-dim-pill">trust_boundary</span>
              </div>
              <h4 className="k-name">Trust Boundaries & Attacker-Controlled Input</h4>
              <p className="k-desc">
                Inputs crossing untrusted network boundaries must be authenticated, parsed defensively, and bounded before consuming internal resources.
              </p>
              <div className="k-provenance">
                <span className="prov-label font-mono">manual_analysis (systems primitive)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: L2 Failure Patterns */}
        <div className="level-column l2-col">
          <div className="column-header">
            <span className="level-badge l2">L2 Failure Pattern</span>
            <h3 className="column-title">Reusable Failure Modes</h3>
            <p className="column-desc">Recurrent architectural anti-patterns independent of specific frameworks.</p>
          </div>

          <div className="knowledge-cards-list">
            {contract.discoveredConcerns.map((concern) => (
              <div key={concern.id} className="k-card card highlight">
                <div className="k-title-row">
                  <span className="k-id font-mono">{concern.id}</span>
                  <span className="k-dim-pill">{concern.dimensions[0]}</span>
                </div>
                <h4 className="k-name">{concern.title}</h4>
                <p className="k-desc">{concern.description}</p>
                <div className="k-mitigation-box">
                  <span className="mitigation-label">Triggers & Boundary Conditions:</span>
                  <p className="mitigation-text">{concern.applicabilityReason}</p>
                </div>
                <div className="k-provenance">
                  <span className="prov-label font-mono">Pattern Confidence: {Math.round(concern.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: L3 Technology Specific */}
        <div className="level-column l3-col">
          <div className="column-header">
            <span className="level-badge l3">L3 Technology Specific</span>
            <h3 className="column-title">Concrete Tech Mechanisms</h3>
            <p className="column-desc">Real mechanisms and documentation for specific runtimes and protocols.</p>
          </div>

          <div className="knowledge-cards-list">
            <div className="k-card card">
              <div className="k-title-row">
                <span className="k-id font-mono">l3-redis-rate-limiter</span>
                <span className="k-tech-pill font-mono">Redis 7+</span>
              </div>
              <h4 className="k-name">Redis Atomic Sliding Window (Lua)</h4>
              <p className="k-desc">
                Sliding window rate limiting using Redis sorted sets (ZADD/ZREMRANGEBYSCORE) executed atomically via EVAL to prevent race conditions.
              </p>
              <div className="k-provenance verified">
                <span className="prov-icon">✓</span>
                <span className="prov-label font-mono">Source: https://redis.io/docs/manual/patterns/rate-limiter/</span>
              </div>
            </div>

            <div className="k-card card">
              <div className="k-title-row">
                <span className="k-id font-mono">l3-rfc6749-token-refresh</span>
                <span className="k-tech-pill font-mono">OAuth 2.0</span>
              </div>
              <h4 className="k-name">RFC 6749 OAuth 2.0 Token Refresh</h4>
              <p className="k-desc">
                RFC 6749 §6 requires single-flight refresh with queued replay of waiting requests to avoid invalidating rotation tokens.
              </p>
              <div className="k-provenance verified">
                <span className="prov-icon">✓</span>
                <span className="prov-label font-mono">Source: https://datatracker.ietf.org/doc/html/rfc6749#section-6</span>
              </div>
            </div>

            <div className="k-card card">
              <div className="k-title-row">
                <span className="k-id font-mono">l3-sharp-stream-pipeline</span>
                <span className="k-tech-pill font-mono">Node.js / Libvips</span>
              </div>
              <h4 className="k-name">Sharp / Libvips Memory-Bounded Pipeline</h4>
              <p className="k-desc">
                Libvips processes image buffers via streaming pipeline (concurrency limit, libvips cache management) avoiding Node.js buffer exhaustion.
              </p>
              <div className="k-provenance verified">
                <span className="prov-icon">✓</span>
                <span className="prov-label font-mono">Source: https://sharp.pixelplumbing.com/performance</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
