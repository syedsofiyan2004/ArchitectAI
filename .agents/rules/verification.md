---
trigger: always_on
description: Completion and verification rules for ArchitectAI.
---

# Verification Rule

Never declare a task complete solely because code was generated.

Before completion:
- run the task's required typecheck/test/eval commands;
- fix failures that are in scope;
- do not hide, skip, or weaken failing tests to achieve green status;
- report every remaining failure explicitly;
- do not broaden the scope in order to fix unrelated failures.

If a test reveals that an accepted architecture assumption is wrong, stop and create an Architecture Change Proposal rather than silently redesigning the project.
