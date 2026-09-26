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
exports.findBugLocation = findBugLocation;
exports.readFileForFrontend = readFileForFrontend;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sourceResolver_1 = require("./sourceResolver");
function findBugLocation(workspacePath, failures, extensions, emit) {
    // ── Pass 1: stack trace points directly at a non-test source file ──────────
    for (const failure of failures) {
        if (failure.file && failure.line && !isTestFile(failure.file)) {
            const found = resolveFile(workspacePath, failure.file);
            if (found) {
                const content = tryReadFile(found);
                if (content) {
                    const rel = path.relative(workspacePath, found).replace(/\\/g, '/');
                    const language = detectLanguage(found);
                    emit({ type: 'FILE_OPENED', file: rel, content, language });
                    return { file: rel, line: failure.line, reason: failure.error, content, language, fullPath: found };
                }
            }
        }
    }
    // ── Pass 2: stack trace points at a test file → follow imports ─────────────
    for (const failure of failures) {
        if (failure.file) {
            const testFileFull = resolveFile(workspacePath, failure.file);
            if (testFileFull && isTestFile(testFileFull)) {
                emit({ type: 'INVESTIGATION_LOG', message: `Stack trace points to test file ${path.basename(testFileFull)} — following imports to source...`, level: 'info' });
                const resolved = (0, sourceResolver_1.resolveSourceFromTest)(workspacePath, testFileFull, failures, emit);
                if (resolved) {
                    emit({ type: 'FILE_OPENED', file: resolved.sourceFile, content: resolved.content, language: resolved.language });
                    return {
                        file: resolved.sourceFile,
                        line: resolved.line,
                        reason: resolved.reason,
                        content: resolved.content,
                        language: resolved.language,
                        fullPath: resolved.sourceFileFull,
                        actual: resolved.actual,
                        expected: resolved.expected,
                    };
                }
            }
        }
    }
    // ── Pass 3: test name / error text contains a known class suffix ───────────
    for (const failure of failures) {
        const classNameMatch = failure.error.match(/(\w+(?:Service|Controller|Handler|Repository|Gateway|Manager))/);
        if (classNameMatch?.[1]) {
            const found = findFileByClass(workspacePath, classNameMatch[1], extensions);
            if (found) {
                const content = tryReadFile(found);
                if (content) {
                    const rel = path.relative(workspacePath, found).replace(/\\/g, '/');
                    const language = detectLanguage(found);
                    emit({ type: 'FILE_OPENED', file: rel, content, language });
                    emit({ type: 'INFERRED_CODE_PATH', description: `Identified ${rel} as likely bug location based on error message (INFERRED, not a runtime trace)` });
                    return { file: rel, line: 1, reason: failure.error, content, language, fullPath: found };
                }
            }
        }
    }
    // ── Pass 4: no file info at all — try test name → import resolution ────────
    for (const failure of failures) {
        // Find any test file in the repo that matches the test name
        const testFile = findTestFileByName(workspacePath, failure.test ?? '');
        if (testFile) {
            emit({ type: 'INVESTIGATION_LOG', message: `Located test file: ${path.relative(workspacePath, testFile).replace(/\\/g, '/')}`, level: 'info' });
            const resolved = (0, sourceResolver_1.resolveSourceFromTest)(workspacePath, testFile, failures, emit);
            if (resolved) {
                emit({ type: 'FILE_OPENED', file: resolved.sourceFile, content: resolved.content, language: resolved.language });
                return {
                    file: resolved.sourceFile,
                    line: resolved.line,
                    reason: resolved.reason,
                    content: resolved.content,
                    language: resolved.language,
                    fullPath: resolved.sourceFileFull,
                    actual: resolved.actual,
                    expected: resolved.expected,
                };
            }
        }
    }
    return null;
}
function readFileForFrontend(workspacePath, relativeFile, emit) {
    const full = path.join(workspacePath, relativeFile);
    const content = tryReadFile(full);
    if (content) {
        const language = detectLanguage(full);
        emit({ type: 'FILE_OPENED', file: relativeFile, content, language });
    }
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function isTestFile(filePath) {
    const norm = filePath.replace(/\\/g, '/');
    return (norm.includes('.test.') ||
        norm.includes('.spec.') ||
        norm.includes('__tests__') ||
        norm.includes('/test/') ||
        norm.endsWith('Test.java') ||
        norm.endsWith('Tests.java') ||
        norm.endsWith('Spec.java'));
}
function resolveFile(workspacePath, filename) {
    // Direct path
    const direct = path.join(workspacePath, filename);
    if (fs.existsSync(direct))
        return direct;
    // Search by basename (handles relative paths like "calculator.test.js:6")
    const base = path.basename(filename.split(':')[0] ?? filename);
    return findFileByName(workspacePath, base);
}
function findFileByName(dir, name) {
    const exclude = ['node_modules', '.git', 'target', 'dist', 'build', '__pycache__'];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (exclude.includes(entry.name))
                continue;
            const full = path.join(dir, entry.name);
            if (entry.isFile() && entry.name === name)
                return full;
            if (entry.isDirectory()) {
                const found = findFileByName(full, name);
                if (found)
                    return found;
            }
        }
    }
    catch { /* ok */ }
    return null;
}
function findFileByClass(workspacePath, className, extensions) {
    for (const ext of extensions) {
        const found = findFileByName(workspacePath, `${className}${ext}`);
        if (found)
            return found;
    }
    return null;
}
function findTestFileByName(workspacePath, testName) {
    if (!testName)
        return null;
    // Extract the first word (likely function/module name), search for matching test file
    const firstWord = testName.split(/\s+/)[0]?.toLowerCase() ?? '';
    const exclude = ['node_modules', '.git', 'target', 'dist', 'build', '__pycache__'];
    function walk(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (exclude.includes(entry.name))
                    continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    const r = walk(full);
                    if (r)
                        return r;
                }
                else if (isTestFile(entry.name)) {
                    const content = tryReadFile(full);
                    if (content && firstWord && content.toLowerCase().includes(firstWord))
                        return full;
                }
            }
        }
        catch { /* ok */ }
        return null;
    }
    return walk(workspacePath);
}
function tryReadFile(file) {
    try {
        const stat = fs.statSync(file);
        if (stat.size > 200_000)
            return null;
        return fs.readFileSync(file, 'utf-8');
    }
    catch {
        return null;
    }
}
function detectLanguage(file) {
    const ext = path.extname(file);
    const map = {
        '.java': 'java', '.ts': 'typescript', '.tsx': 'typescript',
        '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript',
        '.cjs': 'javascript', '.py': 'python', '.kt': 'kotlin',
        '.rb': 'ruby', '.go': 'go',
    };
    return map[ext] ?? 'plaintext';
}
//# sourceMappingURL=investigationService.js.map