# ArchitectAI — Design System & UI Specification

## 1. Product Philosophy & Principles

ArchitectAI is an engineering-intelligence cockpit for software architects and builders.
The design principles guide every surface:

1. **Calm & Intelligent**: Neutral, high-legibility dark surfaces that prioritize code and architecture reasoning over visual noise. Zero neon purple gradients or superfluous AI sparkles.
2. **Precise & Engineering-Native**: Dense information presented with impeccable structure, tabular figures for numbers, clean code blocks, and crisp typography.
3. **Progressive Disclosure**: High-level risk summaries for builders; instant expandable depth (evidence, dimensions, ADRs, schemas) for staff engineers.
4. **Workflow-Driven Progression**: Guide the user logically from intent &rarr; understanding &rarr; discovered risks &rarr; decisions &rarr; verification &rarr; implementation.
5. **Rock-Solid Accessibility**: Full WCAG AA compliance, visible `:focus-visible` rings, semantic elements, and zero color-only semantics.

---

## 2. Design Tokens & CSS Custom Properties

### 2.1 Surfaces & Backgrounds
```css
:root {
  /* Surface Hierarchy (Graphite / Deep Obsidian Base) */
  --surface-0: #08090d;   /* Root viewport background */
  --surface-1: #0e1117;   /* Primary card / panel background */
  --surface-2: #161b24;   /* Elevated card / dropdown / inspector */
  --surface-3: #1f2633;   /* Hover states / nested containers */
  --surface-hover: #262e3d;
  
  /* Borders & Dividers */
  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-default: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.20);
  --border-focus: #3b82f6;

  /* Text & Content */
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --text-inverse: #0f172a;

  /* Primary Brand Accent (Disciplined Precision Blue) */
  --accent-primary: #2563eb;
  --accent-hover: #1d4ed8;
  --accent-subtle: rgba(37, 99, 235, 0.15);
  --accent-border: rgba(37, 99, 235, 0.35);

  /* Semantic Severity Tokens (Color + Label + Icon) */
  --severity-critical-bg: rgba(239, 68, 68, 0.12);
  --severity-critical-text: #f87171;
  --severity-critical-border: rgba(239, 68, 68, 0.30);

  --severity-high-bg: rgba(249, 115, 22, 0.12);
  --severity-high-text: #fb923c;
  --severity-high-border: rgba(249, 115, 22, 0.30);

  --severity-medium-bg: rgba(234, 179, 8, 0.12);
  --severity-medium-text: #facc15;
  --severity-medium-border: rgba(234, 179, 8, 0.30);

  --severity-low-bg: rgba(59, 130, 246, 0.12);
  --severity-low-text: #60a5fa;
  --severity-low-border: rgba(59, 130, 246, 0.30);

  --severity-info-bg: rgba(139, 92, 246, 0.12);
  --severity-info-text: #c084fc;
  --severity-info-border: rgba(139, 92, 246, 0.30);

  /* Success / Status */
  --status-success-bg: rgba(16, 185, 129, 0.12);
  --status-success-text: #34d399;
  --status-success-border: rgba(16, 185, 129, 0.30);

  /* Radii */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5);
  --shadow-overlay: 0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7);

  /* Spacing Scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Typography Scale */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, Menlo, Monaco, monospace;
}
```

---

## 3. Typography Hierarchy

| Style Token | Size / Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- |
| **Display Title** | `28px / 36px` | 600 (SemiBold) | Application hero / Composer title |
| **Section Heading** | `20px / 28px` | 600 (SemiBold) | Workflow major sections (Findings, Decisions) |
| **Card Title** | `16px / 24px` | 600 (SemiBold) | Finding headlines, decision items |
| **Body Primary** | `14px / 22px` | 400 (Regular) | Primary descriptions, rationale prose |
| **Body Secondary** | `13px / 20px` | 400 (Regular) | Supporting copy, metadata notes |
| **Label / Caption** | `12px / 16px` | 500 (Medium) | Badges, tags, form field labels |
| **Code / Technical** | `12px / 18px` | 400 (Regular, Mono) | Contract IDs, file paths, diffs, bash commands |

**Typographic Rules**:
- Headings use `text-wrap: balance` to prevent orphaned words.
- Numbers in tables, timestamps, and confidence scores use `font-variant-numeric: tabular-nums`.
- Monospace font is reserved strictly for code, paths, commands, and technical identifiers.

---

## 4. Application Architecture & Shell

### Responsive 3-Tier Layout
- **Tier 1 (Desktop &ge; 1280px)**:
  - **Top Bar**: Minimal brand logo, project title, and compact system status.
  - **Left Rail Navigation**: Sticky workflow progression (Brief &rarr; Findings &rarr; Decisions &rarr; Verification &rarr; Implementation) + technical inspector toggles.
  - **Main Canvas**: Centered readable workspace container (`max-width: 1040px`).
  - **Inspector Slide-over / Context Panel**: Collapsible side drawer for raw JSON contract, knowledge evidence, and logs.
- **Tier 2 (Tablet 768px – 1024px)**:
  - Top Bar with horizontal segmented workflow navigation.
  - Full-width canvas with collapsible drawer overlays.
- **Tier 3 (Mobile &lt; 768px)**:
  - Top Bar with bottom sheet navigation drawer.
  - Single-column linear flow.
  - Zero horizontal overflow (`document.documentElement.scrollWidth <= document.documentElement.clientWidth`).

---

## 5. Interaction Patterns & Progressive Disclosure

### 5.1 Analyze Interaction (P0)
1. **Immediate Reaction**:
   - `Ctrl/Cmd + Enter` or Click "Analyze Architecture" disables submit button instantly.
   - Button transitions to active state: `Analyzing architecture…` with spinner.
   - Screen scrolls smoothly to the analysis state; focus moves to the active status area (`aria-live="polite"`).
2. **Activity Communication**:
   - Renders a clean progress skeleton communicating:
     - `✓ Understanding requirement`
     - `✓ Mapping engineering dimensions`
     - `✓ Searching knowledge`
     - `Evaluating failure modes…`
3. **Result Reveal**:
   - Seamlessly transitions from skeleton into synthesized findings.

### 5.2 Findings Card Hierarchy
```
┌────────────────────────────────────────────────────────────────────────┐
│ [CRITICAL] Fixed-Window Boundary Bursts                 95% Confidence │
│                                                                        │
│ Clients can transmit up to 2× the allowed rate across window reset.    │
│                                                                        │
│ Why this matters in your architecture                                  │
│ → Causes downstream database pool starvation and ingress saturation.   │
│                                                                        │
│ ▾ View Technical Grounding & Invariants (Expandable)                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.3 3-Level Knowledge Reasoning Trail
Visually connects the layers:
```
[L1 Fundamental: Bounded Memory Buffers]
                 │
                 ▼ (specializes into)
[L2 Failure Mode: Fixed-Window Boundary Bursts]
                 │
                 ▼ (manifests in)
[L3 Technology Grounding: Redis Sliding Window Rate Limiting]
```

### 5.4 Implementation Workflow
- Placed as the natural progression after reviewing architecture findings and decisions.
- Highlights what will change, affected files, and acceptance criteria.
- User Approval Gate requires explicit checkbox confirmation before isolated worktree execution starts.
- Git diff inspector provides syntax-highlighted review with zero risk to main branch.
