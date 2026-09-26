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
exports.resolveSourceFromTest = resolveSourceFromTest;
exports.generateSourcePatch = generateSourcePatch;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Given a failing test file, follow its imports to find the actual source file
 * containing the implementation under test. Works for JS/TS ES modules and CommonJS.
 */
function resolveSourceFromTest(workspacePath, testFilePath, // absolute path to the test file
failures, emit, depth = 0) {
    const testContent = tryReadFile(testFilePath);
    if (!testContent)
        return null;
    const testRel = path.relative(workspacePath, testFilePath).replace(/\\/g, '/');
    if (depth === 0)
        emit({ type: 'INVESTIGATION_LOG', message: `Following imports in ${testRel}...`, level: 'info' });
    // ── Extract assertion context from test output ────────────────────────────
    const assertionCtx = extractAssertionContext(failures);
    const testBasename = path.basename(testFilePath).replace(/\.(test|spec)\.(js|ts|jsx|tsx)$/i, '').toLowerCase();
    // ── Parse all local imports from the test file ───────────────────────────
    const imports = parseImports(testContent);
    if (depth === 0)
        emit({ type: 'INVESTIGATION_LOG', message: `Found ${imports.length} local import(s): ${imports.map(i => i.specifier).join(', ')}`, level: 'info' });
    const testDir = path.dirname(testFilePath);
    let bestFallback = null;
    let bestFallbackScore = -1;
    for (const imp of imports) {
        // Resolve the imported module to an actual file on disk
        const resolvedFull = resolveImportPath(testDir, imp.specifier, workspacePath);
        if (!resolvedFull)
            continue;
        const sourceContent = tryReadFile(resolvedFull);
        if (!sourceContent)
            continue;
        const sourceRel = path.relative(workspacePath, resolvedFull).replace(/\\/g, '/');
        emit({ type: 'FILE_DISCOVERED', file: sourceRel, kind: 'source' });
        emit({ type: 'EDGE_DISCOVERED', source: testRel, target: sourceRel, relation: 'imports' });
        emit({ type: 'INVESTIGATION_LOG', message: `Resolved import "${imp.specifier}" → ${sourceRel}`, level: 'info' });
        const sourceBasename = path.basename(resolvedFull).replace(/\.(js|ts|jsx|tsx)$/i, '').toLowerCase();
        // Score this file based on name match
        let fileScore = 0;
        if (sourceBasename === testBasename)
            fileScore = 100;
        else if (sourceBasename.includes(testBasename) || testBasename.includes(sourceBasename))
            fileScore = 50;
        // ── For each imported name, find and inspect the function body ──────────
        for (const importedName of imp.names) {
            if (depth === 0 && assertionCtx.calledFunction) {
                const fn = assertionCtx.calledFunction.toLowerCase();
                const name = importedName.toLowerCase();
                // Allow match if either string contains the other (covers "router" ↔ "routeRequest", "gateway" ↔ "forwardRequest", etc.)
                if (name !== fn && !name.includes(fn) && !fn.includes(name)) {
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
                const deeperBasename = path.basename(deeper.sourceFileFull).replace(/\.(js|ts|jsx|tsx)$/i, '').toLowerCase();
                let deeperScore = 0;
                if (deeperBasename === testBasename)
                    deeperScore = 100;
                else if (deeperBasename.includes(testBasename) || testBasename.includes(deeperBasename))
                    deeperScore = 50;
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
            const fallbackContent = sourceContent.split('\n')[fallbackLine - 1] ?? '';
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
}
function extractAssertionContext(failures) {
    const ctx = {};
    for (const f of failures) {
        // Use pre-parsed assertionDetail first ("20 !== 5")
        const detail = f.assertionDetail ?? f.error;
        const neqMatch = detail.match(/(\S+)\s*!==\s*(\S+)/);
        if (neqMatch) {
            ctx.actual = stripQuotes(neqMatch[1]);
            ctx.expected = stripQuotes(neqMatch[2]);
        }
        // "Expected values to be strictly equal: \n actual !== expected"
        const strictEqMatch = detail.match(/Expected values to be strictly equal:\s*\n\s*(\S+)\s*!==\s*(\S+)/s);
        if (strictEqMatch) {
            ctx.actual = stripQuotes(strictEqMatch[1]);
            ctx.expected = stripQuotes(strictEqMatch[2]);
        }
        // Extract function name from test name: "divide 10 by 2" → "divide"
        if (f.test) {
            const firstWord = f.test.split(/\s+/)[0]?.toLowerCase();
            if (firstWord && /^[a-z_$][a-zA-Z0-9_$]*$/.test(firstWord)) {
                ctx.calledFunction = firstWord;
            }
        }
    }
    return ctx;
}
function parseImports(content) {
    const results = [];
    const seen = new Set();
    // ES module: import { foo, bar } from "./mod.js"
    const namedImport = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
    let m;
    while ((m = namedImport.exec(content)) !== null) {
        const specifier = m[2] ?? '';
        if (!isLocalSpecifier(specifier))
            continue;
        const names = m[1].split(',').map(n => n.trim().split(/\s+as\s+/).pop().trim()).filter(Boolean);
        const key = specifier;
        if (!seen.has(key)) {
            seen.add(key);
            results.push({ specifier, names });
        }
    }
    // ES module: import defaultName from "./mod.js"
    const defaultImport = /import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+['"]([^'"]+)['"]/g;
    while ((m = defaultImport.exec(content)) !== null) {
        const specifier = m[2] ?? '';
        if (!isLocalSpecifier(specifier))
            continue;
        const name = m[1] ?? '';
        if (!seen.has(specifier)) {
            seen.add(specifier);
            results.push({ specifier, names: [name] });
        }
    }
    // ES module: import * as ns from "./mod.js"
    const namespaceImport = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
    while ((m = namespaceImport.exec(content)) !== null) {
        const specifier = m[2] ?? '';
        if (!isLocalSpecifier(specifier))
            continue;
        if (!seen.has(specifier)) {
            seen.add(specifier);
            results.push({ specifier, names: [m[1] ?? ''] });
        }
    }
    // CJS: const { foo } = require("./mod")
    const cjsNamed = /(?:const|let|var)\s+\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    while ((m = cjsNamed.exec(content)) !== null) {
        const specifier = m[2] ?? '';
        if (!isLocalSpecifier(specifier))
            continue;
        const names = m[1].split(',').map(n => n.trim().split(/\s+as\s+/).pop().trim()).filter(Boolean);
        if (!seen.has(specifier)) {
            seen.add(specifier);
            results.push({ specifier, names });
        }
    }
    // CJS: const foo = require("./mod")
    const cjsDefault = /(?:const|let|var)\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    while ((m = cjsDefault.exec(content)) !== null) {
        const specifier = m[2] ?? '';
        if (!isLocalSpecifier(specifier))
            continue;
        if (!seen.has(specifier)) {
            seen.add(specifier);
            results.push({ specifier, names: [m[1] ?? ''] });
        }
    }
    return results;
}
function isLocalSpecifier(spec) {
    return spec.startsWith('./') || spec.startsWith('../');
}
// ─── Import path resolver ──────────────────────────────────────────────────────
function resolveImportPath(fromDir, specifier, workspacePath) {
    // Strip query string / hash
    const bare = specifier.split('?')[0].split('#')[0];
    const candidate = path.resolve(fromDir, bare);
    // If the specifier already has an extension and the file exists, use it
    if (path.extname(candidate) && fs.existsSync(candidate))
        return candidate;
    // Try common extensions
    const extensions = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.tsx', '.jsx'];
    for (const ext of extensions) {
        const full = candidate.endsWith(ext) ? candidate : candidate + ext;
        if (fs.existsSync(full))
            return full;
    }
    // Try index files
    for (const ext of extensions) {
        const full = path.join(candidate, `index${ext}`);
        if (fs.existsSync(full))
            return full;
    }
    // Must stay inside the workspace
    const resolved = path.resolve(fromDir, bare);
    if (!resolved.startsWith(workspacePath))
        return null;
    return null;
}
function findBugInFunction(content, funcName, ctx) {
    const lines = content.split('\n');
    const funcLine = findFunctionLine(content, funcName);
    if (funcLine === null)
        return null;
    // Collect the function body (up to the closing brace or 30 lines)
    const bodyLines = collectFunctionBody(lines, funcLine - 1);
    // ── Heuristic: wrong operator ──────────────────────────────────────────────
    // If actual > expected and we see multiplication instead of division
    if (ctx.actual !== undefined && ctx.expected !== undefined) {
        const actual = parseFloat(ctx.actual);
        const expected = parseFloat(ctx.expected);
        for (const { idx, text } of bodyLines) {
            // division expected but multiplication found
            if (!isNaN(actual) && !isNaN(expected) && actual === expected * (actual / expected)) {
                if (/\*/.test(text) && actual !== 0 && expected !== 0 && actual / expected === actual / expected) {
                    // actual = a * b, expected = a / b → multiply bug
                    if (actual > expected || actual < expected) {
                        return {
                            line: idx + 1,
                            lineContent: text,
                            reason: buildWrongOperatorReason(funcName, text, ctx, '* instead of /', '÷'),
                        };
                    }
                }
            }
            // subtraction expected but addition
            if (/\+/.test(text) && !isNaN(actual) && !isNaN(expected) && actual > expected) {
                return { line: idx + 1, lineContent: text, reason: buildWrongOperatorReason(funcName, text, ctx, '+ instead of -', '-') };
            }
            // addition expected but subtraction
            if (/-/.test(text) && !isNaN(actual) && !isNaN(expected) && actual < expected) {
                return { line: idx + 1, lineContent: text, reason: buildWrongOperatorReason(funcName, text, ctx, '- instead of +', '+') };
            }
        }
    }
    // ── Heuristic: Missing properties (undefined actual) ───────────────────────
    if (ctx.actual === 'undefined' && ctx.expected !== undefined) {
        for (const { idx, text } of bodyLines) {
            if (/\b(?:delete|remove)\b/.test(text)) {
                return { line: idx + 1, lineContent: text, reason: `Suspicious property removal found: \`${text.trim()}\`` };
            }
        }
    }
    // ── Heuristic: Routing mismatch (404 actual, 200 expected) ─────────────────
    if (ctx.actual === '404' && ctx.expected === '200') {
        for (const { idx, text } of bodyLines) {
            if (/\b(?:req\.path|url|targetService)\b/.test(text) && /['"]/.test(text)) {
                return { line: idx + 1, lineContent: text, reason: `Suspicious routing logic found: \`${text.trim()}\`` };
            }
        }
    }
    // ── Heuristic: any return-with-operator line ───────────────────────────────
    for (const { idx, text } of bodyLines) {
        if (/\breturn\b/.test(text) && /[+\-*/]/.test(text)) {
            const reason = ctx.actual && ctx.expected
                ? `${funcName}() returns ${ctx.actual} but expected ${ctx.expected}. Implementation: \`${text.trim()}\``
                : `Suspicious return statement in ${funcName}(): \`${text.trim()}\``;
            return { line: idx + 1, lineContent: text, reason };
        }
    }
    // ── Fallback: first line of body ──────────────────────────────────────────
    const first = bodyLines[0];
    if (first) {
        return {
            line: first.idx + 1,
            lineContent: first.text,
            reason: `Test failure traced to ${funcName}() starting at this line`,
        };
    }
    return null;
}
function buildWrongOperatorReason(funcName, lineContent, ctx, wrongOp, _correctOp) {
    const parts = [`${funcName}() uses ${wrongOp}.`];
    if (ctx.actual !== undefined && ctx.expected !== undefined) {
        parts.push(`Expected result: ${ctx.expected}, actual result: ${ctx.actual}.`);
    }
    parts.push(`Implementation: \`${lineContent.trim()}\``);
    return parts.join(' ');
}
function findFunctionLine(content, name) {
    if (!name)
        return null;
    const lines = content.split('\n');
    // Various patterns: function foo, const foo =, foo(, export function foo
    const patterns = [
        new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${escapeRe(name)}\\s*\\(`),
        new RegExp(`(?:const|let|var)\\s+${escapeRe(name)}\\s*=\\s*(?:async\\s+)?(?:function|\\(|[A-Za-z_$])`),
        new RegExp(`${escapeRe(name)}\\s*(?:=\\s*)?\\(.*\\)\\s*(?:=>|\\{)`),
        // class method
        new RegExp(`^\\s*(?:async\\s+)?${escapeRe(name)}\\s*\\(`),
    ];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        for (const pat of patterns) {
            if (pat.test(line))
                return i + 1;
        }
    }
    return null;
}
function collectFunctionBody(lines, startIdx) {
    const result = [];
    let depth = 0;
    let inBody = false;
    for (let i = startIdx; i < Math.min(lines.length, startIdx + 60); i++) {
        const line = lines[i] ?? '';
        for (const ch of line) {
            if (ch === '{') {
                depth++;
                inBody = true;
            }
            if (ch === '}')
                depth--;
        }
        if (inBody)
            result.push({ idx: i, text: line });
        if (inBody && depth === 0)
            break;
    }
    return result;
}
function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** Strip surrounding single or double quotes from a captured assertion value. */
function stripQuotes(s) {
    return s.replace(/^(['"])(.*)\1$/, '$2');
}
/**
 * Generates the minimal fix for a wrong-operator bug discovered via import analysis.
 * Returns the patched content and a unified-diff-style string.
 */
function generateSourcePatch(location, _failures) {
    const lines = location.content.split('\n');
    const bugLine = lines[location.line - 1] ?? '';
    // Determine the fix: look for wrong operator in the return statement
    const fixed = applyOperatorFix(bugLine, location.actual, location.expected);
    if (!fixed || fixed === bugLine)
        return null;
    const newLines = [...lines];
    newLines[location.line - 1] = fixed;
    const patchedContent = newLines.join('\n');
    const diff = buildUnifiedDiff(location.sourceFile, bugLine, fixed, location.line);
    return { patchedContent, diff };
}
function applyOperatorFix(line, actual, expected) {
    const a = actual !== undefined ? parseFloat(actual) : NaN;
    const e = expected !== undefined ? parseFloat(expected) : NaN;
    // multiply → divide: actual is larger and a*b = actual while a/b = expected
    if (!isNaN(a) && !isNaN(e) && /\*/.test(line) && a !== e) {
        // Most common: divide function uses * instead of /
        if (line.includes('*') && !line.includes('/') && !line.includes('//')) {
            return line.replace(/\*/g, '/');
        }
    }
    // subtract → add
    if (!isNaN(a) && !isNaN(e) && a < e && /return\s.+-/.test(line)) {
        return line.replace(/-(?!=)/, '+');
    }
    // add → subtract
    if (!isNaN(a) && !isNaN(e) && a > e && /return\s.*\+/.test(line)) {
        return line.replace(/\+/, '-');
    }
    // Generic: replace first arithmetic operator with the correct one
    // Try all operators
    if (!isNaN(a) && !isNaN(e)) {
        for (const [wrong, right] of [['+', '-'], ['-', '+'], ['*', '/'], ['/', '*']]) {
            if (line.includes(wrong)) {
                const candidate = line.replace(wrong, right);
                // we can't evaluate without knowing the arguments, so trust the operator-swap heuristic
                if (candidate !== line)
                    return candidate;
            }
        }
    }
    return null;
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
// ─── Utilities ─────────────────────────────────────────────────────────────────
function tryReadFile(file) {
    try {
        const stat = fs.statSync(file);
        if (stat.size > 300_000)
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
//# sourceMappingURL=sourceResolver.js.map