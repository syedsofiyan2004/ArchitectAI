import {
  VerificationCaseResult,
  VerificationRunResult,
  VerificationOverallStatus,
  VerificationPlan,
} from '../types.js';

/**
 * Deterministically evaluates overall verification status from individual case results.
 * Strict rules:
 * 1. INCONCLUSIVE is NEVER PASS.
 * 2. If ANY blocking invariant FAILS, overall status is FAILED.
 * 3. If ANY blocking invariant is INCONCLUSIVE (and none FAILED), overall status is INCONCLUSIVE.
 * 4. If ANY blocking invariant encountered an ERROR (and none FAILED), overall status is ERROR.
 * 5. Overall status is VERIFIED ONLY IF every blocking invariant has passed with verified evidence.
 */
export class VerdictEvaluator {
  evaluateRun(
    plan: VerificationPlan,
    caseResults: VerificationCaseResult[],
    runDurationMs: number
  ): VerificationRunResult {
    const totalCases = caseResults.length;
    let passedCases = 0;
    let failedCases = 0;
    let inconclusiveCases = 0;
    let errorCases = 0;
    let skippedCases = 0;

    let hasBlockingFail = false;
    let hasBlockingInconclusive = false;
    let hasBlockingError = false;
    let totalBlockingCount = 0;
    let passedBlockingCount = 0;

    for (const res of caseResults) {
      switch (res.verdict) {
        case 'PASS':
          passedCases++;
          if (res.isBlocking) passedBlockingCount++;
          break;
        case 'FAIL':
          failedCases++;
          if (res.isBlocking) hasBlockingFail = true;
          break;
        case 'INCONCLUSIVE':
          inconclusiveCases++;
          if (res.isBlocking) hasBlockingInconclusive = true;
          break;
        case 'ERROR':
          errorCases++;
          if (res.isBlocking) hasBlockingError = true;
          break;
        case 'SKIPPED':
          skippedCases++;
          break;
      }

      if (res.isBlocking) {
        totalBlockingCount++;
      }
    }

    let overallStatus: VerificationOverallStatus;
    let summary: string;

    if (hasBlockingFail) {
      overallStatus = 'FAILED';
      summary = `Verification failed: ${failedCases} case(s) failed, violating required engineering invariant(s). Implementation should not be merged.`;
    } else if (hasBlockingError) {
      overallStatus = 'ERROR';
      summary = `Verification error: infrastructure or execution failed for ${errorCases} case(s). Cannot verify invariants.`;
    } else if (hasBlockingInconclusive) {
      overallStatus = 'INCONCLUSIVE';
      summary = `Verification inconclusive: insufficient instrumentation or unsupported environment for ${inconclusiveCases} blocking case(s).`;
    } else if (totalBlockingCount > 0 && passedBlockingCount === totalBlockingCount) {
      overallStatus = 'VERIFIED';
      summary = `ArchitectAI Verified: all ${passedBlockingCount}/${totalBlockingCount} blocking invariant(s) proven with measured evidence.`;
    } else if (totalBlockingCount === 0 && passedCases > 0) {
      overallStatus = 'VERIFIED';
      summary = `ArchitectAI Verified: ${passedCases}/${totalCases} case(s) passed with verified evidence.`;
    } else {
      overallStatus = 'INCONCLUSIVE';
      summary = 'Verification inconclusive: no blocking invariants were verified.';
    }

    const isVerified = overallStatus === 'VERIFIED';

    return {
      runId: plan.implementationRunId,
      planId: plan.id,
      contractId: plan.contractId,
      overallStatus,
      isVerified,
      summary,
      caseResults,
      totalCases,
      passedCases,
      failedCases,
      inconclusiveCases,
      errorCases,
      skippedCases,
      executedAt: new Date().toISOString(),
      durationMs: runDurationMs,
    };
  }
}
