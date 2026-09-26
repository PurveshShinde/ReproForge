import type { InvestigationEvent } from '../events/eventTypes';
import type { BugLocation } from './investigationService';
export interface PatchResult {
    success: boolean;
    diff?: string;
    files?: string[];
    error?: string;
}
export declare function generatePatch(workspacePath: string, bugLocation: BugLocation, failures: Array<{
    error: string;
    file?: string;
    line?: number;
}>, emit: (event: InvestigationEvent) => void): PatchResult;
export declare function applyDemoRepoPatch(workspacePath: string, targetFile: string, patchedContent: string, emit: (event: InvestigationEvent) => void): PatchResult;
