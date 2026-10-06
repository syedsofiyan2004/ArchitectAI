import {
  VerificationAssertion,
  VerificationCaseAssertionResult,
  VerificationEvidence,
} from '../types.js';

export class AssertionEvaluator {
  evaluateAssertion(
    assertion: VerificationAssertion,
    observedValue: unknown
  ): VerificationCaseAssertionResult {
    const expected = assertion.expected;
    let passed = false;
    let message = '';

    switch (assertion.operator) {
      case 'lte': {
        const expNum = Number(expected);
        const obsNum = Number(observedValue);
        passed = !isNaN(obsNum) && !isNaN(expNum) && obsNum <= expNum;
        if (!passed) {
          message = `Expected <= ${expected}${assertion.unit ? ' ' + assertion.unit : ''}, observed ${observedValue}`;
        }
        break;
      }
      case 'gte': {
        const expNum = Number(expected);
        const obsNum = Number(observedValue);
        passed = !isNaN(obsNum) && !isNaN(expNum) && obsNum >= expNum;
        if (!passed) {
          message = `Expected >= ${expected}${assertion.unit ? ' ' + assertion.unit : ''}, observed ${observedValue}`;
        }
        break;
      }
      case 'eq': {
        passed = observedValue === expected || JSON.stringify(observedValue) === JSON.stringify(expected);
        if (!passed) {
          message = `Expected ${JSON.stringify(expected)}, observed ${JSON.stringify(observedValue)}`;
        }
        break;
      }
      case 'neq': {
        passed = observedValue !== expected && JSON.stringify(observedValue) !== JSON.stringify(expected);
        if (!passed) {
          message = `Expected not equal to ${JSON.stringify(expected)}, but observed ${JSON.stringify(observedValue)}`;
        }
        break;
      }
      case 'contains': {
        const obsStr = String(observedValue);
        const expStr = String(expected);
        passed = obsStr.includes(expStr);
        if (!passed) {
          message = `Expected output to contain "${expStr}"`;
        }
        break;
      }
      case 'not_contains': {
        const obsStr = String(observedValue);
        const expStr = String(expected);
        passed = !obsStr.includes(expStr);
        if (!passed) {
          message = `Expected output NOT to contain "${expStr}"`;
        }
        break;
      }
      case 'matches': {
        try {
          const regex = new RegExp(String(expected));
          passed = regex.test(String(observedValue));
          if (!passed) {
            message = `Expected output to match pattern /${expected}/`;
          }
        } catch {
          passed = false;
          message = `Invalid regular expression pattern: ${expected}`;
        }
        break;
      }
      default: {
        passed = observedValue === expected;
        if (!passed) {
          message = `Expected ${expected}, observed ${observedValue}`;
        }
      }
    }

    return {
      name: assertion.name,
      expected: assertion.expected,
      observed: observedValue,
      passed,
      message: passed ? undefined : message,
    };
  }

  createEvidence(
    caseId: string,
    assertion: VerificationAssertion,
    observedValue: unknown,
    options?: {
      kind?: string;
      stdout?: string;
      stderr?: string;
      artifactPath?: string;
    }
  ): VerificationEvidence {
    return {
      id: `ev-${caseId}-${assertion.id}-${Date.now()}`,
      caseId,
      kind: options?.kind ?? 'metric',
      name: assertion.name,
      expected: assertion.expected,
      observed: observedValue,
      unit: assertion.unit,
      stdout: options?.stdout,
      stderr: options?.stderr,
      artifactPath: options?.artifactPath,
      capturedAt: new Date().toISOString(),
    };
  }
}
