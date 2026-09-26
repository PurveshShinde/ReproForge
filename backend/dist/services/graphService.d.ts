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
export declare function buildRepositoryGraph(workspacePath: string, extensions: string[], emit: (event: InvestigationEvent) => void, limit?: number): RepositoryGraph;
