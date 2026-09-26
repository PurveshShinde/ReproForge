"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gitService_1 = require("../services/gitService");
const investigationOrchestrator_1 = require("../agents/investigationOrchestrator");
const eventBus_1 = require("../events/eventBus");
const router = (0, express_1.Router)();
// POST /api/investigation — start a new investigation
router.post('/', async (req, res) => {
    const { repositoryUrl, bugDescription, stackTrace } = req.body;
    if (!repositoryUrl || typeof repositoryUrl !== 'string') {
        res.status(400).json({ error: 'repositoryUrl is required.' });
        return;
    }
    const validation = (0, gitService_1.validateGitHubUrl)(repositoryUrl);
    if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
    }
    const { id, error } = (0, investigationOrchestrator_1.createSession)(repositoryUrl, bugDescription, stackTrace);
    if (error || !id) {
        res.status(400).json({ error: error ?? 'Failed to create session.' });
        return;
    }
    res.status(201).json({ investigationId: id });
    // Run investigation asynchronously
    (0, investigationOrchestrator_1.runInvestigation)(id).catch((e) => {
        console.error('Investigation error:', e);
    });
});
// GET /api/investigation/:id — session status
router.get('/:id', (req, res) => {
    const session = (0, investigationOrchestrator_1.getSession)(req.params['id'] ?? '');
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
router.get('/:id/events', (req, res) => {
    const id = req.params['id'] ?? '';
    const session = (0, investigationOrchestrator_1.getSession)(id);
    if (!session) {
        res.status(404).json({ error: 'Investigation not found.' });
        return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    const sendEvent = (event) => {
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
    const listener = (event) => {
        sendEvent(event);
        const typed = event;
        if (typed.type === 'INVESTIGATION_COMPLETED' || typed.type === 'INVESTIGATION_ERROR') {
            cleanup();
            res.end();
        }
    };
    eventBus_1.eventBus.on(id, listener);
    const keepAlive = setInterval(() => {
        res.write(': keepalive\n\n');
    }, 15000);
    const cleanup = () => {
        eventBus_1.eventBus.off(id, listener);
        clearInterval(keepAlive);
    };
    req.on('close', cleanup);
});
exports.default = router;
//# sourceMappingURL=investigation.js.map