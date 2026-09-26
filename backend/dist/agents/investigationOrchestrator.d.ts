import type { InvestigationSession } from '../events/eventTypes';
export declare function getSession(id: string): InvestigationSession | undefined;
export declare function createSession(repositoryUrl: string, bugDescription?: string, stackTrace?: string): {
    id: string;
    error?: string;
};
export declare function runInvestigation(id: string): Promise<void>;
