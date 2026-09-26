import os

file_path = r"d:\Repo\ReproForge\backend\src\services\sourceResolver.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Modify the signature
content = content.replace(
    "  emit: (event: InvestigationEvent) => void\n): ResolvedSourceLocation | null {",
    "  emit: (event: InvestigationEvent) => void,\n  depth: number = 0\n): ResolvedSourceLocation | null {"
)

# Modify the loop logic
old_loop = """      const loc = findBugInFunction(sourceContent, importedName, assertionCtx);
      if (loc) {
        const language = detectLanguage(resolvedFull);
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

    // ── Even if we didn't pinpoint a bug line, return the source file ───────
    // so upstream can at least open it in Monaco and show the diff
    const language = detectLanguage(resolvedFull);
    const fallbackLine = findFunctionLine(sourceContent, imp.names[0] ?? '') ?? 1;
    const fallbackContent = sourceContent.split('\\n')[fallbackLine - 1] ?? '';
    return {
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
  }"""

new_loop = """      const loc = findBugInFunction(sourceContent, importedName, assertionCtx);
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
      if (deeper) return deeper;
    }

    // ── Even if we didn't pinpoint a bug line, return the source file ───────
    // so upstream can at least open it in Monaco and show the diff
    const language = detectLanguage(resolvedFull);
    const fallbackLine = findFunctionLine(sourceContent, imp.names[0] ?? '') ?? 1;
    const fallbackContent = sourceContent.split('\\n')[fallbackLine - 1] ?? '';
    return {
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
  }"""

content = content.replace(old_loop, new_loop)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
