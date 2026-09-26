import type { Router, Request, Response } from 'express';
import { Router as createRouter } from 'express';
import { validateGitHubUrl } from '../services/gitService';
import { createSession, runInvestigation, getSession } from '../agents/investigationOrchestrator';
import { eventBus } from '../events/eventBus';

const router: Router = createRouter();

// POST /api/investigation — start a new investigation
router.post('/', async (req: Request, res: Response) => {
  const { repositoryUrl, bugDescription, stackTrace } = req.body as {
    repositoryUrl?: string;
    bugDescription?: string;
    stackTrace?: string;
  };

  if (!repositoryUrl || typeof repositoryUrl !== 'string') {
    res.status(400).json({ error: 'repositoryUrl is required.' });
    return;
  }

  const validation = validateGitHubUrl(repositoryUrl);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const { id, error } = createSession(repositoryUrl, bugDescription, stackTrace);
  if (error || !id) {
    res.status(400).json({ error: error ?? 'Failed to create session.' });
    return;
  }

  res.status(201).json({ investigationId: id });

  // Run investigation asynchronously
  runInvestigation(id).catch((e) => {
    console.error('Investigation error:', e);
  });
});

// GET /api/investigation/:id — session status
router.get('/:id', (req: Request, res: Response) => {
  const session = getSession(req.params['id'] ?? '');
  if (!session) {
    res.status(404).json({ error: 'Investigation not found.' });
    return;
  }
  res.json({
    id: session.id,
    status: session.status,
    repositoryUrl: session.repositoryUrl,
    language: session.language,
    framework: session.framework,
    commit: session.commit,
    createdAt: session.createdAt,
    eventCount: session.events.length,
  });
});

// GET /api/investigation/:id/events — SSE stream
router.get('/:id/events', (req: Request, res: Response) => {
  const id = req.params['id'] ?? '';
  const session = getSession(id);
  if (!session) {
    res.status(404).json({ error: 'Investigation not found.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const sendEvent = (event: object) => {
    const data = JSON.stringify(event);
    res.write(`data: ${data}\n\n`);
  };

  // Replay already-recorded events
  for (const event of session.events) {
    sendEvent(event);
  }

  // If already completed, close immediately
  if (session.status === 'completed' || session.status === 'error') {
    res.end();
    return;
  }

  // Subscribe to future events
  const listener = (event: object) => {
    sendEvent(event);
    const typed = event as { type: string };
    if (typed.type === 'INVESTIGATION_COMPLETED' || typed.type === 'INVESTIGATION_ERROR') {
      cleanup();
      res.end();
    }
  };

  eventBus.on(id, listener);

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  const cleanup = () => {
    eventBus.off(id, listener);
    clearInterval(keepAlive);
  };

  req.on('close', cleanup);
});

export default router;
