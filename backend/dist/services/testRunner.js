"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const child_process_1 = require("child_process");
const SAFE_COMMANDS = {
    'mvn test -B': ['mvn', ['test', '-B']],
    './gradlew test': ['./gradlew', ['test']],
    'gradle test': ['gradle', ['test']],
    'npm test': ['npm', ['test', '--', '--forceExit']],
    'npm run test': ['npm', ['run', 'test']],
    'pnpm test': ['pnpm', ['test']],
    'pnpm run test': ['pnpm', ['run', 'test']],
    'yarn test': ['yarn', ['test']],
    'pytest -v': ['pytest', ['-v', '--tb=short']],
    'python -m pytest -v': ['python', ['-m', 'pytest', '-v', '--tb=short']],
};
async function runTests(workspacePath, projectInfo, emit) {
    const cmd = projectInfo.testCommand;
    let executable = '';
    let args = [];
    const safeEntry = SAFE_COMMANDS[cmd];
    if (safeEntry) {
        [executable, args] = safeEntry;
    }
    else if (cmd.startsWith('mvn test -Dtest=')) {
        executable = 'mvn';
        args = ['test', cmd.substring('mvn test '.length)];
    }
    else {
        emit({ type: 'INVESTIGATION_LOG', message: `Test command "${cmd}" is not in the safe list, skipping.`, level: 'warn' });
        return { exitCode: -1, output: 'Test command not allowed.', failures: [], passed: 0, failed: 0, duration: 0, status: 'ENVIRONMENT_FAILED', testsRun: 0, errors: 0, skipped: 0 };
    }
    emit({ type: 'TEST_STARTED', command: cmd });
    emit({ type: 'INVESTIGATION_LOG', message: `Running: ${cmd}`, level: 'info' });
    const startTime = Date.now();
    let output = '';
    const exitCode = await new Promise((resolve) => {
        const proc = (0, child_process_1.spawn)(executable, args, {
            cwd: workspacePath,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32',
            env: {
                ...process.env,
                CI: '1',
                TERM: 'dumb',
            },
        });
        const onData = (data) => {
            const chunk = data.toString();
            output += chunk;
            // Stream lines to frontend
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    emit({ type: 'TEST_OUTPUT', output: line });
                }
            }
        };
        proc.stdout?.on('data', onData);
        proc.stderr?.on('data', onData);
        proc.on('close', (code) => resolve(code ?? 1));
        proc.on('error', (err) => {
            output += `\nError executing command: ${err.message}\n`;
            resolve(1);
        });
    });
    const duration = Date.now() - startTime;
    const parsed = parseFailures(output, projectInfo.testOutputParser);
    let status = exitCode === 0 ? 'PASSED' : 'FAILED';
    if (exitCode !== 0) {
        if (output.includes('Compilation failure') || output.includes('compilation error')) {
            status = 'BUILD_FAILED';
        }
        else if (output.includes('command not found') || output.includes('No such file or directory') || output.includes('Could not resolve dependencies') || output.includes('wrong Java version') || output.includes('Error executing command')) {
            status = 'ENVIRONMENT_FAILED';
        }
        else if (parsed.testsRun === 0 && parsed.failures.length === 0) {
            status = 'NO_TESTS_FOUND';
        }
    }
    return {
        exitCode,
        output,
        failures: parsed.failures,
        passed: Math.max(0, parsed.testsRun - parsed.failures.length - parsed.errors - parsed.skipped),
        failed: parsed.failures.length + parsed.errors,
        duration,
        status,
        testsRun: parsed.testsRun,
        errors: parsed.errors,
        skipped: parsed.skipped
    };
}
function parseFailures(output, parser) {
    const failures = [];
    let testsRun = 0;
    let errors = 0;
    let skipped = 0;
    if (parser === 'jest' || parser === 'vitest') {
        // Match: ● TestName > should do something
        const jestPattern = /● (.+?)\n[\s\S]*?expect\((.|\n)*?at (.+?):(\d+)/gm;
        let m;
        while ((m = jestPattern.exec(output)) !== null) {
            failures.push({ test: m[1]?.trim(), error: `Assertion failed`, file: m[3]?.trim(), line: m[4] ? parseInt(m[4]) : undefined });
        }
        // Fallback: look for FAIL lines
        const failLinePattern = /FAIL\s+(\S+)/g;
        while ((m = failLinePattern.exec(output)) !== null) {
            if (!failures.length)
                failures.push({ error: `Tests failed in ${m[1]}`, file: m[1]?.trim() });
        }
        // Error patterns
        const errorPattern = /Error: (.+)/g;
        while ((m = errorPattern.exec(output)) !== null) {
            if (!failures.some(f => f.error === m[1]?.trim())) {
                failures.push({ error: m[1]?.trim() ?? 'Error' });
            }
        }
    }
    if (parser === 'maven' || parser === 'gradle') {
        // Match: java.lang.XException: message at Class.method(File.java:line)
        const javaPattern = /([\w.]+Exception|[\w.]+Error): (.+?)\n[\s\S]*?at ([\w.]+)\((\w+\.java):(\d+)\)/gm;
        let m;
        while ((m = javaPattern.exec(output)) !== null) {
            failures.push({
                test: m[1] ?? undefined,
                error: `${m[1]}: ${m[2]}`.trim(),
                file: m[4] ?? undefined,
                line: m[5] ? parseInt(m[5]) : undefined,
            });
            if (failures.length >= 10)
                break; // limit
        }
        // FAILED: tests
        // Format: Tests run: 1, Failures: 1, Errors: 0, Skipped: 0
        const failPattern = /Tests run: (\d+), Failures: (\d+), Errors: (\d+)(?:, Skipped: (\d+))?/g;
        let fm;
        while ((fm = failPattern.exec(output)) !== null) {
            testsRun += parseInt(fm[1] ?? '0');
            const f = parseInt(fm[2] ?? '0');
            const e = parseInt(fm[3] ?? '0');
            skipped += parseInt(fm[4] ?? '0');
            errors += e;
            if ((f + e > 0) && failures.length === 0) {
                failures.push({ error: `${f} failures, ${e} errors in test run` });
            }
        }
    }
    if (parser === 'pytest') {
        const pyPattern = /FAILED (.+?) - (.+)/g;
        let m;
        while ((m = pyPattern.exec(output)) !== null) {
            failures.push({ test: m[1]?.trim(), error: m[2]?.trim() ?? 'Test failed' });
        }
        const errorPattern = /E\s+([\w.]+Error|[\w.]+Exception): (.+)/g;
        while ((m = errorPattern.exec(output)) !== null) {
            if (!failures.some(f => f.error.includes(m[2]?.trim() ?? ''))) {
                failures.push({ error: `${m[1]}: ${m[2]}`.trim() });
            }
        }
    }
    if (parser === 'unknown') {
        // ── Node built-in test runner (node:test) ──────────────────────────────
        // Failing block looks like:
        //   ✖ divide 10 by 2 (1.44ms)
        //   ...
        //   AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
        //   20 !== 5
        //       at TestContext.<anonymous> (file:///...calculator.test.js:6:10)
        //
        // Also: "test at calculator.test.js:5:1"  (locates the test declaration)
        // And the "✖ failing tests:" section re-lists them.
        let m;
        // Parse each "✖ testName" occurrence and enrich with assertion data below
        const nodeFailPattern = /✖ (.+?) \(/g;
        while ((m = nodeFailPattern.exec(output)) !== null) {
            const testName = m[1]?.trim() ?? '';
            if (!failures.some(f => f.test === testName)) {
                failures.push({ test: testName, error: 'Test failed' });
            }
        }
        // Enrich failures with assertion detail and file/line
        // AssertionError block: "20 !== 5\n\n    at ... (file:///...foo.test.js:6:10)"
        const assertionBlockPattern = /AssertionError[^\n]*\n\s*([\s\S]+?)\n\s+at\s+\S+\s+\((?:file:\/\/\/)?([^)]+?):(\d+):\d+\)/g;
        while ((m = assertionBlockPattern.exec(output)) !== null) {
            const detail = m[1]?.trim() ?? '';
            const rawFile = m[2]?.trim() ?? '';
            const lineNo = parseInt(m[3] ?? '0', 10);
            // rawFile may be an absolute path — basename is enough for resolution
            const fileBase = rawFile.split(/[\\/]/).pop() ?? rawFile;
            if (failures.length > 0) {
                const last = failures[failures.length - 1];
                if (detail)
                    last.assertionDetail = detail;
                if (detail && !last.error.includes('!=='))
                    last.error = detail;
                if (fileBase)
                    last.file = fileBase;
                if (lineNo > 0)
                    last.line = lineNo;
            }
            else {
                failures.push({ error: detail || 'AssertionError', file: fileBase || undefined, line: lineNo || undefined, assertionDetail: detail || undefined });
            }
        }
        // Simpler "20 !== 5" pattern (Node test runner summary line)
        const neqPattern = /^\s*(\S+)\s*!==\s*(\S+)\s*$/gm;
        while ((m = neqPattern.exec(output)) !== null) {
            const detail = `${m[1]} !== ${m[2]}`;
            for (const f of failures) {
                if (!f.assertionDetail) {
                    f.assertionDetail = detail;
                    f.error = detail;
                }
            }
        }
        // "test at calculator.test.js:5:1" — gives us the test file location
        const testAtPattern = /test at ([^:]+):(\d+):\d+/g;
        while ((m = testAtPattern.exec(output)) !== null) {
            const fileBase = m[1]?.trim().split(/[\\/]/).pop() ?? '';
            const lineNo = parseInt(m[2] ?? '0', 10);
            for (const f of failures) {
                if (!f.file && fileBase)
                    f.file = fileBase;
                if (!f.line && lineNo > 0)
                    f.line = lineNo;
            }
        }
        // TAP fallback: "not ok N - testname"
        const tapFailPattern = /not ok \d+ - (.+)/g;
        while ((m = tapFailPattern.exec(output)) !== null) {
            const testName = m[1]?.trim() ?? '';
            if (!failures.some(f => f.test === testName)) {
                failures.push({ test: testName, error: 'Test failed' });
            }
        }
        // Count passing tests
        const tapOkPattern = /^ok \d+ /gm;
        const nodeOkPattern = /✔ (.+?) \(/g;
        testsRun = (output.match(tapOkPattern)?.length ?? 0) +
            (output.match(nodeOkPattern)?.length ?? 0) +
            failures.length;
        // Node summary: "ℹ fail N"
        const nodeFailCountPattern = /ℹ fail (\d+)/;
        const nodePassCountPattern = /ℹ pass (\d+)/;
        const fcm = nodeFailCountPattern.exec(output);
        const pcm = nodePassCountPattern.exec(output);
        if (fcm || pcm) {
            const fc = fcm ? parseInt(fcm[1] ?? '0', 10) : 0;
            const pc = pcm ? parseInt(pcm[1] ?? '0', 10) : 0;
            testsRun = fc + pc;
            errors = fc;
        }
    }
    return { failures, testsRun, errors, skipped };
}
//# sourceMappingURL=testRunner.js.map