import * as fs from 'fs';
import * as path from 'path';
import type { InvestigationEvent } from '../events/eventTypes';

export interface ProjectInfo {
  language: string;
  framework?: string;
  buildTool?: string;
  testCommand: string;
  testOutputParser: 'jest' | 'pytest' | 'maven' | 'gradle' | 'vitest' | 'unknown';
  sourceExtensions: string[];
}

export function detectProject(
  workspacePath: string,
  emit: (event: InvestigationEvent) => void
): ProjectInfo | null {
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
    const pkg = JSON.parse(fs.readFileSync(path.join(workspacePath, 'package.json'), 'utf-8')) as Record<string, unknown>;
    const deps = { ...(pkg['dependencies'] as Record<string, string> | undefined), ...(pkg['devDependencies'] as Record<string, string> | undefined) };
    const scripts = (pkg['scripts'] as Record<string, string> | undefined) ?? {};

    // Detect package manager
    let pm = 'npm';
    if (files.includes('pnpm-lock.yaml')) pm = 'pnpm';
    else if (files.includes('yarn.lock')) pm = 'yarn';

    // Detect test framework
    const hasVitest = 'vitest' in deps;
    const hasJest = 'jest' in deps;

    // Prefer the test script if it exists
    let testCommand = `${pm} run test`;
    let testOutputParser: ProjectInfo['testOutputParser'] = 'unknown';

    const testScript = scripts['test'] ?? '';
    if (hasVitest || testScript.includes('vitest')) {
      testOutputParser = 'vitest';
      testCommand = `${pm} run test`;
    } else if (hasJest || testScript.includes('jest')) {
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

function detectNodeFramework(deps: Record<string, string>): string | undefined {
  if ('express' in deps) return 'express';
  if ('fastify' in deps) return 'fastify';
  if ('koa' in deps) return 'koa';
  if ('next' in deps) return 'nextjs';
  if ('react' in deps) return 'react';
  if ('vue' in deps) return 'vue';
  if ('svelte' in deps) return 'svelte';
  return undefined;
}
