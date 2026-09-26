import * as fs from 'fs';
import * as path from 'path';
import type { InvestigationEvent } from '../events/eventTypes';

export interface GraphNode {
  id: string;
  label: string;
  kind: 'class' | 'function' | 'module' | 'file' | 'test' | 'unknown';
  file?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: 'calls' | 'imports' | 'extends' | 'implements' | 'tests';
}

export interface RepositoryGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function buildRepositoryGraph(
  workspacePath: string,
  extensions: string[],
  emit: (event: InvestigationEvent) => void,
  limit = 40
): RepositoryGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const allFiles = walkFiles(workspacePath, extensions, ['node_modules', '.git', 'target', 'dist', 'build', '__pycache__']);
  const selected = allFiles.slice(0, limit);

  for (const file of selected) {
    const rel = path.relative(workspacePath, file);
    const ext = path.extname(file);
    const base = path.basename(file, ext);

    emit({ type: 'FILE_DISCOVERED', file: rel, kind: 'source' });

    if (ext === '.java') {
      const content = tryReadFile(file);
      if (!content) continue;

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
    } else if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      const content = tryReadFile(file);
      if (!content) continue;

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
    } else if (ext === '.py') {
      const content = tryReadFile(file);
      if (!content) continue;

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

function walkFiles(dir: string, extensions: string[], exclude: string[]): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkFiles(full, extensions, exclude));
      } else if (extensions.some(e => entry.name.endsWith(e))) {
        results.push(full);
      }
    }
  } catch { /* ok */ }
  return results;
}

function tryReadFile(file: string): string | null {
  try {
    const stat = fs.statSync(file);
    if (stat.size > 500_000) return null; // skip huge files
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}
