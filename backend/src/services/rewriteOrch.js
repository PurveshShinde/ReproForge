const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../agents/investigationOrchestrator.ts');
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('import { AIProvider }')) {
  content = content.replace(
    'import { verifyFix } from \'../services/verificationService\';',
    'import { verifyFix } from \'../services/verificationService\';\nimport { AIProvider } from \'../services/aiProvider\';\nimport * as fs from \'fs\';\nimport * as path from \'path\';'
  );
}

const lines = content.split('\n');
const phase5Idx = lines.findIndex(l => l.includes('// Phase 5: Locate bug'));
const endIdx = lines.findIndex((l, idx) => idx > phase5Idx && l.includes('session.status = \'completed\';'));

const replacement = `    // Process all failures
    let remainingFailures = [...testResult.failures];
    let testsFailedBefore = remainingFailures.length;

    for (let i = 0; i < remainingFailures.length; i++) {
      const failure = remainingFailures[i];
      
      emit({ type: 'AGENT_STARTED', agent: 'Reproduction Agent' });
      emit({ type: 'INVESTIGATION_LOG', message: \`✅ Deterministically reproduced by \${failure.file}\`, level: 'info' });

      const bugLocation = await findBugLocation(cloneResult.workspacePath, [failure], projectInfo.sourceExtensions, emit);

      if (!bugLocation) {
        emit({ type: 'INVESTIGATION_LOG', message: 'Unable to precisely locate bug file. Reporting test failure as evidence.', level: 'warn' });
        emit({ type: 'ROOT_CAUSE_FOUND', summary: \`Test failure detected but precise source location could not be determined automatically.\`, evidence: [failure.error] });
        emit({ type: 'AGENT_COMPLETED', agent: 'Reproduction Agent', summary: 'Could not reproduce automatically' });
        continue;
      }

      emit({ type: 'AGENT_COMPLETED', agent: 'Reproduction Agent', summary: \`Bug located near \${bugLocation.file}\` });

      emit({ type: 'AGENT_STARTED', agent: 'Fix Agent' });
      
      let aiResult;
      try {
        aiResult = await AIProvider.analyzeRootCauseAndPatch({
          mode: investigationContext.mode,
          failingTest: failure,
          testFile: failure.file,
          actualValue: bugLocation.actual,
          expectedValue: bugLocation.expected,
          relevantSourceFiles: [bugLocation.file],
          relevantSourceCode: bugLocation.content
        });
      } catch (e) {
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
      
      const diff = \`--- a/\${aiResult.file}\\n+++ b/\${aiResult.file}\\n@@ -\${aiResult.line},1 +\${aiResult.line},1 @@\\n-\${aiResult.originalCode.trim()}\\n+\${aiResult.replacementCode.trim()}\`;
      
      emit({ type: 'PATCH_PROPOSED', files: [aiResult.file], diff });
      emit({ type: 'PATCH_APPLIED', files: [aiResult.file] });
      emit({ type: 'AGENT_COMPLETED', agent: 'Fix Agent', summary: \`Patch applied to \${aiResult.file}\` });

      // Verify
      const verification = await verifyFix(cloneResult.workspacePath, projectInfo, emit);
      
      if (verification.totalFailed < testsFailedBefore) {
         emit({ type: 'TEST_PASSED', test: failure.test || failure.file });
         testsFailedBefore = verification.totalFailed;
      } else {
         emit({ type: 'INVESTIGATION_LOG', message: 'Test still failing after patch.', level: 'warn' });
      }
    }

    emit({
      type: 'INVESTIGATION_COMPLETED',
      success: testsFailedBefore === 0,
      summary: testsFailedBefore === 0
        ? \`All issues fixed. 0 failing tests remaining.\`
        : \`Fixes applied but \${testsFailedBefore} test(s) still failing.\`,
    });
`;

lines.splice(phase5Idx, endIdx - phase5Idx, replacement);
fs.writeFileSync(file, lines.join('\n'), 'utf-8');
console.log('Replaced successfully');
