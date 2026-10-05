# ArchitectAI — Engineering Intelligence Platform

ArchitectAI is an engineering-intelligence platform for builders who can describe what they want but may not know the software-engineering, systems, operating-system, database, networking, security, reliability, or distributed-systems concerns they should have asked about.

---

## Quickstart & Local Development

Run the entire platform with a single command:

```bash
# 1. Install dependencies
pnpm install

# 2. Start the ArchitectAI cockpit (backend API & web interface)
pnpm run dev
```

Open `http://localhost:3001` in your browser to launch the ArchitectAI Engineering Cockpit.

---

## Core Capabilities (Milestones 1 – 2.5)

### 1. Natural-Language Unknown-Unknown Discovery
- Ask **"What are you building or changing?"** in plain product language (e.g. *"Limit each authenticated user to 100 API requests per minute"*, *"When my access token expires automatically refresh it and retry"*).
- Discovers hidden concurrency races, memory saturation, cascading retry storms, cache stampedes, and trust boundary hazards.
- Keyboard shortcut: **`Ctrl + Enter`** (or `Cmd + Enter`) triggers instant analysis.

### 2. Three-Level Knowledge Causal Reasoning Trail
- Connects **L1 Fundamentals** (physical invariants: capacity, concurrency, time, trust boundaries) &rarr; **L2 Failure Patterns** (reusable anti-patterns) &rarr; **L3 Technology-Specific Mechanisms** (Redis Lua scripts, OAuth RFC 6749 single-flight replay, Libvips stream pipelines) with authoritative provenance citations.

### 3. Architecture Decision Records (ADRs) & Invariants
- Synthesizes explicit, enforceable architectural choices with evaluated trade-offs, selected options, rationale, and reconsideration triggers.
- Formulates non-negotiable invariants and 3-step executable test specifications (Setup, Stimulus, Expected Invariant).

### 4. Milestone 2 Engineering Execution Gate
- Inspects target Git repositories and workspace signals.
- Compiles contracts into bounded, traceable implementation tasks with strict file boundaries.
- Protected by a **User Approval Gate** before executing coding agents in an isolated Git worktree branch (`architectai/run-xxx`). Active working branches remain untouched.

### 5. Premium, Responsive Developer Cockpit (Milestone 2.5)
- Obsidian/graphite dark design system with disciplined typography and semantic severity badges (Critical, High, Medium, Low).
- Left workflow navigation rail on desktop, smooth segmented scroll on mobile.
- Zero horizontal overflow guaranteed across all viewports (from 1920×1080 desktop down to 390×844 mobile).

---

## Verification & Quality Commands

```bash
# Typecheck all packages
pnpm run typecheck

# Run full Vitest suite (unit, integration, and browser UX tests)
pnpm run test

# Run architecture boundary isolation tests
pnpm run test:arch

# Execute walking skeleton CLI
pnpm run cli:skeleton

# Build production web client bundle
pnpm run web:build
```

---

## Repository Structure

```
├── packages/
│   ├── domain/         # Core schemas, Zod validation, universal dimensions
│   ├── knowledge/      # 3-level knowledge repository and authoritative fixtures
│   ├── providers/      # Provider-neutral model adapters and coding agent gateways
│   ├── application/    # Analysis use cases, git workspace, task compiler, plan executor
│   └── evals/          # Deterministic evaluation runner
├── apps/
│   ├── web/            # Premium React 18 cockpit and Express backend
│   └── cli/            # Deterministic walking skeleton
├── tests/
│   ├── architecture/   # Boundary and schema isolation tests
│   └── ux/             # Automated Playwright browser UX tests
└── artifacts/
    └── ui-review/      # Baseline (before) and post-redesign (after) visual QA screenshots
```
