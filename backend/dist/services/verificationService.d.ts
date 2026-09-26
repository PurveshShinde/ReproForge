import type { InvestigationEvent } from '../events/eventTypes';
import type { ProjectInfo } from './projectDetector';
export interface VerificationResult {
    regressionPassed: boolean;
    fullSuitePassed: boolean;
    totalPassed: number;
    totalFailed: number;
    notes?: string;
}
export declare function verifyFix(workspacePath: string, projectInfo: ProjectInfo, emit: (event: InvestigationEvent) => void): Promise<VerificationResult>;
