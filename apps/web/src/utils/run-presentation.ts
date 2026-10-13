import { RunLifecycleState } from '@architectai/domain';
import { AnalysisRunRecord } from '../types';

export interface RunPresentationState {
  label: string;
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info';
  description?: string;
}

/**
 * Canonical product-wide presentation state mapping for architecture runs.
 * Maps all 12 lifecycle states:
 * DRAFT -> "Draft"
 * ANALYZING -> "Analyzing"
 * ANALYSIS_COMPLETE -> "Needs Decisions" (if questions pending) or "Design Ready"
 * ARCHITECTURE_ACCEPTED -> "Design Ready"
 * READY_FOR_IMPLEMENTATION -> "Ready to Build"
 * IMPLEMENTING -> "Building"
 * VERIFICATION_FAILED -> "Needs Fix"
 * REPAIR_PENDING -> "Fix Prepared"
 * REPAIRING -> "Repairing"
 * VERIFIED -> "Verified"
 * ESCALATED -> "Escalated"
 * FAILED -> "Failed"
 * CANCELLED -> "Cancelled"
 */
export function getRunPresentationState(
  runOrState: AnalysisRunRecord | RunLifecycleState | string | undefined | null
): RunPresentationState {
  if (!runOrState) {
    return { label: 'Draft', variant: 'default' };
  }

  let state: string;
  let hasPendingQuestions = false;

  if (typeof runOrState === 'string') {
    state = runOrState.toUpperCase();
  } else {
    state = (runOrState.state || (runOrState.status === 'completed' ? 'ANALYSIS_COMPLETE' : runOrState.status === 'analyzing' ? 'ANALYZING' : 'DRAFT')).toUpperCase();
    const contract = runOrState.result?.contract;
    if (contract?.discoveredConcerns) {
      const allQuestions = contract.discoveredConcerns.flatMap((c) => c.unresolvedQuestions || []);
      const answers = runOrState.userAnswers || {};
      hasPendingQuestions = allQuestions.length > 0 && allQuestions.some((q) => !answers[q]);
    }
  }

  switch (state) {
    case 'VERIFIED':
      return { label: 'Verified', variant: 'success', description: 'All engineering invariants independently proven.' };
    case 'READY_FOR_IMPLEMENTATION':
      return { label: 'Ready to Build', variant: 'info', description: 'Architecture accepted and ready for agent implementation.' };
    case 'ARCHITECTURE_ACCEPTED':
      return { label: 'Design Ready', variant: 'info', description: 'Architecture verified and ready for implementation planning.' };
    case 'ANALYSIS_COMPLETE':
      if (hasPendingQuestions) {
        return { label: 'Needs Decisions', variant: 'warning', description: 'Input needed on discovered architecture edge cases.' };
      }
      return { label: 'Design Ready', variant: 'info', description: 'Architecture analysis complete and ready for review.' };
    case 'ANALYZING':
      return { label: 'Analyzing', variant: 'info', description: 'Extracting engineering failure modes and constraints.' };
    case 'IMPLEMENTING':
      return { label: 'Building', variant: 'info', description: 'Coding agent implementing tasks in isolated Git worktree.' };
    case 'VERIFICATION_FAILED':
      return { label: 'Needs Fix', variant: 'warning', description: 'Implementation failed one or more verification checks.' };
    case 'REPAIR_PENDING':
      return { label: 'Fix Prepared', variant: 'warning', description: 'Targeted repair plan compiled and ready for approval.' };
    case 'REPAIRING':
      return { label: 'Repairing', variant: 'warning', description: 'Executing automated repair loop in isolated worktree.' };
    case 'ESCALATED':
      return { label: 'Escalated', variant: 'warning', description: 'Repair budget exceeded. Requires architectural review.' };
    case 'FAILED':
      return { label: 'Failed', variant: 'danger', description: 'Operation encountered an unrecoverable failure.' };
    case 'CANCELLED':
      return { label: 'Cancelled', variant: 'default', description: 'Build cancelled by user. Original branch untouched.' };
    case 'DRAFT':
    default:
      return { label: 'Draft', variant: 'default', description: 'Requirement drafted.' };
  }
}
