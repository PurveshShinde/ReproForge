import type { InvestigationEvent } from '../events/eventTypes';
import type { TestFailure } from './testRunner';
export interface BugLocation {
    file: string;
    line: number;
    reason: string;
    content: string;
    language: string;
    /** Absolute path to the file — used by patchService */
    fullPath?: string;
    /** Actual assertion value, used by patchService */
    actual?: string;
    /** Expected assertion value, used by patchService */
    expected?: string;
}
export declare function findBugLocation(workspacePath: string, failures: TestFailure[], extensions: string[], emit: (event: InvestigationEvent) => void): BugLocation | null;
export declare function readFileForFrontend(workspacePath: string, relativeFile: string, emit: (event: InvestigationEvent) => void): void;
