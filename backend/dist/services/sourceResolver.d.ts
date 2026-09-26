import type { InvestigationEvent } from '../events/eventTypes';
import type { TestFailure } from './testRunner';
export interface ResolvedSourceLocation {
    sourceFile: string;
    sourceFileFull: string;
    functionName?: string;
    line: number;
    lineContent: string;
    reason: string;
    language: string;
    content: string;
    actual?: string;
    expected?: string;
}
/**
 * Given a failing test file, follow its imports to find the actual source file
 * containing the implementation under test. Works for JS/TS ES modules and CommonJS.
 */
export declare function resolveSourceFromTest(workspacePath: string, testFilePath: string, // absolute path to the test file
failures: TestFailure[], emit: (event: InvestigationEvent) => void, depth?: number): ResolvedSourceLocation | null;
export interface SourcePatch {
    patchedContent: string;
    diff: string;
}
/**
 * Generates the minimal fix for a wrong-operator bug discovered via import analysis.
 * Returns the patched content and a unified-diff-style string.
 */
export declare function generateSourcePatch(location: ResolvedSourceLocation, _failures: TestFailure[]): SourcePatch | null;
