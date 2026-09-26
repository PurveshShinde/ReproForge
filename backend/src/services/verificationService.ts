import type { InvestigationEvent } from '../events/eventTypes';
import type { ProjectInfo } from './projectDetector';
import { runTests } from './testRunner';

export interface VerificationResult {
  regressionPassed: boolean;
  fullSuitePassed: boolean;
  totalPassed: number;
  totalFailed: number;
  notes?: string;
}

export async function verifyFix(
  workspacePath: string,
  projectInfo: ProjectInfo,
  emit: (event: InvestigationEvent) => void
): Promise<VerificationResult> {
  emit({ type: 'VERIFICATION_STARTED' });
  emit({ type: 'INVESTIGATION_LOG', message: 'Running verification test suite...', level: 'info' });
  emit({ type: 'AGENT_STARTED', agent: 'Verification Agent' });

  const result = await runTests(workspacePath, projectInfo, emit);

  const passed = result.exitCode === 0;
  const failCount = result.failures.length;
  const passCount = Math.max(0, result.passed);

  for (const failure of result.failures) {
    emit({ type: 'TEST_FAILED', test: failure.test, error: failure.error, file: failure.file, line: failure.line });
  }

  let notes: string | undefined;
  if (!passed && failCount > 0) {
    notes = `${failCount} test(s) failed after patch.`;
  }

  emit({
    type: 'VERIFICATION_RESULT',
    passed,
    regressionPassed: passed,
    totalTests: passCount + failCount,
    failedTests: failCount,
    notes,
  });

  emit({ type: 'AGENT_COMPLETED', agent: 'Verification Agent', summary: passed ? 'All tests passed' : `${failCount} test(s) still failing` });

  return {
    regressionPassed: passed,
    fullSuitePassed: passed,
    totalPassed: passCount,
    totalFailed: failCount,
    notes,
  };
}
