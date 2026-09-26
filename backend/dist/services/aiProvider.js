"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProvider = void 0;
class AIProvider {
    static async analyzeRootCauseAndPatch(context) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return AIProvider.mockAIPatch(context);
        }
        const prompt = `You are an automated debugging agent.
Analyze the following test failure and the provided source code, then determine the EXACT line number of the bug, the root cause, and generate a minimal patch.

TEST FAILURE:
${context.failingTest ? JSON.stringify(context.failingTest, null, 2) : 'N/A'}
ACTUAL: ${context.actualValue ?? 'N/A'}
EXPECTED: ${context.expectedValue ?? 'N/A'}

SOURCE CODE (${context.relevantSourceFiles?.[0] || 'Unknown'}):
${context.relevantSourceCode}

Respond EXACTLY in this JSON format, no markdown wrapping, no extra text:
{
  "file": "${context.relevantSourceFiles?.[0] || 'file.js'}",
  "line": <number>,
  "originalCode": "<exact string to replace>",
  "replacementCode": "<new string>",
  "explanation": "ROOT CAUSE: ...\\n\\nEvidence:\\n..."
}
`;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1 }
                })
            });
            if (!response.ok) {
                throw new Error(`AI API returned status ${response.status}`);
            }
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new Error('AI returned empty response');
            }
            const jsonStr = text.replace(/^\s*```json\s*/, '').replace(/\s*```\s*$/, '').trim();
            const result = JSON.parse(jsonStr);
            if (!result.originalCode || !result.replacementCode || !result.line) {
                throw new Error('AI missing fields');
            }
            return result;
        }
        catch (e) {
            throw new Error(`PATCH_GENERATION_FAILED: ${e.message}`);
        }
    }
    static mockAIPatch(context) {
        const code = context.relevantSourceCode || '';
        const file = context.relevantSourceFiles?.[0] || 'unknown';
        const actual = context.actualValue ?? '';
        const expected = context.expectedValue ?? '';
        const lines = code.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // ── Boolean: false returned where true expected ──────────────────────────
            if (expected === 'true' && actual === 'false') {
                if (/\bfalse\b/.test(line) && /\breturn\b/.test(line)) {
                    return { file, line: i + 1, originalCode: line, replacementCode: line.replace(/\bfalse\b/, 'true'), explanation: 'ROOT CAUSE: Function returned false but true was expected.' };
                }
            }
            // ── Undefined property: any delete/remove statement strips a field ───────
            if (actual === 'undefined' && expected !== '') {
                // Generic: any `delete obj.prop` line
                const deleteMatch = line.match(/(\bdelete\s+\w+\.\w+)/);
                if (deleteMatch) {
                    const indent = line.match(/^(\s*)/)?.[1] ?? '';
                    return { file, line: i + 1, originalCode: line, replacementCode: `${indent}// ${line.trimStart()}`, explanation: `ROOT CAUSE: Property deleted from response — receiver sees undefined.` };
                }
                // Generic: any `obj.prop = undefined` or removal pattern
                const undefAssign = line.match(/\.\w+\s*=\s*undefined/);
                if (undefAssign) {
                    const replacement = line.replace(/\.\w+\s*=\s*undefined/, '');
                    return { file, line: i + 1, originalCode: line, replacementCode: replacement, explanation: 'ROOT CAUSE: Field explicitly set to undefined.' };
                }
            }
            // ── HTTP routing: wrong status code (e.g. 404 instead of 200) ────────────
            if (actual === '404' && expected === '200') {
                // Wrong service name in routing assignment: targetService = 'wrong'
                const routeAssign = line.match(/(\w+)\s*=\s*['"](\w+)['"]/);
                if (routeAssign && /service|route|target|path|endpoint/i.test(line)) {
                    // Infer the correct service from the test name if available
                    const testName = context.failingTest?.test ?? '';
                    const serviceMatch = testName.match(/to\s+(\w+)\s+service/i);
                    const correctService = serviceMatch?.[1]?.toLowerCase() ?? '';
                    const currentValue = routeAssign[2];
                    if (correctService && currentValue.toLowerCase() !== correctService) {
                        const replacement = line.replace(`'${currentValue}'`, `'${correctService}'`).replace(`"${currentValue}"`, `"${correctService}"`);
                        return { file, line: i + 1, originalCode: line, replacementCode: replacement, explanation: `ROOT CAUSE: Router pointed at '${currentValue}' but should route to '${correctService}'.` };
                    }
                    // Fallback: comment out the suspicious line so router falls through
                    return { file, line: i + 1, originalCode: line, replacementCode: `// ${line.trimStart()}`, explanation: `ROOT CAUSE: Suspicious routing assignment causes wrong service to be selected.` };
                }
            }
            // ── Wrong arithmetic operator ─────────────────────────────────────────────
            const a = parseFloat(actual);
            const e = parseFloat(expected);
            if (!isNaN(a) && !isNaN(e) && /[+\-*/]/.test(line) && /\breturn\b|\bconst\b|\blet\b/.test(line)) {
                if (a > e && line.includes('+') && !line.includes('//')) {
                    return { file, line: i + 1, originalCode: line, replacementCode: line.replace('+', '*'), explanation: `ROOT CAUSE: Used + instead of *. Got ${a}, expected ${e}.` };
                }
                if (a !== e && line.includes('+') && !line.includes('//') && e === a - (a - e)) {
                    return { file, line: i + 1, originalCode: line, replacementCode: line.replace('+', '*'), explanation: `ROOT CAUSE: Wrong arithmetic operator.` };
                }
                if (line.includes('*') && !line.includes('//') && a > e) {
                    return { file, line: i + 1, originalCode: line, replacementCode: line.replace('*', '/'), explanation: `ROOT CAUSE: Used * instead of /. Got ${a}, expected ${e}.` };
                }
            }
        }
        throw new Error('PATCH_GENERATION_FAILED: Mock AI could not determine patch for this pattern. Add a GEMINI_API_KEY for full AI-powered analysis.');
    }
}
exports.AIProvider = AIProvider;
//# sourceMappingURL=aiProvider.js.map