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
exports.buildRepositoryGraph = buildRepositoryGraph;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function buildRepositoryGraph(workspacePath, extensions, emit, limit = 40) {
    const nodes = [];
    const edges = [];
    const seen = new Set();
    const allFiles = walkFiles(workspacePath, extensions, ['node_modules', '.git', 'target', 'dist', 'build', '__pycache__']);
    const selected = allFiles.slice(0, limit);
    for (const file of selected) {
        const rel = path.relative(workspacePath, file);
        const ext = path.extname(file);
        const base = path.basename(file, ext);
        emit({ type: 'FILE_DISCOVERED', file: rel, kind: 'source' });
        if (ext === '.java') {
            const content = tryReadFile(file);
            if (!content)
                continue;
            // Extract class/interface names
            const classMatches = content.matchAll(/(?:public\s+)?(?:class|interface|enum)\s+(\w+)/g);
            for (const m of classMatches) {
                const id = m[1] ?? base;
                if (!seen.has(id)) {
                    seen.add(id);
                    const kind = content.includes('interface') ? 'class' : 'class';
                    nodes.push({ id, label: id, kind, file: rel });
                    emit({ type: 'NODE_DISCOVERED', id, label: id, kind });
                }
            }
            // Extract extends/implements
            const inheritMatches = content.matchAll(/class\s+(\w+)\s+extends\s+(\w+)/g);
            for (const m of inheritMatches) {
                const src = m[1] ?? '';
                const tgt = m[2] ?? '';
                if (src && tgt) {
                    edges.push({ source: src, target: tgt, relation: 'extends' });
                    emit({ type: 'EDGE_DISCOVERED', source: src, target: tgt, relation: 'extends' });
                }
            }
            // Extract method calls (basic heuristic)
            const callMatches = content.matchAll(/this\.(\w+)\s*=/g);
            for (const m of callMatches) {
                const fieldType = m[1] ?? '';
                if (fieldType && seen.has(fieldType)) {
                    const classMatch = content.match(/class\s+(\w+)/);
                    if (classMatch?.[1]) {
                        edges.push({ source: classMatch[1], target: fieldType, relation: 'calls' });
                        emit({ type: 'EDGE_DISCOVERED', source: classMatch[1], target: fieldType, relation: 'calls' });
                    }
                }
            }
        }
        else if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            const content = tryReadFile(file);
            if (!content)
                continue;
            const nodeId = base;
            if (!seen.has(nodeId)) {
                seen.add(nodeId);
                const isTest = base.includes('.test') || base.includes('.spec') || rel.includes('__tests__');
                nodes.push({ id: nodeId, label: base, kind: isTest ? 'test' : 'module', file: rel });
                emit({ type: 'NODE_DISCOVERED', id: nodeId, label: base, kind: isTest ? 'test' : 'module' });
            }
            // imports
            const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
            for (const m of importMatches) {
                const imported = m[1] ?? '';
                if (imported.startsWith('.')) {
                    const importedBase = path.basename(imported).replace(/\.[^.]+$/, '');
                    if (importedBase && importedBase !== nodeId) {
                        edges.push({ source: nodeId, target: importedBase, relation: 'imports' });
                        emit({ type: 'EDGE_DISCOVERED', source: nodeId, target: importedBase, relation: 'imports' });
                    }
                }
            }
        }
        else if (ext === '.py') {
            const content = tryReadFile(file);
            if (!content)
                continue;
            const classMatches = content.matchAll(/^class\s+(\w+)/gm);
            for (const m of classMatches) {
                const id = m[1] ?? base;
                if (!seen.has(id)) {
                    seen.add(id);
                    nodes.push({ id, label: id, kind: 'class', file: rel });
                    emit({ type: 'NODE_DISCOVERED', id, label: id, kind: 'class' });
                }
            }
            // imports
            const importMatches = content.matchAll(/^(?:import|from)\s+(\w+)/gm);
            for (const m of importMatches) {
                const imported = m[1] ?? '';
                if (seen.has(imported)) {
                    edges.push({ source: base, target: imported, relation: 'imports' });
                    emit({ type: 'EDGE_DISCOVERED', source: base, target: imported, relation: 'imports' });
                }
            }
        }
    }
    return { nodes, edges };
}
function walkFiles(dir, extensions, exclude) {
    const results = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (exclude.includes(entry.name))
                continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...walkFiles(full, extensions, exclude));
            }
            else if (extensions.some(e => entry.name.endsWith(e))) {
                results.push(full);
            }
        }
    }
    catch { /* ok */ }
    return results;
}
function tryReadFile(file) {
    try {
        const stat = fs.statSync(file);
        if (stat.size > 500_000)
            return null; // skip huge files
        return fs.readFileSync(file, 'utf-8');
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=graphService.js.map