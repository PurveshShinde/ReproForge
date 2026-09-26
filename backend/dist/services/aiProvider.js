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
        const lines = code.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (context.expectedValue === 'true' && context.actualValue === 'false') {
                if (line.includes("return { authenticated: false, error: 'Token expired' };")) {
                    return { file, line: i + 1, originalCode: line, replacementCode: line.replace('false', 'true').replace(", error: 'Token expired'", ""), explanation: 'ROOT CAUSE: Valid token returned false.' };
                }
            }
            if (context.actualValue === 'undefined') {
                if (line.includes('delete data.id;')) {
                    return { file, line: i + 1, originalCode: line, replacementCode: line.replace('delete data.id;', '// delete data.id;'), explanation: 'ROOT CAUSE: ID field stripped from response.' };
                }
            }
            if (context.expectedValue === '200' && context.actualValue === '404') {
                if (line.includes("targetService = 'users';")) {
                    return { file, line: i + 1, originalCode: line, replacementCode: line.replace("'users'", "'orders'"), explanation: 'ROOT CAUSE: Routing redirected to wrong service.' };
                }
            }
            if (context.expectedValue === '100' && context.actualValue === '52') {
                if (line.includes("const total = quantity + price;")) {
                    return { file, line: i + 1, originalCode: line, replacementCode: line.replace('+', '*'), explanation: 'ROOT CAUSE: Wrong math operator.' };
                }
            }
        }
        throw new Error('PATCH_GENERATION_FAILED: Mock AI could not determine patch.');
    }
}
exports.AIProvider = AIProvider;
//# sourceMappingURL=aiProvider.js.map