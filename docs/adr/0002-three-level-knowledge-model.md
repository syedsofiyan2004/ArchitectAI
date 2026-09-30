# ADR 0002: Three-Level Knowledge Model

## Status
Accepted

## Context
ArchitectAI must avoid becoming a brittle, hard-coded catalog of individual application features (such as `rate_limit` or `cache_stampede` hard-coded as engine branches). Software systems fail due to fundamental engineering constraints (concurrency, bounded resources, time, trust boundaries) that manifest in recurring failure modes across different technological implementations.

Without a structured knowledge hierarchy:
1. Knowledge becomes a flat, unmaintainable list of ad-hoc advice.
2. The engine cannot generalize across tech stacks (e.g., recognizing that backpressure issues apply equally to Node.js streams, Go channels, and TCP sockets).
3. Technology-specific details become obsolete or conflict with durable engineering primitives.

## Decision
We organize all engineering knowledge into an explicit three-level model:

1. **L1 — Fundamental Primitives (`fundamental`)**:
   Durable, technology-agnostic physical and mathematical constraints: memory, CPU, storage, network, state, concurrency, time/windows, capacity, latency, throughput, consistency, failure, trust boundaries, and resource ownership.

2. **L2 — Reusable Failure Patterns (`failure_pattern`)**:
   Cross-technology emergent failure modes and interaction bugs: OOM, retry amplification, cache stampede, deadlock, lost update, hot partition, connection exhaustion, boundary bursts, backpressure, token refresh races, and duplicate side effects.

3. **L3 — Technology-Specific Mechanisms (`technology_specific`)**:
   Concrete runtime mechanisms, language semantics, frameworks, and constraints (e.g., Node.js event loop & stream backpressure, Linux cgroups & OOM killer, PostgreSQL MVCC isolation levels, Redis single-threaded execution). L3 items preserve source provenance, technological ecosystem, and version applicability.

Every knowledge item in the generic knowledge repository must belong to, or explicitly bridge, one or more of these three levels and link to relevant engineering dimensions.

## Consequences
### Positive
- The core reasoning engine operates on generalized dimensions and failure patterns rather than hard-coded feature rules.
- Technology-specific advice is cleanly separated and versioned, preserving durable engineering principles when frameworks evolve.
- The knowledge repository can be queried uniformly across levels (e.g., discovering applicable L2 patterns and concrete L3 mitigations for an L1 bounded resource concern).

### Negative / Tradeoffs
- Knowledge authoring requires identifying fundamental primitives and patterns rather than pasting flat tips.
- Query and retrieval logic must support hierarchical or multi-level relationship traversals.
