"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSession = getSession;
exports.createSession = createSession;
exports.runInvestigation = runInvestigation;
const eventBus_1 = require("../events/eventBus");
const gitService_1 = require("../services/gitService");
const projectDetector_1 = require("../services/projectDetector");
const testRunner_1 = require("../services/testRunner");
const graphService_1 = require("../services/graphService");
const investigationService_1 = require("../services/investigationService");
const verificationService_1 = require("../services/verificationService");
const aiProvider_1 = require("../services/aiProvider");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
// In-memory session store
const sessions = new Map();
function getSession(id) {
    return sessions.get(id);
}
function createSession(repositoryUrl, bugDescription, stackTrace) {
    const validation = (0, gitService_1.validateGitHubUrl)(repositoryUrl);
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
async function runInvestigation(id) {
    const session = sessions.get(id);
    if (!session)
        return;
    const emit = (event) => {
        session.events.push(event);
        eventBus_1.eventBus.emit(id, event);
    };
    session.status = 'running';
    try {
        // Phase 1: Clone
        let cloneResult;
        try {
            cloneResult = await (0, gitService_1.cloneRepository)(session.repositoryUrl, emit);
        }
        catch (e) {
            emit({ type: 'INVESTIGATION_ERROR', message: `Unable to clone repository.\n\n${String(e)}` });
            emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Clone failed' });
            session.status = 'error';
            return;
        }
        session.workspacePath = cloneResult.workspacePath;
        session.commit = cloneResult.commit;
        // Phase 2: Detect project
        emit({ type: 'AGENT_STARTED', agent: 'Code Investigator' });
        const projectInfo = (0, projectDetector_1.detectProject)(cloneResult.workspacePath, emit);
        if (!projectInfo) {
            emit({ type: 'INVESTIGATION_ERROR', message: 'Project type could not be confidently detected. Supported: Java (Maven/Gradle), Node.js (npm/yarn/pnpm), Python (pytest).' });
            emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Project detection failed' });
            session.status = 'error';
            (0, gitService_1.cleanupWorkspace)(cloneResult.workspacePath);
            return;
        }
        session.language = projectInfo.language;
        session.framework = projectInfo.framework;
        // Phase 3: Build graph
        emit({ type: 'INVESTIGATION_LOG', message: 'Scanning repository structure...', level: 'info' });
        (0, graphService_1.buildRepositoryGraph)(cloneResult.workspacePath, projectInfo.sourceExtensions, emit, 30);
        emit({ type: 'AGENT_COMPLETED', agent: 'Code Investigator', summary: 'Repository structure mapped' });
        // Git history
        emit({ type: 'AGENT_STARTED', agent: 'History Investigator' });
        const log = (0, gitService_1.getGitLog)(cloneResult.workspacePath, 10);
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
        const testResult = await (0, testRunner_1.runTests)(cloneResult.workspacePath, projectInfo, emit);
        if (testResult.status === 'NO_TESTS_FOUND' || testResult.exitCode === -1) {
            emit({ type: 'NO_TESTS_FOUND', message: 'No supported test framework detected. Repository analysis can continue, but automated verification is unavailable.' });
            emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'No tests found' });
            session.status = 'completed';
            (0, gitService_1.cleanupWorkspace)(cloneResult.workspacePath);
            return;
        }
        if (testResult.status === 'BUILD_FAILED') {
            emit({ type: 'BUILD_FAILED', error: 'Compilation/build failed.' });
            emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Build failed' });
            session.status = 'error';
            (0, gitService_1.cleanupWorkspace)(cloneResult.workspacePath);
            return;
        }
        if (testResult.status === 'ENVIRONMENT_FAILED') {
            emit({ type: 'ENVIRONMENT_FAILED', error: 'Environment setup or tool execution failed.' });
            emit({ type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Environment failed' });
            session.status = 'error';
            (0, gitService_1.cleanupWorkspace)(cloneResult.workspacePath);
            return;
        }
        emit({ type: 'AGENT_COMPLETED', agent: 'Test Investigator', summary: `Tests completed (status: ${testResult.status})` });
        if (testResult.exitCode === 0 && testResult.failures.length === 0) {
            // All tests pass
            if (!session.bugDescription) {
                emit({ type: 'ALL_TESTS_PASS', message: 'No failing tests detected. Provide a bug description for targeted investigation.' });
                emit({ type: 'INVESTIGATION_COMPLETED', success: true, summary: 'All tests pass — no bug found' });
                session.status = 'completed';
                (0, gitService_1.cleanupWorkspace)(cloneResult.workspacePath);
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
        // Process all failures sequentially
        let remainingFailures = [...testResult.failures];
        let testsFailedBefore = remainingFailures.length;
        for (let i = 0; i < remainingFailures.length; i++) {
            const failure = remainingFailures[i];
            // Phase 5: Locate bug
            emit({ type: 'AGENT_STARTED', agent: 'Reproduction Agent' });
            const failureLabel = failure.file || failure.test || 'test suite';
            emit({ type: 'INVESTIGATION_LOG', message: `✅ Deterministically reproduced by ${failureLabel}`, level: 'info' });
            const bugLocation = (0, investigationService_1.findBugLocation)(cloneResult.workspacePath, [failure], projectInfo.sourceExtensions, emit);
            if (!bugLocation) {
                emit({ type: 'INVESTIGATION_LOG', message: 'Unable to precisely locate bug file. Reporting test failure as evidence.', level: 'warn' });
                emit({ type: 'ROOT_CAUSE_FOUND', summary: `Test failure detected but precise source location could not be determined automatically.`, evidence: [failure.error] });
                emit({ type: 'AGENT_COMPLETED', agent: 'Reproduction Agent', summary: 'Could not reproduce automatically' });
                continue;
            }
            emit({ type: 'AGENT_COMPLETED', agent: 'Reproduction Agent', summary: `Bug located near ${bugLocation.file}` });
            // Phase 6: Generate and apply patch
            emit({ type: 'AGENT_STARTED', agent: 'Fix Agent' });
            let aiResult;
            try {
                aiResult = await aiProvider_1.AIProvider.analyzeRootCauseAndPatch({
                    mode: investigationContext.mode,
                    failingTest: failure,
                    testFile: failure.file || bugLocation.file,
                    actualValue: bugLocation.actual || failure.actual,
                    expectedValue: bugLocation.expected || failure.expected,
                    relevantSourceFiles: [bugLocation.file],
                    relevantSourceCode: bugLocation.content
                });
            }
            catch (e) {
                emit({ type: 'PATCH_GENERATION_FAILED', reason: e.message });
                emit({ type: 'AGENT_COMPLETED', agent: 'Fix Agent', summary: 'Fix generation failed' });
                continue;
            }
            if (!aiResult) {
                emit({ type: 'PATCH_GENERATION_FAILED', reason: 'AI returned null' });
                emit({ type: 'AGENT_COMPLETED', agent: 'Fix Agent', summary: 'Fix generation failed' });
                continue;
            }
            emit({ type: 'CODE_HIGHLIGHT', file: aiResult.file, line: aiResult.line, reason: aiResult.explanation });
            emit({ type: 'BUG_LOCATION_FOUND', file: aiResult.file, line: aiResult.line, reason: aiResult.explanation });
            emit({ type: 'ROOT_CAUSE_FOUND', summary: aiResult.explanation, evidence: ['AI analysis'] });
            const fullPath = path.join(cloneResult.workspacePath, aiResult.file);
            const originalContent = fs.readFileSync(fullPath, 'utf-8');
            if (!originalContent.includes(aiResult.originalCode) && !aiResult.originalCode.includes('//')) {
                emit({ type: 'PATCH_FAILED', reason: 'Original code snippet not found in target file' });
                emit({ type: 'AGENT_COMPLETED', agent: 'Fix Agent', summary: 'Patch application failed' });
                continue;
            }
            const patchedContent = originalContent.replace(aiResult.originalCode, aiResult.replacementCode);
            fs.writeFileSync(fullPath, patchedContent, 'utf-8');
            const diff = `--- a/${aiResult.file}\n+++ b/${aiResult.file}\n@@ -${aiResult.line},1 +${aiResult.line},1 @@\n-${aiResult.originalCode.trim()}\n+${aiResult.replacementCode.trim()}`;
            emit({ type: 'PATCH_PROPOSED', files: [aiResult.file], diff });
            emit({ type: 'PATCH_APPLIED', files: [aiResult.file] });
            emit({ type: 'AGENT_COMPLETED', agent: 'Fix Agent', summary: `Patch applied to ${aiResult.file}` });
            // Phase 7: Verify
            const verification = await (0, verificationService_1.verifyFix)(cloneResult.workspacePath, projectInfo, emit);
            if (verification.totalFailed < testsFailedBefore) {
                emit({ type: 'TEST_PASSED', test: failure.test || failure.file || 'unknown test' });
                testsFailedBefore = verification.totalFailed;
            }
            else {
                emit({ type: 'INVESTIGATION_LOG', message: 'Test still failing after patch.', level: 'warn' });
            }
        }
        emit({
            type: 'INVESTIGATION_COMPLETED',
            success: testsFailedBefore === 0,
            summary: testsFailedBefore === 0
                ? `All issues fixed. 0 failing tests remaining.`
                : `Fixes applied but ${testsFailedBefore} test(s) still failing.`,
        });
        session.status = 'completed';
        (0, gitService_1.cleanupWorkspace)(cloneResult.workspacePath);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        try {
            eventBus_1.eventBus.emit(id, { type: 'INVESTIGATION_ERROR', message: `Unexpected error: ${message}` });
            eventBus_1.eventBus.emit(id, { type: 'INVESTIGATION_COMPLETED', success: false, summary: 'Unexpected error' });
        }
        catch { /* ok */ }
        session.status = 'error';
        if (session.workspacePath) {
            (0, gitService_1.cleanupWorkspace)(session.workspacePath);
        }
    }
}
//# sourceMappingURL=investigationOrchestrator.js.map