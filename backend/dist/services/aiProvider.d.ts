import type { TestFailure } from './testRunner';
export interface AIPatchResult {
    file: string;
    line: number;
    originalCode: string;
    replacementCode: string;
    explanation: string;
}
export declare class AIProvider {
    static analyzeRootCauseAndPatch(context: {
        mode: string;
        failingTest?: TestFailure;
        testFile?: string;
        testSource?: string;
        actualValue?: string;
        expectedValue?: string;
        relevantSourceFiles?: string[];
        relevantSourceCode?: string;
    }): Promise<AIPatchResult | null>;
    private static mockAIPatch;
}
