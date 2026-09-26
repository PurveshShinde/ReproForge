import type { InvestigationEvent } from '../events/eventTypes';
export interface ProjectInfo {
    language: string;
    framework?: string;
    buildTool?: string;
    testCommand: string;
    testOutputParser: 'jest' | 'pytest' | 'maven' | 'gradle' | 'vitest' | 'unknown';
    sourceExtensions: string[];
}
export declare function detectProject(workspacePath: string, emit: (event: InvestigationEvent) => void): ProjectInfo | null;
