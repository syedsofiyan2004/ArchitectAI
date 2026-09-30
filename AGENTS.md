# ArchitectAI — Workspace Constitution

## Mission

ArchitectAI is an engineering-intelligence platform for builders who can describe what they want but may not know the software-engineering, systems, operating-system, database, networking, security, reliability, or distributed-systems concerns they should have asked about.

ArchitectAI must:
1. infer missing engineering concerns from incomplete product intent;
2. ground engineering claims in structured knowledge and authoritative evidence when appropriate;
3. turn applicable concerns into explicit architecture decisions and implementation constraints;
4. delegate implementation through provider-neutral coding-agent adapters;
5. independently verify important behavior with executable tests/evidence;
6. repair or escalate when verification disproves an implementation.

The product is NOT a prompt pack, skill collection, documentation chatbot, single-provider wrapper, or a manually enumerated catalog of one rule per application feature.

## Non-negotiable architecture

The core must stay provider-neutral and UI-neutral.

User Intent
→ Context/Capability Decomposition
→ Unknown-Unknown Discovery
→ Knowledge Retrieval
→ Concern Relevance Evaluation
→ Architecture Decisions
→ Engineering Contract
→ Coding Agent Adapter
→ Implementation
→ Independent Verification
→ Repair / Escalation

## Three-level knowledge model

Every engineering knowledge item must belong to, or explicitly bridge, one or more of:

- L1 FUNDAMENTAL: durable engineering primitives such as memory, CPU, storage, network, state, concurrency, time, capacity, latency, throughput, consistency, failure, trust boundaries, and resource ownership.
- L2 FAILURE_PATTERN: reusable failure modes/patterns such as OOM, retry amplification, cache stampede, deadlock, lost update, hot partition, connection exhaustion, boundary bursts, backpressure, token refresh races, and duplicate side effects.
- L3 TECHNOLOGY_SPECIFIC: current mechanisms and constraints for concrete technologies such as Linux, JVM/Java, Node.js, Python, PostgreSQL, Redis, Kafka, Kubernetes, Docker, AWS, HTTP/TCP, etc.

L3 should preserve source provenance/version information and should prefer authoritative current documentation for implementation-significant facts.

## Critical generalization rule

Do NOT make the core engine depend on hard-coded application features such as `if feature == "rate_limit"`.

Rate limiting, OOM, token refresh, databases, etc. are evaluation cases and knowledge examples—not the architecture of the engine.

The engine should reason from reusable dimensions such as:
- bounded resources
- shared mutable state
- concurrency
- time/windows
- retries
- side effects
- queues
- trust boundaries
- persistence
- ordering
- distributed ownership
- failure of dependencies
- scaling/concentration
- attacker-controlled input

## Evidence and uncertainty

Never present model intuition as verified engineering fact.

Architecture decisions must be able to carry:
- supporting knowledge/evidence references;
- assumptions;
- confidence;
- unresolved questions;
- reconsideration triggers;
- verification requirements.

If evidence is insufficient, preserve uncertainty rather than inventing certainty.

## Development constraints

- TypeScript strict mode.
- No `any` in production code unless an ADR explicitly justifies it.
- Runtime validation at trust boundaries.
- Core domain package must not import provider SDKs, web frameworks, databases, or UI code.
- Provider-specific code must live behind explicit adapter interfaces.
- No UI work until the kernel acceptance gate passes.
- No cloud deployment, billing, authentication, vector database, or multi-agent swarm in the bootstrap task.
- Do not add abstractions purely for hypothetical future needs.
- Do not silently change accepted architecture.
- A required architectural change must be documented as an ADR or Architecture Change Proposal first.

## Verification discipline

"Agent says done" is not completion.

A task is complete only when its acceptance criteria are mechanically checked where possible:
- typecheck passes;
- tests pass;
- architecture-boundary tests pass;
- generated artifacts validate against schemas;
- no out-of-scope functionality was added.

Bug fixes should add regression tests when practical.

## Change discipline

Before editing:
1. read this file;
2. read the active task;
3. inspect existing relevant code;
4. state the smallest implementation plan;
5. identify files expected to change.

During implementation:
- stay within the active task;
- do not refactor unrelated code;
- preserve public contracts unless the task explicitly changes them.

At completion report:
- files changed;
- tests/commands executed and results;
- assumptions;
- deviations;
- deliberately deferred work.

## Product quality bar

We are building a professional product kernel intended to grow into a market-facing platform. Prefer correctness, explicit contracts, provenance, testability, and replaceable provider boundaries over demo shortcuts.
