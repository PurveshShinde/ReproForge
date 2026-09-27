import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { InvestigationEvent } from '../events/eventTypes';

export interface CloneResult {
  workspacePath: string;
  commit: string;
  branch: string;
}

export function validateGitHubUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'github.com') {
      return { valid: false, error: 'Only github.com repositories are supported.' };
    }
    const parts = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      return { valid: false, error: 'URL must be in the form https://github.com/owner/repo' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }
}

export async function cloneRepository(
  url: string,
  emit: (event: InvestigationEvent) => void
): Promise<CloneResult> {
  // Sanitize: only allow the parsed URL, never user-supplied shell args
  const parsed = new URL(url);
  const cleanUrl = `https://github.com${parsed.pathname.replace(/\.git$/, '')}.git`;

  // Clean up any stale workspaces older than 10 minutes before cloning
  pruneStaleWorkspaces();

  const workspaceBase = path.join(os.tmpdir(), 'reproforge');
  fs.mkdirSync(workspaceBase, { recursive: true });
  const workspacePath = fs.mkdtempSync(path.join(workspaceBase, 'repo-'));

  emit({ type: 'REPOSITORY_CLONING', repository: cleanUrl });
  emit({ type: 'INVESTIGATION_LOG', message: `Cloning ${cleanUrl} into isolated workspace...`, level: 'info' });

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('git', ['clone', '--depth=50', cleanUrl, workspacePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        // Strip credentials from env to avoid leaking
        GIT_ASKPASS: 'echo',
      },
    });

    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Clone failed: ${stderr.trim()}`));
      } else {
        resolve();
      }
    });
    proc.on('error', reject);
  });

  // Get commit SHA
  let commit = 'unknown';
  let branch = 'unknown';
  try {
    commit = execSync('git rev-parse HEAD', { cwd: workspacePath }).toString().trim();
    branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: workspacePath }).toString().trim();
  } catch { /* ok */ }

  emit({ type: 'REPOSITORY_READY', commit, branch });
  emit({ type: 'INVESTIGATION_LOG', message: `Repository ready at commit ${commit.slice(0, 8)} (${branch})`, level: 'info' });

  return { workspacePath, commit, branch };
}

export function getGitLog(workspacePath: string, maxEntries = 20): string[] {
  try {
    const out = execSync(
      `git log --oneline -${maxEntries}`,
      { cwd: workspacePath }
    ).toString().trim();
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function cleanupWorkspace(workspacePath: string): void {
  try {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  } catch { /* ok */ }
}

/**
 * Prune workspace folders older than maxAgeMs (default: 10 minutes)
 * to prevent disk exhaustion on shared hosting like Render.
 */
export function pruneStaleWorkspaces(maxAgeMs = 10 * 60 * 1000): void {
  const workspaceBase = path.join(os.tmpdir(), 'reproforge');
  if (!fs.existsSync(workspaceBase)) return;

  try {
    const entries = fs.readdirSync(workspaceBase);
    const now = Date.now();
    for (const entry of entries) {
      const fullPath = path.join(workspaceBase, entry);
      try {
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      } catch { /* ok */ }
    }
  } catch { /* ok */ }
}
