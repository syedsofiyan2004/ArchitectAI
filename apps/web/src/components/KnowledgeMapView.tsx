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
    <div className="knowledge-trail-container">
      <div className="section-intro">
        <div>
          <h2 className="section-heading">Three-Level Knowledge Causal Reasoning Trail</h2>
          <p className="section-subtext">
            ArchitectAI grounds discovered concerns by tracing durable physical primitives (L1),
            through reusable architectural failure modes (L2), down to concrete runtime mechanisms (L3).
          </p>
        </div>
        <div className="grounding-count-pill font-mono">
          {supportingIds.size} Grounded Primitives Active
        </div>
      </div>

      <div className="knowledge-trail-columns">
        {/* Tier 1: L1 Fundamental */}
        <div className="trail-column tier-l1">
          <div className="trail-column-header">
            <span className="tier-badge l1 font-mono">L1 FUNDAMENTAL</span>
            <h3>Durable Systems Primitives</h3>
            <p>Invariant physical principles: finite capacity, concurrency, time, and trust boundaries.</p>
          </div>

          <div className="trail-cards-list">
            <div className="surface-card trail-card">
              <div className="card-top-tags">
                <span className="k-id font-mono">l1-bounded-resources</span>
                <span className="k-dim-tag font-mono">bounded_resource</span>
              </div>
              <h4 className="card-title">Bounded Capacity & Saturation</h4>
              <p className="card-desc">
                Physical computational resources (memory, file descriptors, network bandwidth) are finite.
                Unbounded arrival rates cause OOM or catastrophic tail latency.
              </p>
              <div className="provenance-tag font-mono">
                Physical Systems Primitive
              </div>
            </div>

            <div className="surface-card trail-card">
              <div className="card-top-tags">
                <span className="k-id font-mono">l1-concurrency-state</span>
                <span className="k-dim-tag font-mono">concurrency</span>
              </div>
              <h4 className="card-title">Concurrent Shared Mutation</h4>
              <p className="card-desc">
                Without serializability or atomic primitives, interleaved operations over shared mutable
                state produce race conditions and lost updates.
              </p>
              <div className="provenance-tag font-mono">
                Physical Systems Primitive
              </div>
            </div>

            <div className="surface-card trail-card">
              <div className="card-top-tags">
                <span className="k-id font-mono">l1-trust-boundaries</span>
                <span className="k-dim-tag font-mono">trust_boundary</span>
              </div>
              <h4 className="card-title">Untrusted Network Ingress</h4>
              <p className="card-desc">
                Inputs crossing untrusted network boundaries must be authenticated, parsed defensively,
                and bounded before consuming internal resources.
              </p>
              <div className="provenance-tag font-mono">
                Physical Systems Primitive
              </div>
            </div>
          </div>
        </div>

        {/* Tier 2: L2 Failure Pattern */}
        <div className="trail-column tier-l2">
          <div className="trail-column-header">
            <span className="tier-badge l2 font-mono">L2 FAILURE PATTERN</span>
            <h3>Reusable Failure Modes</h3>
            <p>Recurrent architectural anti-patterns independent of specific programming languages.</p>
          </div>

          <div className="trail-cards-list">
            {contract.discoveredConcerns.map((concern) => (
              <div key={concern.id} className="surface-card trail-card active-pattern">
                <div className="card-top-tags">
                  <span className="k-id font-mono">{concern.id}</span>
                  <span className="k-dim-tag font-mono">{concern.dimensions[0]}</span>
                </div>
                <h4 className="card-title">{concern.title}</h4>
                <p className="card-desc">{concern.description}</p>
                <div className="trigger-box">
                  <span className="trigger-label">Boundary Condition:</span>
                  <span className="trigger-text">{concern.applicabilityReason}</span>
                </div>
                <div className="provenance-tag font-mono">
                  Confidence: {Math.round(concern.confidence * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tier 3: L3 Technology Specific */}
        <div className="trail-column tier-l3">
          <div className="trail-column-header">
            <span className="tier-badge l3 font-mono">L3 TECHNOLOGY SPECIFIC</span>
            <h3>Concrete Mechanisms</h3>
            <p>Authoritative documentation, runtime primitives, and concrete protocols.</p>
          </div>

          <div className="trail-cards-list">
            <div className="surface-card trail-card">
              <div className="card-top-tags">
                <span className="k-id font-mono">l3-redis-rate-limiter</span>
                <span className="tech-badge font-mono">Redis 7+</span>
              </div>
              <h4 className="card-title">Atomic Sliding Window via Lua</h4>
              <p className="card-desc">
                Sliding window rate limiting using Redis sorted sets (ZADD/ZREMRANGEBYSCORE) executed
                atomically via EVAL script to prevent multi-node race conditions.
              </p>
              <div className="authoritative-source font-mono">
                <span className="source-check">✓</span>
                <a
                  href="https://redis.io/docs/manual/patterns/rate-limiter/"
                  target="_blank"
                  rel="noreferrer"
                  className="source-link"
                >
                  redis.io/docs/patterns/rate-limiter
                </a>
              </div>
            </div>

            <div className="surface-card trail-card">
              <div className="card-top-tags">
                <span className="k-id font-mono">l3-rfc6749-token-refresh</span>
                <span className="tech-badge font-mono">OAuth 2.0</span>
              </div>
              <h4 className="card-title">RFC 6749 Single-Flight Refresh</h4>
              <p className="card-desc">
                RFC 6749 §6 requires single-flight refresh with queued replay of waiting requests to
                avoid invalidating rotation tokens across concurrent requests.
              </p>
              <div className="authoritative-source font-mono">
                <span className="source-check">✓</span>
                <a
                  href="https://datatracker.ietf.org/doc/html/rfc6749#section-6"
                  target="_blank"
                  rel="noreferrer"
                  className="source-link"
                >
                  datatracker.ietf.org/doc/rfc6749
                </a>
              </div>
            </div>

            <div className="surface-card trail-card">
              <div className="card-top-tags">
                <span className="k-id font-mono">l3-sharp-stream-pipeline</span>
                <span className="tech-badge font-mono">Node / Libvips</span>
              </div>
              <h4 className="card-title">Memory-Bounded Stream Pipeline</h4>
              <p className="card-desc">
                Libvips processes image buffers via streaming pipeline (concurrency limit, libvips cache
                management) avoiding Node.js buffer exhaustion.
              </p>
              <div className="authoritative-source font-mono">
                <span className="source-check">✓</span>
                <a
                  href="https://sharp.pixelplumbing.com/performance"
                  target="_blank"
                  rel="noreferrer"
                  className="source-link"
                >
                  sharp.pixelplumbing.com/performance
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
