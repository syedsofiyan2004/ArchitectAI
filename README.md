# ArchitectAI — Kernel Foundation

ArchitectAI is an engineering-intelligence platform for builders who can describe what they want but may not know the software-engineering, systems, operating-system, database, networking, security, reliability, or distributed-systems concerns they should have asked about.

This repository currently hosts the foundational kernel established in **BOOTSTRAP TASK 001**.

---

## What Works Now

- **Pure Domain Schemas & Types (`@architectai/domain`)**:
  - Runtime validation (powered by Zod) for:
    - `RequirementIntent` (capturing incomplete natural-language builder intent)
    - `EngineeringDimension` (open, extensible taxonomy: bounded resources, concurrency, time windows, side effects, etc.)
    - `KnowledgeLevel` (L1 Fundamental, L2 Failure Pattern, L3 Technology-Specific)
    - `KnowledgeEvidence` (source provenance, technology/version applicability, confidence)
    - `EngineeringKnowledgeItem` (triggers, mechanisms, mitigations, verification ideas)
    - `ConcernCandidate` (rationale, supporting knowledge, assumptions, confidence, open questions)
    - `ArchitectureDecision` (options, selected option, rationale, evidence, reconsideration triggers)
    - `EngineeringInvariant` (enforceable property, severity, blocking status)
    - `VerificationSpec` (preconditions, stimulus, expected property, evidence, automatable status)
    - `EngineeringContract` (complete aggregated architectural specification)
    - `EvaluationCase` & `EvaluationResult` (deterministic evaluation criteria)
- **Generic Knowledge Repository (`@architectai/knowledge`)**:
  - Provider-neutral, in-memory repository implementation.
  - Queries uniformly across knowledge levels, engineering dimensions, and technology metadata.
  - Neutral non-rate-limiter evaluation fixtures (bounded memory backpressure across L1, L2, L3).
- **Application Orchestration Ports (`@architectai/application`)**:
  - Core interfaces for concern discovery and contract assembly decoupled from concrete AI models.
- **Provider Abstractions (`@architectai/providers`)**:
  - Pure port abstractions (`ProviderAdapter`, `ModelCapabilities`, `ProviderRequest`) without vendor SDK dependencies.
- **Verification Interfaces (`@architectai/verification`)**:
  - Interfaces for independent verification planning and execution.
- **Deterministic Eval Runner (`@architectai/evals`)**:
  - Evaluates whether discovered concerns match expected engineering dimensions, asserts forbidden dimensions are not hallucinated, and validates schema compliance.
- **Architecture Boundary Tests (`tests/architecture`)**:
  - Validates that domain packages remain isolated from providers/frameworks.
  - Validates schema round-tripping and open dimension extensibility without hardcoded switch statements.
- **CLI Walking Skeleton (`apps/cli`)**:
  - Deterministic runnable demonstrating end-to-end fixture loading, schema validation, repository querying, contract assembly, serialization, and round-trip deserialization.

---

## Development & Verification Commands

ArchitectAI strictly standardizes on `pnpm` workspaces:

```bash
# Install dependencies with frozen lockfile
pnpm install --frozen-lockfile

# Typecheck all packages with TypeScript strict mode
pnpm run typecheck

# Run unit tests and evaluation suite
pnpm run test

# Run architecture boundary tests
pnpm run test:arch

# Execute deterministic CLI walking skeleton
pnpm run cli:skeleton
```

---

## What Explicitly Does Not Exist Yet (Out of Scope)

The following components are deliberately deferred and **not implemented** in this foundation phase:
- User interface (web, desktop, or mobile)
- Real remote AI provider connections (OpenAI, Anthropic, Google, etc.)
- Vector databases, embeddings, or RAG pipelines
- User authentication, billing, or cloud deployment infrastructure
- Production databases / ORM persistence
- Coding-agent integrations (e.g. Codex, Claude Code, Antigravity adapters)
- Autonomous self-repair loops or multi-agent swarms
- Hard-coded problem-specific rules (e.g. rate limiters, OOM handlers) in the core engine
