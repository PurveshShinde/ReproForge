export type InvestigationEvent =
  | { type: 'REPOSITORY_CLONING'; repository: string }
  | { type: 'REPOSITORY_READY'; commit: string; branch: string }
  | { type: 'PROJECT_DETECTED'; language: string; framework?: string; buildTool?: string; testCommand?: string }
  | { type: 'FILE_DISCOVERED'; file: string; kind?: string }
  | { type: 'NODE_DISCOVERED'; id: string; label: string; kind: string }
  | { type: 'EDGE_DISCOVERED'; source: string; target: string; relation: string }
  | { type: 'AGENT_STARTED'; agent: string }
  | { type: 'AGENT_COMPLETED'; agent: string; summary?: string }
  | { type: 'AGENT_ERROR'; agent: string; error: string }
  | { type: 'FILE_OPENED'; file: string; content?: string; language?: string; line?: number }
  | { type: 'CODE_HIGHLIGHT'; file: string; line: number; reason?: string }
  | { type: 'TEST_STARTED'; command: string }
  | { type: 'TEST_OUTPUT'; output: string }
  | { type: 'TEST_FAILED'; test?: string; error: string; file?: string; line?: number }
  | { type: 'TEST_PASSED'; test: string }
  | { type: 'BUILD_FAILED'; error: string }
  | { type: 'ENVIRONMENT_FAILED'; error: string }
  | { type: 'TEST_EXECUTION_FAILED'; reason: string }
  | { type: 'NO_TESTS_FOUND'; message: string }
  | { type: 'ALL_TESTS_PASS'; message: string }
  | { type: 'BUG_LOCATION_FOUND'; file: string; line: number; reason: string }
  | { type: 'ROOT_CAUSE_FOUND'; summary: string; evidence: string[] }
  | { type: 'PATCH_PROPOSED'; files: string[]; diff?: string }
  | { type: 'PATCH_APPLIED'; files: string[] }
  | { type: 'PATCH_FAILED'; reason: string }
  | { type: 'VERIFICATION_STARTED' }
  | { type: 'VERIFICATION_RESULT'; passed: boolean; regressionPassed: boolean; totalTests?: number; failedTests?: number; notes?: string }
  | { type: 'INFERRED_CODE_PATH'; description: string }
  | { type: 'INVESTIGATION_LOG'; message: string; level: 'info' | 'warn' | 'error' }
  | { type: 'INVESTIGATION_COMPLETED'; success: boolean; summary?: string }
  | { type: 'INVESTIGATION_ERROR'; message: string };

export interface InvestigationSession {
  id: string;
  repositoryUrl: string;
  bugDescription?: string;
  stackTrace?: string;
  workspacePath?: string;
  commit?: string;
  language?: string;
  framework?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  createdAt: Date;
  events: InvestigationEvent[];
}
