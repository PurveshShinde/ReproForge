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
exports.validateGitHubUrl = validateGitHubUrl;
exports.cloneRepository = cloneRepository;
exports.getGitLog = getGitLog;
exports.cleanupWorkspace = cleanupWorkspace;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function validateGitHubUrl(url) {
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
    }
    catch {
        return { valid: false, error: 'Invalid URL format.' };
    }
}
async function cloneRepository(url, emit) {
    // Sanitize: only allow the parsed URL, never user-supplied shell args
    const parsed = new URL(url);
    const cleanUrl = `https://github.com${parsed.pathname.replace(/\.git$/, '')}.git`;
    const workspaceBase = path.join(os.tmpdir(), 'reproforge');
    fs.mkdirSync(workspaceBase, { recursive: true });
    const workspacePath = fs.mkdtempSync(path.join(workspaceBase, 'repo-'));
    emit({ type: 'REPOSITORY_CLONING', repository: cleanUrl });
    emit({ type: 'INVESTIGATION_LOG', message: `Cloning ${cleanUrl} into isolated workspace...`, level: 'info' });
    await new Promise((resolve, reject) => {
        const proc = (0, child_process_1.spawn)('git', ['clone', '--depth=50', cleanUrl, workspacePath], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: '0',
                // Strip credentials from env to avoid leaking
                GIT_ASKPASS: 'echo',
            },
        });
        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Clone failed: ${stderr.trim()}`));
            }
            else {
                resolve();
            }
        });
        proc.on('error', reject);
    });
    // Get commit SHA
    let commit = 'unknown';
    let branch = 'unknown';
    try {
        commit = (0, child_process_1.execSync)('git rev-parse HEAD', { cwd: workspacePath }).toString().trim();
        branch = (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', { cwd: workspacePath }).toString().trim();
    }
    catch { /* ok */ }
    emit({ type: 'REPOSITORY_READY', commit, branch });
    emit({ type: 'INVESTIGATION_LOG', message: `Repository ready at commit ${commit.slice(0, 8)} (${branch})`, level: 'info' });
    return { workspacePath, commit, branch };
}
function getGitLog(workspacePath, maxEntries = 20) {
    try {
        const out = (0, child_process_1.execSync)(`git log --oneline -${maxEntries}`, { cwd: workspacePath }).toString().trim();
        return out.split('\n').filter(Boolean);
    }
    catch {
        return [];
    }
}
function cleanupWorkspace(workspacePath) {
    try {
        fs.rmSync(workspacePath, { recursive: true, force: true });
    }
    catch { /* ok */ }
}
//# sourceMappingURL=gitService.js.map