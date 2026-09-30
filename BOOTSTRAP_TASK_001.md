# BOOTSTRAP TASK 001 — ArchitectAI Kernel Foundation

Read `AGENTS.md` first. This task establishes the durable kernel. Do not build the final product.

## Goal

Create a small, runnable TypeScript monorepo that represents ArchitectAI's core contracts without hard-coding any particular engineering problem.

The result must make it possible to add rate limiting, OOM, token refresh races, database concerns, and future domains as DATA/KNOWLEDGE/EVALS rather than by redesigning the core.

## Required repository structure

Use pnpm workspaces.

Create:
- `apps/cli` — thin local development/debug CLI only
- `packages/domain` — pure domain schemas/types; no provider SDKs
- `packages/application` — use-case orchestration interfaces; no concrete AI provider
- `packages/knowledge` — generic knowledge repository/query interfaces and in-memory adapter
- `packages/providers` — provider abstractions only; no real remote provider in this task
- `packages/verification` — verification-plan/result contracts only
- `packages/evals` — reusable eval-case contracts and a tiny deterministic runner
- `tests/architecture` — architecture boundary tests
- `docs/adr`

Use TypeScript strict mode, Zod, and Vitest.

## Required domain concepts

Implement runtime schemas + inferred TypeScript types for at least:

### RequirementIntent
Represents the user's incomplete natural-language intent plus optional explicit constraints/context.

### EngineeringDimension
A reusable primitive/dimension. It must support concepts such as bounded resource, shared state, concurrency, time/window, side effect, retry, ordering, persistence, dependency, trust boundary, scaling concentration, and attacker-controlled input WITHOUT making those values the only possible future values.

### KnowledgeLevel
- `fundamental`
- `failure_pattern`
- `technology_specific`

### KnowledgeEvidence
Must include enough structure for provenance, including:
- source type;
- source identifier/URL when applicable;
- title;
- technology;
- version/applicability metadata when applicable;
- retrieved/published metadata when known;
- excerpt/claim reference;
- confidence/quality metadata.

Do not require every field when it genuinely may be unknown.

### EngineeringKnowledgeItem
Must support:
- stable ID;
- knowledge level(s);
- title/description;
- relevant engineering dimensions;
- triggers/applicability hints;
- risks/failure mechanism;
- possible mitigations;
- verification ideas;
- evidence references;
- relationships to other knowledge items.

### ConcernCandidate
A concern discovered for a specific requirement. It must distinguish:
- why it may apply;
- supporting knowledge IDs;
- assumptions;
- confidence;
- unresolved questions.

### ArchitectureDecision
Must support:
- problem/context;
- considered options;
- selected option when one exists;
- rationale;
- evidence;
- assumptions;
- risks/tradeoffs;
- verification requirements;
- reconsideration triggers.

### EngineeringInvariant
An enforceable property, severity, and whether it blocks completion/deployment.

### VerificationSpec
Must describe what is being verified, setup/preconditions, action/stimulus, expected property, evidence to collect, and whether it is automatable.

### EngineeringContract
Aggregates the requirement, discovered concerns, decisions, invariants, verification specs, assumptions, unresolved questions, and metadata/version.

### EvaluationCase / EvaluationResult
An eval should be able to assert that certain concern classes/dimensions MUST be discovered, MUST NOT be invented, and that output conforms to contract schemas.

## Generic knowledge repository

Implement an interface that can:
- add/load knowledge items;
- retrieve by ID;
- query by knowledge level;
- query by engineering dimensions;
- query by technology metadata when present.

Provide only an in-memory implementation for now.

Do not build embeddings/vector search yet.

## Walking skeleton

Create a deterministic CLI command that:
1. loads a small fixture containing one L1 fundamental, one L2 failure pattern, and one L3 technology-specific knowledge item;
2. validates all three through the schemas;
3. queries them through the generic knowledge repository;
4. assembles a sample `EngineeringContract`;
5. serializes it to JSON;
6. validates the serialized result by parsing it back through the schema.

The fixture must NOT be rate-limiter-specific. Use a neutral demonstration around generic bounded-resource/shared-state concepts so the core cannot accidentally become feature-specific.

This walking skeleton is not "the AI." It proves the contracts and knowledge layers can exist independently of any model.

## Architecture boundary checks

Add tests that protect at least these invariants:
- `packages/domain` cannot depend on `packages/providers`, `apps/*`, web frameworks, or provider SDKs.
- provider-specific implementation cannot leak into the domain contracts.
- knowledge items can represent all three knowledge levels through the same generic repository.
- an EngineeringContract round-trips through runtime validation.
- adding a previously unseen EngineeringDimension string/value does not require editing a central switch statement unless validation policy explicitly requires it.

Choose a simple enforceable mechanism; do not create a large tooling framework just for this.

## Documentation

Create these ADRs:
- `0001-provider-neutral-core.md`
- `0002-three-level-knowledge-model.md`
- `0003-evidence-and-provenance.md`
- `0004-executable-verification-over-agent-self-assessment.md`

Each ADR should contain Context, Decision, Consequences, and Status.

Also add a concise root README explaining what works now and what explicitly does not exist yet.

## Out of scope — DO NOT IMPLEMENT

- frontend/UI
- authentication
- billing
- cloud deployment
- production persistence/database
- embeddings/vector DB/RAG
- web scraping/document ingestion
- real OpenAI/Anthropic/Google calls
- Codex/Claude/Antigravity adapters
- MCP
- rate-limiter implementation
- OOM implementation
- technology-specific production rules
- autonomous repair loop
- multi-agent orchestration

## Required completion gate

Before declaring completion, run and report:
- dependency install
- typecheck
- unit tests
- architecture tests
- CLI walking skeleton

All must pass.

Do not weaken tests to get a pass.

## Completion report

Return:
1. repository tree;
2. exact files created/modified;
3. commands executed and results;
4. explanation of dependency direction;
5. how the design prevents hard-coding thousands of cases into the engine;
6. assumptions;
7. deferred items;
8. any Architecture Change Proposal if you found this task incompatible with `AGENTS.md`.
