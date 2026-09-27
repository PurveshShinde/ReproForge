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
/**
 * Prune workspace folders older than maxAgeMs (default: 10 minutes)
 * to prevent disk exhaustion on shared hosting like Render.
 */
export declare function pruneStaleWorkspaces(maxAgeMs?: number): void;
