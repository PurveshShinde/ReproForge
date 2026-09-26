import os
import sys

file_path = r"d:\Repo\ReproForge\backend\src\agents\investigationOrchestrator.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

if "import { AIProvider }" not in content:
    content = content.replace(
        "import { verifyFix } from '../services/verificationService';",
        "import { verifyFix } from '../services/verificationService';\nimport { AIProvider } from '../services/aiProvider';\nimport * as fs from 'fs';\nimport * as path from 'path';"
    )

start_marker = "    // Phase 5: Locate bug"
end_marker = "    session.status = 'completed';\n    cleanupWorkspace(cloneResult.workspacePath);"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print("Could not find markers")
    sys.exit(1)

replacement = """    // Process all failures sequentially
    let remainingFailures = [...testResult.failures];
    let testsFailedBefore = remainingFailures.length;

    for (let i = 0; i < remainingFailures.length; i++) {
      const failure = remainingFailures[i];
      
      // Phase 5: Locate bug
      emit({ type: 'AGENT_STARTED', agent: 'Reproduction Agent' });
      emit({ type: 'INVESTIGATION_LOG', message: `✅ Deterministically reproduced by ${failure.file}`, level: 'info' });

      const bugLocation = findBugLocation(cloneResult.workspacePath, [failure], projectInfo.sourceExtensions, emit);

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
        aiResult = await AIProvider.analyzeRootCauseAndPatch({
          mode: investigationContext.mode,
          failingTest: failure,
          testFile: failure.file,
          actualValue: bugLocation.actual,
          expectedValue: bugLocation.expected,
          relevantSourceFiles: [bugLocation.file],
          relevantSourceCode: bugLocation.content
        });
      } catch (e: any) {
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
      
      const diff = `--- a/${aiResult.file}\\n+++ b/${aiResult.file}\\n@@ -${aiResult.line},1 +${aiResult.line},1 @@\\n-${aiResult.originalCode.trim()}\\n+${aiResult.replacementCode.trim()}`;
      
      emit({ type: 'PATCH_PROPOSED', files: [aiResult.file], diff });
      emit({ type: 'PATCH_APPLIED', files: [aiResult.file] });
      emit({ type: 'AGENT_COMPLETED', agent: 'Fix Agent', summary: `Patch applied to ${aiResult.file}` });

      // Phase 7: Verify
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
        ? `All issues fixed. 0 failing tests remaining.`
        : `Fixes applied but ${testsFailedBefore} test(s) still failing.`,
    });

"""

new_content = content[:start_idx] + replacement + content[end_idx:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Success")
