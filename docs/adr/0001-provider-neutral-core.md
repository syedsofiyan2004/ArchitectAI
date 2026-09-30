# ADR 0001: Provider-Neutral Core

## Status
Accepted

## Context
ArchitectAI is an engineering-intelligence platform designed to infer missing engineering concerns, ground them in structured knowledge, generate explicit architecture decisions, and delegate implementation to coding agents.

Coding agent capabilities, LLM architectures, and AI provider APIs change rapidly. Tightly coupling the core engineering judgment, knowledge representation, or domain contracts to any specific AI vendor (such as OpenAI, Anthropic, or Google) or framework would:
1. Couple the system's durable knowledge kernel to transient vendor abstractions.
2. Invalidate core business logic whenever SDKs change.
3. Compromise testability, as evaluating core domain rules would require live network calls or heavy mocking.
4. Violate the foundational workspace constitution (`AGENTS.md`), which requires the core to remain provider-neutral and UI-neutral.

## Decision
We decouple all domain schemas, reasoning dimensions, knowledge structures, and contract definitions from any specific AI provider or coding agent SDK.

Specifically:
1. `packages/domain` contains zero imports of external vendor SDKs, web frameworks, databases, or UI components.
2. AI generation, reasoning assistance, and code synthesis are abstracted behind explicit port interfaces (`packages/providers`).
3. The core domain and application layers interact only with these provider-neutral ports.
4. Testing, evaluation, and walking skeletons run deterministically without requiring remote provider credentials or network connectivity.

## Consequences
### Positive
- The core reasoning logic and domain contracts are completely testable and deterministic.
- Model providers can be swapped, chained, or updated without altering domain rules or knowledge repositories.
- Complies strictly with the architectural boundary rules defined in `AGENTS.md`.

### Negative / Tradeoffs
- Requires explicit adapter layers and mapping types between domain contracts and external provider responses.
- Provider-specific optimizations (such as specialized tool-calling schemas or proprietary JSON modes) must be encapsulated in provider adapters rather than used directly in domain logic.
