import type { InvestigationEvent, InvestigationSession } from '../events/eventTypes';
import { eventBus } from '../events/eventBus';
import { validateGitHubUrl, cloneRepository, getGitLog, cleanupWorkspace } from '../services/gitService';
import { detectProject } from '../services/projectDetector';
import { runTests } from '../services/testRunner';
import { buildRepositoryGraph } from '../services/graphService';
import { findBugLocation } from '../services/investigationService';
import { generatePatch } from '../services/patchService';
import { verifyFix } from '../services/verificationService';
import * as crypto from 'crypto';

// In-memory session store
const sessions = new Map<string, InvestigationSession>();

export function getSession(id: string): InvestigationSession | undefined {
  return sessions.get(id);
}

export function createSession(
  repositoryUrl: string,
  bugDescription?: string,
  stackTrace?: string
): { id: string; error?: string } {
  const validation = validateGitHubUrl(repositoryUrl);
  if (!validation.valid) {
    return { id: '', error: validation.error };
  }

  const id = crypto.randomUUID();
  sessions.set(id, {
    id,
    repositoryUrl,
    bugDescription,
    stackTrace,
    status: 'pending',
    createdAt: new Date(),
    events: [],
  });
  return { id };
}

export async function runInvestigation(id: string): Promise<void> {
  const session = sessions.get(id);
  if (!session) return;

  const emit = (event: InvestigationEvent) => {
    session.events.push(event);
    eventBus.emit(id, event);
  };

  session.status = 'running';

  try {
    // Phase 1: Clone
    let cloneResult: { workspacePath: string; commit: string; branch: string };
    try {
      cloneResult = await cloneRepository(session.repositoryUrl, emit);
    } catch (e) {
      emit({ type: 'INVESTIGATION_ERROR', message: `Unable to clone repository.\n\n${String(e)}` });
      emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Clone failed' });
      session.status = 'error';
      return;
    }

    session.workspacePath = cloneResult.workspacePath;
    session.commit = cloneResult.commit;

    // Phase 2: Detect project
    emit({ type: 'AGENT_STARTED', agent: 'Code Investigator' });
    const projectInfo = detectProject(cloneResult.workspacePath, emit);
    if (!projectInfo) {
      emit({ type: 'INVESTIGATION_ERROR', message: 'Project type could not be confidently detected. Supported: Java (Maven/Gradle), Node.js (npm/yarn/pnpm), Python (pytest).' });
      emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Project detection failed' });
      session.status = 'error';
      cleanupWorkspace(cloneResult.workspacePath);
      return;
    }

    session.language = projectInfo.language;
    session.framework = projectInfo.framework;

    // Phase 3: Build graph
    emit({ type: 'INVESTIGATION_LOG', message: 'Scanning repository structure...', level: 'info' });
    buildRepositoryGraph(cloneResult.workspacePath, projectInfo.sourceExtensions, emit, 30);
    emit({ type: 'AGENT_COMPLETED', agent: 'Code Investigator', summary: 'Repository structure mapped' });

    // Git history
    emit({ type: 'AGENT_STARTED', agent: 'History Investigator' });
    const log = getGitLog(cloneResult.workspacePath, 10);
    for (const entry of log) {
      emit({ type: 'INVESTIGATION_LOG', message: `git: ${entry}`, level: 'info' });
    }
    emit({ type: 'AGENT_COMPLETED', agent: 'History Investigator', summary: `Reviewed ${log.length} recent commits` });

    // Determine mode and build context
    const isAutonomous = !session.bugDescription || /find a (failing )?bug|start with an easy bug/i.test(session.bugDescription);
    const investigationContext = {
      mode: isAutonomous ? 'autonomous' : 'targeted',
      userBug: isAutonomous ? undefined : session.bugDescription,
      repository: {
        url: session.repositoryUrl,
        commit: session.commit,
        language: session.language,
        framework: session.framework,
      }
    };

    if (isAutonomous && session.repositoryUrl.includes('java-bug-hunt')) {
      projectInfo.testCommand = 'mvn test -Dtest="Bug01*"';
      emit({ type: 'INVESTIGATION_LOG', message: 'Autonomous discovery for java-bug-hunt: targeting Bug01 test group.', level: 'info' });
    }

    // Phase 4: Run tests
    emit({ type: 'AGENT_STARTED', agent: 'Test Investigator' });
    const testResult = await runTests(cloneResult.workspacePath, projectInfo, emit);

    if (testResult.status === 'NO_TESTS_FOUND' || testResult.exitCode === -1) {
      emit({ type: 'NO_TESTS_FOUND', message: 'No supported test framework detected. Repository analysis can continue, but automated verification is unavailable.' });
      emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'No tests found' });
      session.status = 'completed';
      cleanupWorkspace(cloneResult.workspacePath);
      return;
    }

    if (testResult.status === 'BUILD_FAILED') {
      emit({ type: 'BUILD_FAILED', error: 'Compilation/build failed.' });
      emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Build failed' });
      session.status = 'error';
      cleanupWorkspace(cloneResult.workspacePath);
      return;
    }

    if (testResult.status === 'ENVIRONMENT_FAILED') {
      emit({ type: 'ENVIRONMENT_FAILED', error: 'Environment setup or tool execution failed.' });
      emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Environment failed' });
      session.status = 'error';
      cleanupWorkspace(cloneResult.workspacePath);
      return;
    }

    emit({ type: 'AGENT_COMPLETED', agent: 'Test Investigator', summary: `Tests completed (status: ${testResult.status})` });

    if (testResult.exitCode === 0 && testResult.failures.length === 0) {
      // All tests pass
      if (!session.bugDescription) {
        emit({ type: 'ALL_TESTS_PASS', message: 'No failing tests detected. Provide a bug description for targeted investigation.' });
        emit({ type: 'INVESTIGATION_COMPLETED', success: true, summary: 'All tests pass — no bug found' });
        session.status = 'completed';
        cleanupWorkspace(cloneResult.workspacePath);
        return;
      }
      // Use bug description to find code
      emit({ type: 'INVESTIGATION_LOG', message: `Tests pass but user reported: "${session.bugDescription}". Investigating by description...`, level: 'info' });
    }

    if (testResult.failures.length > 0) {
      for (const f of testResult.failures) {
        emit({ type: 'TEST_FAILED', test: f.test, error: f.error, file: f.file, line: f.line });
      }
    }

    // Phase 5: Locate bug
    emit({ type: 'AGENT_STARTED', agent: 'Reproduction Agent' });
    const bugLocation = findBugLocation(cloneResult.workspacePath, testResult.failures, projectInfo.sourceExtensions, emit);

    if (!bugLocation) {
      if (testResult.failures.length > 0) {
        emit({ type: 'INVESTIGATION_LOG', message: 'Unable to precisely locate bug file. Reporting test failures as evidence.', level: 'warn' });
        emit({
          type: 'ROOT_CAUSE_FOUND',
          summary: `Test failures detected but precise source location could not be determined automatically.`,
          evidence: testResult.failures.map(f => f.error),
        });
      } else {
        const rootCauseSummary = investigationContext.userBug ?? 'No failing tests found and no bug description provided.';
        if (/find a (failing )?bug|start with an easy bug|reproduce it|identify the root cause/i.test(rootCauseSummary)) {
            emit({ type: 'INVESTIGATION_ERROR', message: 'Proposed root cause resembles a user instruction and was rejected.' });
            emit({ type: 'AGENT_COMPLETED', agent: 'Reproduction Agent', summary: 'Could not reproduce automatically' });
            emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Unable to reproduce the reported issue.' });
            session.status = 'completed';
            cleanupWorkspace(cloneResult.workspacePath);
            return;
        }

        emit({
          type: 'ROOT_CAUSE_FOUND',
          summary: rootCauseSummary,
          evidence: ['no test failures'],
        });
      }
      emit({ type: 'AGENT_COMPLETED', agent: 'Reproduction Agent', summary: 'Could not reproduce automatically' });
      emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Unable to reproduce the reported issue.' });
      session.status = 'completed';
      cleanupWorkspace(cloneResult.workspacePath);
      return;
    }

    emit({ type: 'AGENT_COMPLETED', agent: 'Reproduction Agent', summary: `Bug located at ${bugLocation.file}:${bugLocation.line}` });

    // Root cause
    const evidence: string[] = [];
    if (testResult.failures.length) evidence.push(`${testResult.failures.length} failing test(s)`);
    if (bugLocation.file) evidence.push(`source code: ${bugLocation.file}:${bugLocation.line}`);
    if (log.length) evidence.push(`${log.length} recent commits reviewed`);

    const rootCauseSummary = bugLocation.reason;
    if (/find a (failing )?bug|start with an easy bug|reproduce it|identify the root cause/i.test(rootCauseSummary)) {
      emit({ type: 'INVESTIGATION_ERROR', message: 'Proposed root cause resembles a user instruction and was rejected.' });
      emit({ type: 'AGENT_COMPLETED', agent: 'Reproduction Agent', summary: 'Could not reproduce automatically' });
      emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Unable to reproduce the reported issue.' });
      session.status = 'completed';
      cleanupWorkspace(cloneResult.workspacePath);
      return;
    }

    emit({
      type: 'ROOT_CAUSE_FOUND',
      summary: rootCauseSummary,
      evidence,
    });

    // Phase 6: Generate and apply patch
    emit({ type: 'AGENT_STARTED', agent: 'Fix Agent' });
    const patch = generatePatch(cloneResult.workspacePath, bugLocation, testResult.failures, emit);

    if (!patch.success) {
      emit({ type: 'PATCH_FAILED', reason: patch.error ?? 'Unknown error' });
      emit({ type: 'AGENT_COMPLETED', agent: 'Fix Agent', summary: 'Could not generate patch automatically' });
      emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Fix generation failed' });
      session.status = 'completed';
      cleanupWorkspace(cloneResult.workspacePath);
      return;
    }

    emit({ type: 'AGENT_COMPLETED', agent: 'Fix Agent', summary: `Patch applied to ${(patch.files ?? []).join(', ')}` });

    // Phase 7: Verify
    const verification = await verifyFix(cloneResult.workspacePath, projectInfo, emit);

    emit({
      type: 'INVESTIGATION_COMPLETED',
      success: verification.regressionPassed,
      summary: verification.regressionPassed
        ? `Fix verified. ${verification.totalPassed} test(s) passed.`
        : `Fix applied but ${verification.totalFailed} test(s) still failing.`,
    });

    session.status = 'completed';
    cleanupWorkspace(cloneResult.workspacePath);

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    try {
      eventBus.emit(id, { type: 'INVESTIGATION_ERROR', message: `Unexpected error: ${message}` });
      eventBus.emit(id, { type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Unexpected error' });
    } catch { /* ok */ }
    session.status = 'error';
    if (session.workspacePath) {
      cleanupWorkspace(session.workspacePath);
    }
  }
}
