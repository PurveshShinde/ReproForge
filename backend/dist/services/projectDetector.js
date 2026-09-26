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
exports.detectProject = detectProject;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function detectProject(workspacePath, emit) {
    const files = fs.readdirSync(workspacePath);
    // Java — Maven
    if (files.includes('pom.xml')) {
        emit({ type: 'PROJECT_DETECTED', language: 'java', buildTool: 'maven', testCommand: 'mvn test -B' });
        return {
            language: 'java',
            buildTool: 'maven',
            testCommand: 'mvn test -B',
            testOutputParser: 'maven',
            sourceExtensions: ['.java'],
        };
    }
    // Java — Gradle
    if (files.includes('gradlew') || files.includes('build.gradle') || files.includes('build.gradle.kts')) {
        const cmd = files.includes('gradlew') ? './gradlew test' : 'gradle test';
        emit({ type: 'PROJECT_DETECTED', language: 'java', buildTool: 'gradle', testCommand: cmd });
        return {
            language: 'java',
            buildTool: 'gradle',
            testCommand: cmd,
            testOutputParser: 'gradle',
            sourceExtensions: ['.java', '.kt'],
        };
    }
    // Node/TypeScript — check package.json
    if (files.includes('package.json')) {
        const pkg = JSON.parse(fs.readFileSync(path.join(workspacePath, 'package.json'), 'utf-8'));
        const deps = { ...pkg['dependencies'], ...pkg['devDependencies'] };
        const scripts = pkg['scripts'] ?? {};
        // Detect package manager
        let pm = 'npm';
        if (files.includes('pnpm-lock.yaml'))
            pm = 'pnpm';
        else if (files.includes('yarn.lock'))
            pm = 'yarn';
        // Detect test framework
        const hasVitest = 'vitest' in deps;
        const hasJest = 'jest' in deps;
        // Prefer the test script if it exists
        let testCommand = `${pm} run test`;
        let testOutputParser = 'unknown';
        const testScript = scripts['test'] ?? '';
        if (hasVitest || testScript.includes('vitest')) {
            testOutputParser = 'vitest';
            testCommand = `${pm} run test`;
        }
        else if (hasJest || testScript.includes('jest')) {
            testOutputParser = 'jest';
            testCommand = `${pm} test`;
        }
        const isTS = 'typescript' in deps || files.includes('tsconfig.json');
        const language = isTS ? 'typescript' : 'javascript';
        const framework = detectNodeFramework(deps);
        emit({ type: 'PROJECT_DETECTED', language, framework, buildTool: pm, testCommand });
        return {
            language,
            framework,
            buildTool: pm,
            testCommand,
            testOutputParser,
            sourceExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'],
        };
    }
    // Python
    const hasPytest = files.includes('pytest.ini') || files.includes('setup.cfg') || files.includes('pyproject.toml');
    const hasSetupPy = files.includes('setup.py');
    if (hasPytest || hasSetupPy || files.some(f => f.endsWith('.py'))) {
        const testCommand = hasPytest ? 'pytest -v' : 'python -m pytest -v';
        emit({ type: 'PROJECT_DETECTED', language: 'python', testCommand });
        return {
            language: 'python',
            testCommand,
            testOutputParser: 'pytest',
            sourceExtensions: ['.py'],
        };
    }
    emit({ type: 'INVESTIGATION_LOG', message: 'Could not confidently detect project type.', level: 'warn' });
    return null;
}
function detectNodeFramework(deps) {
    if ('express' in deps)
        return 'express';
    if ('fastify' in deps)
        return 'fastify';
    if ('koa' in deps)
        return 'koa';
    if ('next' in deps)
        return 'nextjs';
    if ('react' in deps)
        return 'react';
    if ('vue' in deps)
        return 'vue';
    if ('svelte' in deps)
        return 'svelte';
    return undefined;
}
//# sourceMappingURL=projectDetector.js.map