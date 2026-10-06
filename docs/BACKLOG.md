# ArchitectAI — Product Backlog

This backlog tracks non-blocking enhancements, polish items, and deferred architectural evolutions identified during Milestone 1.

---

## P2 — Important Enhancements (Post-Milestone 1)

1. **Streaming Progress Updates over Server-Sent Events (SSE)**
   - *Context*: Currently the analysis pipeline executes synchronously and returns stage metadata with the final contract. Streaming stage updates via SSE would provide real-time progressive rendering as each step completes.
2. **Interactive Decision Trade-Off Explorer**
   - *Context*: Allow users to toggle alternative options in the UI to see how changing an architecture decision updates the invariants and verification requirements in real time.
3. **Graph-Based Knowledge Map Visualization**
   - *Context*: Visual node-link canvas (e.g. using canvas or SVG) for the 3-level knowledge model relationships (mitigates, specializes, causes).

---

## P2 — Important Enhancements (Post-Milestone 2)

1. **Claude Code CLI Adapter**
   - *Context*: Implement Claude Code CLI integration behind `CodingAgentAdapter` alongside Codex CLI.
2. **Interactive Multi-File Side-by-Side Diff Inspector**
   - *Context*: Enhance the web UI diff viewer with side-by-side syntax-highlighted code comparison and hunk expansion.
3. **Granular Per-Task Approval Gate**
   - *Context*: Allow users to selectively approve or deselect individual tasks in an implementation plan rather than all-or-nothing execution.
4. **Persistent Execution Runs & Resumption**
   - *Context*: Persist `PlanExecutionOutput` runs to SQLite / local storage so users can review previous execution logs and diffs across restarts.

---

## P3 — Polish & Refinements

1. **Download Raw Git Patch (.patch)**
   - *Context*: Add one-click download button for the generated Git diff in standard patch format.
2. **Light/Dark Theme Toggle**
   - *Context*: Default is high-contrast engineering dark mode; add optional system-matching light mode.
3. **Export to Architecture Decision Record (ADR) Markdown**
   - *Context*: Add one-click export of an `EngineeringContract` into standard ADR markdown format for repository commit.
4. **Automated Worktree Pruning Schedule**
   - *Context*: Background routine to prune stale temporary worktrees older than 24 hours.

---

## P2 — Deferred Architectural Items (Post-Milestone 3)

1. **Automatic Repair Loop (Milestone 4)**
   - *Context*: Automatically feed failed verification evidence and assertion traces back to coding agents to generate precision repairs until invariants hold.
2. **Full Docker Container Sandbox Enforcement**
   - *Context*: Transition from local trusted process sandbox to rootless, ephemeral Docker/OCI container execution for untrusted target repositories.
3. **Multi-Language Verification Adapters (Java / Python / Go / Rust)**
   - *Context*: Expand the `VerificationExecutor` registry beyond Node.js/TypeScript to support PyTest, JUnit, and Go test harness execution against native projects.
4. **Distributed Cloud Test Infrastructure**
   - *Context*: Offload resource-intensive or long-running verification suites to remote container runners (e.g. AWS ECS, Kubernetes jobs).
5. **Persistent Verification History & Invariant Regression Tracking**
   - *Context*: Store historical verification runs to detect invariant regressions across multiple iterations or branch merges.
6. **Large-Scale Fault Injection & Chaos Testing**
   - *Context*: Incorporate network packet loss, latency spikes, and dependency crash injection into verification harnesses.

