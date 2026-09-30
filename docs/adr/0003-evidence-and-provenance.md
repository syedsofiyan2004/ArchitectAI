# ADR 0003: Evidence and Provenance

## Status
Accepted

## Context
Generative AI models frequently hallucinate technical assertions, cite non-existent APIs, extrapolate outdated runtime behaviors, or present speculative intuitions as verified facts.

ArchitectAI must produce production-grade engineering decisions and enforceable contracts. Presenting unverified model intuition as engineering fact damages trust and leads to critical system failures in production.

## Decision
All engineering knowledge items, concern discoveries, and architecture decisions must support structured evidence and provenance tracking.

Specifically:
1. `KnowledgeEvidence` must capture:
   - Source type (official documentation, specification, benchmark, RFC, postmortem, source code, manual analysis).
   - Source identifier or URL when applicable.
   - Title and author/publisher.
   - Target technology and version/applicability metadata (e.g., Node.js >= 18, PostgreSQL 14+).
   - Publication or retrieval timestamp.
   - Exact claim reference or excerpt.
   - Confidence score or quality rating.
2. Architecture decisions must explicitly cite supporting evidence references, document unverified assumptions, assign confidence levels, list open questions, and record reconsideration triggers.
3. If authoritative evidence is unavailable, the system must explicitly preserve uncertainty rather than fabricating certainty.

## Consequences
### Positive
- Decisions are auditable and traceable back to authoritative specifications or postmortems.
- When platform versions change or assumptions are invalidated, reconsideration triggers allow automated re-evaluation.
- Distinguishes high-confidence empirical facts from speculative model hypotheses.

### Negative / Tradeoffs
- Increases data structure verbosity.
- Requires metadata fields to be nullable/optional to accommodate genuinely unknown or unrecorded provenance details during early draft stages.
