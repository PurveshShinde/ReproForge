import type { InvestigationEvent } from '../events/eventTypes';
export interface CloneResult {
    workspacePath: string;
    commit: string;
    branch: string;
}
export declare function validateGitHubUrl(url: string): {
    valid: boolean;
    error?: string;
};
export declare function cloneRepository(url: string, emit: (event: InvestigationEvent) => void): Promise<CloneResult>;
export declare function getGitLog(workspacePath: string, maxEntries?: number): string[];
export declare function cleanupWorkspace(workspacePath: string): void;
