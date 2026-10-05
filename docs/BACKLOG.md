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

## P3 — Polish & Refinements

1. **Light/Dark Theme Toggle**
   - *Context*: Default is high-contrast engineering dark mode; add optional system-matching light mode.
2. **Export to Architecture Decision Record (ADR) Markdown**
   - *Context*: Add one-click export of an `EngineeringContract` into standard ADR markdown format for repository commit.
3. **Saved Analysis Sessions in Local Storage**
   - *Context*: Allow switching between previous analyses in the browser without server persistence.
