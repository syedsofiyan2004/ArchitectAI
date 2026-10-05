# ArchitectAI — Milestone 2.5 UI/UX Audit Report

## Audit Overview
- **Date**: 2026-10-05
- **Tooling**: Playwright Chromium (Automated Headless & Playwright CLI)
- **Target URL**: `http://localhost:3001`
- **Viewports Inspected**:
  - Desktop 1920×1080 (Full HD)
  - Desktop 1440×900 (MacBook standard)
  - Desktop 1280×800 (Compact desktop)
  - Tablet 1024×768 (iPad landscape / small tablet)
  - Mobile 390×844 (iPhone 12/13/14 standard mobile)
- **Baseline Artifacts**: Stored in [`artifacts/ui-review/before/`](file:///d:/architectai/artifacts/ui-review/before/) (16 baseline screenshots captured).

---

## 1. Quantitative Findings & Critical Defects

| Metric | Result | Severity | Finding |
| :--- | :--- | :--- | :--- |
| **Mobile Horizontal Overflow** | `scrollWidth=961px` vs `clientWidth=390px` | **P0 (Critical)** | On mobile viewports (390×844), horizontal overflow is **246% of viewport width**, caused by horizontal tab buttons, stage timeline cards, and meta grids. |
| **Tablet Horizontal Fitting** | `scrollWidth=1024px` | **P2** | Fits closely at 1024px but margins collapse and tabs cramp into multi-row wraps. |
| **Analyze Interaction Feedback** | Delayed feedback below fold | **P0 (Critical)** | When clicking "Analyze Architecture", the viewport does not auto-advance or reveal progress immediately, giving the illusion that the button is unresponsive. |
| **Console Errors** | 0 errors | **Pass** | Clean console, no uncaught JS errors. |
| **Accessibility Warnings** | Missing focus rings, icon labels | **P1 (High)** | Interactive tabs and icon badges lack visible `:focus-visible` rings and `aria-live` announcements. |

---

## 2. Information Architecture & User Journey Gaps

### Current Broken Model: Form Submission &rarr; 7-Tab Dump
Currently, the UI operates as a traditional forms app:
1. User types in a composer card.
2. User clicks "Analyze".
3. A 7-step horizontal timeline appears.
4. Below that, a 7-tab navigation bar appears (`Overview`, `Unknown-Unknowns`, `3-Level Knowledge`, `Architecture Decisions`, `Verification Plan`, `Implementation`, `Contract JSON`).
5. All 7 tabs render heterogeneous cards with no guiding progressive flow.

### Required Cognitive Model: Architecture Cockpit Workflow
```text
Describe Requirement
       ↓
Understand Context & Inferred Dimensions
       ↓
Discover Risks & Unknown-Unknowns (Hero Feature)
       ↓
Decide Architecture (ADRs & Options)
       ↓
Verify Invariants (Executable Specs)
       ↓
Implement (Isolated Git Execution)
```

---

## 3. Surface-by-Surface Diagnostic Audit

### 3.1 Header
- **Problem**: Dominated by internal kernel diagnostics (`Kernel v0.1.0`, `Knowledge Base: 32 items`, large `DETERMINISTIC ARCHITECTURE KERNEL` pill).
- **Impact**: Makes the product look like an internal debug tool rather than a developer-facing intelligence platform.
- **Fix**: Elevate clean brand identity ("ArchitectAI"), project/workspace selector, and collapse diagnostics into a compact status menu.

### 3.2 Requirement Composer
- **Problem**: 
  - Generic form styling with wide unconstrained textarea.
  - Scenario presets are arranged in a horizontal wrap of button pills that clutter the viewport.
  - No keyboard submission shortcut (`Ctrl/Cmd + Enter`).
  - Technical context fields (language, database, scale) are statically open, cluttering the primary prompt.
- **Fix**: Redesign as a command surface with prominent "What are you building?" prompt, keyboard shortcut, clean expandable context drawer, and quick scenario templates.

### 3.3 Stage Progress Timeline
- **Problem**: Renders 7 full-width horizontal cards representing engine stages (`Decomposing Intent`, `Inferring Dimensions`, `Retrieving Knowledge`, etc.).
- **Impact**: Takes up over 350px of vertical space and 100% horizontal width without conveying actionable information.
- **Fix**: Replace with a compact, progressive analysis stepper or inline activity indicator that transitions into actual findings.

### 3.4 Findings / Unknown-Unknowns (Hero Feature)
- **Problem**:
  - Findings are rendered as plain cards with equal visual weight for titles, descriptions, and technical IDs (`pattern-fixed-window-burst`).
  - No explicit severity language (Critical, High, Medium, Low).
  - Technical metadata (assumptions, dimensions, confidence scores, evidence) is dumped inline, overwhelming non-systems engineers.
- **Fix**: Implement a strong visual hierarchy:
  - Severity badge with color + label + icon (not color alone).
  - Clear risk headline and "Why this matters in your architecture".
  - Progressive disclosure drawer for technical grounding, dimensions, and evidence.

### 3.5 3-Level Knowledge Representation
- **Problem**: Renders three disconnected columns (L1, L2, L3) with ID badges.
- **Impact**: Fails to communicate ArchitectAI's core thesis: how a Fundamental (L1) connects to a Failure Pattern (L2), which grounds in concrete Technology Knowledge (L3).
- **Fix**: Render as a causal reasoning trail / connected hierarchy (`L1 Fundamental → L2 Failure Pattern → L3 Technology Grounding`).

### 3.6 Architecture Decisions & Verification
- **Problem**:
  - Decisions dump all options and tradeoffs with identical visual weight.
  - Verification specs look like prose descriptions rather than an executable test suite.
- **Fix**: Structure decisions into Problem &rarr; Recommended Decision &rarr; Trade-offs &rarr; Invariants. Structure verification specs as an actionable test plan (Automated, Load Scenario, Fault Injection).

### 3.7 Implementation Experience
- **Problem**: Implementation view is exposed as just another tab, even before the user has reviewed findings and decisions.
- **Fix**: Position Implementation as the culminating action of the workflow ("Proceed to Implementation"). Preserve the user approval gate and Git worktree isolation with clean split-pane diff viewing.

---

## 4. Visual Design & Design System Deficiencies
- **Color Palette**: Overly neon purple/violet glow accents with high-contrast borders around every container ("AI landing page / admin dashboard" fingerprint).
- **Typography**: Inconsistent line-heights, unconstrained paragraph line-lengths exceeding 120 characters, overuse of monospace for non-code elements.
- **Design Tokens**: Absence of unified CSS custom properties for surface elevations (`--surface-0`, `--surface-1`, `--surface-2`), spacing scale, and typography hierarchy.

---

## 5. Planned Redesign Execution Plan
1. **Design System (`docs/DESIGN.md`)**: Define tokens, typography, surface hierarchy, semantic colors, and component patterns.
2. **Unified App Shell (`AppShell.tsx`)**: Compact top bar, workflow navigation (Brief, Findings, Decisions, Verification, Implementation), and expandable technical inspector.
3. **P0 Analyze Interaction Upgrade**: Immediate active feedback, progressive skeleton loader, and smooth scroll into findings.
4. **Responsive Layouts**: Zero horizontal overflow across all viewports (1920px down to 390px).
5. **Continuous Playwright Visual QA**: Capture `artifacts/ui-review/after/` and run regression checks.
