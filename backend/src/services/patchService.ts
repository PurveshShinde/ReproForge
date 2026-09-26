import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { InvestigationEvent } from '../events/eventTypes';
import type { BugLocation } from './investigationService';
import { generateSourcePatch } from './sourceResolver';

export interface PatchResult {
  success: boolean;
  diff?: string;
  files?: string[];
  error?: string;
}

export function generatePatch(
  workspacePath: string,
  bugLocation: BugLocation,
  failures: Array<{ error: string; file?: string; line?: number }>,
  emit: (event: InvestigationEvent) => void
): PatchResult {
  const fullPath = bugLocation.fullPath ?? path.join(workspacePath, bugLocation.file);

  // ── Strategy 1: use sourceResolver's operator-fix patch ───────────────────
  // This fires when the bug was found via import analysis (actual/expected present)
  if (bugLocation.actual !== undefined || bugLocation.expected !== undefined) {
    const sourcePatch = generateSourcePatch(
      {
        sourceFile: bugLocation.file,
        sourceFileFull: fullPath,
        line: bugLocation.line,
        lineContent: bugLocation.content.split('\n')[bugLocation.line - 1] ?? '',
        reason: bugLocation.reason,
        language: bugLocation.language,
        content: bugLocation.content,
        actual: bugLocation.actual,
        expected: bugLocation.expected,
      },
      failures
    );

    if (sourcePatch) {
      return writePatchAndEmit(workspacePath, fullPath, bugLocation.file, sourcePatch.patchedContent, sourcePatch.diff, emit);
    }
  }

  // ── Strategy 2: Java null-dereference ─────────────────────────────────────
  if (bugLocation.language === 'java') {
    const result = tryJavaNullPatch(bugLocation, fullPath, workspacePath, emit);
    if (result) return result;
  }

  // ── Strategy 3: JS/TS null guard ─────────────────────────────────────────
  if (bugLocation.language === 'javascript' || bugLocation.language === 'typescript') {
    const result = tryJsNullPatch(bugLocation, fullPath, workspacePath, emit);
    if (result) return result;
  }

  // ── Strategy 4: Python None guard ─────────────────────────────────────────
  if (bugLocation.language === 'python') {
    const result = tryPythonNonePatch(bugLocation, fullPath, workspacePath, emit);
    if (result) return result;
  }

  emit({ type: 'INVESTIGATION_LOG', message: 'Could not automatically generate a targeted patch for this code.', level: 'warn' });
  return { success: false, error: 'No automatic patch could be generated for this pattern.' };
}

// ─── Strategy implementations ─────────────────────────────────────────────────

function tryJavaNullPatch(
  bugLocation: BugLocation,
  fullPath: string,
  workspacePath: string,
  emit: (event: InvestigationEvent) => void
): PatchResult | null {
  const lines = bugLocation.content.split('\n');
  const bugLine = lines[bugLocation.line - 1] ?? '';
  const derefMatch = bugLine.match(/(\w+)\.(\w+)\(\)/);
  if (!derefMatch) return null;

  const varName = derefMatch[1];
  const indent = bugLine.match(/^(\s*)/)?.[1] ?? '';
  const newLines = [...lines];
  newLines.splice(bugLocation.line - 1, 0,
    `${indent}if (${varName} == null) {`,
    `${indent}    throw new IllegalStateException("${varName} must not be null");`,
    `${indent}}`
  );
  const patchedContent = newLines.join('\n');
  const diff = buildUnifiedDiff(bugLocation.file, bugLine, `${indent}if (${varName} == null) { throw ... }\n${bugLine}`, bugLocation.line);
  return writePatchAndEmit(workspacePath, fullPath, bugLocation.file, patchedContent, diff, emit);
}

function tryJsNullPatch(
  bugLocation: BugLocation,
  fullPath: string,
  workspacePath: string,
  emit: (event: InvestigationEvent) => void
): PatchResult | null {
  const lines = bugLocation.content.split('\n');
  const bugLine = lines[bugLocation.line - 1] ?? '';
  const derefMatch = bugLine.match(/(\w+)\.(\w+)/);
  if (!derefMatch) return null;

  const varName = derefMatch[1];
  const indent = bugLine.match(/^(\s*)/)?.[1] ?? '';
  const newLines = [...lines];
  newLines.splice(bugLocation.line - 1, 0,
    `${indent}if (${varName} == null) { throw new Error('${varName} is null or undefined'); }`
  );
  const patchedContent = newLines.join('\n');
  const diff = buildUnifiedDiff(bugLocation.file, bugLine, `${indent}if (...) throw\n${bugLine}`, bugLocation.line);
  return writePatchAndEmit(workspacePath, fullPath, bugLocation.file, patchedContent, diff, emit);
}

function tryPythonNonePatch(
  bugLocation: BugLocation,
  fullPath: string,
  workspacePath: string,
  emit: (event: InvestigationEvent) => void
): PatchResult | null {
  const lines = bugLocation.content.split('\n');
  const bugLine = lines[bugLocation.line - 1] ?? '';
  const indent = bugLine.match(/^(\s*)/)?.[1] ?? '';
  const derefMatch = bugLine.match(/(\w+)\.\w+/);
  if (!derefMatch) return null;

  const varName = derefMatch[1];
  const newLines = [...lines];
  newLines.splice(bugLocation.line - 1, 0,
    `${indent}if ${varName} is None:`,
    `${indent}    raise ValueError("${varName} must not be None")`
  );
  const patchedContent = newLines.join('\n');
  const diff = buildUnifiedDiff(bugLocation.file, bugLine, `${indent}if ${varName} is None: raise\n${bugLine}`, bugLocation.line);
  return writePatchAndEmit(workspacePath, fullPath, bugLocation.file, patchedContent, diff, emit);
}

// ─── Shared writer ─────────────────────────────────────────────────────────────

function writePatchAndEmit(
  workspacePath: string,
  fullPath: string,
  relFile: string,
  patchedContent: string,
  heuristicDiff: string,
  emit: (event: InvestigationEvent) => void
): PatchResult {
  try {
    fs.writeFileSync(fullPath, patchedContent, 'utf-8');
  } catch (e) {
    return { success: false, error: `Failed to write patch: ${String(e)}` };
  }

  // Always prefer real git diff over our heuristic diff
  let diff = heuristicDiff;
  try {
    const gitDiff = execSync('git diff', { cwd: workspacePath }).toString();
    if (gitDiff.trim()) diff = gitDiff;
  } catch { /* ok — workspace may not be a git repo */ }

  emit({ type: 'PATCH_PROPOSED', files: [relFile], diff });
  emit({ type: 'PATCH_APPLIED', files: [relFile] });

  return { success: true, diff, files: [relFile] };
}

function buildUnifiedDiff(file: string, oldLine: string, newLine: string, lineNo: number): string {
  return [
    `--- a/${file}`,
    `+++ b/${file}`,
    `@@ -${lineNo},1 +${lineNo},1 @@`,
    `-${oldLine}`,
    `+${newLine}`,
  ].join('\n');
}

export function applyDemoRepoPatch(
  workspacePath: string,
  targetFile: string,
  patchedContent: string,
  emit: (event: InvestigationEvent) => void
): PatchResult {
  const fullPath = path.join(workspacePath, targetFile);
  try {
    fs.writeFileSync(fullPath, patchedContent, 'utf-8');
  } catch (e) {
    return { success: false, error: `Failed to write patch: ${String(e)}` };
  }

  let diff = '';
  try {
    diff = execSync('git diff', { cwd: workspacePath }).toString();
  } catch { /* ok */ }

  emit({ type: 'PATCH_PROPOSED', files: [targetFile], diff });
  emit({ type: 'PATCH_APPLIED', files: [targetFile] });

  return { success: true, diff, files: [targetFile] };
}
