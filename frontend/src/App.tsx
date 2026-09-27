import { useState, useEffect, useRef, useCallback } from 'react';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import Editor from '@monaco-editor/react';
import { Play, Activity, Code2, GitCommit, Search, ShieldCheck, TerminalSquare, GitBranch, ChevronRight, AlertCircle, CheckCircle2, Loader2, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

// ─── SHARED TYPES ────────────────────────────────────────────────────────────

type AgentState = 'waiting' | 'working' | 'done' | 'error';

interface AgentsMap {
  code: AgentState;
  history: AgentState;
  test: AgentState;
  reproduce: AgentState;
  fix: AgentState;
  verification: AgentState;
}

// ─── DEMO MODE DATA ───────────────────────────────────────────────────────────

const DEMO_NODES: Node[] = [
  { id: '1', position: { x: 250, y: 50 }, data: { label: 'Controller' }, style: { backgroundColor: '#1f2937', color: '#f3f4f6', border: '1px solid #374151', borderRadius: '8px', padding: '10px' } },
  { id: '2', position: { x: 250, y: 150 }, data: { label: 'CheckoutService' }, style: { backgroundColor: '#1f2937', color: '#f3f4f6', border: '1px solid #374151', borderRadius: '8px', padding: '10px' } },
  { id: '3', position: { x: 150, y: 250 }, data: { label: 'PaymentService' }, style: { backgroundColor: '#1f2937', color: '#f3f4f6', border: '1px solid #374151', borderRadius: '8px', padding: '10px' } },
  { id: '4', position: { x: 350, y: 250 }, data: { label: 'OrderService' }, style: { backgroundColor: '#1f2937', color: '#f3f4f6', border: '1px solid #374151', borderRadius: '8px', padding: '10px' } },
  { id: '5', position: { x: 150, y: 350 }, data: { label: 'PaymentGateway' }, style: { backgroundColor: '#1f2937', color: '#f3f4f6', border: '1px solid #374151', borderRadius: '8px', padding: '10px' } },
];

const DEMO_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' }, style: { stroke: '#4b5563' } },
  { id: 'e2-3', source: '2', target: '3', markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' }, style: { stroke: '#4b5563' } },
  { id: 'e2-4', source: '2', target: '4', markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' }, style: { stroke: '#4b5563' } },
  { id: 'e3-5', source: '3', target: '5', markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' }, style: { stroke: '#4b5563' } },
];

const MOCK_CODE_BEFORE = `public class PaymentService {
    private final PaymentGateway gateway;
    
    public PaymentService(PaymentGateway gateway) {
        this.gateway = gateway;
    }

    public PaymentStatus processPayment(PaymentRequest request) {
        PaymentResponse response = gateway.pay(request);
        
        // BUG: response can be null when gateway times out
        return response.getStatus();
    }
}`;

const MOCK_CODE_AFTER = `public class PaymentService {
    private final PaymentGateway gateway;
    
    public PaymentService(PaymentGateway gateway) {
        this.gateway = gateway;
    }

    public PaymentStatus processPayment(PaymentRequest request) {
        PaymentResponse response = gateway.pay(request);
        
        if (response == null) {
            return PaymentStatus.FAILED;
        }
        
        return response.getStatus();
    }
}`;

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function AgentRow({ name, icon, state }: { name: string; icon: React.ReactNode; state: AgentState }) {
  return (
    <div className="flex items-center justify-between bg-[#111827] p-2 rounded border border-gray-800">
      <div className="flex items-center gap-2">
        <span className="text-gray-400">{icon}</span>
        <span className="text-sm font-medium text-gray-300">{name}</span>
      </div>
      <div className="text-xs font-medium">
        {state === 'waiting' && <span className="text-gray-500">Waiting</span>}
        {state === 'working' && <span className="text-blue-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping inline-block"></span>Active</span>}
        {state === 'done' && <span className="text-green-400">✓ Done</span>}
        {state === 'error' && <span className="text-red-400">✗ Error</span>}
      </div>
    </div>
  );
}


// ─── DEMO MODE ────────────────────────────────────────────────────────────────

function DemoMode() {
  const [nodes, setNodes] = useState<Node[]>(DEMO_NODES);
  const [edges, setEdges] = useState<Edge[]>(DEMO_EDGES);
  const [code, setCode] = useState(MOCK_CODE_BEFORE);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [agents, setAgents] = useState<AgentsMap>({ code: 'waiting', history: 'waiting', test: 'waiting', reproduce: 'waiting', fix: 'waiting', verification: 'waiting' });
  const [step, setStep] = useState(0);

  const startInvestigation = () => {
    setIsRunning(true);
    setLogs(['[SYSTEM] Investigation Started...']);
    setStep(1);
  };

  useEffect(() => {
    if (!isRunning) return;
    const sequence = async () => {
      await delay(1000);
      setAgents(p => ({ ...p, code: 'working' }));
      setLogs(p => [...p, '[CODE AGENT] Analyzing repository structure...']);

      await delay(2000);
      setNodes(nds => nds.map(n => {
        if (['1', '2', '3', '5'].includes(n.id)) return { ...n, style: { ...n.style, backgroundColor: '#3b82f6', borderColor: '#60a5fa' } };
        return { ...n, style: { ...n.style, opacity: 0.5 } };
      }));
      setEdges(eds => eds.map(e => {
        if (['e1-2', 'e2-3', 'e3-5'].includes(e.id)) return { ...e, animated: true, style: { stroke: '#3b82f6' } };
        return { ...e, style: { opacity: 0.2 } };
      }));
      setLogs(p => [...p, '[CODE AGENT] Discovered execution path Controller → CheckoutService → PaymentService']);
      setAgents(p => ({ ...p, history: 'working' }));

      await delay(1500);
      setAgents(p => ({ ...p, code: 'done', history: 'done', reproduce: 'working' }));
      setLogs(p => [...p, '[HISTORY AGENT] Reviewed last 10 commits. No recent changes to PaymentService.']);
      setLogs(p => [...p, '[REPRODUCE AGENT] Attempting to reproduce issue based on trace...']);
      setStep(3);

      await delay(2000);
      setLogs(p => [...p, '❌ CheckoutRegressionTest FAILED: NullPointerException in PaymentService.java:11']);
      setStep(5);

      await delay(2000);
      setAgents(p => ({ ...p, reproduce: 'done', fix: 'working' }));
      setLogs(p => [...p, '[FIX AGENT] Proposing patch for null check on PaymentResponse']);

      await delay(2000);
      setCode(MOCK_CODE_AFTER);
      setLogs(p => [...p, '[FIX AGENT] Patch applied successfully.']);

      await delay(2000);
      setAgents(p => ({ ...p, fix: 'done', test: 'working', verification: 'working' }));
      setLogs(p => [...p, '✅ CheckoutRegressionTest PASSED']);
      setLogs(p => [...p, '✅ Payment tests PASSED']);
      setLogs(p => [...p, '✅ Integration tests PASSED']);

      await delay(1000);
      setNodes(nds => nds.map(n => {
        if (['1', '2', '3', '5'].includes(n.id)) return { ...n, style: { ...n.style, backgroundColor: '#10b981', borderColor: '#34d399' } };
        return n;
      }));
      setEdges(eds => eds.map(e => {
        if (['e1-2', 'e2-3', 'e3-5'].includes(e.id)) return { ...e, animated: false, style: { stroke: '#10b981' } };
        return e;
      }));
      setAgents(p => ({ ...p, test: 'done', verification: 'done' }));
      setLogs(p => [...p, '[SYSTEM] VERIFIED FIXED.']);
      setStep(10);
    };
    sequence();
  }, [isRunning]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar */}
      <div className="w-80 flex flex-col border-r border-gray-800 bg-[#0b0f19]">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-2">Bug Report</h2>
          <div className="bg-[#111827] p-3 rounded-lg border border-gray-700 text-sm">
            <p className="mb-2 text-gray-300">Checkout occasionally crashes when the payment gateway returns an empty response.</p>
            {!isRunning && (
              <button onClick={startInvestigation} className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded transition-colors">
                <Play size={16} /> Start Investigation
              </button>
            )}
            {isRunning && step < 10 && <p className="mt-2 text-xs text-blue-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/>Investigation running…</p>}
            {step >= 10 && <p className="mt-2 text-xs text-green-400">✓ Bug fixed and verified</p>}
          </div>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-3">Agent Activity</h2>
          <div className="space-y-3">
            <AgentRow name="Code Investigator" icon={<Search size={16} />} state={agents.code} />
            <AgentRow name="History Investigator" icon={<GitCommit size={16} />} state={agents.history} />
            <AgentRow name="Reproduction Agent" icon={<Play size={16} />} state={agents.reproduce} />
            <AgentRow name="Fix Agent" icon={<Code2 size={16} />} state={agents.fix} />
            <AgentRow name="Verification Agent" icon={<ShieldCheck size={16} />} state={agents.verification} />
          </div>
        </div>
      </div>

      {/* Center */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-1/2 border-b border-gray-800 relative bg-[#0b0f19]">
          <div className="absolute top-4 left-4 z-10 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-[#111827] px-2 py-1 rounded shadow">Live Codebase Graph</div>
          <ReactFlow nodes={nodes} edges={edges} fitView className="bg-[#0b0f19]">
            <Background color="#1f2937" gap={16} />
            <Controls className="bg-gray-800 border-gray-700 fill-white" />
          </ReactFlow>
        </div>
        <div className="h-1/2 relative bg-[#111827] flex flex-col">
          <div className="flex items-center px-4 py-2 border-b border-gray-800 bg-[#1f2937]">
            <TerminalSquare size={16} className="text-gray-400 mr-2" />
            <span className="text-sm font-medium text-gray-300">PaymentService.java</span>
          </div>
          <div className="flex-1">
            <Editor height="100%" defaultLanguage="java" theme="vs-dark" value={code} options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 14, padding: { top: 16 } }} />
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-96 flex flex-col border-l border-gray-800 bg-[#0b0f19]">
        <div className="h-1/2 border-b border-gray-800 p-4 flex flex-col">
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-3">Execution Trace</h2>
          <div className="flex-1 overflow-y-auto font-mono text-xs text-gray-300 bg-[#111827] p-3 rounded-lg border border-gray-800">
            {step > 1 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="text-blue-400">POST /checkout</div>
                <div className="pl-2 border-l border-gray-700 ml-1 py-1">
                  <div className={step > 2 ? 'text-gray-300' : 'text-gray-500'}>└─ Controller</div>
                  <div className={step > 2 ? 'text-gray-300' : 'text-gray-500'}>   └─ CheckoutService</div>
                  <div className={step > 2 ? 'text-gray-300' : 'text-gray-500'}>      └─ PaymentService</div>
                  <div className={step > 2 ? 'text-gray-300' : 'text-gray-500'}>         └─ PaymentGateway</div>
                  {step > 4 && step < 10 && <div className="text-red-400 mt-2">💥 NullPointerException</div>}
                  {step >= 10 && <div className="text-green-400 mt-2">✅ Handled Gracefully</div>}
                </div>
              </motion.div>
            )}
            {step <= 1 && <span className="text-gray-600">Waiting for investigation…</span>}
          </div>
        </div>
        <div className="h-1/2 p-4 flex flex-col">
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-3">Terminal</h2>
          <div className="flex-1 overflow-y-auto bg-black rounded-lg p-3 font-mono text-xs border border-gray-800">
            <AnimatePresence>
              {logs.map((log, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  className={`mb-1 ${log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : log.includes('[') ? 'text-blue-300' : 'text-gray-300'}`}>
                  {log}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── REAL REPOSITORY MODE TYPES ───────────────────────────────────────────────

type InvestigationStatus = 'idle' | 'starting' | 'running' | 'completed' | 'error';

interface RealEvent {
  type: string;
  [key: string]: unknown;
}

// ─── REAL REPOSITORY MODE ─────────────────────────────────────────────────────

function RealRepositoryMode() {
  const [url, setUrl] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [stackTrace, setStackTrace] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<InvestigationStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [investigationId, setInvestigationId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [code, setCode] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('plaintext');
  const [activeFile, setActiveFile] = useState('');
  const [highlightLine, setHighlightLine] = useState<number | null>(null);
  const [agents, setAgents] = useState<AgentsMap>({ code: 'waiting', history: 'waiting', test: 'waiting', reproduce: 'waiting', fix: 'waiting', verification: 'waiting' });
  const [rootCause, setRootCause] = useState<{ summary: string; evidence: string[] } | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ passed: boolean; regressionPassed: boolean; totalTests?: number; failedTests?: number; notes?: string } | null>(null);
  const [inferred, setInferred] = useState<string[]>([]);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  const nodeIdCounter = useRef(0);
  const editorRef = useRef<unknown>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const nodeMap = useRef<Map<string, string>>(new Map()); // label → node id

  const [isCheckingBackend, setIsCheckingBackend] = useState(false);

  // Check backend availability
  const checkBackend = useCallback(async () => {
    setIsCheckingBackend(true);
    try {
      const r = await fetch(`${API_BASE}/api/health`);
      setBackendAvailable(r.ok);
    } catch {
      setBackendAvailable(false);
    } finally {
      setIsCheckingBackend(false);
    }
  }, []);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addNode = useCallback((id: string, label: string, kind: string) => {
    const existingId = nodeMap.current.get(label);
    if (existingId) return;
    const nodeId = `r-${nodeIdCounter.current++}`;
    nodeMap.current.set(label, nodeId);

    const x = 100 + (nodeIdCounter.current % 4) * 160;
    const y = 50 + Math.floor(nodeIdCounter.current / 4) * 120;

    const bgColor = kind === 'test' ? '#1e3a2f' : kind === 'class' ? '#1e293b' : '#1f2937';
    const borderColor = kind === 'test' ? '#10b981' : '#374151';

    setNodes(prev => [...prev, {
      id: nodeId,
      position: { x, y },
      data: { label },
      style: { backgroundColor: bgColor, color: '#f3f4f6', border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '10px', fontSize: '12px' },
    }]);
    void id; // suppress unused warning
  }, []);

  const addEdge = useCallback((sourceLabel: string, targetLabel: string, relation: string) => {
    const sourceId = nodeMap.current.get(sourceLabel);
    const targetId = nodeMap.current.get(targetLabel);
    if (!sourceId || !targetId) return;
    const edgeId = `re-${sourceId}-${targetId}`;
    const color = relation === 'calls' ? '#3b82f6' : relation === 'imports' ? '#8b5cf6' : '#4b5563';
    setEdges(prev => {
      if (prev.some(e => e.id === edgeId)) return prev;
      return [...prev, {
        id: edgeId,
        source: sourceId,
        target: targetId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color },
      }];
    });
  }, []);

  const highlightNode = useCallback((label: string, color: string) => {
    const nodeId = nodeMap.current.get(label);
    if (!nodeId) return;
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, style: { ...n.style, backgroundColor: color, borderColor: color === '#ef4444' ? '#fca5a5' : '#34d399' } } : n));
  }, []);

  const processEvent = useCallback((event: RealEvent) => {
    switch (event.type) {
      case 'REPOSITORY_CLONING':
        setLogs(p => [...p, `[GIT] Cloning ${String(event['repository'])}...`]);
        break;
      case 'REPOSITORY_READY':
        setLogs(p => [...p, `[GIT] Ready at commit ${String(event['commit']).slice(0, 8)} (${String(event['branch'])})`]);
        break;
      case 'PROJECT_DETECTED':
        setLogs(p => [...p, `[DETECT] Language: ${String(event['language'])}${event['framework'] ? ` / ${String(event['framework'])}` : ''}${event['testCommand'] ? ` | test: ${String(event['testCommand'])}` : ''}`]);
        break;
      case 'FILE_DISCOVERED':
        setLogs(p => [...p, `[SCAN] ${String(event['file'])}`]);
        break;
      case 'NODE_DISCOVERED':
        addNode(String(event['id']), String(event['label']), String(event['kind']));
        break;
      case 'EDGE_DISCOVERED':
        addEdge(String(event['source']), String(event['target']), String(event['relation']));
        break;
      case 'AGENT_STARTED': {
        const agent = String(event['agent']);
        setLogs(p => [...p, `[AGENT] ${agent} started`]);
        if (agent.toLowerCase().includes('code')) setAgents(p => ({ ...p, code: 'working' }));
        else if (agent.toLowerCase().includes('history')) setAgents(p => ({ ...p, history: 'working' }));
        else if (agent.toLowerCase().includes('test')) setAgents(p => ({ ...p, test: 'working' }));
        else if (agent.toLowerCase().includes('repro')) setAgents(p => ({ ...p, reproduce: 'working' }));
        else if (agent.toLowerCase().includes('fix')) setAgents(p => ({ ...p, fix: 'working' }));
        else if (agent.toLowerCase().includes('verif')) setAgents(p => ({ ...p, verification: 'working' }));
        break;
      }
      case 'AGENT_COMPLETED': {
        const agent = String(event['agent']);
        setLogs(p => [...p, `[AGENT] ${agent} ✓${event['summary'] ? ` — ${String(event['summary'])}` : ''}`]);
        if (agent.toLowerCase().includes('code')) setAgents(p => ({ ...p, code: 'done' }));
        else if (agent.toLowerCase().includes('history')) setAgents(p => ({ ...p, history: 'done' }));
        else if (agent.toLowerCase().includes('test')) setAgents(p => ({ ...p, test: 'done' }));
        else if (agent.toLowerCase().includes('repro')) setAgents(p => ({ ...p, reproduce: 'done' }));
        else if (agent.toLowerCase().includes('fix')) setAgents(p => ({ ...p, fix: 'done' }));
        else if (agent.toLowerCase().includes('verif')) setAgents(p => ({ ...p, verification: 'done' }));
        break;
      }
      case 'AGENT_ERROR': {
        const agent = String(event['agent']);
        if (agent.toLowerCase().includes('code')) setAgents(p => ({ ...p, code: 'error' }));
        else if (agent.toLowerCase().includes('test')) setAgents(p => ({ ...p, test: 'error' }));
        break;
      }
      case 'FILE_OPENED': {
        const file = String(event['file']);
        const content = event['content'] ? String(event['content']) : '';
        const lang = event['language'] ? String(event['language']) : 'plaintext';
        setActiveFile(file);
        if (content) { setCode(content); setCodeLanguage(lang); }
        setLogs(p => [...p, `[OPEN] ${file}`]);
        break;
      }
      case 'CODE_HIGHLIGHT': {
        const line = Number(event['line']);
        setHighlightLine(line);
        setLogs(p => [...p, `[HIGHLIGHT] ${String(event['file'])}:${line}${event['reason'] ? ` — ${String(event['reason'])}` : ''}`]);
        break;
      }
      case 'TEST_STARTED':
        setLogs(p => [...p, `[TEST] Running: ${String(event['command'])}`]);
        setAgents(p => ({ ...p, test: 'working' }));
        break;
      case 'TEST_OUTPUT':
        setLogs(p => [...p, String(event['output'])]);
        break;
      case 'TEST_FAILED': {
        const testName = event['test'] ? `${String(event['test'])}: ` : '';
        setLogs(p => [...p, `❌ ${testName}${String(event['error'])}`]);
        if (event['file']) highlightNode(String(event['file']).replace(/\.java$/, ''), '#ef4444');
        break;
      }
      case 'TEST_PASSED':
        setLogs(p => [...p, `✅ ${String(event['test'])}`]);
        break;
      case 'NO_TESTS_FOUND':
        setLogs(p => [...p, `⚠ ${String(event['message'])}`]);
        break;
      case 'ALL_TESTS_PASS':
        setLogs(p => [...p, `✅ ${String(event['message'])}`]);
        break;
      case 'BUG_LOCATION_FOUND':
        setLogs(p => [...p, `🔍 Bug found: ${String(event['file'])}:${String(event['line'])} — ${String(event['reason'])}`]);
        highlightNode(String(event['file']).replace(/\.\w+$/, ''), '#ef4444');
        break;
      case 'ROOT_CAUSE_FOUND': {
        const evidence = (event['evidence'] as string[] | undefined) ?? [];
        setRootCause({ summary: String(event['summary']), evidence });
        setLogs(p => [...p, `🔬 ROOT CAUSE: ${String(event['summary'])}`]);
        break;
      }
      case 'INFERRED_CODE_PATH':
        setInferred(p => [...p, String(event['description'])]);
        setLogs(p => [...p, `⚠ INFERRED: ${String(event['description'])}`]);
        break;
      case 'PATCH_PROPOSED': {
        const d = event['diff'] ? String(event['diff']) : null;
        if (d) setDiff(d);
        setLogs(p => [...p, `[PATCH] Proposed for: ${(event['files'] as string[] | undefined ?? []).join(', ')}`]);
        break;
      }
      case 'PATCH_APPLIED': {
        setLogs(p => [...p, `✅ Patch applied to: ${(event['files'] as string[] | undefined ?? []).join(', ')}`]);
        // Update graph: highlight fixed nodes green
        setNodes(prev => prev.map(n => {
          const files = event['files'] as string[] | undefined ?? [];
          if (files.some(f => n.data.label === f.replace(/\.\w+$/, '') || f.toLowerCase().includes(String(n.data.label).toLowerCase()))) {
            return { ...n, style: { ...n.style, backgroundColor: '#10b981', borderColor: '#34d399' } };
          }
          return n;
        }));
        break;
      }
      case 'PATCH_FAILED':
        setLogs(p => [...p, `❌ Patch failed: ${String(event['reason'])}`]);
        break;
      case 'VERIFICATION_STARTED':
        setLogs(p => [...p, '[VERIFY] Running verification suite...']);
        setAgents(p => ({ ...p, verification: 'working' }));
        break;
      case 'VERIFICATION_RESULT': {
        const r = event as unknown as { passed: boolean; regressionPassed: boolean; totalTests?: number; failedTests?: number; notes?: string };
        setVerificationResult({ passed: r.passed, regressionPassed: r.regressionPassed, totalTests: r.totalTests, failedTests: r.failedTests, notes: r.notes });
        setLogs(p => [...p, r.passed ? '✅ Verification PASSED' : `⚠ Verification: ${r.notes ?? 'Some tests failing'}`]);
        break;
      }
      case 'INVESTIGATION_LOG': {
        const level = String(event['level'] ?? 'info');
        const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠' : '▸';
        setLogs(p => [...p, `${prefix} ${String(event['message'])}`]);
        break;
      }
      case 'INVESTIGATION_COMPLETED': {
        const success = Boolean(event['success']);
        setStatus(success ? 'completed' : 'error');
        setLogs(p => [...p, success ? `✅ Investigation complete.${event['summary'] ? ` ${String(event['summary'])}` : ''}` : `❌ Investigation ended.${event['summary'] ? ` ${String(event['summary'])}` : ''}`]);
        // Finalize graph colors
        setNodes(prev => prev.map(n => ({ ...n, style: { ...n.style, opacity: 1 } })));
        break;
      }
      case 'INVESTIGATION_ERROR':
        setErrorMsg(String(event['message']));
        setStatus('error');
        setLogs(p => [...p, `❌ ${String(event['message'])}`]);
        break;
    }
  }, [addNode, addEdge, highlightNode]);

  const startInvestigation = async () => {
    if (!url.trim()) return;
    setStatus('starting');
    setErrorMsg('');
    setLogs([]);
    setNodes([]);
    setEdges([]);
    setCode('');
    setActiveFile('');
    setHighlightLine(null);
    setAgents({ code: 'waiting', history: 'waiting', test: 'waiting', reproduce: 'waiting', fix: 'waiting', verification: 'waiting' });
    setRootCause(null);
    setDiff(null);
    setVerificationResult(null);
    setInferred([]);
    nodeIdCounter.current = 0;
    nodeMap.current = new Map();

    try {
      const res = await fetch(`${API_BASE}/api/investigation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryUrl: url, bugDescription: bugDescription || undefined, stackTrace: stackTrace || undefined }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setErrorMsg(body.error ?? 'Failed to start investigation.');
        setStatus('error');
        return;
      }

      const body = await res.json() as { investigationId: string };
      setInvestigationId(body.investigationId);
      setStatus('running');
      setLogs(['[SYSTEM] Investigation started...']);

      // Open SSE stream
      const es = new EventSource(`${API_BASE}/api/investigation/${body.investigationId}/events`);
      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data as string) as RealEvent;
          processEvent(event);
          if (event.type === 'INVESTIGATION_COMPLETED' || event.type === 'INVESTIGATION_ERROR') {
            es.close();
          }
        } catch { /* ok */ }
      };
      es.onerror = () => {
        es.close();
        setStatus(prev => prev === 'running' ? 'error' : prev);
      };
    } catch (e) {
      setErrorMsg(`Network error: ${String(e)}`);
      setStatus('error');
    }
  };

  void investigationId; // used in url display only
  void highlightLine;   // used by editor effect below

  // Decorate highlighted line in Monaco
  const handleEditorMount = (editor: unknown) => { editorRef.current = editor; };

  useEffect(() => {
    if (!editorRef.current || highlightLine === null) return;
    const editor = editorRef.current as { revealLineInCenter: (line: number) => void };
    editor.revealLineInCenter(highlightLine);
  }, [highlightLine]);

  if (backendAvailable === false) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-lg bg-[#111827] border border-gray-800 rounded-xl p-8 shadow-xl">
          <AlertCircle size={44} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Backend Unavailable</h2>
          <p className="text-gray-300 text-sm mb-3">
            Could not connect to the ReproForge backend at:
          </p>
          <div className="bg-[#0b0f19] border border-gray-800 rounded px-3 py-2 text-xs font-mono text-blue-400 break-all mb-4">
            {API_BASE ? `${API_BASE}/api/health` : `${window.location.origin}/api/health (VITE_API_URL not baked into build)`}
          </div>
          <p className="text-gray-400 text-xs mb-6">
            If hosted on Render Free Tier, the backend service spins down after inactivity and can take 40–60 seconds to wake up on the first request.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={checkBackend}
              disabled={isCheckingBackend}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-sm font-medium flex items-center gap-2 transition"
            >
              {isCheckingBackend ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
              {isCheckingBackend ? 'Connecting...' : 'Retry Connection'}
            </button>
            <button
              onClick={() => setBackendAvailable(true)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm font-medium transition"
            >
              Continue Anyway
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isRunning = status === 'running' || status === 'starting';

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar */}
      <div className="w-80 flex flex-col border-r border-gray-800 bg-[#0b0f19]">
        <div className="p-4 border-b border-gray-800 overflow-y-auto">
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-3 flex items-center gap-2"><GitBranch size={14}/>Repository Analysis</h2>

          {status === 'idle' || status === 'error' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">GitHub Repository URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  className="w-full bg-[#111827] border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  onKeyDown={e => e.key === 'Enter' && !isRunning && startInvestigation()}
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(p => !p)}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                >
                  <ChevronRight size={12} className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                  Optional details
                </button>
                {showAdvanced && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Bug Description</label>
                      <textarea
                        value={bugDescription}
                        onChange={e => setBugDescription(e.target.value)}
                        placeholder="Users receive HTTP 500 during checkout."
                        rows={2}
                        className="w-full bg-[#111827] border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Stack Trace</label>
                      <textarea
                        value={stackTrace}
                        onChange={e => setStackTrace(e.target.value)}
                        placeholder="NullPointerException at PaymentService.java:184"
                        rows={3}
                        className="w-full bg-[#111827] border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500 resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="bg-red-900/30 border border-red-800 rounded p-2 text-xs text-red-300">
                  <AlertCircle size={12} className="inline mr-1" />{errorMsg}
                </div>
              )}

              <button
                onClick={startInvestigation}
                disabled={!url.trim()}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded transition-colors text-sm font-medium"
              >
                <Search size={16} /> Analyze Repository
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="bg-[#111827] rounded p-2 border border-gray-700">
                <div className="text-gray-400">Repository</div>
                <div className="text-blue-400 font-mono break-all">{url}</div>
              </div>
              {isRunning && (
                <div className="flex items-center gap-2 text-blue-400">
                  <Loader2 size={14} className="animate-spin" /> Investigating…
                </div>
              )}
              {status === 'completed' && <div className="flex items-center gap-2 text-green-400"><CheckCircle2 size={14}/>Complete</div>}
            </div>
          )}
        </div>

        {/* Agent activity */}
        <div className="p-4 flex-1 overflow-y-auto">
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-3">Agent Activity</h2>
          <div className="space-y-3">
            <AgentRow name="Code Investigator" icon={<Search size={16} />} state={agents.code} />
            <AgentRow name="History Investigator" icon={<GitCommit size={16} />} state={agents.history} />
            <AgentRow name="Test Investigator" icon={<Play size={16} />} state={agents.test} />
            <AgentRow name="Reproduction Agent" icon={<Code2 size={16} />} state={agents.reproduce} />
            <AgentRow name="Fix Agent" icon={<Code2 size={16} />} state={agents.fix} />
            <AgentRow name="Verification Agent" icon={<ShieldCheck size={16} />} state={agents.verification} />
          </div>

          {/* Root cause */}
          {rootCause && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 bg-red-950/40 border border-red-900 rounded-lg p-3">
              <div className="text-xs font-bold text-red-400 uppercase mb-1">Root Cause</div>
              <div className="text-xs text-gray-200">{rootCause.summary}</div>
              {rootCause.evidence.length > 0 && (
                <div className="mt-2 space-y-1">
                  {rootCause.evidence.map((e, i) => <div key={i} className="text-xs text-gray-400">✓ {e}</div>)}
                </div>
              )}
            </motion.div>
          )}

          {/* Inferred path warnings */}
          {inferred.length > 0 && (
            <div className="mt-3 bg-yellow-950/30 border border-yellow-900 rounded p-2">
              <div className="text-xs font-bold text-yellow-400 uppercase mb-1">⚠ Inferred (not runtime)</div>
              {inferred.map((s, i) => <div key={i} className="text-xs text-yellow-200">{s}</div>)}
            </div>
          )}

          {/* Verification result */}
          {verificationResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mt-3 rounded-lg p-3 border ${verificationResult.passed ? 'bg-green-950/40 border-green-900' : 'bg-yellow-950/40 border-yellow-900'}`}>
              <div className={`text-xs font-bold uppercase mb-1 ${verificationResult.passed ? 'text-green-400' : 'text-yellow-400'}`}>Verification</div>
              <div className={`text-sm font-medium ${verificationResult.passed ? 'text-green-300' : 'text-yellow-300'}`}>
                {verificationResult.passed ? '✅ ALL TESTS PASSED' : '⚠ PARTIALLY VERIFIED'}
              </div>
              {verificationResult.totalTests !== undefined && (
                <div className="text-xs text-gray-400 mt-1">{verificationResult.totalTests} total, {verificationResult.failedTests ?? 0} failed</div>
              )}
              {verificationResult.notes && <div className="text-xs text-gray-400 mt-1">{verificationResult.notes}</div>}
            </motion.div>
          )}
        </div>
      </div>

      {/* Center — graph + editor */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-1/2 border-b border-gray-800 relative bg-[#0b0f19]">
          <div className="absolute top-4 left-4 z-10 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-[#111827] px-2 py-1 rounded shadow">
            Repository Graph {nodes.length > 0 && <span className="ml-1 text-blue-400">{nodes.length} nodes</span>}
          </div>
          {nodes.length === 0 && status === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-700 text-sm">
              Graph will appear as repository is analyzed
            </div>
          )}
          {nodes.length === 0 && isRunning && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
              <Loader2 size={20} className="animate-spin mr-2" /> Scanning repository…
            </div>
          )}
          <ReactFlow nodes={nodes} edges={edges} fitView className="bg-[#0b0f19]">
            <Background color="#1f2937" gap={16} />
            <Controls className="bg-gray-800 border-gray-700 fill-white" />
          </ReactFlow>
        </div>

        <div className="h-1/2 relative bg-[#111827] flex flex-col">
          <div className="flex items-center px-4 py-2 border-b border-gray-800 bg-[#1f2937] min-h-[36px]">
            <TerminalSquare size={16} className="text-gray-400 mr-2 shrink-0" />
            <span className="text-sm font-medium text-gray-300 truncate">{activeFile || (status === 'idle' ? 'No file open' : 'Waiting for file…')}</span>
            {diff && (
              <span className="ml-auto text-xs text-yellow-400 flex items-center gap-1 shrink-0"><Code2 size={12}/>Diff available</span>
            )}
          </div>
          <div className="flex-1">
            {diff ? (
              <Editor
                key="diff"
                height="100%"
                defaultLanguage="diff"
                theme="vs-dark"
                value={diff}
                options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, padding: { top: 16 } }}
                onMount={handleEditorMount}
              />
            ) : code ? (
              <Editor
                key={activeFile}
                height="100%"
                language={codeLanguage}
                theme="vs-dark"
                value={code}
                options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, padding: { top: 16 } }}
                onMount={handleEditorMount}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-700 text-sm bg-[#0d1117]">
                {isRunning ? 'File content will appear here…' : 'Start investigation to view files'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right sidebar — terminal */}
      <div className="w-96 flex flex-col border-l border-gray-800 bg-[#0b0f19]">
        <div className="p-4 flex flex-col h-full">
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-3 shrink-0">Investigation Log</h2>
          <div className="flex-1 overflow-y-auto bg-black rounded-lg p-3 font-mono text-xs border border-gray-800">
            {logs.length === 0 && <span className="text-gray-600">Logs will appear here…</span>}
            <AnimatePresence>
              {logs.map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`mb-0.5 break-all ${log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : log.includes('⚠') ? 'text-yellow-400' : log.includes('[') ? 'text-blue-300' : 'text-gray-400'}`}
                >
                  {log}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

type AppMode = 'demo' | 'real';

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

export default function App() {
  const [mode, setMode] = useState<AppMode>('demo');

  return (
    <div className="flex flex-col h-screen bg-[#0b0f19] text-gray-100 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-[#111827] shrink-0">
        <div className="flex items-center space-x-3">
          <Activity className="text-blue-500 shrink-0" size={22} />
          <h1 className="text-lg font-bold tracking-tight text-white">ReproForge Visual</h1>
        </div>

        {/* Mode switcher */}
        <div className="flex items-center bg-[#0b0f19] rounded-lg p-1 border border-gray-800">
          <button
            onClick={() => setMode('demo')}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${mode === 'demo' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Demo Mode
          </button>
          <button
            onClick={() => setMode('real')}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${mode === 'real' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <GitBranch size={14} /> Real Repository
          </button>
        </div>
      </header>

      {/* Mode banner */}
      <div className={`px-6 py-1 text-xs font-medium border-b border-gray-800 ${mode === 'demo' ? 'bg-blue-950/40 text-blue-300' : 'bg-purple-950/40 text-purple-300'}`}>
        {mode === 'demo' ? '🎭 Demo Mode — simulated investigation of a mock payment service bug' : '🔬 Real Repository Mode — live GitHub repository analysis'}
      </div>

      {mode === 'demo' ? <DemoMode /> : <RealRepositoryMode />}
    </div>
  );
}
