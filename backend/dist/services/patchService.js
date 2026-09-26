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
exports.generatePatch = generatePatch;
exports.applyDemoRepoPatch = applyDemoRepoPatch;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sourceResolver_1 = require("./sourceResolver");
function generatePatch(workspacePath, bugLocation, failures, emit) {
    const fullPath = bugLocation.fullPath ?? path.join(workspacePath, bugLocation.file);
    // ── Strategy 1: use sourceResolver's operator-fix patch ───────────────────
    // This fires when the bug was found via import analysis (actual/expected present)
    if (bugLocation.actual !== undefined || bugLocation.expected !== undefined) {
        const sourcePatch = (0, sourceResolver_1.generateSourcePatch)({
            sourceFile: bugLocation.file,
            sourceFileFull: fullPath,
            line: bugLocation.line,
            lineContent: bugLocation.content.split('\n')[bugLocation.line - 1] ?? '',
            reason: bugLocation.reason,
            language: bugLocation.language,
            content: bugLocation.content,
            actual: bugLocation.actual,
            expected: bugLocation.expected,
        }, failures);
        if (sourcePatch) {
            return writePatchAndEmit(workspacePath, fullPath, bugLocation.file, sourcePatch.patchedContent, sourcePatch.diff, emit);
        }
    }
    // ── Strategy 2: Java null-dereference ─────────────────────────────────────
    if (bugLocation.language === 'java') {
        const result = tryJavaNullPatch(bugLocation, fullPath, workspacePath, emit);
        if (result)
            return result;
    }
    // ── Strategy 3: JS/TS null guard ─────────────────────────────────────────
    if (bugLocation.language === 'javascript' || bugLocation.language === 'typescript') {
        const result = tryJsNullPatch(bugLocation, fullPath, workspacePath, emit);
        if (result)
            return result;
    }
    // ── Strategy 4: Python None guard ─────────────────────────────────────────
    if (bugLocation.language === 'python') {
        const result = tryPythonNonePatch(bugLocation, fullPath, workspacePath, emit);
        if (result)
            return result;
    }
    emit({ type: 'INVESTIGATION_LOG', message: 'Could not automatically generate a targeted patch for this code.', level: 'warn' });
    return { success: false, error: 'No automatic patch could be generated for this pattern.' };
}
// ─── Strategy implementations ─────────────────────────────────────────────────
function tryJavaNullPatch(bugLocation, fullPath, workspacePath, emit) {
    const lines = bugLocation.content.split('\n');
    const bugLine = lines[bugLocation.line - 1] ?? '';
    const derefMatch = bugLine.match(/(\w+)\.(\w+)\(\)/);
    if (!derefMatch)
        return null;
    const varName = derefMatch[1];
    const indent = bugLine.match(/^(\s*)/)?.[1] ?? '';
    const newLines = [...lines];
    newLines.splice(bugLocation.line - 1, 0, `${indent}if (${varName} == null) {`, `${indent}    throw new IllegalStateException("${varName} must not be null");`, `${indent}}`);
    const patchedContent = newLines.join('\n');
    const diff = buildUnifiedDiff(bugLocation.file, bugLine, `${indent}if (${varName} == null) { throw ... }\n${bugLine}`, bugLocation.line);
    return writePatchAndEmit(workspacePath, fullPath, bugLocation.file, patchedContent, diff, emit);
}
function tryJsNullPatch(bugLocation, fullPath, workspacePath, emit) {
    const lines = bugLocation.content.split('\n');
    const bugLine = lines[bugLocation.line - 1] ?? '';
    const derefMatch = bugLine.match(/(\w+)\.(\w+)/);
    if (!derefMatch)
        return null;
    const varName = derefMatch[1];
    const indent = bugLine.match(/^(\s*)/)?.[1] ?? '';
    const newLines = [...lines];
    newLines.splice(bugLocation.line - 1, 0, `${indent}if (${varName} == null) { throw new Error('${varName} is null or undefined'); }`);
    const patchedContent = newLines.join('\n');
    const diff = buildUnifiedDiff(bugLocation.file, bugLine, `${indent}if (...) throw\n${bugLine}`, bugLocation.line);
    return writePatchAndEmit(workspacePath, fullPath, bugLocation.file, patchedContent, diff, emit);
}
function tryPythonNonePatch(bugLocation, fullPath, workspacePath, emit) {
    const lines = bugLocation.content.split('\n');
    const bugLine = lines[bugLocation.line - 1] ?? '';
    const indent = bugLine.match(/^(\s*)/)?.[1] ?? '';
    const derefMatch = bugLine.match(/(\w+)\.\w+/);
    if (!derefMatch)
        return null;
    const varName = derefMatch[1];
    const newLines = [...lines];
    newLines.splice(bugLocation.line - 1, 0, `${indent}if ${varName} is None:`, `${indent}    raise ValueError("${varName} must not be None")`);
    const patchedContent = newLines.join('\n');
    const diff = buildUnifiedDiff(bugLocation.file, bugLine, `${indent}if ${varName} is None: raise\n${bugLine}`, bugLocation.line);
    return writePatchAndEmit(workspacePath, fullPath, bugLocation.file, patchedContent, diff, emit);
}
// ─── Shared writer ─────────────────────────────────────────────────────────────
function writePatchAndEmit(workspacePath, fullPath, relFile, patchedContent, heuristicDiff, emit) {
    try {
        fs.writeFileSync(fullPath, patchedContent, 'utf-8');
    }
    catch (e) {
        return { success: false, error: `Failed to write patch: ${String(e)}` };
    }
    // Always prefer real git diff over our heuristic diff
    let diff = heuristicDiff;
    try {
        const gitDiff = (0, child_process_1.execSync)('git diff', { cwd: workspacePath }).toString();
        if (gitDiff.trim())
            diff = gitDiff;
    }
    catch { /* ok — workspace may not be a git repo */ }
    emit({ type: 'PATCH_PROPOSED', files: [relFile], diff });
    emit({ type: 'PATCH_APPLIED', files: [relFile] });
    return { success: true, diff, files: [relFile] };
}
function buildUnifiedDiff(file, oldLine, newLine, lineNo) {
    return [
        `--- a/${file}`,
        `+++ b/${file}`,
        `@@ -${lineNo},1 +${lineNo},1 @@`,
        `-${oldLine}`,
        `+${newLine}`,
    ].join('\n');
}
function applyDemoRepoPatch(workspacePath, targetFile, patchedContent, emit) {
    const fullPath = path.join(workspacePath, targetFile);
    try {
        fs.writeFileSync(fullPath, patchedContent, 'utf-8');
    }
    catch (e) {
        return { success: false, error: `Failed to write patch: ${String(e)}` };
    }
    let diff = '';
    try {
        diff = (0, child_process_1.execSync)('git diff', { cwd: workspacePath }).toString();
    }
    catch { /* ok */ }
    emit({ type: 'PATCH_PROPOSED', files: [targetFile], diff });
    emit({ type: 'PATCH_APPLIED', files: [targetFile] });
    return { success: true, diff, files: [targetFile] };
}
//# sourceMappingURL=patchService.js.map