import type { InvestigationEvent } from '../events/eventTypes';
import type { ProjectInfo } from './projectDetector';
export interface TestRunResult {
    exitCode: number;
    output: string;
    failures: TestFailure[];
    passed: number;
    failed: number;
    duration: number;
    status: 'PASSED' | 'FAILED' | 'BUILD_FAILED' | 'ENVIRONMENT_FAILED' | 'NO_TESTS_FOUND' | 'TEST_EXECUTION_FAILED';
    testsRun: number;
    errors: number;
    skipped: number;
}
export interface TestFailure {
    test?: string;
    error: string;
    file?: string;
    line?: number;
    /** Raw assertion mismatch text e.g. "20 !== 5" */
    assertionDetail?: string;
    actual?: string;
    expected?: string;
}
export declare function runTests(workspacePath: string, projectInfo: ProjectInfo, emit: (event: InvestigationEvent) => void): Promise<TestRunResult>;
