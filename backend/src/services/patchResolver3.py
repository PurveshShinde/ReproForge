import os

file_path = r"d:\Repo\ReproForge\backend\src\services\sourceResolver.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# We need to replace the entire resolveSourceFromTest function body again
# I will just write a regex or find/replace to put the new logic.

start_str = "export function resolveSourceFromTest(\n  workspacePath: string,\n  testFilePath: string,         // absolute path to the test file\n  failures: TestFailure[],\n  emit: (event: InvestigationEvent) => void,\n  depth: number = 0\n): ResolvedSourceLocation | null {"
end_str = "  return bestFallback;\n}"

if start_str in content and end_str in content:
    start_idx = content.find(start_str) + len(start_str)
    end_idx = content.find(end_str) + len(end_str)
    
    new_body = """
  const testContent = tryReadFile(testFilePath);
  if (!testContent) return null;

  const testRel = path.relative(workspacePath, testFilePath).replace(/\\\\/g, '/');
  if (depth === 0) emit({ type: 'INVESTIGATION_LOG', message: `Following imports in ${testRel}...`, level: 'info' });

  // ── Extract assertion context from test output ────────────────────────────
  const assertionCtx = extractAssertionContext(failures);
  const testBasename = path.basename(testFilePath).replace(/\\.(test|spec)\\.(js|ts|jsx|tsx)$/i, '').toLowerCase();

  // ── Parse all local imports from the test file ───────────────────────────
  const imports = parseImports(testContent);
  if (depth === 0) emit({ type: 'INVESTIGATION_LOG', message: `Found ${imports.length} local import(s): ${imports.map(i => i.specifier).join(', ')}`, level: 'info' });

  const testDir = path.dirname(testFilePath);
  let bestFallback: ResolvedSourceLocation | null = null;
  let bestFallbackScore = -1;

  for (const imp of imports) {
    // Resolve the imported module to an actual file on disk
    const resolvedFull = resolveImportPath(testDir, imp.specifier, workspacePath);
    if (!resolvedFull) continue;

    const sourceContent = tryReadFile(resolvedFull);
    if (!sourceContent) continue;

    const sourceRel = path.relative(workspacePath, resolvedFull).replace(/\\\\/g, '/');
    emit({ type: 'FILE_DISCOVERED', file: sourceRel, kind: 'source' });
    emit({ type: 'EDGE_DISCOVERED', source: testRel, target: sourceRel, relation: 'imports' });
    emit({ type: 'INVESTIGATION_LOG', message: `Resolved import "${imp.specifier}" → ${sourceRel}`, level: 'info' });

    const sourceBasename = path.basename(resolvedFull).replace(/\\.(js|ts|jsx|tsx)$/i, '').toLowerCase();
    
    // Score this file based on name match
    let fileScore = 0;
    if (sourceBasename === testBasename) fileScore = 100;
    else if (sourceBasename.includes(testBasename) || testBasename.includes(sourceBasename)) fileScore = 50;

    // ── For each imported name, find and inspect the function body ──────────
    for (const importedName of imp.names) {
      if (depth === 0 && assertionCtx.calledFunction && importedName.toLowerCase() !== assertionCtx.calledFunction.toLowerCase()) {
         if (!importedName.toLowerCase().includes(assertionCtx.calledFunction.toLowerCase())) {
             continue;
         }
      }

      const loc = findBugInFunction(sourceContent, importedName, assertionCtx);
      if (loc) {
        const language = detectLanguage(resolvedFull);
        
        // If we found a definitive bug (not just a fallback)
        if (!loc.reason.startsWith('Test failure traced to')) {
           emit({ type: 'INVESTIGATION_LOG', message: `Inspecting ${importedName}() in ${sourceRel}:${loc.line}`, level: 'info' });
           return {
             sourceFile: sourceRel,
             sourceFileFull: resolvedFull,
             functionName: importedName,
             line: loc.line,
             lineContent: loc.lineContent,
             reason: loc.reason,
             language,
             content: sourceContent,
             actual: assertionCtx.actual,
             expected: assertionCtx.expected,
           };
        }
      }
    }

    // If we didn't find a definitive bug here, follow one additional call level
    if (depth < 2) {
      const deeper = resolveSourceFromTest(workspacePath, resolvedFull, failures, emit, depth + 1);
      if (deeper) {
         if (!deeper.reason.startsWith('Test failure traced to')) {
            return deeper; // Found definitive bug deeper
         }
         
         // Evaluate the deeper fallback
         const deeperBasename = path.basename(deeper.sourceFileFull).replace(/\\.(js|ts|jsx|tsx)$/i, '').toLowerCase();
         let deeperScore = 0;
         if (deeperBasename === testBasename) deeperScore = 100;
         else if (deeperBasename.includes(testBasename) || testBasename.includes(deeperBasename)) deeperScore = 50;
         
         if (deeperScore > bestFallbackScore) {
            bestFallbackScore = deeperScore;
            bestFallback = deeper;
         }
      }
    }

    // ── Even if we didn't pinpoint a bug line, store the source file as fallback ───────
    if (fileScore >= bestFallbackScore || !bestFallback) {
      const language = detectLanguage(resolvedFull);
      const fallbackLine = findFunctionLine(sourceContent, imp.names[0] ?? '') ?? 1;
      const fallbackContent = sourceContent.split('\\n')[fallbackLine - 1] ?? '';
      
      bestFallbackScore = fileScore;
      bestFallback = {
        sourceFile: sourceRel,
        sourceFileFull: resolvedFull,
        functionName: imp.names[0],
        line: fallbackLine,
        lineContent: fallbackContent,
        reason: `Test failure in ${testRel} traces to ${sourceRel} via import "${imp.specifier}"`,
        language,
        content: sourceContent,
        actual: assertionCtx.actual,
        expected: assertionCtx.expected,
      };
    }
  }

  return bestFallback;
}"""
    
    content = content[:start_idx] + new_body + content[end_idx:]
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Could not find start or end strings")
